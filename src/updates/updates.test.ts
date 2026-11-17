import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { persistentStore } from '../copilot/storage.ts'
import { compareVersions } from './version.ts'
import { githubSource, metadataReader, remoteMetadata, UpdateError } from './metadata.ts'
import { createUpdates } from './service.ts'
import type { Installation } from './types.ts'

test('SemVer handles releases, prereleases, build metadata, numeric identifiers and invalid values', () => {
  for (const [a, b, expected] of [['1.2.3','1.2.3',0], ['1.10.0','1.9.9',1], ['1.0.0-rc.9','1.0.0-rc.10',-1], ['1.0.0','1.0.0-rc.10',1], ['1.0.0-a','1.0.0-a.1',-1], ['1.0.0-1','1.0.0-a',-1], ['1.0.0+x','1.0.0+y',0], ['1.0.0-01','1.0.0',null], ['v1.0.0','1.0.0',null], ['1.2','1.2.0',null], ['01.0.0','1.0.0',null]] as const) assert.equal(compareVersions(a,b), expected, `${a} / ${b}`)
})
test('source parsing preserves forks, branches and pins without accepting arbitrary URLs or traversal', () => {
  assert.deepEqual(githubSource({ source: 'github', repo: 'Owner/Fork', ref: 'beta', path: 'plugin' }), { repo: 'owner/fork', ref: 'beta', path: 'plugin' })
  assert.equal(githubSource({ source: 'github', repo: 'owner/repo', path: '../bad' }), undefined)
  assert.equal(githubSource({ source: 'url', url: 'https://user:secret@github.com/owner/repo' }), undefined)
  assert.equal(githubSource({ source: 'local', path: 'C:/fixture' }), undefined)
})
test('metadata follows the configured branch and marketplace subtree, validates pins, source changes and versions', async () => {
  const sha = 'a'.repeat(40), calls: string[] = []
  const read = async (url: string) => {
    calls.push(url)
    if (url.includes('/tags/')) throw new UpdateError('missing', 'not_found')
    if (url.endsWith('/heads/beta')) return { object: { sha, type: 'commit' } }
    if (url.endsWith('marketplace.json')) return { plugins: [{ name: 'enhance-prompt', source: './plugin' }] }
    return { name: 'enhance-prompt', version: '2.0.0-beta.2' }
  }
  const source = { repo: 'owner/fork', ref: 'beta', path: 'plugin' }
  const installation = { scope: 'a', canUpdate: true, source, marketplace: { ...source, path: undefined } }
  const available = await remoteMetadata(read)(installation)
  assert.equal(available.version, '2.0.0-beta.2')
  assert.equal(available.changes, `https://github.com/owner/fork/blob/${sha}/plugin/CHANGELOG.md`)
  assert.ok(calls.every(url => url.includes('owner/fork')))
  await assert.rejects(remoteMetadata(read)({ ...installation, source: { ...source, path: 'other' } }), /changed/)
  await assert.rejects(remoteMetadata(read)({ ...installation, marketplace: undefined, source: { ...source, sha } }), /pinned/)
  await assert.rejects(remoteMetadata(async () => ({ object: { sha, type: 'commit' } }))({ ...installation, marketplace: undefined }), /branch and tag/)
  await assert.rejects(remoteMetadata(async url => url.includes('/heads/') ? { object: { sha, type: 'commit' } } : url.includes('/tags/') ? Promise.reject(new UpdateError('', 'not_found')) : { name: 'other', version: 'latest' })({ ...installation, marketplace: undefined }), /invalid/)
})
test('metadata HTTP requests are bounded, credential-free, reject redirects and report rate limits, malformed data, offline and timeout', async () => {
  let init: RequestInit | undefined
  const read = metadataReader((async (_url, options) => { init = options; return new Response('{"version":"1.0.0"}') }) as typeof fetch)
  assert.deepEqual(await read('https://raw.githubusercontent.com/owner/repo/main/plugin.json'), { version: '1.0.0' })
  assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); assert.deepEqual(init?.headers, { Accept: 'application/json' })
  await assert.rejects(read('https://evil.example/plugin.json'), /not supported/)
  for (const response of [new Response('bad'), new Response('x'.repeat(130_000))]) await assert.rejects(metadataReader(async () => response)('https://api.github.com/repos/a/b'))
  await assert.rejects(metadataReader(async () => new Response('', { status: 429, headers: { 'retry-after': '600' } }))('https://api.github.com/repos/a/b'), (e: UpdateError) => e.code === 'rate_limited' && e.retryAfter === 600_000)
  await assert.rejects(metadataReader(async () => { throw new Error('offline secret') })('https://api.github.com/repos/a/b'), /connection/)
  await assert.rejects(metadataReader(async (_url, init) => new Promise((_, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('timeout')))), 5)('https://api.github.com/repos/a/b'), /timed out/)
})

async function fixture(run: (f: ReturnType<typeof setup>) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-updates-test-'))
  try { await run(setup(dir)) } finally { await rm(dir, { recursive: true, force: true, maxRetries: 5 }) }
}
function setup(dir: string) {
  let time = 1000, count = 0, updates = 0, busy = false
  let installation: Installation = { scope: 'same', installed: '1.0.0', target: 'enhance-prompt@fixture', source: { repo: 'owner/repo' }, canUpdate: true }
  let metadata = async () => { count++; return { version: '1.1.0', changes: 'https://github.com/owner/repo/blob/main/CHANGELOG.md' } }
  let update = async (_target: string) => { updates++; installation = { ...installation, installed: '1.1.0' } }
  const store = persistentStore(dir)
  const options = { running: '1.0.0', store, now: () => time, pid: 42, alive: (p: number) => p === 42,
    installation: async () => installation, metadata: () => metadata(), update: (target: string) => update(target), busy: () => busy }
  return { options, store, service: createUpdates(options), get count() { return count }, get updates() { return updates },
    advance: (ms: number) => { time += ms }, busy: (b: boolean) => { busy = b }, installation: (i: Partial<Installation>) => { installation = { ...installation, ...i } },
    metadata: (fn: typeof metadata) => { metadata = fn }, update: (fn: typeof update) => { update = fn } }
}
test('24-hour automatic cache, manual override, disabling checks and version-specific dismissal', async () => fixture(async f => {
  assert.equal((await f.service.check(false)).status, 'available'); assert.equal(f.count, 1)
  assert.equal((await f.service.later()).dismissed, true)
  await f.service.check(false); assert.equal(f.count, 1)
  f.advance(5001); await f.service.check(true); assert.equal(f.count, 2)
  await f.service.automatic(false); f.advance(86_400_001); await f.service.check(false); assert.equal(f.count, 2)
  await f.service.automatic(true); await f.service.check(false); assert.equal(f.count, 3)
  f.metadata(async () => ({ version: '1.2.0', changes: 'https://github.com/owner/repo/blob/main/CHANGELOG.md' }))
  f.advance(5001)
  assert.equal((await f.service.check(true)).dismissed, false)
}))
test('newer installed code needs reload; unknown, equal, and older sources are distinct', async () => fixture(async f => {
  f.installation({ installed: '1.1.0' }); assert.equal((await f.service.check(false)).status, 'reload'); assert.equal(f.count, 0)
  f.installation({ installed: 'bad' }); assert.equal((await f.service.check(true)).status, 'unknown')
  f.advance(5001); f.installation({ installed: '1.0.0' }); f.metadata(async () => ({ version: '1.0.0', changes: '' })); assert.equal((await f.service.check(true)).status, 'current')
  f.advance(5001); f.metadata(async () => ({ version: '0.9.0', changes: '' })); assert.equal((await f.service.check(true)).status, 'current')
}))
test('simultaneous instances coalesce checks and duplicate Update clicks', async () => fixture(async f => {
  const second = createUpdates(f.options)
  await Promise.all([f.service.check(true), second.check(true), f.service.check(true)])
  assert.equal(f.count, 1)
  await Promise.all([f.service.install(), second.install()])
  assert.equal(f.updates, 1); assert.equal((await second.state()).status, 'reload')
}))
test('offline retries back off and automatic failures cannot spin on reopen', async () => fixture(async f => {
  let calls = 0; f.metadata(async () => { calls++; throw new UpdateError('Offline. Try later.', 'network') })
  assert.equal((await f.service.check(false)).status, 'failed')
  await f.service.check(true); assert.equal(calls, 1)
  f.advance(60_001); await f.service.check(false); assert.equal(calls, 1)
  await f.service.check(true); assert.equal(calls, 2)
}))
test('source change invalidates cache and unsupported installations cannot update', async () => fixture(async f => {
  await f.service.check(true); f.installation({ scope: 'fork' })
  assert.equal((await f.service.state()).available, undefined)
  f.installation({ source: undefined, target: undefined, canUpdate: false, reason: 'Local development.' })
  assert.equal((await f.service.check(true)).status, 'unavailable'); await assert.rejects(f.service.install(), /Local/); assert.equal(f.updates, 0)
}))
test('a temporary inventory failure does not erase the daily cache or version dismissal', async () => fixture(async f => {
  await f.service.check(false); await f.service.later()
  f.installation({ scope: 'unresolved', source: undefined, target: undefined })
  assert.equal((await f.service.state()).status, 'unavailable')
  f.installation({ scope: 'same', source: { repo: 'owner/repo' }, target: 'enhance-prompt@fixture' })
  const restored = await f.service.check(false)
  assert.equal(f.count, 1); assert.equal(restored.dismissed, true)
}))
test('active work in another canvas prevents updates and data is left untouched', async () => fixture(async f => {
  await f.store.set('unrelated-draft', 'Keep Unicode 日本語 and attachments')
  await f.service.check(true)
  let release!: () => void
  const working = f.service.withWork(() => new Promise<void>(resolve => { release = resolve }))
  while (!release) await new Promise(resolve => setTimeout(resolve, 1))
  await assert.rejects(createUpdates(f.options).install(), /Finish active/)
  release(); await working; await f.service.install()
  assert.equal(await f.store.get('unrelated-draft'), 'Keep Unicode 日本語 and attachments')
}))
test('policy refusal, successful request with unchanged files, and interruption are not success', async () => fixture(async f => {
  await f.service.check(true)
  f.update(async () => { throw new Error('policy denied private details') })
  assert.equal((await f.service.install()).status, 'failed')
  assert.doesNotMatch((await f.service.state()).message, /private details/)
  f.update(async () => {})
  assert.match((await f.service.install()).message, /does not match/)
  await f.store.set('state', { scope: 'same', pending: { id: 'interrupted', pid: 99, started: 1, version: '1.1.0' } })
  assert.match((await f.service.state()).message, /interrupted/)
  f.installation({ installed: '1.1.0' })
  assert.equal((await f.service.state()).status, 'reload')
}))
test('timed-out installation remains reserved until its real completion is verified', async () => fixture(async f => {
  await f.service.check(true); let finish!: () => void
  f.update(async () => new Promise<void>(resolve => { finish = () => { f.installation({ installed: '1.1.0' }); resolve() } }))
  const client = createUpdates({ ...f.options, updateTimeoutMs: 10 })
  assert.equal((await client.install()).status, 'updating')
  await assert.rejects(f.service.withWork(async () => {}), /in progress/)
  assert.equal((await client.install()).status, 'updating')
  finish()
  for (let i = 0; i < 50 && (await client.state()).status === 'updating'; i++) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal((await client.state()).status, 'reload')
}))

test('recycled PIDs do not own old work or an interrupted installer; uncertain identities stay reserved', async () => fixture(async f => {
  const service = createUpdates({ ...f.options, identity: async () => 'process-new' })
  await service.check(true)
  const saved = await f.store.get('state') as Record<string, any>
  await f.store.set('state', { ...saved, work: { old: { pid: 42, identity: 'process-old' } } })
  await assert.rejects(createUpdates({ ...f.options, identity: async () => 'process-old' }).install(), /Finish active/)
  assert.equal((await service.install()).status, 'reload')
  f.installation({ installed: '1.0.0' })
  await f.store.set('state', { ...saved, pending: { id: 'old-install', pid: 42, identity: 'process-old', started: 1, version: '1.1.0' } })
  assert.match((await service.state()).message, /interrupted/)
  assert.equal((await f.store.get('state') as any).pending, undefined)
  await f.store.set('state', { ...saved, pending: { id: 'uncertain', pid: 42, identity: 'process-old', started: 1, version: '1.1.0' } })
  const uncertain = createUpdates({ ...f.options, identity: async () => undefined })
  f.advance(86_400_000 * 30)
  assert.equal((await uncertain.state()).status, 'updating', 'age never expires a possibly live installer')
  const same = createUpdates({ ...f.options, identity: async () => 'process-old' })
  assert.equal((await same.state()).status, 'updating')
}))

test('legacy PID-only reservations and unreadable creation identity never expire by age', async () => fixture(async f => {
  const service = createUpdates({ ...f.options, identity: async () => { throw new Error('PRIVATE permission error') } })
  await service.check(true)
  const saved = await f.store.get('state') as Record<string, any>
  await f.store.set('state', { ...saved, work: { legacy: 42, unreadable: { pid: 42, identity: 'old' } } })
  f.advance(86_400_000 * 100)
  await assert.rejects(service.install(), /Finish active/)
  await f.store.set('state', { ...saved, pending: { id: 'legacy', pid: 42, started: 1, version: '1.1.0' } })
  assert.equal((await service.state()).status, 'updating')
}))
