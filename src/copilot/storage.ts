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
export type PersistentStore = KeyValueStore & { transaction<T>(fn: () => Promise<T>): Promise<T> }

/** Atomic replacement plus a renewable cross-process lock. Never hold it during model/network calls. */
export function persistentStore(directory: string): PersistentStore {
  const root = resolve(directory)
  const file = join(root, 'state.json')
  const bus = buses.get(root) ?? new EventEmitter()
  bus.setMaxListeners(100)
  buses.set(root, bus)
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
    if (held.getStore()?.has(root)) return fn()
    await mkdir(root, { recursive: true, mode: 0o700 })
    const release = await lockfile.lock(root, { realpath: false, stale: 30_000, retries: { retries: 80, minTimeout: 20, maxTimeout: 250, factor: 1.2 } })
    try { return await held.run(new Set([...(held.getStore() ?? []), root]), fn) }
    finally { await release() }
  }
  const change = async (key: string, value?: JsonValue) => transaction(async () => {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 2000) throw new Error('Invalid storage key.')
    const data = await read()
    if (value === undefined) delete data[key]
    else data[key] = value
    const temporary = `${file}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, file)
    bus.emit('change', { key })
  })
  return {
    get: async key => { const data = await read(); return Object.hasOwn(data, key) ? data[key] : null },
    set: (key, value) => change(key, value), delete: key => change(key), keys: async () => Object.keys(await read()),
    onDidChange: listener => {
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
      return { dispose: () => { active = false; bus.off('change', listener); unwatchFile(file, refresh) } }
    },
    transaction
  }
}
