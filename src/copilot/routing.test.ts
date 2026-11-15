import { test, assert, mockHost, mountWorker } from '#testing'
import * as workerModule from '../worker.ts'
import { candidates, runChain } from '../models.ts'
import { normalizeProfile } from '../presets.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LlmError } from '../llm.ts'
import { msg } from '../messages.ts'

const copilot = normalizeProfile({ id: 'copilot', preset: 'copilot', provider: 'copilot', model: 'model-a' })!
const external = { id: 'external', preset: 'ollama', provider: 'openai', model: 'other', enabled: true } as any

test('an accounting failure cannot retry a potentially charged rewrite on a fallback model', async () => {
  const host = mockHost({ results: { 'copilot.rewrite': () => { throw new LlmError(msg('error.copilot_usage'), 'action_failed') } } })
  const worker = await mountWorker(workerModule, { host })
  try {
    await assert.rejects(runChain(worker.api, [copilot, { ...copilot, id: 'backup' }], 'Rewrite', 'Draft', { timeoutMs: 1000, fallback: true, fallbackOn: 'any' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 1)
  } finally { await worker.deactivate() }
})

test('Copilot fallback never crosses the provider boundary, even if passed an unsanitized chain', async () => {
  assert.deepEqual(candidates([external, copilot], copilot.id, true), [copilot])
  assert.deepEqual(candidates([copilot, external], external.id, true), [])
  const host = mockHost({ results: { 'copilot.rewrite': () => { throw new Error('Unavailable') } } })
  const worker = await mountWorker(workerModule, { host })
  const realFetch = globalThis.fetch
  let fetches = 0
  globalThis.fetch = async () => { fetches++; throw new Error('Unexpected external provider') }
  try {
    await assert.rejects(runChain(worker.api, [copilot, external], 'Rewrite', 'Private draft', { timeoutMs: 1000, fallback: true, fallbackOn: 'any' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 0, 'reject the whole forged chain before executing')
    assert.equal(fetches, 0)
  } finally { globalThis.fetch = realFetch; await worker.deactivate() }
})

test('a removed selected profile cannot silently become Auto and use an external provider', () => {
  assert.deepEqual(candidates([external], 'removed-copilot-profile', true), [])
})

test('Copilot catalogs obey the network setting, stay out of persistent cache, and refresh across requests', async () => {
  let count = 0
  const host = mockHost({ settings: { allowOnlineModelLists: false }, results: {
    'copilot.catalog': () => ({ models: [{ id: `model-${++count}`, label: 'Copilot model' }], source: 'GitHub Copilot', fetchedAt: Date.now() })
  } })
  const worker = await mountWorker(workerModule, { host })
  try {
    assert.equal((await worker.request('models.catalog', { preset: 'copilot' })).models.length, 0)
    assert.equal((await worker.request('logs.get')).copilotModelDiscovery?.stage, 'privacy')
    assert.equal(count, 0)
    await assert.rejects(runChain(worker.api, [copilot], 'Rewrite', 'Private text', { timeoutMs: 1000, fallback: true, fallbackOn: 'any' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 0)
    await host.settings.set('allowOnlineModelLists', true)
    assert.equal((await worker.request('models.catalog', { preset: 'copilot' })).models[0].id, 'model-1')
    assert.equal((await worker.request('models.catalog', { preset: 'copilot' })).models[0].id, 'model-2')
    assert.equal(Object.keys(host.data().storage).filter(key => key.startsWith('catalog:')).length, 0)
  } finally { await worker.deactivate() }
})

test('Max context requires replacing a retired selector before using Copilot for file picking', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-routing-test-'))
  await writeFile(join(directory, 'app.ts'), 'export const login = true')
  const host = mockHost({ settings: { effortMediumModel: 'copilot|chosen-model' }, storage: { models: { profiles: [external, copilot], selectorProfileId: external.id } }, results: {
    'workspace.readContext': { displayName: 'Test', branch: 'main', terminals: [] },
    'workspace.list': { workspaces: [{ id: 'project', name: 'Test', path: directory, branch: null, hostId: null }] },
    'agents.list': { agents: [] },
    'copilot.rewrite': (input: { system: string }) => ({ text: input.system.includes('pick source files') ? '["app.ts"]' : 'Improve the login screen.' })
  } })
  const worker = await mountWorker(workerModule, { host })
  const realFetch = globalThis.fetch
  let fetches = 0
  globalThis.fetch = async () => { fetches++; throw new Error('Unexpected external provider') }
  try {
    await host.settings.set('effortMediumModel', 'removed-copilot-profile|chosen-model')
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Improve login', effort: 'medium', level: 'max' }))
    await host.settings.set('effortMediumModel', 'copilot|chosen-model')
    assert.equal(host.callsOf('copilot.rewrite').length, 0)
    assert.equal(fetches, 0)
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Improve login', effort: 'medium', level: 'max' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 0)
    await worker.request('models.roles', { selectorProfileId: null })
    const result = await worker.request('prompt.enhance', { prompt: 'Improve login', effort: 'medium', level: 'max' })
    assert.equal(result.enhanced, 'Improve the login screen.')
    assert.equal(fetches, 0)
    assert.equal(host.callsOf('copilot.rewrite').length, 2)
    assert.ok(host.callsOf('copilot.rewrite').every(input => input.model === 'chosen-model'))
    const roles = await worker.request('models.roles', { selectorProfileId: copilot.id })
    assert.equal(roles.selectorProfileId, copilot.id)
  } finally { globalThis.fetch = realFetch; await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})
