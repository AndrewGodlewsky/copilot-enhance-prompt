// Files attached to a prompt in the panel: pasted, dropped or picked there, they have no path on
// disk, so the panel sends their bytes in chunks and they are kept in a folder of their own under the
// system's temporary folder. A run reads only files of that folder: images are shown to models that
// read images (src/images.ts), text goes in the context, and every attachment is listed by its path
// so the agent can open it.
import { lstat, mkdir, open, readdir, realpath, rename, rmdir, unlink, type FileHandle } from 'node:fs/promises'
import { constants, type BigIntStats } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import lockfile from 'proper-lockfile'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { MAX_ATTACHMENT_BYTES, MAX_CHUNK_BASE64, MAX_IMAGE_BYTES, MAX_IMAGES, sizeOver } from './image-limits.ts'
import { megabytes, sniffImage, type ImageData } from './images.ts'
import { LlmError } from './llm.ts'
import { msg } from './messages.ts'

/**
 * Where attachments are kept; removed after a day. Under the test runner (Node sets
 * NODE_TEST_CONTEXT in a test's process) it is a folder of that test file's own, so a test never
 * writes into, or deletes, the folder that holds what a person attached in the real panel.
 */
export const ATTACHMENTS_DIR = join(tmpdir(), `enhance-prompt-attachments${process.env.NODE_TEST_CONTEXT ? `-test-${process.pid}` : ''}`)
/** An attachment can be at most MAX_ATTACHMENT_BYTES. */
export { MAX_ATTACHMENT_BYTES }
/** How many characters of an attached text file go in the context (see `excerpt`). */
export const TEXT_MAX = 20_000
const DAY_MS = 24 * 3600_000
const RECEIPT = '.upload.json'
type Upload = { owner: string; name: string; next: number; total: number; bytes: number; size?: number; dev: string; ino: string }
const bad = () => new LlmError(msg('error.attachment_bad'), 'invalid_params')
const ownerKey = (owner: string) => { if (!owner) throw bad(); return createHash('sha256').update(owner).digest('hex') }
const validId = (id: string) => /^[a-z0-9-]{6,40}$/.test(id)

/** Refuse links at each owned boundary, including a replaced temporary root. */
async function directory(path: string): Promise<void> {
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw bad()
  const expected = join(await realpath(tmpdir()), relative(tmpdir(), path))
  if (await realpath(path) !== expected) throw bad()
}

async function uploadDirectory(id: string): Promise<string> {
  if (!validId(id)) throw bad()
  await directory(ATTACHMENTS_DIR)
  const dir = join(ATTACHMENTS_DIR, id)
  await directory(dir)
  return dir
}

/** Hold one verified inode for the complete read/write; never reopen by its submitted path. */
async function verifiedFile(path: string, writable = false): Promise<{ file: FileHandle; info: BigIntStats }> {
  const before = await lstat(path, { bigint: true })
  const expected = join(await realpath(tmpdir()), relative(tmpdir(), path))
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || await realpath(path) !== expected) throw bad()
  const file = await open(path, (writable ? constants.O_RDWR : constants.O_RDONLY) | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = await file.stat({ bigint: true })
    if (!info.isFile() || info.nlink !== 1n || info.dev !== before.dev || info.ino !== before.ino) throw bad()
    await directory(dirname(path))
    return { file, info }
  } catch (error) { await file.close(); throw error }
}

async function receipt(dir: string): Promise<Upload> {
  const { file, info } = await verifiedFile(join(dir, RECEIPT))
  try {
    if (info.size > 4096) throw bad()
    const bytes = Buffer.alloc(4097)
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0)
    if (BigInt(bytesRead) !== info.size) throw bad()
    const value = JSON.parse(bytes.subarray(0, bytesRead).toString('utf8')) as Upload
    if (!value || !/^[a-f0-9]{64}$/.test(value.owner) || typeof value.name !== 'string' || value.name !== safeName(value.name) || value.name === RECEIPT ||
        !Number.isSafeInteger(value.next) || !Number.isSafeInteger(value.total) || value.next < 0 || value.next > value.total || value.total < 1 ||
        !Number.isSafeInteger(value.bytes) || value.bytes < 0 || value.bytes > MAX_ATTACHMENT_BYTES || !/^\d{1,40}$/.test(value.dev) || !/^\d{1,40}$/.test(value.ino)) throw bad()
    return value
  } finally { await file.close() }
}

async function saveReceipt(dir: string, value: Upload): Promise<void> {
  await directory(dir)
  const temporary = join(dir, `.upload-${randomUUID()}.tmp`)
  const file = await open(temporary, 'wx', 0o600)
  try { await file.writeFile(JSON.stringify(value)); await file.sync() } finally { await file.close() }
  try { await directory(dir); await rename(temporary, join(dir, RECEIPT)) }
  finally { await unlink(temporary).catch(() => {}) }
}

async function locked<T>(id: string, operation: (dir: string) => Promise<T>): Promise<T> {
  const dir = await uploadDirectory(id)
  const release = await lockfile.lock(dir, { realpath: false, retries: { retries: 20, minTimeout: 10, maxTimeout: 100 } })
  try { await uploadDirectory(id); return await operation(dir) } finally { await release() }
}

function pathParts(path: string): { id: string; name: string } {
  if (typeof path !== 'string' || resolve(path) !== path) throw bad()
  const parts = relative(ATTACHMENTS_DIR, path).split(/[\\/]/)
  if (parts.length !== 2 || !validId(parts[0]) || parts[1] !== safeName(parts[1]) || parts[1] === RECEIPT) throw bad()
  return { id: parts[0], name: parts[1] }
}

function matches(info: BigIntStats, upload: Upload): boolean {
  return info.dev.toString() === upload.dev && info.ino.toString() === upload.ino && info.size === BigInt(upload.bytes)
}

/** A file name safe on every system, its extension kept. */
export function safeName(name: string): string {
  const cleaned = basename(name).replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/^[. ]+/, '').trim().slice(0, 120).trim()
  return cleaned === RECEIPT || cleaned.startsWith('.upload-') ? `file-${cleaned}` : cleaned || 'file'
}

/**
 * Adds one chunk (base64) of an attachment. Chunks come in order; the last one answers with the file's
 * path. Refuses an id that is not ours or a file past MAX_ATTACHMENT_BYTES.
 */
export async function putChunk(input: { id: string; name: string; index: number; total: number; data: string; size?: number }, owner: string): Promise<{ path: string; bytes: number } | { received: number }> {
  const key = ownerKey(owner)
  if (!/^[a-z0-9-]{6,40}$/.test(input.id)) throw new LlmError(msg('error.attachment_bad'), 'invalid_params')
  // One piece must fit in a panel request (64 KiB): the panel cuts files at ATTACHMENT_CHUNK_BYTES.
  if (typeof input.data !== 'string' || input.data.length > MAX_CHUNK_BASE64) throw new LlmError(msg('error.attachment_bad'), 'invalid_params')
  // The whole size, when the panel says it on the first piece: refused before anything is written.
  if (input.index === 0 && typeof input.size === 'number' && input.size > MAX_ATTACHMENT_BYTES) {
    throw new LlmError(msg('error.file_too_large', { name: safeName(input.name), size: sizeOver(input.size, MAX_ATTACHMENT_BYTES), max: megabytes(MAX_ATTACHMENT_BYTES) }), 'too_large')
  }
  if (!Number.isSafeInteger(input.index) || !Number.isSafeInteger(input.total) || input.index < 0 || input.index >= input.total) {
    throw new LlmError(msg('error.attachment_bad'), 'invalid_params')
  }
  const dir = join(ATTACHMENTS_DIR, input.id)
  const path = join(dir, safeName(input.name))
  const bytes = Buffer.from(input.data, 'base64')
  if (bytes.toString('base64') !== input.data || (input.size !== undefined && (!Number.isSafeInteger(input.size) || input.size < 0))) throw bad()
  if (input.index === 0) {
    await mkdir(ATTACHMENTS_DIR, { recursive: true, mode: 0o700 })
    await directory(ATTACHMENTS_DIR)
    // Never delete/replace a caller-selected existing directory, including a previous upload.
    try { await mkdir(dir, { mode: 0o700 }) } catch { throw bad() }
    await uploadDirectory(input.id)
    const file = await open(path, 'wx', 0o600)
    try {
      const info = await file.stat({ bigint: true })
      await saveReceipt(dir, { owner: key, name: safeName(input.name), next: 0, total: input.total, bytes: 0,
        ...(input.size !== undefined ? { size: input.size } : {}), dev: info.dev.toString(), ino: info.ino.toString() })
    } finally { await file.close() }
  }
  return locked(input.id, async dir => {
    const upload = await receipt(dir)
    if (upload.owner !== key || upload.name !== safeName(input.name) || upload.total !== input.total || upload.next !== input.index) throw bad()
    const after = upload.bytes + bytes.length
    if (after > MAX_ATTACHMENT_BYTES) throw new LlmError(msg('error.file_too_large', { name: upload.name, size: sizeOver(after, MAX_ATTACHMENT_BYTES), max: megabytes(MAX_ATTACHMENT_BYTES) }), 'too_large')
    if (upload.size !== undefined && (after > upload.size || (input.index === input.total - 1 && after !== upload.size))) throw bad()
    const { file, info } = await verifiedFile(path, true)
    try {
      if (!matches(info, upload)) throw bad()
      let written = 0
      while (written < bytes.length) {
        const result = await file.write(bytes, written, bytes.length - written, upload.bytes + written)
        if (!result.bytesWritten) throw bad()
        written += result.bytesWritten
      }
      await file.sync()
    } finally { await file.close() }
    await saveReceipt(dir, { ...upload, next: input.index + 1, bytes: after })
    return input.index < input.total - 1 ? { received: after } : { path, bytes: after }
  }).catch(error => { if (error instanceof LlmError) throw error; throw bad() })
}

/**
 * Removes attachments older than a day. Called when the worker starts and whenever a new file
 * arrives: a worker can run for days, and "removed after a day" must not wait for its next start.
 */
export async function cleanAttachments(now = Date.now()): Promise<void> {
  try { await directory(ATTACHMENTS_DIR) } catch { return }
  const entries = await readdir(ATTACHMENTS_DIR).catch(() => [] as string[])
  for (const entry of entries) {
    if (!validId(entry)) continue
    const removed = await locked(entry, async dir => {
      const info = await lstat(dir)
      if (now - info.mtimeMs <= DAY_MS) return false
      await removeOwned(dir)
      return true
    }).catch(() => false)
    if (removed) await rmdir(join(ATTACHMENTS_DIR, entry)).catch(() => {})
  }
}

async function removeOwned(dir: string): Promise<void> {
  const upload = await receipt(dir)
  const path = join(dir, upload.name)
  const { file, info } = await verifiedFile(path)
  // A crash after writing bytes but before saving the receipt still leaves our inode.
  // Reading requires the exact byte count; deleting that owned copy does not.
  try { if (info.dev.toString() !== upload.dev || info.ino.toString() !== upload.ino) throw bad() } finally { await file.close() }
  await uploadDirectory(basename(dir))
  await unlink(path)
  await unlink(join(dir, RECEIPT))
}

/** Removes every attachment now ("Delete everything"). */
export async function clearAttachments(): Promise<void> {
  await cleanAttachments(Number.MAX_SAFE_INTEGER)
  // Leave unregistered data and links alone. Never recursively delete an untrusted tree.
  try { await directory(ATTACHMENTS_DIR); await rmdir(ATTACHMENTS_DIR) } catch { /* Nonempty or unsafe roots stay untouched. */ }
}

export type LoadedFiles = {
  /** Image files among them, for models that read images. */
  images: ImageData[]
  /** Text files: their content goes in the context, a long one as an excerpt (`cut` characters left out). */
  texts: { path: string; name: string; content: string; cut: number }[]
  /** Every attached file, by path, for the agent. */
  paths: string[]
}

/** One-time upgrade: only exact paths restored from this session's already-saved drafts. */
export async function restoreAttachments(paths: readonly string[], owner: string): Promise<void> {
  const key = ownerKey(owner)
  for (const path of paths) {
    try {
      const { id, name } = pathParts(path)
      await locked(id, async dir => {
        if (await lstat(join(dir, RECEIPT)).catch(() => null)) return
        const { file, info } = await verifiedFile(path)
        try {
          if (info.size > MAX_ATTACHMENT_BYTES) throw bad()
          await saveReceipt(dir, { owner: key, name, next: 1, total: 1, bytes: Number(info.size), dev: info.dev.toString(), ino: info.ino.toString() })
        } finally { await file.close() }
      })
    } catch { /* Unsafe/missing old attachments stay visible so the user can reattach them. */ }
  }
}

/**
 * A long text as its beginning and its end, with a line between them saying how much was left out:
 * a config's or a source file's shape is at its beginning, a log's cause at its end, and the agent
 * can open the whole file by its path. Cuts fall on a line break when one is near, and never inside
 * a surrogate pair. `cut` is how many characters were left out (0: the text is whole).
 */
export function excerpt(text: string, max = TEXT_MAX): { text: string; cut: number } {
  if (text.length <= max) return { text, cut: 0 }
  const headMax = Math.floor(max * 0.6)
  let head = text.slice(0, headMax)
  let tail = text.slice(text.length - (max - headMax))
  // On a line break, when there is one in the last fifth of the beginning (the first fifth of the end).
  const lineEnd = head.lastIndexOf('\n')
  if (lineEnd >= head.length * 0.8) head = head.slice(0, lineEnd)
  const lineStart = tail.indexOf('\n')
  if (lineStart !== -1 && lineStart < tail.length * 0.2) tail = tail.slice(lineStart + 1)
  if (/[\uD800-\uDBFF]$/.test(head)) head = head.slice(0, -1)
  if (/^[\uDC00-\uDFFF]/.test(tail)) tail = tail.slice(1)
  const cut = text.length - head.length - tail.length
  return { text: `${head}\n…(${cut.toLocaleString('en-US')} characters left out)…\n${tail}`, cut }
}

/** Reads attached files: images as images, text as text (a long one as an excerpt), anything else by path only. */
export async function loadFiles(paths: readonly string[], owner: string): Promise<LoadedFiles> {
  const key = ownerKey(owner)
  const out: LoadedFiles = { images: [], texts: [], paths: [] }
  for (const path of paths) {
    // Only what the panel uploaded (attachments.put): a request cannot have another file of this
    // machine read and sent to a model.
    const { id, name } = pathParts(path)
    const bytes = await locked(id, async dir => {
      const upload = await receipt(dir)
      if (upload.owner !== key || upload.name !== name || upload.next !== upload.total) throw bad()
      const { file, info } = await verifiedFile(path)
      try {
        if (!matches(info, upload)) throw bad()
        const buffer = Buffer.alloc(Number(info.size) + 1)
        let used = 0
        while (used < buffer.length) {
          const result = await file.read(buffer, used, buffer.length - used, used)
          if (!result.bytesRead) break
          used += result.bytesRead
        }
        if (BigInt(used) !== info.size) throw bad()
        return buffer.subarray(0, used)
      } finally { await file.close() }
    }).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new LlmError(msg('error.attachment_missing', { name }), 'invalid_params')
      if (error instanceof LlmError) throw error
      throw bad()
    })
    out.paths.push(path)
    const type = sniffImage(bytes.subarray(0, 16))
    if (type && bytes.length <= MAX_IMAGE_BYTES && out.images.length < MAX_IMAGES) {
      out.images.push({ path, name: basename(path), bytes: bytes.length, type, base64: bytes.toString('base64') })
      continue
    }
    // Text: no image, and no NUL byte anywhere in it.
    if (type || bytes.includes(0)) continue
    const { text: content, cut } = excerpt(bytes.toString('utf8'))
    out.texts.push({ path, name: basename(path), content, cut })
  }
  return out
}
