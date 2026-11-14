import { EventEmitter } from 'node:events'
import type { EnhanceWorker, RequestContext, WorkerHooks } from './host.ts'
import type { AppEvents, Disposable, PanelClient, RequestInput, RequestOptions } from './runtime.ts'
import type { PluginPanelEvents, PluginRequests } from './protocol.ts'

type Handler = (input: any, context: RequestContext) => unknown
export function createWorkerHost(services: Pick<EnhanceWorker, 'storage' | 'settings' | 'secrets' | 'host'>, log = (_message: string) => {}) {
  const events = new EventEmitter()
  events.setMaxListeners(100)
  const handlers = new Map<string, Handler>()
  const hooks = new Map<string, ((event: any, next: (event: any) => unknown) => unknown)[]>()
  const commands = new Map<string, () => unknown>()
  const requests = new Map<AbortController, string>()
  const listen = (name: string, handler: (...args: any[]) => void): Disposable => {
    events.on(name, handler)
    return { dispose: () => { events.off(name, handler) } }
  }
  const api: EnhanceWorker = {
    ...services, log,
    panels: {
      handle: (name, handler) => { handlers.set(name, handler); return { dispose: () => { handlers.delete(name) } } },
      post: (name, payload, options) => { events.emit('post', { event: name, payload, panel: options?.panel }) }
    },
    events: { on: (name, handler) => listen(name, handler) },
    hooks: { on: (name, handler) => {
      const list = hooks.get(name) ?? []; list.push(handler); hooks.set(name, list)
      return { dispose: () => { const index = list.indexOf(handler); if (index >= 0) list.splice(index, 1) } }
    } },
    commands: { register: (name, handler) => { commands.set(name, handler); return { dispose: () => { commands.delete(name) } } } }
  }
  async function request<K extends keyof PluginRequests>(name: K, input?: RequestInput<K>, options: RequestOptions & { panelId?: string; panel?: string } = {}): Promise<PluginRequests[K]['output']> {
    const handler = handlers.get(name)
    if (!handler) throw Object.assign(new Error(`Unknown request: ${name}`), { code: 'unavailable' })
    const controller = new AbortController()
    const panelId = options.panelId ?? options.panel ?? 'panel'
    requests.set(controller, panelId)
    const abort = () => controller.abort()
    if (options.signal?.aborted) abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    const timer = options.timeoutMs ? setTimeout(abort, options.timeoutMs) : undefined
    let onAbort: () => void = () => {}
    try {
      const stopped = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(Object.assign(new Error('The request was aborted.'), { code: 'aborted' }))
        if (controller.signal.aborted) onAbort()
        else controller.signal.addEventListener('abort', onAbort, { once: true })
      })
      return await Promise.race([Promise.resolve().then(() => handler(input ?? {}, { signal: controller.signal, panel: { id: panelId } })), stopped]) as PluginRequests[K]['output']
    } finally {
      clearTimeout(timer)
      controller.signal.removeEventListener('abort', onAbort)
      options.signal?.removeEventListener('abort', abort)
      requests.delete(controller)
    }
  }
  async function fire<K extends keyof WorkerHooks>(name: K, event: WorkerHooks[K]): Promise<{ kind: 'continue'; event: WorkerHooks[K] }> {
    let current = event
    for (const handler of hooks.get(name) ?? []) await handler(current, updated => { current = updated })
    return { kind: 'continue', event: current }
  }
  function panel(panelId: string): PanelClient {
    return {
      settings: services.settings, storage: services.storage,
      plugin: {
        request: (name, input, options) => request(name, input, { ...options, panelId }),
        on: (name, handler) => listen('post', post => { if (post.event === name && (!post.panel || post.panel === panelId)) handler(post.payload) })
      },
      on: (name, handler) => listen(name, handler)
    }
  }
  return {
    api, request, hooks: { fire }, panel,
    emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]) { events.emit(name, payload) },
    onPost: (handler: (post: { event: keyof PluginPanelEvents; payload: unknown; panel?: string }) => void) => listen('post', handler),
    async command(name: string) { const handler = commands.get(name); if (!handler) throw new Error(`Unknown command: ${name}`); return await handler() },
    closePanel(panelId: string) { for (const [request, owner] of requests) if (owner === panelId) request.abort() },
    async deactivate() { for (const request of requests.keys()) request.abort(); requests.clear(); events.removeAllListeners(); hooks.clear(); commands.clear(); handlers.clear() }
  }
}
