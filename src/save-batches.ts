import type { SaveOperation } from './save-queue.ts'
import { REQUEST_BYTES, validateJson } from './limits.ts'

type SaveRequest = {method: 'storage.patch' | 'storage.set' | 'storage.delete'; input: Record<string, unknown>}
const encoder = new TextEncoder()

/** Split before sending, using the same envelope limits as the HTTP server.
 * Each returned request is ordered; a partial failure remains safe to retry. */
export function storageSaveRequests(operations: SaveOperation[]): SaveRequest[] {
  if (!operations.length) return []
  const request: SaveRequest = {method:'storage.patch',input:{changes:operations.map(({scope:_, ...change}) => change)}}
  let fits = operations.length <= 64
  try { validateJson(request) } catch { fits = false }
  if (fits && encoder.encode(JSON.stringify(request)).byteLength <= REQUEST_BYTES) return [request]
  if (operations.length === 1) {
    // Batch wrapping adds depth/bytes. Preserve individually supported old
    // payloads through the existing single-key endpoint, still server-checked.
    const {key, value, remove} = operations[0]
    return [{method: remove ? 'storage.delete' : 'storage.set',input: remove ? {key} : {key,value}}]
  }
  const middle = Math.ceil(operations.length / 2)
  return [...storageSaveRequests(operations.slice(0, middle)), ...storageSaveRequests(operations.slice(middle))]
}
