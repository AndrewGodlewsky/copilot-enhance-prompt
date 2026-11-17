// Synthetic typing bursts against disposable production session storage.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createSaveQueue } from '../../src/save-queue.ts'
import { createServices } from '../../src/copilot/services.ts'
import { VERSION } from '../../src/version.ts'

const root = await mkdtemp(join(tmpdir(), 'enhance-draft-benchmark-'))
const report = { version: VERSION, capturedAt: new Date().toISOString(), node: process.version, platform: process.platform,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), workingTreeModified: true,
  syntheticOnly: true, modelCalls: 0, measurements: [], sourceHashes: {},
  method: 'Burst while the first save is held, then drain real atomic disk writes and reopen through a new service. Timings include burst submission and drain; no rendering, network or realistic typing cadence. Endpoint memory is not peak memory. Old sequential writes measured only at 100/1000; no extrapolated time for larger bursts.' }
for (const file of ['src/save-queue.ts', 'src/copilot/services.ts', 'src/copilot/storage.ts', 'scripts/audit/draft-saves.mjs']) report.sourceHashes[file] = createHash('sha256').update((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')).digest('hex')
try {
  for (const count of [100, 1000, 10000, 30000]) for (const coalesced of count <= 1000 ? [false, true] : [true]) {
    const directory = join(root, `${count}-${coalesced}`), session = {sessionId: 'synthetic'}
    const services = createServices(session, directory)
    await services.settings.get()
    let release; const gate = new Promise(resolve => { release = resolve })
    let writes = 0
    const write = async operations => {
      if (++writes === 1) await gate
      if (coalesced) await services.storage.patch(Object.fromEntries(operations.map(op => [op.key, op.value])))
      else await services.storage.set(operations[0].key, operations[0].value)
    }
    const queue = createSaveQueue(write)
    let chain = Promise.resolve()
    const submit = value => {
      const operations = [{scope:'storage',key:'panel:draft',value}]
      if (coalesced) return queue.enqueue(operations[0])
      chain = chain.then(() => write(operations)); return chain
    }
    global.gc?.(); const memoryBefore = process.memoryUsage(), started = performance.now()
    void submit('Initial request')
    await new Promise(resolve => setImmediate(resolve))
    const pending = []
    for (let index = 0; index < count; index++) pending.push(submit(`Final ${index}: 日本語 🧪, path src/main.ts, "quoted" text`))
    const pendingEntries = coalesced ? queue.snapshot().pending : count + 1
    release(); await Promise.all(pending); if (coalesced) await queue.flush()
    const ms = +(performance.now() - started).toFixed(3), memoryAfter = process.memoryUsage()
    const reopened = createServices(session, directory)
    assert.equal(await reopened.storage.get('panel:draft'), `Final ${count - 1}: 日本語 🧪, path src/main.ts, "quoted" text`)
    assert.equal(writes, coalesced ? 2 : count + 1)
    report.measurements.push({edits:count,coalesced,writes,pendingEntries,ms,heapUsedBytes:memoryAfter.heapUsed,heapDeltaBytes:memoryAfter.heapUsed-memoryBefore.heapUsed,rssBytes:memoryAfter.rss,finalValueVerified:true})
    console.log(`${count} ${coalesced ? 'coalesced' : 'sequential'}: ${writes} writes, ${ms} ms; final value verified`)
  }
  await writeFile('docs/audits/v1/draft-save-measurements.json', JSON.stringify(report, null, 2) + '\n')
} finally { await rm(root, {recursive:true,force:true}) }
