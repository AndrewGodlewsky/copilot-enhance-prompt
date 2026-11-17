import { atom, read, set } from '#panel'

export type PendingUpload = { id: string; name: string }
export const pendingUploads = atom<PendingUpload[]>([])
export const failedUploads = atom<(PendingUpload & { error: string })[]>([])
export const uploadRevision = atom(0)
const controllers = new Map<string, AbortController>()
const changed = () => set(uploadRevision, read(uploadRevision) + 1)

/** Reserve the whole selection synchronously, including files queued behind the first. */
export function beginUploads(names: string[]) {
  const batch = names.map(name => {
    const id = crypto.randomUUID(), controller = new AbortController()
    controllers.set(id, controller)
    return { id, name, signal: controller.signal }
  })
  set(pendingUploads, [...read(pendingUploads), ...batch.map(({ id, name }) => ({ id, name }))])
  changed()
  return batch
}

export function finishUpload(id: string, error?: string): void {
  const item = read(pendingUploads).find(upload => upload.id === id)
  if (!item) return
  if (error) set(failedUploads, [...read(failedUploads), { ...item, error }])
  set(pendingUploads, read(pendingUploads).filter(upload => upload.id !== id))
  controllers.delete(id)
  changed()
}

/** An explicit Cancel/Remove excludes this file; it never starts enhancement. */
export function discardUpload(id: string): void {
  controllers.get(id)?.abort()
  controllers.delete(id)
  set(pendingUploads, read(pendingUploads).filter(upload => upload.id !== id))
  set(failedUploads, read(failedUploads).filter(upload => upload.id !== id))
  changed()
}

export function resetUploads(): void {
  for (const controller of controllers.values()) controller.abort()
  controllers.clear()
  set(pendingUploads, [])
  set(failedUploads, [])
  changed()
}

export function uploadBlockReason(): string | null {
  if (read(pendingUploads).length) return 'Wait for attachments to finish uploading, or cancel the uploads, before enhancing.'
  if (read(failedUploads).length) return 'An attachment could not be added. Remove the failed attachment, then attach it again or continue without it.'
  return null
}
