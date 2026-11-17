import type { JsonValue } from './runtime.ts'

export type SaveOperation = { scope: 'storage' | 'settings'; key: string; value?: JsonValue; remove?: true }
export type SaveState = { pending: number; failed: number; phase: 'saving' | 'saved' | 'failed' }
type Entry = { operation: SaveOperation; revision: number }
type Batch = { scope: SaveOperation['scope']; entries: Map<string, Entry>; promise: Promise<void>; resolve(): void; reject(error: unknown): void }
const identity = (operation: SaveOperation) => `${operation.scope}:${operation.key}`

/** One in-flight batch and only the newest pending value per storage key.
 * Settings remain ordering barriers. No debounce delay or automatic retry. */
export function createSaveQueue(commit: (operations: SaveOperation[]) => Promise<void>) {
  const pending: Batch[] = [], failed = new Map<string, Entry>(), latest = new Map<string, number>()
  const listeners = new Set<() => void>()
  let active: Batch | undefined, draining: Promise<void> | undefined, revision = 0
  let state: SaveState = { pending: 0, failed: 0, phase: 'saved' }
  const changed = () => {
    const count = (active?.entries.size ?? 0) + pending.reduce((sum, batch) => sum + batch.entries.size, 0)
    state = { pending: count, failed: failed.size, phase: count ? 'saving' : failed.size ? 'failed' : 'saved' }
    for (const listener of listeners) listener()
  }
  const start = () => {
    if (draining) return
    draining = Promise.resolve().then(async () => {
      while (pending.length) {
        active = pending.shift()!
        changed()
        try {
          await commit([...active.entries.values()].map(entry => entry.operation))
          for (const [id, entry] of active.entries) if ((failed.get(id)?.revision ?? Infinity) <= entry.revision) failed.delete(id)
          active.resolve()
        } catch (error) {
          for (const [id, entry] of active.entries) if (latest.get(id) === entry.revision) failed.set(id, entry)
          active.reject(error)
        } finally { active = undefined; changed() }
      }
    }).finally(() => { draining = undefined; if (pending.length) start() })
  }
  const enqueue = (operation: SaveOperation): Promise<void> => {
    const id = identity(operation), entry = { operation: structuredClone(operation), revision: ++revision }
    latest.set(id, entry.revision)
    let batch = pending.at(-1)
    if (operation.scope !== 'storage' || batch?.scope !== 'storage' || batch.entries.size >= 64 && !batch.entries.has(id)) {
      let resolve!: () => void, reject!: (error: unknown) => void
      const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
      // Callers normally handle errors; keep retries/close safe if one was dropped.
      void promise.catch(() => {})
      batch = { scope: operation.scope, entries: new Map(), promise, resolve, reject }
      pending.push(batch)
    }
    batch!.entries.set(id, entry)
    changed(); start()
    return batch!.promise
  }
  const flush = async () => {
    if (pending.length) start()
    while (draining) await draining
    if (failed.size) throw new Error('Some changes could not be saved. Use Retry save or copy your text before closing.')
  }
  return { enqueue, flush,
    forgetFailedStorage(matches: (key: string) => boolean) {
      for (const [id, entry] of failed) if (entry.operation.scope === 'storage' && matches(entry.operation.key)) failed.delete(id)
      changed()
    },
    async retry() {
      const attempts = [...failed.entries()].filter(([id, entry]) => latest.get(id) === entry.revision).map(([, entry]) => enqueue(entry.operation))
      await Promise.allSettled(attempts)
      await flush()
    },
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
  }
}
