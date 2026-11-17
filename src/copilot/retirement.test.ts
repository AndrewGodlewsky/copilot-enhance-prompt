import { test, assert } from '#testing'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { persistentStore } from './storage.ts'
import { createServices } from './services.ts'
import type { JsonValue } from '../runtime.ts'
import type { CopilotSession } from './session.ts'

test('Copilot-only migration retires external state without losing user data or Copilot assignments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-retirement-test-'))
  const unused = async (): Promise<never> => { throw new Error('Migration must not call the session.') }
  const session = (sessionId: string): CopilotSession => ({ sessionId, send: unused, rpc: {
    metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused }
  } })
  try {
    const prefs = persistentStore(join(directory, 'preferences'))
    const data = persistentStore(join(directory, 'data'))
    const credentials = persistentStore(join(directory, 'credentials'))
    const copilot = { id: 'saved', name: 'My Copilot', preset: 'copilot', provider: 'copilot', model: 'claude-test', enabled: true }
    await data.set('models', { profiles: [copilot, { id: 'old', preset: 'anthropic', provider: 'anthropic', model: 'old-model' }], selectorProfileId: 'saved', hookProfileId: 'old' })
    await prefs.set('effortHighModel', 'saved|claude-test')
    await prefs.set('effortLowModel', 'old|old-model')
    await prefs.set('autoEnhanceMode', 'ai')
    await prefs.set('autoEnhanceAppend', 'My saved instructions: 保留原文')
    await prefs.set('notifyWhenDone', true)
    await prefs.set('allowEnvKeys', true)
    await data.set('catalog:external', { models: ['old-model'] })
    await data.set('sent:old', 123)
    await credentials.set('apiKey.old', 'opaque-encrypted-value')
    await credentials.set('unrelated', 'keep-this')
    const scoped = `session:${createHash('sha256').update('one').digest('hex').slice(0, 24)}:panel:`
    await data.set(scoped + 'feedbackAsk', { runs: 20 })
    await data.set(scoped + 'feedbackOff', false)
    const preserved: Record<string, JsonValue> = {
      history: [{ original: 'Draft 保留', enhanced: 'Result', model: 'Old provider' }],
      rules: { rules: [{ text: 'Keep my instructions.' }] },
      'usage-ledger': { credits: 3 }, colorTheme: 'dark',
      [scoped + 'draft']: 'My existing draft', [scoped + 'result']: 'My existing result'
    }
    for (const [key, value] of Object.entries(preserved)) await data.set(key, value)
    const first = createServices(session('one'), directory)
    const second = createServices(session('two'), directory)
    const [settings] = await Promise.all([first.settings.get(), second.settings.get(), second.storage.keys()])
    for (const key of ['autoEnhanceMode', 'autoEnhanceAppend', 'notifyWhenDone', 'allowEnvKeys', 'statusBarItem']) {
      assert.equal(key in settings, false, key)
      await assert.rejects(first.settings.set(key, key === 'autoEnhanceMode' ? 'ai' : true), /Invalid setting/)
    }
    assert.deepEqual(await data.get('models'), { profiles: [copilot], selectorProfileId: 'saved' })
    assert.equal(settings.effortHighModel, 'saved|claude-test')
    assert.equal(settings.effortLowModel, 'old|old-model', 'a removed selection must not silently choose another model')
    assert.equal(await credentials.get('apiKey.old'), null)
    assert.equal(await credentials.get('unrelated'), 'keep-this')
    for (const key of ['catalog:external', 'sent:old', scoped + 'feedbackAsk', scoped + 'feedbackOff']) assert.equal(await data.get(key), null)
    for (const [key, value] of Object.entries(preserved)) {
      if (key.startsWith(scoped)) {
        assert.equal(await data.get(key), null, 'migrated session data leaves the shared file')
        assert.deepEqual(await first.storage.get(key.replace(/^session:[a-f0-9]{24}:/, '')), value, key)
      } else assert.deepEqual(await data.get(key), value, key)
    }
    assert.equal(await prefs.get('autoEnhanceAppend'), 'My saved instructions: 保留原文', 'inactive chat settings remain recoverable')
    assert.equal(first.host.has('secrets.protection'), false)
    assert.equal(first.host.has('notifications.show'), false)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('an older explicit external selection stays unavailable when effort preferences are first created', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-old-choice-test-'))
  const unused = async (): Promise<never> => { throw new Error('Migration must not call the session.') }
  const session: CopilotSession = { sessionId: 'legacy', send: unused, rpc: {
    metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused }
  } }
  try {
    const data = persistentStore(join(directory, 'data'))
    await data.set('models', { profiles: [
      { id: 'old', preset: 'anthropic', provider: 'anthropic', model: 'old-model', enabled: true },
      { id: 'copilot', name: 'Copilot', preset: 'copilot', provider: 'copilot', model: 'new-model', enabled: true }
    ] })
    await data.set('panel:profileChoice', 'old')
    await data.set('panel:modelChoice', 'old-override')
    const settings = await createServices(session, directory).settings.get()
    for (const key of ['effortLowModel', 'effortMediumModel', 'effortHighModel']) {
      assert.equal(settings[key], 'old|old-override', 'migration must not silently switch a selected provider')
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})
