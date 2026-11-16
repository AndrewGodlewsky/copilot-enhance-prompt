import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { assert, mockHost, mountWorker, test } from '#testing'
import { createServices } from './copilot/services.ts'
import { persistentStore } from './copilot/storage.ts'
import type { CopilotSession } from './copilot/session.ts'
import * as main from './worker.ts'

const profile = (id: string, provider = 'copilot') => ({ id, name: id, preset: provider, provider,
  model: `${id}-default`, enabled: true })
const unused = async (): Promise<never> => { throw new Error('No session RPC or paid provider calls in this test.') }
const session = (sessionId: string): CopilotSession => ({ sessionId, send: unused,
  rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } } })

test('efforts inherit the current model once and preserve existing assignments and user data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-effort-test-'))
  try {
    const data = persistentStore(join(dir, 'data'))
    const prefs = persistentStore(join(dir, 'preferences'))
    const scope = createHash('sha256').update('first').digest('hex').slice(0, 24)
    await data.set('models', { profiles: [profile('primary'), profile('chosen')] })
    await data.set(`session:${scope}:panel:profileChoice`, 'chosen')
    await data.set(`session:${scope}:panel:modelChoice`, 'chosen-override')
    await data.set(`session:${scope}:panel:draft`, 'Keep 你好 and paths verbatim')
    await prefs.set('effortHighModel', 'primary|already-saved')
    await prefs.set('customInstructions', 'Keep my rules')
    const first = createServices(session('first'), dir)
    const [a, b] = await Promise.all([first.settings.get(), createServices(session('first'), dir).settings.get()])
    for (const settings of [a, b]) {
      assert.equal(settings.effortLowModel, 'chosen|chosen-override')
      assert.equal(settings.effortMediumModel, 'chosen|chosen-override')
      assert.equal(settings.effortHighModel, 'primary|already-saved')
      assert.equal(settings.customInstructions, 'Keep my rules')
    }
    await first.settings.set('effortLowModel', 'primary|new-low')
    const second = createServices(session('second'), dir)
    assert.equal(await second.settings.get('effortLowModel'), 'primary|new-low')
    assert.equal(await second.settings.get('effortMediumModel'), 'chosen|chosen-override')
    assert.equal(await first.storage.get('panel:draft'), 'Keep 你好 and paths verbatim')
    await assert.rejects(first.settings.set('effortLowModel', 'malformed'), /Invalid/)
    await first.settings.set('effortLowModel', 'catalog:gpt-model')
    assert.equal(await second.settings.get('effortLowModel'), 'catalog:gpt-model')
    for (const invalid of ['catalog:', 'catalog: bad', 'catalog:bad\nvalue']) await assert.rejects(first.settings.set('effortLowModel', invalid), /Invalid/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('Auto migrates to the first enabled model; a new installation starts with recommended presets', async () => {
  for (const configured of [false, true]) {
    const dir = await mkdtemp(join(tmpdir(), 'enhance-effort-test-'))
    try {
      const data = persistentStore(join(dir, 'data'))
      if (configured) await data.set('models', { profiles: [{ ...profile('disabled'), enabled: false }, profile('first')] })
      const services = createServices(session('auto'), dir)
      const all = await services.settings.get()
      for (const key of ['effortLowModel', 'effortMediumModel', 'effortHighModel']) assert.equal(all[key], configured ? 'first|first-default' : 'recommended')
      if (!configured) {
        await services.storage.set('models', { profiles: [profile('added')] })
        assert.equal(await services.settings.get('effortMediumModel'), 'recommended')
      }
    } finally { await rm(dir, { recursive: true, force: true }) }
  }
})

test('worker resolves each effort at run time and ignores stale direct model overrides', async () => {
  const calls: { model: string; system: string; user: string }[] = []
  const host = mockHost({
    settings: { effortLowModel: 'copilot|low-model', effortMediumModel: 'copilot|medium-model', effortHighModel: 'copilot|high-model', fallbackEnabled: false },
    storage: { models: { profiles: [profile('copilot')] } },
    results: { 'workspace.readContext': null, 'copilot.rewrite': (input: { model: string; system: string; user: string }) => { calls.push(input); return { text: 'An English prompt.' } } }
  })
  const worker = await mountWorker(main, { host })
  try {
    for (const effort of ['low', 'medium', 'high']) {
      const answer = await worker.request('prompt.enhance', { prompt: 'Keep "你好" in src/日本語.ts', level: 'off', effort, profileId: 'stale', model: 'stale-model' })
      assert.equal(answer.model, `${effort}-model`)
      assert.equal(calls.at(-1)?.model, `${effort}-model`)
      assert.match(calls.at(-1)?.user ?? '', /你好.*src\/日本語\.ts/)
    }
    await host.settings.set('effortLowModel', 'copilot|changed-low')
    await worker.request('prompt.enhance', { prompt: 'Change the tests', level: 'off', effort: 'low' })
    assert.equal(calls.at(-1)?.model, 'changed-low')
    assert.equal((await worker.request('models.get')).profiles[0].model, 'copilot-default')
    await worker.request('data.clear', { what: 'all' })
    for (const key of ['effortLowModel', 'effortMediumModel', 'effortHighModel']) assert.equal(await host.settings.get(key), 'recommended')
  } finally { await worker.deactivate() }
})

test('recommended effort works without saved profiles and ignores request reasoning overrides', async () => {
  const calls: { model: string; reasoningEffort?: string }[] = []
  const host = mockHost({ results: {
    'workspace.readContext': null,
    'copilot.catalog': { models: [
      { id: 'claude-haiku-5.5', label: 'Claude Haiku 5.5', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
      { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
      { id: 'claude-sonnet-5.5', label: 'Claude Sonnet 5.5', supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] }
    ], source: 'GitHub Copilot', fetchedAt: 1 },
    'copilot.rewrite': (input: { model: string; reasoningEffort?: string }) => { calls.push(input); return { text: 'English rewrite' } }
  } })
  const worker = await mountWorker(main, { host })
  try {
    for (const [effort, model, reasoning] of [['low', 'claude-haiku-5.5', 'max'], ['medium', 'gpt-6.1-terra', 'high'], ['high', 'claude-sonnet-5.5', 'medium']] as const) {
      const answer = await worker.request('prompt.enhance', { prompt: 'Fix tests', effort, level: 'off', model: 'untrusted', reasoningEffort: 'low' } as any)
      assert.equal(answer.model, model)
      assert.equal(answer.attempts[0].reasoningEffort, reasoning)
      assert.equal(calls.at(-1)?.model, model)
      assert.equal(calls.at(-1)?.reasoningEffort, reasoning)
    }
    assert.equal((await worker.request('models.get')).profiles.length, 0)
    await host.settings.set('effortMediumReasoning', 'minimal')
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Fix tests', effort: 'medium', level: 'off' }), /reasoning/)
    assert.equal(calls.length, 3)
    await host.settings.set('allowOnlineModelLists', false)
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Fix tests', effort: 'medium', level: 'off' }), /lists.*off/)
    assert.equal(calls.length, 3)
  } finally { await worker.deactivate() }
})

test('missing, disabled and invalid effort assignments fail before calling a model', async () => {
  let called = false
  const host = mockHost({
    settings: { effortLowModel: 'missing|model', effortMediumModel: 'disabled|model', effortHighModel: 'bad-value' },
    storage: { models: { profiles: [profile('copilot'), { ...profile('disabled'), enabled: false }] } },
    results: { 'workspace.readContext': null, 'copilot.rewrite': () => { called = true; return { text: 'Unexpected' } } }
  })
  const worker = await mountWorker(main, { host })
  try {
    for (const effort of ['low', 'medium', 'high', 'unknown']) {
      await assert.rejects(worker.request('prompt.enhance', { prompt: 'Fix the code', effort, level: 'off' }), /effort|Effort/)
    }
    assert.equal(called, false)
  } finally { await worker.deactivate() }
})

test('direct catalog effort is usable without profiles and is revalidated before rewriting', async () => {
  let calls = 0
  let available = true
  const host = mockHost({
    settings: { effortMediumModel: 'catalog:chosen', fallbackEnabled: false },
    results: {
      'workspace.readContext': null,
      'copilot.catalog': () => ({ models: available ? [{ id: 'chosen', label: 'Chosen model' }] : [], source: 'GitHub Copilot', fetchedAt: Date.now() }),
      'copilot.rewrite': (input: { model: string }) => { calls++; assert.equal(input.model, 'chosen'); return { text: 'A clearer request.' } }
    }
  })
  const worker = await mountWorker(main, { host })
  try {
    assert.equal((await worker.request('prompt.enhance', { prompt: 'Fix tests', effort: 'medium', level: 'off' })).model, 'chosen')
    available = false
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Fix tests', effort: 'medium', level: 'off' }), /effort/i)
    await host.settings.set('allowOnlineModelLists', false)
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Fix tests', effort: 'medium', level: 'off' }), /lists.*off/)
    assert.equal(calls, 1)
  } finally { await worker.deactivate() }
})
