// Effort assignments use the Copilot catalog while preserving saved profile choices.
import { assert, mockHost, mountWorker, test } from '#testing'
import { enhanceNow, setSetting, openSection } from './panel/actions.ts'
import { draft, put, effort, effortModels, dataSummary, tab } from './panel/state.ts'
import { read, set } from '#panel'
import { mountPanel } from './panel/testing.ts'
import { effortModelOptions, effortModelLabel } from './panel/view.ts'
import { type ProfileView } from './presets.ts'
import * as main from './worker.ts'

const claude: ProfileView = {
  id: 'claude', name: 'Claude Sonnet', preset: 'copilot', provider: 'copilot', model: 'claude-sonnet-4.5', enabled: true, effectiveModel: 'claude-sonnet-4.5'
}
const gpt: ProfileView = { ...claude, id: 'gpt', name: 'GPT-5 mini', model: 'gpt-5-mini', effectiveModel: 'gpt-5-mini' }

test('opening Settings loads its data summary on first navigation', async () => {
  const summary = { history: 2, profiles: 1, catalogs: 1 }
  const host = mockHost({ requests: { 'models.get': { profiles: [claude], selectorProfileId: null }, 'data.summary': summary } })
  const panel = await mountPanel(host)
  try {
    assert.equal(read(dataSummary), null)
    openSection('privacy')
    await panel.settled()
    assert.equal(read(tab), 'privacy')
    assert.deepEqual(read(dataSummary), summary)
    assert.ok(!host.callsOf('plugin.request').some(call => call.name === 'hook.last'))
  } finally { await panel.unmount() }
})

test('lists models for effort settings and sends the selected effort without stale model fields', async () => {
  const sent: { effort?: string; profileId?: string | null; model?: string }[] = []
  const host = mockHost({
    requests: {
      'models.get': { profiles: [claude, gpt], selectorProfileId: null },
      'targets.list': { targets: [] },
      'models.catalog': () => ({
        models: [{ id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' }, { id: 'gpt-5-mini', label: 'GPT-5 mini' }],
        source: 'Copilot', fetchedAt: 1
      }),
      'prompt.enhance': (input) => {
        sent.push(input)
        return { enhanced: 'ok', model: input.model ?? 'claude-sonnet-4.5', profileName: 'Claude Sonnet', ms: 1, attempts: [], context: [], notes: [] }
      }
    }
  })
  const view = await mountPanel(host)
  assert.deepEqual(
    effortModelOptions('low').map(option => option.value),
    ['recommended', 'catalog:claude-sonnet-4.5', 'catalog:gpt-5-mini', 'auto']
  )
  await setSetting('effortLowModel', 'claude|claude-sonnet-4.5')
  await setSetting('effortMediumModel', 'claude|gpt-5-mini')
  await setSetting('effortHighModel', 'gpt|gpt-5-mini')
  assert.equal(read(effortModels).low, 'claude|claude-sonnet-4.5')
  assert.match(effortModelLabel('low'), /Claude Sonnet 4.5/)
  put(draft, 'fix it')
  for (const tier of ['low', 'medium', 'high']) {
    set(effort, tier)
    await enhanceNow()
    assert.equal(sent.at(-1)?.effort, tier)
    assert.equal(sent.at(-1)?.model, undefined)
    assert.equal(sent.at(-1)?.profileId, undefined)
  }
  // Corrupt old panel state normalizes to Medium; saved assignments stay unchanged.
  set(effort, 'not-a-tier')
  await enhanceNow()
  assert.equal(sent.at(-1)?.effort, 'medium')
  await setSetting('effortLowModel', 'deleted|model')
  assert.equal(effortModelOptions('low').at(-1)?.value, 'deleted|model')
  assert.match(effortModelLabel('low'), /Unavailable assignment/)
  // A pinned model missing from a refreshed catalog remains visibly selected.
  await setSetting('effortMediumModel', 'claude|older-model')
  assert.match(effortModelLabel('medium'), /older-model.*saved/)
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('the worker runs the picked Copilot model and preserves its saved profile', async () => {
  const profile = { id: 'copilot', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-5-mini', enabled: true }
  const host = mockHost({ storage: { models: { profiles: [profile] } }, results: {
    'workspace.readContext': null,
    'copilot.catalog': { models: [{ id: 'gpt-5', label: 'GPT-5' }, { id: 'gpt-5-mini', label: 'GPT-5 mini' }], source: 'Copilot', fetchedAt: 1 },
    'copilot.rewrite': { text: 'done' }
  } })
  const worker = await mountWorker(main, { host })
  try {
    const answer = await worker.request('prompt.enhance', { prompt: 'x y z', level: 'off', profileId: 'copilot', model: 'gpt-5' })
    assert.equal(host.callsOf('copilot.rewrite')[0].model, 'gpt-5')
    assert.equal(answer.model, 'gpt-5')
    assert.equal((await worker.request('models.get')).profiles[0].model, 'gpt-5-mini')
  } finally { await worker.deactivate() }
})
