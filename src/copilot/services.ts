import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DEFAULTS } from '../defaults.ts'
import type { EnhanceWorker } from '../host.ts'
import type { JsonValue, KeyValueStore, SettingsStore } from '../runtime.ts'
import { persistentStore } from './storage.ts'
import { protectedSecrets } from './secrets.ts'
import { sessionAdapter, type CopilotSession } from './session.ts'
import { UNSUPPORTED_SETTINGS } from '../capabilities.ts'
import { sentKey } from './sent.ts'
import type { createCopilotModels } from './models.ts'

// These services have no equivalent on the current canvas SDK. Do not silently emulate them.
export function createServices(session: CopilotSession, directory = process.env.ENHANCE_PROMPT_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'copilot-enhance-prompt'), copilot?: ReturnType<typeof createCopilotModels>) {
  const data = persistentStore(join(directory, 'data'))
  const prefs = persistentStore(join(directory, 'preferences'))
  const secrets = protectedSecrets(persistentStore(join(directory, 'credentials')))
  // Retire only language preferences, including composer choices saved by older sessions.
  // Each store uses its normal cross-process transaction; a failed cleanup can be retried.
  let migration: Promise<void> | undefined
  const prepare = (): Promise<void> => migration ??= (async () => {
    await prefs.transaction(async () => {
      for (const key of ['uiLanguage', 'outputLanguage']) if (await prefs.get(key) !== null) await prefs.delete(key)
    })
    await data.transaction(async () => {
      for (const key of await data.keys()) {
        if (key === 'uiLocale' || /^(?:session:[a-f0-9]{24}:)?panel:(?:uiLanguage|outputChoice)$/.test(key)) await data.delete(key)
      }
    })
  })().catch(error => { migration = undefined; throw error })
  const adapter = sessionAdapter({ sessionId: session.sessionId, rpc: session.rpc, send: async options => {
    const key = sentKey(session.sessionId, options.prompt)
    await data.transaction(async () => {
      for (const old of (await data.keys()).filter(key => key.startsWith('sent:'))) {
        if (Number(await data.get(old)) < Date.now()) await data.delete(old)
      }
      await data.set(key, Date.now() + 120_000)
    })
    try { return await session.send(options) }
    catch (error) { await data.delete(key); throw error }
  } })
  const settings: SettingsStore = {
    get: (async (key?: string) => {
      await prepare()
      const values: Record<string, JsonValue> = { ...DEFAULTS }
      for (const name of await prefs.keys()) if (Object.hasOwn(DEFAULTS, name)) values[name] = (await prefs.get(name))!
      for (const name of UNSUPPORTED_SETTINGS) values[name] = false
      return key === undefined ? values : values[key]
    }) as SettingsStore['get'],
    set: async (key, value) => {
      if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) throw new Error('Invalid setting.')
      if (UNSUPPORTED_SETTINGS.has(key) && value) throw new Error('This setting is unavailable in the Copilot canvas.')
      await prepare()
      await prefs.set(key, value)
    },
    onDidChange: listener => prefs.onDidChange(listener)
  }
  const scope = createHash('sha256').update(session.sessionId).digest('hex').slice(0, 24)
  const scopeKey = (key: string) => key.startsWith('panel:') ? `session:${scope}:${key}` : key
  const storage: KeyValueStore = {
    get: async key => { await prepare(); return data.get(scopeKey(key)) },
    set: async (key, value) => { await prepare(); await data.set(scopeKey(key), value) },
    delete: async key => { await prepare(); await data.delete(scopeKey(key)) },
    keys: async () => { await prepare(); return (await data.keys()).filter(key => !key.startsWith('session:') || key.startsWith(`session:${scope}:`)).map(key => key.replace(`session:${scope}:`, '')) },
    onDidChange: listener => data.onDidChange(({ key }) => { if (!key.startsWith('session:') || key.startsWith(`session:${scope}:`)) listener({ key: key.replace(`session:${scope}:`, '') }) }),
    transaction: async fn => { await prepare(); return data.transaction(fn) }
  }
  const host: EnhanceWorker['host'] = {
    has: name => (Boolean(copilot) && ['copilot.catalog', 'copilot.rewrite'].includes(name)) || name === 'secrets.protection' || adapter.has(name),
    call: async (name, input, options) => name === 'copilot.catalog' && copilot ? await copilot.catalog() as never
      : name === 'copilot.rewrite' && copilot ? { text: await copilot.rewrite(input as import('./models.ts').CopilotRewrite, options?.signal) } as never
      : name === 'secrets.protection'
      ? { status: secrets.available ? 'os-keyring' : 'unavailable', backend: 'DPAPI' } as never
      : adapter.call(name, input, options)
  }
  return { storage, settings, secrets, host, adapter, directory, data }
}
