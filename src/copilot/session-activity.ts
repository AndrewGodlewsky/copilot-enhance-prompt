import { lstat, mkdir, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { readConfinedFile } from '../confined-read.ts'
import { persistentStore } from './storage.ts'

export type SessionUse = 'active' | 'inactive' | 'unknown'
export type ProcessAlive = (pid: number) => boolean | undefined
const scopeName = (scope: string) => { if (!/^[a-f0-9]{24}$/.test(scope)) throw Error('Invalid session identity.'); return `${scope}.json` }
const invalid = () => Error('Unable to verify session activity. Keep the saved files for recovery.')
export const processAlive: ProcessAlive = pid => {
  try { process.kill(pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH' ? false : undefined }
}

/** Resolve the trusted root, then refuse links at every owned child boundary. */
export async function storageDirectory(root: string, ...parts: string[]): Promise<string | undefined> {
  const initial = await lstat(root).catch(() => null)
  if (!initial?.isDirectory() || initial.isSymbolicLink()) return
  let path = await realpath(root).catch(() => undefined)
  if (!path) return
  for (const part of parts) {
    if (!/^[a-z-]+$/.test(part)) return
    path = join(path, part)
    const info = await lstat(path).catch(() => null)
    if (!info?.isDirectory() || info.isSymbolicLink() || await realpath(path).catch(() => undefined) !== path) return
  }
  return path
}

async function owners(root: string, scope: string): Promise<number[] | undefined> {
  const directory = await storageDirectory(root, 'data', 'session-activity')
  if (!directory) return
  const file = await readConfinedFile(directory, scopeName(scope), 8192, path => path === scopeName(scope))
  if (!file) return
  try {
    const saved = JSON.parse(file.data.toString('utf8'))
    if (!saved || saved.version !== 1 || !Array.isArray(saved.pids) || !saved.pids.length || saved.pids.length > 64 ||
      Object.keys(saved).some(key => !['version', 'pids'].includes(key)) || saved.pids.some((pid: unknown) => !Number.isSafeInteger(pid) || (pid as number) < 1 || (pid as number) > 2 ** 31 - 1)) return
    return saved.pids
  } catch { return }
}

export async function sessionUse(root: string, scope: string, alive: ProcessAlive = processAlive): Promise<SessionUse> {
  const pids = await owners(root, scope)
  if (!pids) return 'unknown'
  const states = pids.map(alive)
  return states.some(state => state === true) ? 'active' : states.every(state => state === false) ? 'inactive' : 'unknown'
}

/** Called under the same shared transaction as cleanup before opening a store.
 * No heartbeat expiry: an inaccessible/reused PID is protected, not presumed dead. */
export async function registerSessionUse(root: string, scope: string): Promise<void> {
  const name = scopeName(scope)
  await persistentStore(join(root, 'data')).transaction(async () => {
    const data = await storageDirectory(root, 'data')
    if (!data) throw invalid()
    await mkdir(join(data, 'session-activity'), {mode:0o700}).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error })
    const directory = await storageDirectory(root, 'data', 'session-activity')
    if (!directory) throw invalid()
    const existing = await lstat(join(directory,name)).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return null })
    const prior = existing ? await owners(root,scope) : []
    if (!prior) throw invalid()
    const pids = [...new Set([...prior.filter(pid => processAlive(pid) !== false), process.pid])]
    if (pids.length > 64) throw invalid()
    if (JSON.stringify(prior) !== JSON.stringify(pids)) await persistentStore(directory,name).patch({version:1,pids})
  })
}
