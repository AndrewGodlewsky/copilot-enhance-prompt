// Effort assignments reuse every enabled profile and its live model list in Settings.
import { assert, mockHost, mountWorker, test } from '#testing'
import { enhanceNow, setSetting, openSection, openForm, applyPreset, patchForm, formCatalogInput, saveForm } from './panel/actions.ts'
import { draft, put, form, effort, effortModels, dataSummary, tab } from './panel/state.ts'
import { read, set } from '#panel'
import { mountPanel } from './panel/testing.ts'
import { modelMenu, effortModelOptions, effortModelLabel } from './panel/view.ts'
import { PRESETS, type ProfileView } from './presets.ts'
import * as main from './worker.ts'

test('switching a keyed form to Copilot clears the key and never sends it in catalog or save requests', async () => {
  const models = { profiles: [], hookProfileId: null, selectorProfileId: null, fromEnv: false, presets: PRESETS }
  const host = mockHost({ requests: { 'models.get': models, 'models.save': models, 'models.catalog': { models: [], source: 'fixture', fetchedAt: 0 } } })
  const panel = await mountPanel(host)
  try {
    openForm()
    applyPreset('openai')
    patchForm({ apiKey: 'private-key' })
    applyPreset('copilot')
    assert.equal(read(form)?.apiKey, '')
    assert.equal(formCatalogInput({ ...read(form)!, apiKey: 'stale-key' }).apiKey, undefined)
    await saveForm()
    const saved = host.callsOf('plugin.request').find(call => call.name === 'models.save')
    assert.equal(saved.input.apiKey, '')
  } finally { await panel.unmount() }
})

const claude: ProfileView = {
  id: 'claude',
  name: 'Claude Code',
  preset: 'claude-code',
  provider: 'cli',
  baseUrl: '',
  model: 'haiku',
  maxTokens: 2000,
  enabled: true,
  command: '',
  args: '',
  keySource: 'subscription',
  envName: '',
  effectiveBaseUrl: '',
  effectiveModel: 'haiku'
}
const codex: ProfileView = { ...claude, id: 'codex', name: 'Codex', preset: 'codex', model: '', effectiveModel: '' }

test('opening effort settings loads the Settings data on first navigation', async () => {
  const summary = { history: 2, profiles: 1, keys: 0, catalogs: 1 }
  const host = mockHost({ requests: { 'models.get': { profiles: [claude], hookProfileId: null, selectorProfileId: null, fromEnv: false, presets: PRESETS }, 'data.summary': summary, 'hook.last': null } })
  const panel = await mountPanel(host)
  try {
    assert.equal(read(dataSummary), null)
    openSection('privacy')
    await panel.settled()
    assert.equal(read(tab), 'privacy')
    assert.deepEqual(read(dataSummary), summary)
    assert.ok(host.callsOf('plugin.request').some(call => call.name === 'hook.last'))
  } finally { await panel.unmount() }
})

test('lists models for effort settings and sends the selected effort without stale model fields', async () => {
  const sent: { effort?: string; profileId?: string | null; model?: string }[] = []
  const host = mockHost({
    requests: {
      'models.get': { profiles: [claude, codex], hookProfileId: null, selectorProfileId: null, fromEnv: false, presets: PRESETS },
      'targets.list': { targets: [] },
      'models.detect': { found: [] },
      'models.catalog': ({ preset }: { preset: string }) => ({
        models:
          preset === 'claude-code'
            ? [
                { id: 'claude-opus-5-5', label: 'Opus 5.5', description: 'For complex work and everyday tasks' },
                { id: 'haiku', label: 'haiku: Haiku, newest (fastest)' },
                { id: 'sonnet', label: 'sonnet: Sonnet, newest', isDefault: true },
                { id: 'opus', label: 'opus: Opus, newest' }
              ]
            : [{ id: 'gpt-6.1-sol', label: 'GPT-6.1-Sol' }],
        source: 'test',
        fetchedAt: 1
      }),
      'prompt.enhance': (input) => {
        sent.push(input)
        return { enhanced: 'ok', model: input.model ?? 'haiku', profileName: 'Claude Code', ms: 1, attempts: [], context: [], notes: [] }
      }
    }
  })
  const view = await mountPanel(host)
  assert.deepEqual(
    modelMenu().map((option) => option.label),
    [
      'Auto (fallback)',
      'Claude Code · Opus 5.5',
      'Claude Code · haiku (latest) · default',
      'Claude Code · sonnet (latest)',
      'Claude Code · opus (latest)',
      'Codex · CLI default',
      'Codex · GPT-6.1-Sol'
    ]
  )
  await setSetting('effortLowModel', 'claude|claude-opus-5-5')
  await setSetting('effortMediumModel', 'claude|haiku')
  await setSetting('effortHighModel', 'codex|__profile_default__')
  assert.equal(read(effortModels).low, 'claude|claude-opus-5-5')
  assert.match(effortModelLabel('low'), /Opus 5.5/)
  put(draft, 'fix it')
  for (const tier of ['low', 'medium', 'high']) {
    set(effort, tier)
    await enhanceNow()
    assert.equal(sent.at(-1)?.effort, tier)
    assert.equal(sent.at(-1)?.model, undefined)
    assert.equal(sent.at(-1)?.profileId, undefined)
  }
  // Corrupt old panel state normalizes to Medium; assignments stay in Settings.
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

test('the worker runs the picked model on the picked profile only', async () => {
  const calls: { url: string; model: string }[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    calls.push({ url: String(url), model: body.model })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'done' } }] }), { status: 200 })
  }) as typeof fetch
  try {
    const profile = { id: 'oa', name: 'OpenAI', preset: 'openai', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', maxTokens: 2000, enabled: true, command: '', args: '' }
    const host = mockHost({ storage: { models: { profiles: [profile] } }, secrets: { 'apiKey.oa': 'k' }, results: { 'workspace.readContext': null } })
    const worker = await mountWorker(main, { host })
    const answer = await worker.request('prompt.enhance', { prompt: 'x y z', level: 'off', profileId: 'oa', model: 'gpt-4.1' })
    assert.equal(calls[0].model, 'gpt-4.1')
    assert.equal(answer.model, 'gpt-4.1')
    // Saved profile untouched.
    const view = await worker.request('models.get')
    assert.equal(view.profiles[0].model, 'gpt-4.1-mini')
    await worker.deactivate()
  } finally {
    globalThis.fetch = realFetch
  }
})
