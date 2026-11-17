import { watchFile, unwatchFile } from 'node:fs'
import type { Disposable, JsonValue } from '../runtime.ts'

type Values = Record<string, JsonValue>
type Listener = (event: { key: string }) => void
type Observer = { listeners: Set<Listener>; written(values: Values, keys: string[]): void; refresh(): void; dispose(): void }
const observers = new Map<string, Observer>()
const differences = (before: Values, after: Values) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))

// Observe only subscribed files. Ordinary reads, including privacy checks, never
// use this snapshot. A corrupt read must not announce that saved data was erased.
export function observeStore(file: string, read: () => Promise<Values>, listener: Listener): Disposable {
  let observer = observers.get(file)
  if (!observer) {
    const listeners = new Set<Listener>()
    let previous: Values | undefined, revision = 0, active = true, reading = false, dirty = false
    let notifiedDuringRead: Set<string> | undefined
    const emit = (keys: string[]) => { for (const key of keys) { notifiedDuringRead?.add(key); for (const fn of listeners) fn({ key }) } }
    const refresh = () => {
      dirty = true
      if (reading || !active) return
      reading = true
      void (async () => {
        try {
          while (dirty && active) {
            dirty = false
            const observedRevision = revision
            const initial = previous === undefined, alreadyNotified = new Set<string>()
            notifiedDuringRead = alreadyNotified
            const next = await read().catch(() => undefined)
            notifiedDuringRead = undefined
            if (!active || !next) continue
            if (revision !== observedRevision) {
              // A local commit can overtake the initial read. Compare its old
              // baseline for missed external changes, but never install it.
              if (initial && previous) emit(differences(next, previous).filter(key => !alreadyNotified.has(key)))
              continue
            }
            const before = previous
            previous = next
            if (before) emit(differences(before, next))
          }
        } finally { reading = false }
      })().catch(() => {})
    }
    observer = { listeners, refresh,
      written(values, keys) {
        const changed = previous ? differences(previous, values) : []
        revision++; previous = structuredClone(values)
        emit([...new Set([...keys, ...changed])])
      },
      dispose() { active = false; unwatchFile(file, refresh) }
    }
    observers.set(file, observer)
    watchFile(file, { interval: 500, persistent: false }, refresh)
    refresh()
  }
  observer.listeners.add(listener)
  let disposed = false
  return { dispose() {
    if (disposed) return
    disposed = true
    observer.listeners.delete(listener)
    if (!observer.listeners.size && observers.get(file) === observer) { observer.dispose(); observers.delete(file) }
  } }
}

export function notifyStoreWrite(file: string, values: Values, keys: string[]) {
  observers.get(file)?.written(values, keys)
}
