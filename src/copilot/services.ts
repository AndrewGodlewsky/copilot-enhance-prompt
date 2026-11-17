import { homedir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DEFAULTS } from '../defaults.ts'
import { validSetting, effectiveSetting } from '../limits.ts'
import { isChatTextSize } from '../text-size.ts'
import type { EnhanceWorker } from '../host.ts'
import type { JsonValue, KeyValueStore, SettingsStore } from '../runtime.ts'
import { persistentStore } from './storage.ts'
import { partitionSessions, sessionData, SESSION_LAYOUT_KEY, validateSessionLayout } from './session-storage.ts'
import { sessionAdapter, type CopilotSession } from './session.ts'
import { UNSUPPORTED_SETTINGS } from '../capabilities.ts'
import type { createCopilotModels } from './models.ts'
import { EFFORT_SETTINGS, REASONING_SETTINGS, validReasoning, modelAssignment, parseModelAssignment, parseCatalogAssignment } from '../effort.ts'
import { MODELS_KEY, parseModelsConfig, modelsToJson } from '../presets.ts'
import { effectiveModel } from '../models.ts'

// These services have no equivalent on the current canvas SDK. Do not silently emulate them.
export function createServices(session: CopilotSession, directory = process.env.ENHANCE_PROMPT_DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'copilot-enhance-prompt'), copilot?: ReturnType<typeof createCopilotModels>) {
  const data = persistentStore(join(directory, 'data'))
  const prefs = persistentStore(join(directory, 'preferences'))
  const retiredCredentials = persistentStore(join(directory, 'credentials'))
  const scope = createHash('sha256').update(session.sessionId).digest('hex').slice(0, 24)
  const panelData = sessionData(directory, scope)
  // Remove retired state without reading or decrypting old provider credentials.
  // Each store uses its normal cross-process transaction; a failed cleanup can be retried.
  let migration: Promise<void> | undefined
  const prepare = (): Promise<void> => migration ??= (async () => {
    await data.transaction(async () => {
      const snapshot = await data.snapshot()
      validateSessionLayout(snapshot)
      await prefs.transaction(async () => {
        for (const key of ['uiLanguage', 'outputLanguage', 'notifyWhenDone', 'allowEnvKeys', 'statusBarItem', 'allowAgentLaunch']) if (await prefs.get(key) !== null) await prefs.delete(key)
      })
      const changes: Record<string, JsonValue | undefined> = {}
      for (const key of Object.keys(snapshot)) {
        if (key === 'uiLocale' || key.startsWith('catalog:') || key.startsWith('sent:') || /^(?:session:[a-f0-9]{24}:)?panel:(?:uiLanguage|outputChoice|feedbackAsk|feedbackOff|hookLast)$/.test(key)) changes[key] = undefined
      }
      const saved = snapshot[MODELS_KEY]
      if (saved !== undefined) {
        const cleaned = modelsToJson(parseModelsConfig(saved))
        if (JSON.stringify(saved) !== JSON.stringify(cleaned)) changes[MODELS_KEY] = cleaned
      }
      await data.patch(changes)
      await partitionSessions(directory, data)
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
    const legacy = async (key: string) => await panelData.get(`panel:${key}`) ?? await data.get(`panel:${key}`)
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
      if (key !== undefined && (typeof key !== 'string' || key.length > 200)) throw new Error('Invalid setting key.')
      await prepare()
      await prepareEfforts()
      const values: Record<string, JsonValue> = { ...DEFAULTS }
      // A final privacy check must not read its value and then wait on unrelated preferences.
      const saved = key === undefined ? await prefs.snapshot() : { [key]: await prefs.get(key) }
      for (const [name, value] of Object.entries(saved)) if (Object.hasOwn(DEFAULTS, name)) values[name] = effectiveSetting(name, value) as JsonValue
      if (!isChatTextSize(values.chatTextSize)) values.chatTextSize = 'medium'
      if (typeof values.useEnhancedPrompts !== 'boolean') values.useEnhancedPrompts = true
      for (const name of UNSUPPORTED_SETTINGS) values[name] = false
      return key === undefined ? values : values[key]
    }) as SettingsStore['get'],
    set: async (key, value) => {
      if (!validSetting(key, value)) throw new Error('Invalid setting. Check its allowed range or length.')
      if (key === 'chatTextSize' && !isChatTextSize(value)) throw new Error('Invalid chat text size.')
      if (Object.values(EFFORT_SETTINGS).some(name => name === key) && value !== 'recommended' && !parseModelAssignment(value) && !parseCatalogAssignment(value)) throw new Error('Invalid effort model assignment.')
      if (Object.values(REASONING_SETTINGS).some(name => name === key) && !validReasoning(value)) throw new Error('Invalid reasoning level.')
      if (UNSUPPORTED_SETTINGS.has(key) && value) throw new Error('This setting is unavailable in the Copilot canvas.')
      await prepare()
      await prefs.set(key, value)
    },
    onDidChange: listener => prefs.onDidChange(listener)
  }
  const visibleShared = (key: string) => !key.startsWith('session:') && key !== SESSION_LAYOUT_KEY
  const storeFor = (key: string) => {
    if (!visibleShared(key)) throw new Error('This storage key belongs to internal session state.')
    return key.startsWith('panel:') ? panelData : data
  }
  const storage: KeyValueStore = {
    get: async key => { await prepare(); return storeFor(key).get(key) },
    set: async (key, value) => { await prepare(); await storeFor(key).set(key, value) },
    delete: async key => { await prepare(); await storeFor(key).delete(key) },
    keys: async () => { await prepare(); return [...new Set([...(await data.keys()).filter(visibleShared), ...await panelData.keys()])] },
    onDidChange: listener => {
      const shared = data.onDidChange(({ key }) => { if (visibleShared(key) && !key.startsWith('panel:')) listener({ key }) })
      const own = panelData.onDidChange(listener)
      return { dispose: () => { shared.dispose(); own.dispose() } }
    },
    transaction: async fn => { await prepare(); return data.transaction(() => panelData.transaction(fn)) }
  }
  const host: EnhanceWorker['host'] = {
    has: name => (Boolean(copilot) && ['copilot.catalog', 'copilot.rewrite', 'copilot.usage.status', 'copilot.usage.recover'].includes(name)) || adapter.has(name),
    call: async (name, input, options) => name === 'copilot.catalog' && copilot ? await copilot.catalog() as never
      : name === 'copilot.rewrite' && copilot ? { text: await copilot.rewrite(input as import('./models.ts').CopilotRewrite, options?.signal, options?.ensureAccess) } as never
      : name === 'copilot.usage.status' && copilot ? await copilot.recoverUsage(false, true) as never
      : name === 'copilot.usage.recover' && copilot ? await copilot.recoverUsage(true) as never
      : adapter.call(name, input, options)
  }
  return { storage, settings, host, adapter, directory, data, attachmentOwner: `${directory}\0${session.sessionId}` }
}
