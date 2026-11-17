import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServices } from './copilot/services.ts'
import { persistentStore } from './copilot/storage.ts'
import { createWorkerHost } from './worker-host.ts'
import { mockHost } from './testing.ts'
import activate from './worker.ts'

test('settings enforce finite integer ranges at the durable backend, including legacy preferences', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-limits-'))
  try {
    const services = createServices({ sessionId: 'limits' } as never, root)
    for (const [key, values] of Object.entries({ historyLimit: [-1, 501, 1.5, Infinity, NaN], timeoutSeconds: [0, 301, 5.5, Infinity] })) {
      for (const value of values) await assert.rejects(services.settings.set(key, value), /Invalid/)
    }
    await services.settings.set('historyLimit', 500)
    await services.settings.set('timeoutSeconds', 5)
    assert.equal(await services.settings.get('historyLimit'), 500)
    await persistentStore(join(root, 'preferences')).set('historyLimit', 500_000)
    assert.equal(await services.settings.get('historyLimit'), 500)
    assert.equal(await persistentStore(join(root, 'preferences')).get('historyLimit'), 500_000, 'safe effective values do not erase saved data')
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5 }) }
})

test('malformed and excessive request lists fail before handlers run', async () => {
  const worker = createWorkerHost(mockHost())
  let calls = 0
  for (const name of ['prompt.enhance', 'models.move', 'rules.save'] as const) worker.api.panels.handle(name, (() => { calls++; return {} }) as never)
  try {
    for (const input of [{ prompt: 7 }, { prompt: 'ok', files: Array(9).fill('file') }, { prompt: 'ok', exclude: Array(1025).fill('file') }]) {
      await assert.rejects(worker.request('prompt.enhance', input as never), /limit|Invalid/)
    }
    await assert.rejects(worker.request('models.move', { id: 'a', to: Infinity }), /Invalid/)
    await assert.rejects(worker.request('rules.save', { config: { rules: Array(1001).fill({}), structures: [] } } as never), /limit/)
    assert.equal(calls, 0)
    await worker.request('prompt.enhance', { prompt: 'Unicode 日本語 stays intact', files: [] })
    assert.equal(calls, 1)
  } finally { await worker.deactivate() }
})

test('outstanding worker quota stays reserved after caller cancellation until actual work settles', async () => {
  const worker = createWorkerHost(mockHost())
  const release: (() => void)[] = []
  worker.api.panels.handle('models.get', async () => { await new Promise<void>(resolve => release.push(resolve)); return { profiles: [], selectorProfileId: null } })
  const stop = new AbortController()
  const pending = Array.from({ length: 32 }, () => worker.request('models.get', undefined, { signal: stop.signal }).catch(() => null))
  while (release.length !== 32) await new Promise(resolve => setTimeout(resolve, 1))
  try {
    await assert.rejects(worker.request('models.get'), { code: 'rate_limited' })
    stop.abort(); await Promise.all(pending)
    await assert.rejects(worker.request('models.get'), { code: 'rate_limited' })
  } finally { release.forEach(done => done()); await new Promise(resolve => setTimeout(resolve, 1)) }
  worker.api.panels.handle('models.get', () => ({ profiles: [], selectorProfileId: null }))
  assert.deepEqual(await worker.request('models.get'), { profiles: [], selectorProfileId: null })
  await worker.deactivate()
})

test('upload concurrency has its own cap and leaves room for diagnostics', async () => {
  const worker = createWorkerHost(mockHost())
  const release: (() => void)[] = []
  worker.api.panels.handle('attachments.put', async () => { await new Promise<void>(resolve => release.push(resolve)); return { received: 0 } })
  const input = { id: 'att-quota', name: 'a', index: 0, total: 1, data: '' }
  const pending = Array.from({ length: 8 }, () => worker.request('attachments.put', input))
  try {
    await assert.rejects(worker.request('attachments.put', input), { code: 'rate_limited' })
    assert.ok((await worker.request('logs.get')).entries)
  } finally { release.forEach(done => done()); await Promise.all(pending); await worker.deactivate() }
})

test('enhancement saturation refuses a fifth model run before inference', async () => {
  const release: (() => void)[] = []
  const worker = createWorkerHost(mockHost({ settings: { saveHistory: false }, storage: { models: { profiles: [
    { id: 'fixture', name: 'Fixture', model: 'fixture', provider: 'copilot', preset: 'copilot', enabled: true }
  ] } }, results: { 'copilot.rewrite': async () => {
    await new Promise<void>(resolve => release.push(resolve)); return { text: 'Enhanced' }
  } } }))
  activate(worker.api)
  const pending = Array.from({ length: 4 }, (_, index) => worker.request('prompt.enhance', { prompt: 'Test', level: 'off' }, { panelId: `canvas-${index}` }))
  try {
    while (release.length !== 4) await new Promise(resolve => setTimeout(resolve, 1))
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Fifth', level: 'off' }), { code: 'rate_limited' })
    assert.equal(release.length, 4)
  } finally { release.forEach(done => done()); await Promise.all(pending); await worker.deactivate() }
})
