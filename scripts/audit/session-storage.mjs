// Synthetic offline comparison. The baseline is the old shared-file access pattern.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile, stat, readdir, rm } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { execFileSync } from 'node:child_process'
import { persistentStore } from '../../src/copilot/storage.ts'
import { createServices } from '../../src/copilot/services.ts'
import { VERSION } from '../../src/version.ts'

const artifactRoot = resolve('.artifacts/session-storage')
await mkdir(artifactRoot, { recursive: true })
const base = await mkdtemp(join(artifactRoot, 'run-'))
const scope = id => createHash('sha256').update(id).digest('hex').slice(0, 24)
const session = sessionId => ({ sessionId }) // No host/model operation is called.
const hash = value => createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex')
const sourceFiles = ['src/copilot/services.ts', 'src/copilot/storage.ts', 'src/copilot/session-storage.ts', 'scripts/audit/session-storage.mjs']
const report = { version: VERSION, capturedAt: new Date().toISOString(), node: process.version, platform: process.platform, architecture: process.arch,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeModified: true,
  sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, hash(await readFile(path, 'utf8'))]))),
  syntheticOnly: true, modelCalls: 0, measurements: [] }
async function measure(fn, times = 7) {
  const samples = []
  for (let n = 0; n < times; n++) { const start = performance.now(); await fn(n); samples.push(+(performance.now() - start).toFixed(3)) }
  return { samplesMs: samples, medianMs: [...samples].sort((a,b) => a-b)[Math.floor(samples.length/2)] }
}
try {
  for (const count of [100, 1000, 10000, 30000]) {
    const directory = join(base, String(count)), root = join(directory, 'data')
    await mkdir(root, { recursive: true })
    const values = { rules: { keep: 'Unicode 日本語 🧪' }, history: [{ original: 'Unrelated saved history' }] }
    for (let n = 0; n < count; n++) {
      values[`session:${scope(String(n))}:panel:draft`] = 'd'.repeat(1024)
      values[`session:${scope(String(n))}:panel:lastEnhanced`] = 'r'.repeat(1024)
    }
    await writeFile(join(root, 'state.json'), JSON.stringify(values))
    const old = persistentStore(root), key = `session:${scope('0')}:panel:draft`, bytes = (await stat(join(root, 'state.json'))).size
    const baselineRead = await measure(async () => assert.equal(await old.get(key), 'd'.repeat(1024)))
    const baselineWrite = await measure(() => old.set(key, 'd'.repeat(1024)))
    const clients = Array.from({ length: 4 }, (_, n) => createServices(session(String(n)), directory))
    const migration = await measure(() => clients[0].storage.get('panel:draft'), 1)
    await Promise.all(clients.map(client => client.settings.get()))
    const read = await measure(async () => assert.equal(await clients[0].storage.get('panel:draft'), 'd'.repeat(1024)))
    const write = await measure(() => clients[0].storage.set('panel:draft', 'd'.repeat(1024)))
    const concurrentWrites = await measure(n => Promise.all(clients.map((client, index) => client.storage.set('panel:check', `${n}:${index}`))))
    for (let n = 0; n < 4; n++) assert.equal(await clients[n].storage.get('panel:check'), `6:${n}`)
    const global = await old.snapshot()
    assert.deepEqual(global.rules, values.rules); assert.deepEqual(global.history, values.history)
    assert.ok(!Object.keys(global).some(key => key.startsWith('session:')))
    // Verify every migrated body, not just the session used for timings.
    const names = await readdir(join(root, 'sessions'))
    assert.equal(names.length, count)
    let sessionBytes = 0
    for (const name of names) {
      const text = await readFile(join(root, 'sessions', name), 'utf8'), saved = JSON.parse(text), id = name.slice(0, -5)
      assert.equal(saved['panel:draft'], values[`session:${id}:panel:draft`])
      assert.equal(saved['panel:lastEnhanced'], values[`session:${id}:panel:lastEnhanced`])
      sessionBytes += Buffer.byteLength(text)
    }
    const result = { sessions: count, legacyBytes: bytes, sharedBytes: (await stat(join(root, 'state.json'))).size, sessionBytes,
      baselineRead, baselineWrite, migration, read, write, concurrentWrites, allBodiesVerified: true }
    report.measurements.push(result)
    console.log(`${count} sessions: shared write ${baselineWrite.medianMs} ms, partitioned ${write.medianMs} ms; migration ${migration.medianMs} ms`)
  }
  await writeFile(resolve('docs/audits/v1/session-storage-measurements.json'), JSON.stringify(report, null, 2) + '\n')
} finally {
  assert.ok(relative(artifactRoot, base) && !relative(artifactRoot, base).startsWith('..'))
  await rm(base, { recursive: true, force: true })
}
