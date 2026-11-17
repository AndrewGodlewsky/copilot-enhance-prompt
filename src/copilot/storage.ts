import { AsyncLocalStorage } from 'node:async_hooks'
import { EventEmitter } from 'node:events'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { watchFile, unwatchFile } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import lockfile from 'proper-lockfile'
import type { JsonValue, KeyValueStore } from '../runtime.ts'

const held = new AsyncLocalStorage<Set<string>>()
const buses = new Map<string, EventEmitter>()
export type PersistentStore = KeyValueStore & {
  snapshot(): Promise<Record<string, JsonValue>>
  patch(values: Record<string, JsonValue | undefined>): Promise<void>
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

/** Atomic replacement plus a renewable cross-process lock. Never hold it during model/network calls. */
export function persistentStore(directory: string, name = 'state.json'): PersistentStore {
  const root = resolve(directory)
  if (name !== 'state.json' && !/^[a-f0-9]{24}\.json$/.test(name)) throw new Error('Invalid session storage filename.')
  const file = join(root, name)
  // Preserve the old shared-store lock path; each flat session file locks itself.
  const lockTarget = name === 'state.json' ? root : file
  const read = async (): Promise<Record<string, JsonValue>> => {
    try {
      const value: unknown = JSON.parse(await readFile(file, 'utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Enhance Prompt storage.')
      return value as Record<string, JsonValue>
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw error
    }
  }
  const transaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (held.getStore()?.has(lockTarget)) return fn()
    await mkdir(root, { recursive: true, mode: 0o700 })
    const release = await lockfile.lock(lockTarget, { realpath: false, stale: 30_000, retries: { retries: 80, minTimeout: 20, maxTimeout: 250, factor: 1.2 } })
    try { return await held.run(new Set([...(held.getStore() ?? []), lockTarget]), fn) }
    finally { await release() }
  }
  const patch = async (values: Record<string, JsonValue | undefined>) => transaction(async () => {
    const entries = Object.entries(values)
    if (!entries.length) return
    for (const [key] of entries) if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 2000) throw new Error('Invalid storage key.')
    const data = await read()
    for (const [key, value] of entries) {
      if (value === undefined) delete data[key]
      else data[key] = value
    }
    const temporary = `${file}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, file)
    for (const [key] of entries) buses.get(file)?.emit('change', { key })
  })
  return {
    snapshot: read,
    patch,
    get: async key => { const data = await read(); return Object.hasOwn(data, key) ? data[key] : null },
    set: (key, value) => patch({ [key]: value }), delete: key => patch({ [key]: undefined }), keys: async () => Object.keys(await read()),
    onDidChange: listener => {
      // Migration may touch tens of thousands of inactive files. Only observed
      // stores need a bus, and the last subscriber releases it.
      const bus = buses.get(file) ?? new EventEmitter()
      bus.setMaxListeners(100)
      buses.set(file, bus)
      bus.on('change', listener)
      let active = true
      let previous = read().catch(() => ({} as Record<string, JsonValue>))
      const refresh = () => {
        const next = read().catch(() => ({} as Record<string, JsonValue>))
        void Promise.all([previous, next]).then(([before, after]) => {
          if (!active) return
          for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) listener({ key })
          }
        }).catch(() => {})
        previous = next
      }
      watchFile(file, { interval: 500, persistent: false }, refresh)
      return { dispose: () => {
        active = false; bus.off('change', listener); unwatchFile(file, refresh)
        if (!bus.listenerCount('change') && buses.get(file) === bus) buses.delete(file)
      } }
    },
    transaction
  }
}
