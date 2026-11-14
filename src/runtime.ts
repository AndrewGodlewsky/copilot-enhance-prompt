// Project-owned state and services shared by the canvas and its behavioral tests.
import type { PluginPanelEvents, PluginRequests } from './protocol.ts'
export type { PluginPanelEvents, PluginRequests } from './protocol.ts'
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type Disposable = { dispose(): void }
export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number }
export type RequestInput<K extends keyof PluginRequests> = PluginRequests[K] extends { input: infer I } ? I : undefined
export type KeyValueStore = {
  transaction?<T>(fn: () => Promise<T>): Promise<T>
  get(key: string): Promise<JsonValue | null>
  set(key: string, value: JsonValue): Promise<void>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
  onDidChange(listener: (event: { key: string }) => void): Disposable
}
export type SettingsStore = {
  get(): Promise<Record<string, JsonValue>>
  get(key: string): Promise<JsonValue | undefined>
  set(key: string, value: JsonValue): Promise<void>
  onDidChange(listener: (event: { key: string }) => void): Disposable
}
export type AppEvents = {
  'workspace.changed': { context?: { displayName: string; branch: string; terminals?: { id: string; title?: string }[]; workspaceId?: string } }
  'workspace.removed': { workspaceId: string; path?: string }
  'agent.status.changed': { terminalId?: string; workspaceId: string | null; state: string; agent?: string | null; title?: string; timestamp?: number; paneKey?: string; receivedAt?: number; mainAgent?: { state?: string; outcome?: string; stateStartedAt?: number } }
}
export type SaveOptions = { suggestedName?: string; mimeType?: string; data: string | ArrayBuffer }
export type PanelClient = {
  locale?: string
  plugin: {
    request<K extends keyof PluginRequests>(name: K, input?: RequestInput<K>, options?: RequestOptions): Promise<PluginRequests[K]['output']>
    on<K extends keyof PluginPanelEvents>(event: K, handler: (payload: PluginPanelEvents[K]) => void): Disposable
  }
  storage: KeyValueStore
  settings: SettingsStore
  on<K extends keyof AppEvents>(event: K, handler: (payload: AppEvents[K]) => void): Disposable
  shell?: { openExternal(url: string): Promise<{ opened: boolean }> }
  files?: { saveAs(options: SaveOptions): Promise<{ status: 'saved' | 'downloaded' | 'cancelled'; path?: string }> }
}
export type Atom<T> = { value: T; initial: T; compute?: () => T; key?: string; persist?: string }
const atoms = new Set<Atom<unknown>>()
const listeners = new Set<() => void>()
let changes = 0
let client: PanelClient | undefined
let generation = 0
let followStorage: Disposable | undefined
const copy = <T>(value: T): T => value === undefined ? value : structuredClone(value)
export const version = () => changes
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function changed(): void { changes++; for (const listener of listeners) listener() }
export function frame(): PanelClient {
  if (!client) throw new Error('The canvas is not connected.')
  return client
}
export function atom<T>(initial: T): Atom<T>
export function atom<T>(key: string, initial: T, options?: { persist?: string }): Atom<T>
export function atom<T>(keyOrInitial: string | T, initial?: T, options?: { persist?: string }): Atom<T> {
  const keyed = arguments.length >= 2
  const value = (keyed ? initial : keyOrInitial) as T
  const result: Atom<T> = { value: copy(value), initial: copy(value), ...(keyed ? { key: String(keyOrInitial) } : {}), ...options }
  atoms.add(result as Atom<unknown>)
  return result
}
export function derived<T>(compute: () => T): Atom<T> { return { value: undefined as T, initial: undefined as T, compute } }
export function read<T>(target: Atom<T>): T { return target.compute ? target.compute() : target.value }
const storageKey = (target: Atom<unknown>) => target.persist === 'storage' ? target.key! : `panel:${target.key}`
export function set<T>(target: Atom<T>, value: T): void {
  if (Object.is(target.value, value)) return
  target.value = value
  if (target.persist && target.key && client) {
    void client.storage.set(storageKey(target), (value ?? null) as JsonValue).catch(error => {
      for (const listener of persistenceErrors) listener(error)
    })
  }
  changed()
}
export function update<T>(target: Atom<T>, fn: (value: T) => T): void { set(target, fn(read(target))) }
const persistenceErrors = new Set<(error: unknown) => void>()
export function onPersistenceError(listener: (error: unknown) => void): Disposable {
  persistenceErrors.add(listener)
  return { dispose: () => { persistenceErrors.delete(listener) } }
}
export function bindPanel(next: PanelClient, reset = true): void {
  followStorage?.dispose()
  followStorage = undefined
  client = next
  generation++
  if (reset) for (const target of atoms) target.value = copy(target.initial)
  changed()
}
export async function ready(): Promise<void> {
  const current = frame()
  const epoch = generation
  const load = async (target: Atom<unknown>) => {
    const value = await current.storage.get(storageKey(target))
    if (generation !== epoch) return
    target.value = value ?? copy(target.initial)
    changed()
  }
  await Promise.all([...atoms].filter(target => target.persist && target.key).map(load))
  followStorage?.dispose()
  followStorage = current.storage.onDidChange(({ key }) => {
    for (const target of atoms) if (target.persist === 'storage' && target.key && storageKey(target) === key) void load(target)
  })
}
export const plugin: PanelClient['plugin'] = {
  request: (name, input, options) => frame().plugin.request(name, input, options),
  on: (name, handler) => frame().plugin.on(name, handler)
}
export const settings: SettingsStore = {
  get: ((key?: string) => key === undefined ? frame().settings.get() : frame().settings.get(key)) as SettingsStore['get'],
  set: (key, value) => frame().settings.set(key, value),
  onDidChange: handler => frame().settings.onDidChange(handler)
}
export const storage: KeyValueStore = {
  get: key => frame().storage.get(key), set: (key, value) => frame().storage.set(key, value),
  delete: key => frame().storage.delete(key), keys: () => frame().storage.keys(),
  onDidChange: handler => frame().storage.onDidChange(handler)
}
export const shell = { openExternal: (url: string) => frame().shell?.openExternal(url) ?? Promise.resolve({ opened: false }) }
export const files = { saveAs: (options: SaveOptions) => {
  if (!frame().files) throw new Error('File export is unavailable.')
  return frame().files!.saveAs(options)
} }
export const on: PanelClient['on'] = (name, handler) => frame().on(name, handler)
export const env = {
  get locale() { return client?.locale ?? 'en' },
  get theme() { return { colorScheme: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' as const : 'light' as const } },
  client: 'desktop' as const
}
