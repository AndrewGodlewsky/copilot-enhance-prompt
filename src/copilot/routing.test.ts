import { test, assert, mockHost, mountWorker } from '#testing'
import * as workerModule from '../worker.ts'
import { candidates, runChain } from '../models.ts'
import { normalizeProfile } from '../presets.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LlmError } from '../llm.ts'
import { msg } from '../messages.ts'

const copilot = normalizeProfile({ id: 'copilot', preset: 'copilot', model: 'model-a' })!
const external = normalizeProfile({ id: 'external', preset: 'ollama', model: 'other' })!

test('an accounting failure cannot retry a potentially charged rewrite on a fallback model', async () => {
  const host = mockHost({ results: { 'copilot.rewrite': () => { throw new LlmError(msg('error.copilot_usage'), 'action_failed') } } })
  const worker = await mountWorker(workerModule, { host })
  try {
    await assert.rejects(runChain(worker.api, [copilot, { ...copilot, id: 'backup' }], 'Rewrite', 'Draft', { timeoutMs: 1000, fallback: true, fallbackOn: 'any' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 1)
  } finally { await worker.deactivate() }
})

test('Copilot profiles cannot carry executable/endpoint overrides or use provider keys', async () => {
  const profile = normalizeProfile({ ...copilot, provider: 'openai', baseUrl: 'https://evil', command: 'evil', args: '--evil' })!
  assert.equal(profile.provider, 'copilot')
  assert.equal(profile.baseUrl, '')
  assert.equal(profile.command, '')
  const host = mockHost({ storage: { models: { profiles: [external] } } })
  const worker = await mountWorker(workerModule, { host })
  try {
    await assert.rejects(worker.request('models.save', { ...copilot, apiKey: 'do-not-store' }))
    const models = await worker.request('models.save', copilot)
    assert.deepEqual(models.profiles.map(profile => profile.id), ['external', models.profiles[1].id])
    assert.equal(models.profiles[1].keySource, 'copilot')
    assert.equal(Object.keys(host.data().secrets).length, 0)
  } finally { await worker.deactivate() }
})

test('Copilot fallback never crosses the provider boundary, even if passed an unsanitized chain', async () => {
  assert.deepEqual(candidates([external, copilot], copilot.id, true), [copilot])
  assert.deepEqual(candidates([copilot, external], external.id, true), [external])
  const host = mockHost({ results: { 'copilot.rewrite': () => { throw new Error('Unavailable') } } })
  const worker = await mountWorker(workerModule, { host })
  const realFetch = globalThis.fetch
  let fetches = 0
  globalThis.fetch = async () => { fetches++; throw new Error('Unexpected external provider') }
  try {
    await assert.rejects(runChain(worker.api, [copilot, external], 'Rewrite', 'Private draft', { timeoutMs: 1000, fallback: true, fallbackOn: 'any' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 1)
    assert.equal(fetches, 0)
  } finally { globalThis.fetch = realFetch; await worker.deactivate() }
})

test('a removed selected profile cannot silently become Auto and use an external provider', () => {
  assert.deepEqual(candidates([external], 'removed-copilot-profile', true), [])
})

test('editing an existing external profile to Copilot loads the Copilot catalog', async () => {
  const host = mockHost({ storage: { models: { profiles: [external] } }, results: {
    'copilot.catalog': { models: [{ id: 'model-a', label: 'Model A' }], source: 'GitHub Copilot', fetchedAt: Date.now() }
  } })
  const worker = await mountWorker(workerModule, { host })
  try {
    const catalog = await worker.request('models.catalog', { preset: 'copilot', profileId: external.id, provider: 'copilot' })
    assert.equal(catalog.source, 'GitHub Copilot')
    assert.equal(host.callsOf('copilot.catalog').length, 1)
  } finally { await worker.deactivate() }
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

test('a converted or disabled hook preference falls back only to another enabled API profile', async () => {
  const realFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'API rewritten prompt' } }] })) }
  try {
    for (const oldHook of [copilot, { ...external, id: 'disabled-api', enabled: false }]) {
      const host = mockHost({ settings: { autoEnhanceMode: 'ai' }, storage: { models: { profiles: [oldHook, external], hookProfileId: oldHook.id } } })
      const worker = await mountWorker(workerModule, { host })
      try {
        const result = await worker.hooks.fire('agent.prompt.before', { prompt: 'Improve the login screen', agent: 'copilot', terminalId: 'one', inputKind: 'launch' })
        assert.equal(result.kind === 'continue' && result.event.prompt, 'API rewritten prompt')
        assert.equal(host.callsOf('copilot.rewrite').length, 0)
      } finally { await worker.deactivate() }
    }
    assert.equal(calls, 2)
  } finally { globalThis.fetch = realFetch }
})

test('Max context uses Copilot for picking files even when an external selector was saved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-routing-test-'))
  await writeFile(join(directory, 'app.ts'), 'export const login = true')
  const host = mockHost({ storage: { models: { profiles: [external, copilot], selectorProfileId: external.id } }, results: {
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
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Improve login', profileId: 'removed-copilot-profile', level: 'max' }))
    assert.equal(host.callsOf('copilot.rewrite').length, 0)
    assert.equal(fetches, 0)
    const result = await worker.request('prompt.enhance', { prompt: 'Improve login', profileId: copilot.id, model: 'chosen-model', level: 'max' })
    assert.equal(result.enhanced, 'Improve the login screen.')
    assert.equal(fetches, 0)
    assert.equal(host.callsOf('copilot.rewrite').length, 2)
    assert.ok(host.callsOf('copilot.rewrite').every(input => input.model === 'chosen-model'))
    const roles = await worker.request('models.roles', { hookProfileId: copilot.id, selectorProfileId: copilot.id })
    assert.equal(roles.hookProfileId, null)
  } finally { globalThis.fetch = realFetch; await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})
