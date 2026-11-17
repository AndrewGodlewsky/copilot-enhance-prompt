import { constants, type BigIntStats } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const sameFile = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino
const unchangedFile = (a: BigIntStats, b: BigIntStats) => sameFile(a, b) && b.isFile() && b.nlink === 1n &&
  a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs

/** Read only a stable, regular, single-link file beneath a freshly resolved root.
 * The handle prevents path substitution from changing the bytes being read. Revalidation
 * detects parent/link replacements; this is not a sandbox against a malicious OS user.
 * Policy exceptions deliberately propagate, while filesystem failures return null.
 */
export async function readConfinedFile(root: string, path: string, maxBytes: number,
  authorize: (relativePath: string) => boolean | Promise<boolean> = () => true
): Promise<{ data: Buffer; path: string } | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 64 * 1024 * 1024 ||
    isAbsolute(path) || path.split(/[\\/]/).includes('..')) return null
  const base = await realpath(root).catch(() => null)
  if (!base) return null
  const full = resolve(base, path)
  const file = await realpath(full).catch(() => null)
  if (!file) return null
  const local = relative(base, file).split(sep).join('/')
  if (!local || local === '..' || local.startsWith('../') || isAbsolute(local)) return null
  const [rootInfo, before] = await Promise.all([
    lstat(base, { bigint: true }).catch(() => null), lstat(file, { bigint: true }).catch(() => null)
  ])
  if (!rootInfo?.isDirectory() || !before?.isFile() || before.nlink !== 1n || before.size > BigInt(maxBytes)) return null
  if (!await authorize(local)) return null
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)).catch(() => null)
  if (!handle) return null
  try {
    const stable = async () => {
      const [currentRoot, currentPath, currentFile, directory, entry, held] = await Promise.all([
        realpath(root).catch(() => null), realpath(full).catch(() => null), realpath(file).catch(() => null),
        lstat(base, { bigint: true }).catch(() => null), lstat(file, { bigint: true }).catch(() => null),
        handle.stat({ bigint: true }).catch(() => null)
      ])
      return currentRoot === base && currentPath === file && currentFile === file && directory?.isDirectory() &&
        sameFile(rootInfo, directory) && entry && held && unchangedFile(before, entry) && unchangedFile(before, held)
    }
    if (!await stable() || !await authorize(local)) return null
    // Read one byte beyond the original size to detect growth without unbounded readFile allocation.
    const bytes = Buffer.alloc(Number(before.size) + 1)
    let length = 0
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, length).catch(() => null)
      if (!read) return null
      if (!read.bytesRead) break
      length += read.bytesRead
    }
    if (length !== Number(before.size) || !await stable() || !await authorize(local)) return null
    return { data: bytes.subarray(0, length), path: local }
  } finally { await handle.close().catch(() => {}) }
}
