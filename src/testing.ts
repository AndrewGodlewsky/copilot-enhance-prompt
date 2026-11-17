// Test fixtures for the project's own service contract; no desktop application is required.
import { EventEmitter } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { DEFAULTS } from './defaults.ts'
import { bindPanel, ready, type JsonValue, type PanelClient, type RequestInput, type RequestOptions } from './runtime.ts'
import type { PluginRequests } from './protocol.ts'
import { createWorkerHost } from './worker-host.ts'
import type { EnhanceWorker } from './host.ts'
export { test, afterEach, beforeEach, after, before } from 'node:test'
export { default as assert } from 'node:assert/strict'
// Fixtures deliberately accept incomplete and invalid values for trust-boundary tests.
export type MockRequests = { [K in keyof PluginRequests]?: PluginRequests[K]['output'] | ((input: RequestInput<K>, options?: RequestOptions) => PluginRequests[K]['output'] | Promise<PluginRequests[K]['output']>) }
export function mockHost(options: { settings?: Record<string, any>; storage?: Record<string, any>; results?: Record<string, any>; requests?: MockRequests } = {}) {
  const data = { settings: { ...DEFAULTS, ...options.settings }, storage: structuredClone(options.storage ?? {}) }
  const results = { ...options.results }
  const calls: { name: string; params: any }[] = []
  const notifications = new EventEmitter()
  const track = (name: string, params: any) => { calls.push({ name, params: structuredClone(params) }) }
  const listen = (channel: string, fn: (event: { key: string }) => void) => { notifications.on(channel, fn); return { dispose: () => { notifications.off(channel, fn) } } }
  const settings = {
    get: async (key?: string): Promise<any> => key === undefined ? { ...data.settings } : data.settings[key],
    set: async (key: string, value: JsonValue) => { track('settings.set', { key, value }); data.settings[key] = value; notifications.emit('settings', { key }) },
    onDidChange: (fn: (event: { key: string }) => void) => listen('settings', fn)
  }
  const storage = {
    get: async (key: string) => structuredClone(data.storage[key] ?? null),
    set: async (key: string, value: JsonValue) => { data.storage[key] = structuredClone(value); notifications.emit('storage', { key }) },
    delete: async (key: string) => { delete data.storage[key]; notifications.emit('storage', { key }) },
    keys: async () => Object.keys(data.storage),
    onDidChange: (fn: (event: { key: string }) => void) => listen('storage', fn)
  }
  const invoke = async (name: string, params: any, requestOptions?: any): Promise<any> => {
    track(name, params)
    if (!(name in results)) throw Object.assign(new Error(`${name} is unavailable`), { code: 'unavailable' })
    const result = results[name]
    return typeof result === 'function' ? await result(params, requestOptions) : structuredClone(result)
  }
  const services = {
    attachmentOwner: 'test-session',
    settings, storage,
    host: { has: (name: string) => name in results, call: invoke }
  }
  return { ...services, data: () => data, callsOf: (name: string) => calls.filter(call => call.name === name).map(call => call.params), respond: (name: string, value: any) => { results[name] = value }, invoke, track, requests: options.requests ?? {} }
}
export type MockHost = ReturnType<typeof mockHost>
export async function mountWorker(module: { default: (api: EnhanceWorker) => void }, { host }: { host: MockHost }) {
  const logs: string[] = []
  const posts: { event: string; payload: any; panel?: string }[] = []
  const worker = createWorkerHost(host, message => logs.push(message))
  worker.onPost(post => posts.push(post))
  module.default(worker.api)
  await delay(5)
  return { ...worker, logs, posts }
}
export type MountOptions = { host: MockHost; persisted?: { plugin?: Record<string, any>; workspace?: Record<string, any> } }
export async function mount(module: { setup: () => (() => void) | void; default?: () => unknown }, options: MountOptions) {
  const { host } = options
  const persisted = { plugin: { ...options.persisted?.plugin }, workspace: { ...options.persisted?.workspace } }
  for (const [key, value] of Object.entries(persisted.plugin)) await host.storage.set(`panel:${key}`, value)
  const events = new EventEmitter()
  const posts = new EventEmitter()
  const listen = (bus: EventEmitter, name: string, handler: (...args: any[]) => void) => { bus.on(name, handler); return { dispose: () => { bus.off(name, handler) } } }
  const client: PanelClient = {
    settings: host.settings,
    storage: { ...host.storage, set: async (key, value) => { if (key.startsWith('panel:')) persisted.plugin[key.slice(6)] = structuredClone(value); await host.storage.set(key, value) } },
    plugin: {
      request: async (name, input, requestOptions) => {
        host.track('plugin.request', { name, ...(input === undefined ? {} : { input }) })
        const response = host.requests[name]
        if (response === undefined) throw Object.assign(new Error(`Unknown request: ${name}`), { code: 'unavailable' })
        return typeof response === 'function' ? await (response as any)(input ?? {}, requestOptions) : structuredClone(response) as any
      },
      on: (name, handler) => listen(posts, name, handler)
    },
    on: (name, handler) => listen(events, name, handler),
    shell: { openExternal: url => host.invoke('shell.openExternal', { url }) },
    files: { saveAs: args => host.invoke('files.saveAs', args) }
  }
  bindPanel(client)
  await ready()
  const dispose = module.setup()
  const settled = async () => { await delay(12) }
  return {
    persisted, errors: [] as unknown[], refusals: [] as unknown[], settled,
    emit: async (name: string, payload: any) => { events.emit(name, payload); await settled() },
    post: async (name: string, payload: any) => { posts.emit(name, payload); await settled() },
    unmount: async () => { dispose?.(); events.removeAllListeners(); posts.removeAllListeners(); await settled() }
  }
}
export type TestPanel = Awaited<ReturnType<typeof mount>>
