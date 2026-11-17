import test from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { once } from 'node:events'
import { createUsageRecorder, reconcileUsageJournal, recoverUsage } from './usage.ts'
import { recoverUsageJournals } from './usage-recovery.ts'
import { createServices } from './services.ts'
import { createWorkerHost } from '../worker-host.ts'
import activate from '../worker.ts'

const id = '12345678-1234-4234-8234-123456789abc'
const timestamp = '2026-11-17T12:00:00.000Z'
const event = (usageId: string) => ({ type: 'session.usage_record', id: `event-${usageId}`, timestamp, data: { usage: {
  model: 'fixture', inputTokens: 12, outputTokens: 4, copilotUsage: { totalNanoAiu: 7 },
  accounting: { sourceSessionId: id, usageId, sequence: 1 }, prompt: 'PRIVATE prompt'
} } })

async function fixture(run: (f: { root: string; helper: string; journal: string; receipt: string }) => Promise<void>) {
  const base = await mkdtemp(join(tmpdir(), 'enhance-recovery-test-'))
  const root = join(base, 'accounting'), helper = await mkdtemp(join(base, 'enhance-copilot-'))
  const journal = join(helper, 'home', 'session-state', id, 'events.jsonl')
  await mkdir(join(helper, 'home', 'session-state', id), { recursive: true })
  await writeFile(journal, [JSON.stringify({ type: 'user.message', data: { content: 'PRIVATE transcript' } }), JSON.stringify(event('one')), JSON.stringify(event('two'))].join('\n'))
  try { await run({ root, helper, journal, receipt: join(root, 'session-state', id, 'events.jsonl') }) }
  finally { await rm(base, { recursive: true, force: true }) }
}

test('Windows spelling aliases of the trusted accounting root do not block recovery', { skip: process.platform !== 'win32' }, async () => fixture(async ({ root, helper, journal }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!(); await recorder.settled!()
  const result = await recoverUsage(true, root.toUpperCase())
  assert.equal(result.recovered, 1)
  await assert.rejects(access(journal), { code: 'ENOENT' })
}))

test('canonicalizing the accounting root still refuses a linked root or recovery registry', async () => fixture(async ({ root, helper, journal }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!(); await recorder.settled!()
  const alias = `${root}-alias`, registry = join(root, 'recovery'), moved = join(root, 'kept-recovery')
  await symlink(root, alias, 'junction')
  await assert.rejects(recoverUsage(true, alias))
  await rename(registry, moved)
  await symlink(moved, registry, 'junction')
  await assert.rejects(recoverUsage(true, root))
  await access(journal)
  await access(join(moved, `${id}.json`))
}))

test('failed disk writes recover exactly once across restart and concurrent retry; raw text is removed only after success', async () => fixture(async ({ root, helper, journal, receipt }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  recorder.record(event('one'))
  await recorder.flush()
  await rename(receipt, `${receipt}.backup`)
  await mkdir(receipt)
  await recorder.stopped!()
  try { await assert.rejects(reconcileUsageJournal(journal, recorder)) }
  finally { await recorder.settled!() }
  const failed = await recoverUsage(true, root)
  assert.equal(failed.failed, 1)
  await access(journal)
  assert.equal(JSON.stringify(failed).includes('PRIVATE'), false)
  assert.equal(JSON.stringify(failed).includes(helper), false)
  await rm(receipt, { recursive: true })
  await rename(`${receipt}.backup`, receipt)
  const waiting = await recoverUsage(false, root)
  assert.equal(waiting.deferred, 1, 'automatic retry honors persisted backoff after restart')
  const child = promisify(execFile)(process.execPath, ['--input-type=module', '-e', 'const {recoverUsage}=await import(process.argv[1]); process.stdout.write(JSON.stringify(await recoverUsage(true,process.argv[2])))', new URL('./usage.ts', import.meta.url).href, root], { windowsHide: true }).then(value => JSON.parse(value.stdout))
  const results = await Promise.all([recoverUsage(true, root), child])
  assert.equal(results.reduce((sum, value) => sum + value.recovered, 0), 1)
  await assert.rejects(access(helper), { code: 'ENOENT' })
  const rows = (await readFile(receipt, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  assert.deepEqual(rows.slice(1).map(row => row.data.usage.accounting.usageId), ['one', 'two'])
  assert.equal(JSON.stringify(rows).includes('PRIVATE'), false)
  assert.deepEqual(await recoverUsage(true, root), { pending: 0, unconfirmed: 0, recovered: 0, failed: 0, deferred: 0 })
}))

test('live, unowned and substituted helper directories remain untouched', async () => fixture(async ({ root, helper, journal }) => {
  const unowned = await mkdtemp(join(tmpdir(), 'enhance-copilot-unowned-'))
  try {
    const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
    const live = await recoverUsage(true, root)
    assert.equal(live.unconfirmed, 1)
    await access(journal)
    await access(unowned)
    await recorder.stopped!(); await recorder.settled!()
    const registry = join(root, 'recovery', `${id}.json`)
    const record = JSON.parse(await readFile(registry, 'utf8'))
    await writeFile(registry, JSON.stringify({ ...record, directory: unowned }))
    assert.equal((await recoverUsage(true, root)).unconfirmed, 1)
    await access(journal); await access(unowned)
  } finally { await rm(unowned, { recursive: true, force: true }) }
}))

test('recovery waits for the stopped helper owner to finish flushing before touching receipts', async () => fixture(async ({ root, helper }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!()
  let finished = false
  const retry = recoverUsage(true, root).then(value => { finished = true; return value })
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(finished, false)
  await recorder.settled!()
  assert.equal((await retry).recovered, 1)
}))

test('junctions and malformed journals fail without removing raw or outside files', async () => fixture(async ({ root, helper, journal }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!(); await recorder.settled!()
  await writeFile(journal, 'PRIVATE malformed transcript')
  assert.equal((await recoverUsage(true, root)).failed, 1)
  await access(journal)
  const home = join(helper, 'home'), moved = join(helper, 'saved-home')
  await rename(home, moved)
  await symlink(moved, home, 'junction')
  assert.equal((await recoverUsage(true, root)).failed, 1)
  assert.equal(await readFile(join(moved, 'session-state', id, 'events.jsonl'), 'utf8'), 'PRIVATE malformed transcript')
}))

test('inspection is read-only and successful replay survives interrupted cleanup without replaying twice', async () => fixture(async ({ root, helper, receipt }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!(); await recorder.flush(); await recorder.committed!(); await recorder.settled!()
  const inspected = await recoverUsage(false, root, true)
  assert.equal(inspected.pending, 1)
  await access(helper)
  // Simulate cleanup completing before a process crash leaves the registry entry behind.
  await rm(helper, { recursive: true })
  let consumed = false
  const result = await recoverUsageJournals(root, async () => { consumed = true }, { manual: true })
  assert.equal(consumed, false)
  assert.equal(result.recovered, 1)
  await access(receipt)
}))

test('clearing history through the real storage adapter preserves usage receipts and the recovery registry', async () => fixture(async ({ root, helper, receipt }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  recorder.record(event('one')); await recorder.flush()
  const services = createServices({ sessionId: 'history-fixture' } as never, root)
  await services.settings.get()
  await services.storage.set('history', [{ id: 'saved', at: 1, original: 'private', enhanced: 'private' }])
  const worker = createWorkerHost(services)
  activate(worker.api)
  try {
    await worker.request('history.clear')
    assert.equal(await services.storage.get('history'), null)
    await access(receipt)
    await access(join(root, 'recovery', `${id}.json`))
    await access(helper)
  } finally { await worker.deactivate() }
}))

test('a recovery pass attempts at most eight stopped journals', async () => fixture(async ({ root, helper, journal }) => {
  const base = join(helper, '..')
  for (let index = 0; index < 9; index++) {
    const sessionId = `12345678-1234-4234-8234-${String(index).padStart(12, '0')}`
    const directory = await mkdtemp(join(base, 'enhance-copilot-batch-'))
    const path = join(directory, 'home', 'session-state', sessionId)
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'events.jsonl'), await readFile(journal, 'utf8'))
    const recorder = await createUsageRecorder(sessionId, root, { helperDirectory: directory })
    await recorder.stopped!(); await recorder.settled!()
  }
  let calls = 0
  const first = await recoverUsageJournals(root, async () => { calls++ }, { manual: true })
  assert.equal(calls, 8)
  assert.equal(first.recovered, 8)
  assert.equal(first.deferred, 1)
  const second = await recoverUsageJournals(root, async () => { calls++ }, { manual: true })
  assert.equal(calls, 9)
  assert.equal(second.recovered, 1)
}))

test('partial Windows cleanup retains ownership and a later retry removes the stopped helper', { skip: process.platform !== 'win32' }, async () => fixture(async ({ root, helper }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!(); await recorder.flush(); await recorder.committed!(); await recorder.settled!()
  const raw = join(helper, 'locked-transcript.txt')
  await writeFile(raw, 'PRIVATE transcript')
  const child = spawn('powershell.exe', ['-NoProfile', '-Command', '$f=[System.IO.File]::Open($env:EP_TEST_LOCK_PATH,"Open","ReadWrite","None"); [Console]::WriteLine("ready"); [Console]::ReadLine() | Out-Null; $f.Dispose()'], { windowsHide: true, env: { ...process.env, EP_TEST_LOCK_PATH: raw }, stdio: ['pipe', 'pipe', 'pipe'] })
  const exited = once(child, 'exit')
  try {
    assert.match(String((await once(child.stdout, 'data'))[0]), /ready/)
    assert.equal((await recoverUsage(true, root)).failed, 1)
    await access(join(helper, '.enhance-usage-owner.json'))
    await access(raw)
  } finally { child.stdin.end('\n'); await exited }
  assert.equal((await recoverUsage(true, root)).recovered, 1)
  await assert.rejects(access(helper), { code: 'ENOENT' })
}))

test('marker-last crash recovery removes only the verified empty committed directory', async () => fixture(async ({ root, helper }) => {
  const recorder = await createUsageRecorder(id, root, { helperDirectory: helper })
  await recorder.stopped!(); await recorder.flush(); await recorder.committed!(); await recorder.settled!()
  await rm(join(helper, '.enhance-usage-owner.json'))
  assert.equal((await recoverUsage(true, root)).unconfirmed, 1, 'unmarked nonempty data is never removed')
  await rm(join(helper, 'home'), { recursive: true })
  assert.equal((await recoverUsage(true, root)).recovered, 1)
  await assert.rejects(access(helper), { code: 'ENOENT' })
}))
