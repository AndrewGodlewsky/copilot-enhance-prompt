import { formatText } from '../format.ts'
// Attaching files in the web panel: paste, drop or the paperclip. A frame has no path for a file, so
// its bytes go to the worker in chunks (`attachments.put`), which keeps it in a temporary folder and
// answers with the path the run then uses.
import { plugin, read, set } from '#panel'
import { busy, files, notice, message, put, workspaceKey, type AttachedFile } from './state.ts'
import { ATTACHMENT_CHUNK_BYTES, MAX_ATTACHMENT_BYTES, MAX_IMAGE_BYTES, MAX_FILES, sizeOver } from '../image-limits.ts'
import { beginUploads, failedUploads, finishUpload, pendingUploads } from './uploads.ts'

export { MAX_FILES } from '../image-limits.ts'
export const MAX_FILE_BYTES = MAX_ATTACHMENT_BYTES
/**
 * Raw bytes per request. Copilot refuses a panel request larger than 64 KiB ("message too large"):
 * pieces of 768 KB (about 1 MB in base64) made every attachment fail. See src/image-limits.ts.
 */
const CHUNK = ATTACHMENT_CHUNK_BYTES

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * Why a file cannot be attached, with its size and the limit; null when it can. An image larger than
 * models accept (5 MB) is refused here too, instead of being sent by path without a word.
 */
export function tooLarge(file: { name: string; size: number; type: string }): string | null {
  if (file.type.startsWith('image/') && file.size > MAX_IMAGE_BYTES) {
    return formatText('{name} is {size}; an image can be at most {max}.', { name: file.name, size: sizeOver(file.size, MAX_IMAGE_BYTES), max: megabytes(MAX_IMAGE_BYTES) })
  }
  if (file.size > MAX_FILE_BYTES) return formatText('{name} is {size}; an attachment can be at most {max}.', { name: file.name, size: sizeOver(file.size, MAX_FILE_BYTES), max: megabytes(MAX_FILE_BYTES) })
  return null
}

/** Previews of attached images, by path, for this panel run only. */
export const previews = new Map<string, string>()
/** Names being uploaded now, shown with a spinner. */
export const uploadingNames = () => read(pendingUploads).map(upload => upload.name)

function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (let index = 0; index < bytes.length; index += 0x8000) text += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(text)
}

const newId = () => `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** A pasted screenshot comes as "image.png": give it a name that says when it was taken. */
function nameOf(file: File): string {
  if (file.name && file.name !== 'image.png') return file.name
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const extension = file.type.split('/')[1] || 'png'
  return `pasted-${stamp}.${extension}`
}

async function uploadOne(file: File, name: string, signal: AbortSignal): Promise<AttachedFile> {
  signal.throwIfAborted()
  const bytes = new Uint8Array(await file.arrayBuffer())
  signal.throwIfAborted()
  const id = newId()
  const total = Math.max(1, Math.ceil(bytes.length / CHUNK))
  let answer: unknown = null
  for (let index = 0; index < total; index += 1) {
    const data = toBase64(bytes.subarray(index * CHUNK, (index + 1) * CHUNK))
    // The first piece says the whole size, so the worker can refuse a file that is too large at once.
    answer = await plugin.request('attachments.put', { id, name, index, total, data, ...(index === 0 ? { size: bytes.length } : {}) }, { timeoutMs: 60_000, signal })
    signal.throwIfAborted()
  }
  const done = answer as { path: string; bytes: number }
  if (!done || typeof done.path !== 'string' || !done.path || done.bytes !== bytes.length) throw new Error('The upload did not finish. Remove this attachment and attach it again.')
  return { path: done.path, name, bytes: bytes.length, type: file.type || 'application/octet-stream' }
}

/** Attaches files (from a paste, a drop or the picker); too many or too large ones get a notice. */
export async function attachFiles(list: readonly File[], refresh: () => void): Promise<void> {
  if (!list.length) return
  if (read(busy)) { set(notice, { tone: 'warning', text: 'Finish the current operation before attaching files.' }); return }
  const room = MAX_FILES - read<AttachedFile[]>(files).length - read(pendingUploads).length - read(failedUploads).length
  if (list.length > room) {
    set(notice, { tone: 'warning', text: formatText('At most {max} files per prompt. No files from this selection were added; select fewer files.', { max: MAX_FILES }) })
    return
  }
  const origin = read(workspaceKey)
  const batch = beginUploads(list.map(nameOf))
  refresh()
  for (let index = 0; index < batch.length; index++) {
    const file = list[index], { id, name, signal } = batch[index]
    try {
      signal.throwIfAborted()
      const refused = tooLarge(file)
      if (refused) throw new Error(refused)
      const attached = await uploadOne(file, name, signal)
      if (origin !== read(workspaceKey)) throw new Error('The project changed during upload. Remove this attachment and attach it in the intended project.')
      if (file.type.startsWith('image/')) previews.set(attached.path, URL.createObjectURL(file))
      put(files, [...read<AttachedFile[]>(files), attached])
      finishUpload(id)
    } catch (error) {
      if (!signal.aborted) {
        finishUpload(id, message(error))
        set(notice, { tone: 'danger', text: formatText('{name} could not be added. Remove it and attach it again, or continue without it.', { name }) })
      }
    } finally {
      refresh()
    }
  }
}

/** Files from a paste or a drop (a copied file, or a screenshot in the clipboard). */
export function filesOf(data: DataTransfer | null): File[] {
  if (!data) return []
  const out: File[] = []
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) out.push(file)
    }
  }
  return out.length > 0 ? out : Array.from(data.files ?? [])
}
