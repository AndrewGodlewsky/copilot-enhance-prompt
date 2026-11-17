import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readdir, realpath, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import lockfile from 'proper-lockfile'

export type UsageRecoveryStatus = { pending: number; unconfirmed: number; recovered: number; failed: number; deferred: number }
type Record = { sessionId: string; directory: string; dev: string; ino: string; token: string; committed?: boolean; attempts?: number; nextAt?: number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ownerFile = '.enhance-usage-owner.json'
const generic = () => new Error('Unable to recover usage accounting. Raw helper data was left untouched.')
const within = (root: string, path: string) => { const part = relative(root, path); return !!part && !isAbsolute(part) && !part.startsWith('..') }
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

async function save(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 })
  await rename(temporary, file)
}

/** No links or multiply-linked files. Validate the opened handle, not just its pathname. */
async function json(file: string) {
  const before = await lstat(file, { bigint: true })
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || before.size > 16_384n) throw generic()
  const handle = await open(file, 'r')
  try {
    const actual = await handle.stat({ bigint: true })
    if (before.dev !== actual.dev || before.ino !== actual.ino || actual.nlink !== 1n || !actual.isFile()) throw generic()
    return JSON.parse(await handle.readFile('utf8'))
  } finally { await handle.close() }
}

async function identity(directory: string) {
  const info = await lstat(directory, { bigint: true })
  const canonical = await realpath(directory)
  const temp = await realpath(tmpdir())
  if (!info.isDirectory() || info.isSymbolicLink() || canonical !== resolve(directory) || !within(temp, canonical) || !basename(canonical).startsWith('enhance-copilot-')) throw generic()
  return { directory: canonical, dev: String(info.dev), ino: String(info.ino) }
}

async function owner(record: Record) {
  const info = await identity(record.directory)
  if (info.dev !== record.dev || info.ino !== record.ino) throw generic()
  const value = await json(join(record.directory, ownerFile))
  if (value.token !== record.token || value.sessionId !== record.sessionId || !['running', 'stopped'].includes(value.state)) throw generic()
  return value as { token: string; sessionId: string; state: 'running' | 'stopped' }
}

function parse(value: any, name: string): Record {
  if (!value || !uuid.test(value.sessionId) || name !== `${value.sessionId}.json` || !uuid.test(value.token) ||
      typeof value.directory !== 'string' || typeof value.dev !== 'string' || typeof value.ino !== 'string') throw generic()
  return value
}

async function sameDirectory(record: Record) {
  const info = await identity(record.directory)
  if (info.dev !== record.dev || info.ino !== record.ino) throw generic()
}

async function cleanup(record: Record) {
  if ((await owner(record)).state !== 'stopped') throw generic()
  // A locked child must not erase the proof needed to retry its cleanup later.
  for (const name of await readdir(record.directory)) {
    if (name === ownerFile) continue
    await sameDirectory(record)
    await rm(join(record.directory, name), { recursive: true, force: false, maxRetries: 3 })
  }
  if ((await owner(record)).state !== 'stopped') throw generic()
  await unlink(join(record.directory, ownerFile))
  await rmdir(record.directory)
}

/** Registered before sending input. Only a confirmed stop may authorize later replay/cleanup. */
export async function registerUsageJournal(root: string, sessionId: string, directory: string) {
  if (!uuid.test(sessionId)) throw generic()
  const record: Record = { sessionId, ...await identity(await realpath(directory)), token: randomUUID() }
  const registry = join(root, 'recovery'), file = join(registry, `${sessionId}.json`)
  await mkdir(registry, { recursive: true, mode: 0o700 })
  await writeFile(join(record.directory, ownerFile), JSON.stringify({ token: record.token, sessionId, state: 'running' }), { flag: 'wx', mode: 0o600 })
  await writeFile(file, JSON.stringify(record), { flag: 'wx', mode: 0o600 })
  let release: (() => Promise<void>) | undefined
  return {
    async stopped() {
      release = await lockfile.lock(registry, { realpath: false, stale: 30_000, retries: { retries: 80, minTimeout: 50, maxTimeout: 250 } })
      await owner(record)
      await save(join(record.directory, ownerFile), { token: record.token, sessionId, state: 'stopped' })
    },
    async committed() { await save(file, { ...record, committed: true }) },
    async cleanup() { await cleanup(record) },
    async complete() {
      const current = parse(await json(file), basename(file))
      if (current.token !== record.token) throw generic()
      await unlink(file)
    },
    async settled() {
      const unlock = release
      release = undefined
      await unlock?.()
    }
  }
}

async function journal(record: Record): Promise<string> {
  let path = record.directory
  for (const component of ['home', 'session-state', record.sessionId, 'events.jsonl']) {
    path = join(path, component)
    const info = await lstat(path)
    if (info.isSymbolicLink() || await realpath(path) !== path ||
        (component === 'events.jsonl' ? !info.isFile() || info.nlink !== 1 : !info.isDirectory())) throw generic()
  }
  return path
}

/** Bounded and cross-process serialized. Counts are safe for support logs; no paths leave this module. */
export async function recoverUsageJournals(root: string, consume: (sessionId: string, journal: string) => Promise<void>, options: { manual?: boolean; inspect?: boolean; now?: () => number } = {}): Promise<UsageRecoveryStatus> {
  const status: UsageRecoveryStatus = { pending: 0, unconfirmed: 0, recovered: 0, failed: 0, deferred: 0 }
  const registry = join(root, 'recovery')
  try { if (!(await lstat(registry)).isDirectory() || await realpath(registry) !== resolve(registry)) throw generic() }
  catch (error) { if (missing(error)) return status; throw generic() }
  const release = await lockfile.lock(registry, { realpath: false, stale: 30_000, retries: { retries: 12, minTimeout: 50, maxTimeout: 250 } })
  try {
    const now = options.now?.() ?? Date.now()
    let attempted = 0
    for (const name of (await readdir(registry)).filter(name => name.endsWith('.json')).sort()) {
      const file = join(registry, name)
      let record: Record
      try {
        record = parse(await json(file), name)
        let marker
        try { marker = await owner(record) }
        catch (error) {
          // A crash after successful replay/cleanup but before unlinking the registry is safe to finish.
          if (record.committed && missing(error)) {
            try { await lstat(record.directory) } catch (error) {
              if (missing(error)) { if (!options.inspect) await unlink(file); status.recovered++; continue }
            }
            // Only finish the marker-last crash window for the original, now-empty directory.
            await sameDirectory(record)
            if ((await readdir(record.directory)).length === 0) {
              if (!options.inspect) { await rmdir(record.directory); await unlink(file) }
              status.recovered++; continue
            }
          }
          throw error
        }
        if (marker.state !== 'stopped') { status.unconfirmed++; continue }
      } catch { status.unconfirmed++; continue }
      status.pending++
      if (options.inspect) { if (record.attempts) status.failed++; continue }
      if (attempted >= 8 || (!options.manual && (record.nextAt ?? 0) > now)) { status.deferred++; continue }
      attempted++
      try {
        if (!record.committed) {
          await consume(record.sessionId, await journal(record))
          record = { ...record, committed: true }
          await save(file, record)
        }
        // Revalidate after replay before touching any raw files. Never remove an unconfirmed helper.
        await cleanup(record)
        await unlink(file)
        status.pending--; status.recovered++
      } catch {
        status.failed++
        const attempts = Math.min(20, (record.attempts ?? 0) + 1)
        await save(file, { ...record, attempts, nextAt: now + Math.min(3_600_000, 300_000 * 2 ** (attempts - 1)) }).catch(() => {})
      }
    }
    return status
  } finally { await release() }
}
