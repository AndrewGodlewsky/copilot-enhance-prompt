import { test, assert } from '#testing'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { persistentStore } from './storage.ts'
import { createServices } from './services.ts'
import type { CopilotSession } from './session.ts'
import type { JsonValue } from '../runtime.ts'

test('writes survive restart, concurrent transactions preserve changes, and scopes stay separate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-store-test-'))
  try {
    const a = persistentStore(dir)
    const b = persistentStore(dir)
    await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? a : b).transaction(async () => {
      await a.set('count', Number(await a.get('count')) + 1)
    })))
    assert.equal(await persistentStore(dir).get('count'), 12)
    await a.set('panel:session-1:draft', 'one')
    assert.equal(await b.get('panel:session-2:draft'), null)
    assert.equal(typeof await readFile(join(dir, 'state.json'), 'utf8'), 'string')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('the color theme survives new sessions without sharing their drafts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-theme-test-'))
  try {
    const unused = async (): Promise<never> => { throw new Error('Theme persistence must not call the session RPC.') }
    const session = (sessionId: string): CopilotSession => ({
      sessionId, send: unused,
      rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } }
    })
    const first = createServices(session('first'), dir)
    await first.storage.set('colorTheme', 'light')
    await first.storage.set('panel:draft', 'Private draft')
    const second = createServices(session('second'), dir)
    assert.equal(await second.storage.get('colorTheme'), 'light')
    assert.equal(await second.storage.get('panel:draft'), null)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('legacy language cleanup preserves unrelated preferences, credentials and user data across sessions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-english-test-'))
  try {
    const unused = async (): Promise<never> => { throw new Error('Language cleanup must not call the session RPC.') }
    const session = (sessionId: string): CopilotSession => ({
      sessionId, send: unused,
      rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } }
    })
    const preferences = persistentStore(join(dir, 'preferences'))
    const data = persistentStore(join(dir, 'data'))
    const credentials = persistentStore(join(dir, 'credentials'))
    const scope = (id: string) => `session:${createHash('sha256').update(id).digest('hex').slice(0, 24)}:panel:`
    const kept: Record<string, JsonValue> = {
      history: [{ original: '你好', enhanced: '旧内容', id: 'h1' }],
      rules: { rules: [{ id: 'r1', text: 'Write in Vietnamese.', enabled: true }], structures: [{ id: 'custom', name: '我的结构', sections: ['目标'] }] },
      models: { profiles: [{ id: 'saved', name: 'Saved', preset: 'copilot', provider: 'copilot', model: 'my-model', enabled: true }], selectorProfileId: null },
      colorTheme: 'light',
      'usage-ledger': { credits: 2 },
      [`${scope('first')}draft`]: '旧草稿 🧪',
      [`${scope('second')}result`]: 'Kết quả đã lưu'
    }
    await preferences.set('uiLanguage', 'vi')
    await preferences.set('outputLanguage', 'zh')
    await preferences.set('customInstructions', 'Keep quoted text "你好".')
    await preferences.set('timeoutSeconds', 42)
    await credentials.set('encrypted', 'opaque-existing-credential')
    const originalCredentials = await readFile(join(dir, 'credentials', 'state.json'), 'utf8')
    const retired = ['uiLocale', 'panel:outputChoice', 'panel:uiLanguage', `${scope('first')}outputChoice`, `${scope('second')}outputChoice`]
    for (const key of retired) await data.set(key, 'vi')
    for (const [key, value] of Object.entries(kept)) await data.set(key, value)
    const first = createServices(session('first'), dir)
    const second = createServices(session('second'), dir)
    const [settings] = await Promise.all([first.settings.get(), second.settings.get(), first.storage.keys(), second.storage.get('panel:result')])
    assert.ok(!('uiLanguage' in settings) && !('outputLanguage' in settings))
    assert.equal(settings.customInstructions, 'Keep quoted text "你好".')
    assert.equal(settings.timeoutSeconds, 42)
    for (const key of ['uiLanguage', 'outputLanguage']) {
      assert.equal(await preferences.get(key), null)
      assert.equal(await first.settings.get(key), undefined)
      await assert.rejects(first.settings.set(key, 'zh'), /Invalid setting/)
    }
    for (const key of retired) assert.equal(await data.get(key), null, key)
    for (const [key, value] of Object.entries(kept)) assert.deepEqual(await data.get(key), value, key)
    assert.equal(await first.storage.get('panel:draft'), '旧草稿 🧪')
    assert.equal(await second.storage.get('panel:draft'), null)
    assert.equal(await second.storage.get('panel:result'), 'Kết quả đã lưu')
    assert.equal(await readFile(join(dir, 'credentials', 'state.json'), 'utf8'), originalCredentials)
    assert.equal(await createServices(session('first'), dir).settings.get('timeoutSeconds'), 42)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
