import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import type { JsonValue } from '../runtime.ts'
import { persistentStore, type PersistentStore } from './storage.ts'

export const SESSION_LAYOUT_KEY = 'internal:sessionStorage'
const scoped = /^session:([a-f0-9]{24}):(panel:.+)$/
export const sessionData = (directory: string, scope: string) => persistentStore(join(directory, 'data', 'sessions'), `${scope}.json`)

export function validateSessionLayout(saved: Record<string, JsonValue>) {
  if (saved[SESSION_LAYOUT_KEY] === undefined) return
  if (saved[SESSION_LAYOUT_KEY] !== 1) throw new Error('This saved session format needs a newer Enhance Prompt version. No data was changed.')
  if (Object.keys(saved).some(key => scoped.test(key))) throw new Error('An older Enhance Prompt version wrote session data after migration. Close its sessions and keep the saved files for recovery; do not clear data or downgrade.')
}

/** All new adapters wait for this transaction before opening session files.
 * Until the last shared replacement, legacy values remain authoritative. An
 * interrupted split can therefore be retried without losing a draft. */
export async function partitionSessions(directory: string, data: PersistentStore) {
  await data.transaction(async () => {
    const saved = await data.snapshot()
    validateSessionLayout(saved)
    if (saved[SESSION_LAYOUT_KEY] !== undefined) {
      return
    }
    const sessions = new Map<string, Record<string, JsonValue>>()
    const removed: Record<string, JsonValue | undefined> = { [SESSION_LAYOUT_KEY]: 1 }
    for (const [key, value] of Object.entries(saved)) {
      const match = scoped.exec(key)
      if (!match) continue
      const values = sessions.get(match[1]) ?? Object.create(null)
      values[match[2]] = value
      sessions.set(match[1], values)
      removed[key] = undefined
    }
    // A stopped old worker may have deleted/edited legacy data after a failed
    // copy. Never merge stale copied keys back in or erase an ambiguous copy.
    const copied = await readdir(join(directory, 'data', 'sessions')).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    })
    for (const name of copied) {
      if (!/^[a-f0-9]{24}\.json$/.test(name)) continue
      const scope = name.slice(0, -5), expected = sessions.get(scope)
      const current = await sessionData(directory, scope).snapshot()
      if (!expected || !isDeepStrictEqual({ ...current }, { ...expected })) throw new Error('An interrupted session migration has conflicting saved copies. Close Copilot and keep the data directory for maintainer recovery; no session copy was replaced.')
    }
    const pending = [...sessions.entries()]
    let next = 0
    // Settle all writers even on failure before releasing the migration lock.
    const results = await Promise.allSettled(Array.from({ length: Math.min(8, pending.length) }, async () => {
      while (next < pending.length) {
        const [scope, values] = pending[next++]
        await sessionData(directory, scope).patch(values)
      }
    }))
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    await data.patch(removed)
  })
}
