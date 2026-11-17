import { test, assert } from '#testing'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { persistentStore } from './storage.ts'
import { createServices } from './services.ts'
import type { CopilotSession } from './session.ts'
import type { JsonValue } from '../runtime.ts'
import { promises as fs } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

test('Windows atomic replacement tolerates brief sharing locks but reports persistent or unrelated failures', async () => {
  if (process.platform !== 'win32') return
  const dir = await mkdtemp(join(tmpdir(), 'enhance-rename-sharing-')), original = fs.rename
  const store = persistentStore(dir)
  try {
    await store.set('draft', 'Original')
    let attempts = 0, remaining = 2, code = 'EPERM'
    fs.rename = (async (...args: Parameters<typeof fs.rename>) => {
      attempts++
      if (remaining-- > 0) throw Object.assign(Error('Synthetic file sharing failure'), {code})
      return original(...args)
    }) as typeof fs.rename
    syncBuiltinESMExports()
    await store.set('draft', 'Latest Unicode 🧪')
    assert.equal(attempts, 3)
    assert.equal(await store.get('draft'), 'Latest Unicode 🧪')
    attempts = 0; remaining = Infinity
    await assert.rejects(store.set('draft', 'Must not replace'), /sharing failure/)
    assert.equal(attempts, 6, 'retry count is bounded')
    assert.equal(await store.get('draft'), 'Latest Unicode 🧪')
    attempts = 0; code = 'ENOSPC'
    await assert.rejects(store.set('draft', 'Disk full'), /sharing failure/)
    assert.equal(attempts, 1, 'other errors must not be retried')
  } finally { fs.rename = original; syncBuiltinESMExports(); await rm(dir, {recursive:true,force:true}) }
})

test('a keyed privacy read uses one current preference snapshot without enumerating unrelated settings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-keyed-setting-'))
  const original = fs.readFile
  try {
    const unused = async (): Promise<never> => { throw new Error('No session calls in this fixture.') }
    const services = createServices({ sessionId: 'fixture', send: unused,
      rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } }
    }, dir)
    await services.settings.set('saveHistory', false)
    await services.settings.set('customInstructions', 'Keep user rules')
    await services.settings.get() // Finish migrations before measuring the ordinary read.
    let reads = 0
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      if (String(args[0]) === join(dir, 'preferences', 'state.json')) reads++
      return original(...args)
    }) as typeof fs.readFile
    syncBuiltinESMExports()
    assert.equal(await services.settings.get('saveHistory'), false)
    assert.equal(reads, 1, 'privacy must not be sampled before later unrelated preference reads')
    assert.equal(await services.settings.get('chatTextSize'), 'medium')
    assert.equal(await services.settings.get('customInstructions'), 'Keep user rules')
    reads = 0
    const all = await services.settings.get()
    assert.equal(all.saveHistory, false)
    assert.equal(all.customInstructions, 'Keep user rules')
    assert.equal(reads, 1, 'a policy snapshot must come from one atomic preference read')
  } finally {
    fs.readFile = original
    syncBuiltinESMExports()
    await rm(dir, { recursive: true, force: true })
  }
})

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

test('chat text size persists across sessions and rejects invalid writes, with a safe default for old data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-text-size-test-'))
  try {
    const unused = async (): Promise<never> => { throw new Error('Appearance settings must not call the session RPC.') }
    const session = (sessionId: string): CopilotSession => ({
      sessionId, send: unused,
      rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } }
    })
    const first = createServices(session('first'), dir)
    assert.equal(await first.settings.get('chatTextSize'), 'medium')
    await first.settings.set('timeoutSeconds', 42)
    for (const size of ['small', 'medium', 'large']) {
      await first.settings.set('chatTextSize', size)
      assert.equal(await createServices(session('second'), dir).settings.get('chatTextSize'), size)
    }
    for (const invalid of ['huge', 'LARGE', '', 16, null, { size: 'large' }]) {
      await assert.rejects(first.settings.set('chatTextSize', invalid), /Invalid/)
      assert.equal(await first.settings.get('chatTextSize'), 'large')
    }
    await persistentStore(join(dir, 'preferences')).set('chatTextSize', 'unknown')
    assert.equal(await first.settings.get('chatTextSize'), 'medium')
    assert.equal(await first.settings.get('timeoutSeconds'), 42)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('enhanced prompt preference defaults on, persists false, and leaves saved user data untouched', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-prompt-set-test-'))
  try {
    const unused = async (): Promise<never> => { throw new Error('Preference persistence must not call the session RPC.') }
    const session = (sessionId: string): CopilotSession => ({ sessionId, send: unused,
      rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } } })
    const first = createServices(session('first'), dir)
    await first.settings.set('customInstructions', 'Keep "原文".')
    await first.storage.set('panel:draft', 'My original request')
    await first.storage.set('panel:result', 'My previous prompt')
    await first.storage.set('history', [{ id: 'saved', original: '你好', enhanced: 'Saved prompt' }])
    assert.equal(await first.settings.get('useEnhancedPrompts'), true)
    await first.settings.set('useEnhancedPrompts', false)
    assert.equal(await createServices(session('second'), dir).settings.get('useEnhancedPrompts'), false)
    for (const value of ['false', 0, null, {}]) await assert.rejects(first.settings.set('useEnhancedPrompts', value), /Invalid/)
    assert.equal(await first.settings.get('useEnhancedPrompts'), false)
    await first.settings.set('useEnhancedPrompts', true)
    assert.equal(await createServices(session('first'), dir).settings.get('useEnhancedPrompts'), true)
    assert.equal(await first.settings.get('customInstructions'), 'Keep "原文".')
    assert.equal(await first.storage.get('panel:draft'), 'My original request')
    assert.equal(await first.storage.get('panel:result'), 'My previous prompt')
    assert.deepEqual(await first.storage.get('history'), [{ id: 'saved', original: '你好', enhanced: 'Saved prompt' }])
    await persistentStore(join(dir, 'preferences')).set('useEnhancedPrompts', 'false')
    assert.equal(await first.settings.get('useEnhancedPrompts'), true, 'invalid saved data must not disable the default')
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
    for (const [key, value] of Object.entries(kept)) {
      const owner = key.startsWith(scope('first')) ? first : key.startsWith(scope('second')) ? second : null
      if (owner) {
        assert.equal(await data.get(key), null, 'migrated session text leaves the shared file')
        assert.deepEqual(await owner.storage.get(key.replace(/^session:[a-f0-9]{24}:/, '')), value, key)
      } else assert.deepEqual(await data.get(key), value, key)
    }
    assert.equal(await first.storage.get('panel:draft'), '旧草稿 🧪')
    assert.equal(await second.storage.get('panel:draft'), null)
    assert.equal(await second.storage.get('panel:result'), 'Kết quả đã lưu')
    assert.equal(await readFile(join(dir, 'credentials', 'state.json'), 'utf8'), originalCredentials)
    assert.equal(await createServices(session('first'), dir).settings.get('timeoutSeconds'), 42)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
