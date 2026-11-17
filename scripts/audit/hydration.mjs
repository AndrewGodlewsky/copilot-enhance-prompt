// Production state restoration over authenticated loopback HTTP; no UI or model calls.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { promises as fs } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import * as runtime from '../../src/runtime.ts'
import { historyRaw, KEPT } from '../../src/panel/state.ts'
import { createServices } from '../../src/copilot/services.ts'
import { createWorkerHost } from '../../src/worker-host.ts'
import { createCanvasServer } from '../../src/copilot/server.ts'
import { persistentStore } from '../../src/copilot/storage.ts'
import { VERSION } from '../../src/version.ts'

const root = await mkdtemp(join(tmpdir(), 'enhance-hydration-benchmark-')), original = fs.readFile
const report = { version: VERSION, capturedAt: new Date().toISOString(), node: process.version, platform: process.platform,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeModified: true,
  heapLimitArgument: process.execArgv, modelCalls: 0, syntheticOnly: true, measurements: [], sourceHashes: {} }
for (const file of ['src/runtime.ts', 'src/copilot/services.ts', 'src/copilot/storage.ts', 'src/copilot/store-observer.ts', 'src/copilot/server.ts', 'scripts/audit/hydration.mjs']) report.sourceHashes[file] = createHash('sha256').update((await readFile(file, 'utf8')).replaceAll('\r\n', '\n')).digest('hex')
const summarize = samples => ({ samples, medianMs: [...samples.map(sample => sample.ms)].sort((a,b) => a-b)[Math.floor(samples.length/2)] })
async function measure(name, run, counters, repetitions = 7) {
  const samples = []
  for (let n = 0; n < repetitions; n++) {
    global.gc?.(); counters.reads = 0; counters.requests = 0
    const before = process.memoryUsage(), start = performance.now()
    await run()
    const after = process.memoryUsage()
    samples.push({ ms: +(performance.now() - start).toFixed(3), fileReads: counters.reads, requests: counters.requests,
      heapUsedBytes: after.heapUsed, heapDeltaBytes: after.heapUsed - before.heapUsed, rssBytes: after.rss })
  }
  const result = { name, ...summarize(samples) }; report.measurements.push(result)
  console.log(`${name}: ${result.medianMs} ms; ${samples.at(-1).fileReads} reads, ${samples.at(-1).requests} HTTP calls`)
}
let server, worker
try {
  const assets = join(root, 'assets'); await mkdir(assets)
  const services = createServices({ sessionId: 'synthetic-hydration' }, join(root, 'state'))
  await services.settings.get()
  worker = createWorkerHost(services); server = await createCanvasServer({ worker, assets })
  const url = server.open('benchmark'), token = new URL(url).pathname.split('/')[2]
  // Observer startup is measured separately in instrumented tests, not charged to one mode.
  await new Promise(resolve => setTimeout(resolve, 550))
  const counters = { reads: 0, requests: 0 }
  fs.readFile = (async (...args) => { if (String(args[0]).startsWith(join(root, 'state'))) counters.reads++; return original(...args) })
  syncBuiltinESMExports()
  const call = async (method, input) => {
    counters.requests++
    const response = await fetch(url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method, input }) })
    assert.equal(response.status, 200)
    return (await response.json()).result
  }
  for (const count of [50, 500]) {
    const history = Array.from({ length: count }, (_, n) => ({ id: `synthetic-${n}`, original: 'Request 日本語. '.repeat(25), enhanced: 'Prepared response. '.repeat(60) }))
    const parked = Object.fromEntries(Array.from({ length: 20 }, (_, n) => [`project-${n}`, { draft: 'd'.repeat(4000), result: 'r'.repeat(6000) }]))
    await services.storage.set('history', history)
    await services.storage.set('panel:parked', parked)
    await services.storage.set('panel:draft', 'Keep original 🧪')
    await new Promise(resolve => setTimeout(resolve, 550))
    for (const bulk of [false, true]) await measure(`production-hydration-${count}-history-${bulk ? 'bulk' : 'single'}`, async () => {
      runtime.bindPanel({ storage: { get: key => call('storage.get', { key }),
        ...(bulk ? { getMany: keys => call('storage.getMany', { keys }) } : {}), onDidChange: () => ({ dispose() {} }) } })
      await runtime.ready()
      assert.deepEqual(runtime.read(historyRaw), history)
      for (const [, saved] of KEPT) if (saved.key === 'draft') assert.equal(runtime.read(saved), 'Keep original 🧪')
    }, counters)
  }
  // Retain the original audit's pathological shared-store comparison, separate
  // from current production layout. This does not create 30k retained history rows.
  const stress = persistentStore(join(root, 'legacy-stress'))
  const values = Object.fromEntries(Array.from({ length: 30000 }, (_, n) => [`session:${n.toString(16).padStart(24, '0')}:panel:draft`, 'd'.repeat(2048)]))
  await stress.patch(values)
  const key = Object.keys(values)[0]
  fs.readFile = (async (...args) => { if (String(args[0]).startsWith(join(root, 'legacy-stress'))) counters.reads++; return original(...args) })
  syncBuiltinESMExports()
  await measure('legacy-stress-20-redundant-reads', async () => { for (let n=0;n<20;n++) assert.equal((await stress.get(key)).length, 2048) }, counters, 3)
  await measure('legacy-stress-one-snapshot', async () => { const saved = await stress.snapshot(); for (let n=0;n<20;n++) assert.equal(saved[key].length, 2048) }, counters, 3)
  await writeFile('docs/audits/v1/hydration-measurements.json', JSON.stringify(report, null, 2) + '\n')
} finally {
  fs.readFile = original; syncBuiltinESMExports()
  await server?.close(); await worker?.deactivate()
  await rm(root, { recursive: true, force: true })
}
