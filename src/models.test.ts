import { assert, mockHost, mountWorker, test } from '#testing'
import { candidates, runChain } from './models.ts'
import { normalizeProfile, parseModelsConfig, type ModelProfile } from './presets.ts'
import * as main from './worker.ts'

const profile: ModelProfile = { id: 'copilot', name: 'Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-5', enabled: true }

test('saved model parsing rejects external and mismatched identities without converting them', () => {
  for (const value of [
    { ...profile, preset: 'openai', provider: 'openai' },
    { ...profile, preset: 'copilot', provider: 'openai' },
    { ...profile, preset: 'custom-cli', provider: 'copilot' },
    { ...profile, preset: undefined },
    { ...profile, provider: undefined }
  ]) assert.equal(normalizeProfile(value), null)
  assert.deepEqual(parseModelsConfig({ profiles: [profile, { ...profile, id: 'old', preset: 'openai', provider: 'openai' }], selectorProfileId: 'old' }), { profiles: [profile], selectorProfileId: 'old' })
  assert.equal(parseModelsConfig({ profiles: [profile], selectorProfileId: '../invalid' }).selectorProfileId, null)
})

test('selector roles require an enabled Copilot profile or an explicit chain choice', async () => {
  const host = mockHost({ storage: { models: { profiles: [profile, { ...profile, id: 'disabled', enabled: false }], selectorProfileId: 'retired' } } })
  const worker = await mountWorker(main, { host })
  try {
    for (const selectorProfileId of ['missing', 'disabled', '']) {
      await assert.rejects(worker.request('models.roles', { selectorProfileId }), /Select an enabled Copilot model for AI-assisted context/)
      assert.equal((await worker.request('models.get')).selectorProfileId, 'retired')
    }
    assert.equal((await worker.request('models.roles', { selectorProfileId: profile.id })).selectorProfileId, profile.id)
    assert.equal((await worker.request('models.roles', { selectorProfileId: null })).selectorProfileId, null)
  } finally { await worker.deactivate() }
})

test('model handlers reject external and stale identities before touching Copilot', async () => {
  const host = mockHost({ storage: { models: { profiles: [profile] } }, results: { 'copilot.catalog': { models: [], source: 'GitHub Copilot', fetchedAt: 1 } } })
  const worker = await mountWorker(main, { host })
  try {
    for (const input of [
      { name: 'Forged', preset: 'openai', provider: 'openai', model: 'x', enabled: true },
      { name: 'Forged', preset: 'copilot', provider: 'anthropic', model: 'x', enabled: true },
      { name: 'Legacy', baseUrl: 'https://api.example.invalid', model: 'x', enabled: true },
      { name: 'Legacy', command: 'external-model', model: 'x', enabled: true },
      { name: 'Legacy', apiKey: 'fixture-only', model: 'x', enabled: true },
      { name: 'Stale', id: 'deleted', model: 'x', enabled: true }
    ]) await assert.rejects(worker.request('models.save', input as never), /profile/i)
    for (const input of [{ preset: 'openai' }, { preset: 'copilot', provider: 'openai' }, { profileId: 'deleted' }, { baseUrl: 'https://api.example.invalid' }, { command: 'external-model' }, { apiKey: 'fixture-only' }]) {
      await assert.rejects(worker.request('models.catalog', input as never), /profile/i)
    }
    assert.equal(host.callsOf('copilot.catalog').length, 0)
  } finally { await worker.deactivate() }
})

test('a forged chain cannot invoke any model route', async () => {
  const forged = { ...profile, provider: 'openai', preset: 'openai' } as unknown as ModelProfile
  assert.deepEqual(candidates([forged, profile], forged.id, true), [])
  const host = mockHost({ results: { 'copilot.rewrite': { text: 'unexpected' } } })
  const worker = await mountWorker(main, { host })
  try {
    await assert.rejects(runChain(worker.api, [forged, profile], 'system', 'user', { timeoutMs: 1000, fallback: true, fallbackOn: 'any' }), /profile/i)
    assert.equal(host.callsOf('copilot.rewrite').length, 0)
  } finally { await worker.deactivate() }
})
