import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DEFAULTS } from '../defaults.ts'
import type { EnhanceWorker } from '../host.ts'
import type { JsonValue, KeyValueStore, SettingsStore } from '../runtime.ts'
import { persistentStore } from './storage.ts'
import { sessionAdapter, type CopilotSession } from './session.ts'
import { UNSUPPORTED_SETTINGS } from '../capabilities.ts'
import type { createCopilotModels } from './models.ts'
import { EFFORT_SETTINGS, REASONING_SETTINGS, validReasoning, modelAssignment, parseModelAssignment } from '../effort.ts'
import { MODELS_KEY, parseModelsConfig, modelsToJson } from '../presets.ts'
import { effectiveModel } from '../models.ts'

// These services have no equivalent on the current canvas SDK. Do not silently emulate them.
export function createServices(session: CopilotSession, directory = process.env.ENHANCE_PROMPT_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'copilot-enhance-prompt'), copilot?: ReturnType<typeof createCopilotModels>) {
  const data = persistentStore(join(directory, 'data'))
  const prefs = persistentStore(join(directory, 'preferences'))
  const retiredCredentials = persistentStore(join(directory, 'credentials'))
  const scope = createHash('sha256').update(session.sessionId).digest('hex').slice(0, 24)
  // Remove retired state without reading or decrypting old provider credentials.
  // Each store uses its normal cross-process transaction; a failed cleanup can be retried.
  let migration: Promise<void> | undefined
  const prepare = (): Promise<void> => migration ??= (async () => {
    await prefs.transaction(async () => {
      for (const key of ['uiLanguage', 'outputLanguage', 'notifyWhenDone', 'allowEnvKeys', 'statusBarItem', 'allowAgentLaunch']) if (await prefs.get(key) !== null) await prefs.delete(key)
    })
    await data.transaction(async () => {
      for (const key of await data.keys()) {
        if (key === 'uiLocale' || key.startsWith('catalog:') || key.startsWith('sent:') || /^(?:session:[a-f0-9]{24}:)?panel:(?:uiLanguage|outputChoice|feedbackAsk|feedbackOff|hookLast)$/.test(key)) await data.delete(key)
      }
      const saved = await data.get(MODELS_KEY)
      if (saved !== null) {
        const cleaned = modelsToJson(parseModelsConfig(saved))
        if (JSON.stringify(saved) !== JSON.stringify(cleaned)) await data.set(MODELS_KEY, cleaned)
      }
    })
    await retiredCredentials.transaction(async () => {
      for (const key of await retiredCredentials.keys()) if (key.startsWith('apiKey.')) await retiredCredentials.delete(key)
    })
    // autoEnhance* preferences stay inert on disk for recovery; DEFAULTS excludes them.
  })().catch(error => { migration = undefined; throw error })
  let effortMigration: Promise<void> | undefined
  const prepareEfforts = (): Promise<void> => effortMigration ??= prefs.transaction(async () => {
    const missing: string[] = []
    for (const key of Object.values(EFFORT_SETTINGS)) if (await prefs.get(key) === null) missing.push(key)
    if (!missing.length) return
    const storedModels = await data.get(MODELS_KEY)
    const saved = parseModelsConfig(storedModels).profiles
    const profiles = saved.filter(profile => profile.enabled)
    const legacy = async (key: string) => await data.get(`session:${scope}:panel:${key}`) ?? await data.get(`panel:${key}`)
    const choice = await legacy('profileChoice')
    const explicit = typeof choice === 'string' && choice !== 'auto' && /^[a-z0-9-]{1,40}$/.test(choice) ? choice : null
    const selected = profiles.find(profile => profile.id === explicit)
    const current = selected ?? profiles[0]
    const override = explicit ? await legacy('modelChoice') : null
    // A retired explicit selection stays unavailable until the user chooses a replacement.
    const assignment = explicit ? modelAssignment(explicit, typeof override === 'string' && override ? override : selected ? effectiveModel(selected) : '')
      : current ? modelAssignment(current.id, effectiveModel(current)) : storedModels === null && choice === null ? 'recommended' : 'auto'
    // The first upgrading session initializes all tiers together; subsequent sessions keep them.
    for (const key of missing) await prefs.set(key, assignment === 'recommended' || parseModelAssignment(assignment) ? assignment : 'auto')
  }).catch(error => { effortMigration = undefined; throw error })
  const adapter = sessionAdapter(session)
  const settings: SettingsStore = {
    get: (async (key?: string) => {
      await prepare()
      await prepareEfforts()
      const values: Record<string, JsonValue> = { ...DEFAULTS }
      for (const name of await prefs.keys()) if (Object.hasOwn(DEFAULTS, name)) values[name] = (await prefs.get(name))!
      for (const name of UNSUPPORTED_SETTINGS) values[name] = false
      return key === undefined ? values : values[key]
    }) as SettingsStore['get'],
    set: async (key, value) => {
      if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) throw new Error('Invalid setting.')
      if (Object.values(EFFORT_SETTINGS).some(name => name === key) && value !== 'recommended' && !parseModelAssignment(value)) throw new Error('Invalid effort model assignment.')
      if (Object.values(REASONING_SETTINGS).some(name => name === key) && !validReasoning(value)) throw new Error('Invalid reasoning level.')
      if (UNSUPPORTED_SETTINGS.has(key) && value) throw new Error('This setting is unavailable in the Copilot canvas.')
      await prepare()
      await prefs.set(key, value)
    },
    onDidChange: listener => prefs.onDidChange(listener)
  }
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
    has: name => (Boolean(copilot) && ['copilot.catalog', 'copilot.rewrite'].includes(name)) || adapter.has(name),
    call: async (name, input, options) => name === 'copilot.catalog' && copilot ? await copilot.catalog() as never
      : name === 'copilot.rewrite' && copilot ? { text: await copilot.rewrite(input as import('./models.ts').CopilotRewrite, options?.signal) } as never
      : adapter.call(name, input, options)
  }
  return { storage, settings, host, adapter, directory, data }
}
