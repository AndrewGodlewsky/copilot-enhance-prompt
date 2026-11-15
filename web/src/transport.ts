import { bindPanel, type JsonValue, type PanelClient, type RequestOptions } from '../../src/runtime.ts'
import { panelDiagnostics } from '../../src/panel/diagnostics.ts'
import { diagnosticError } from '../../src/diagnostics.ts'

export function connectCanvas(): void {
  const token = /^\/c\/([a-f0-9]{64})\/$/.exec(location.pathname)?.[1]
  if (!token) throw new Error('Open this panel from the Enhance Prompt canvas in GitHub Copilot.')
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` }
  const listeners = new Map<string, Set<(payload: any) => void>>()
  const emit = (name: string, payload: unknown) => { for (const listener of listeners.get(name) ?? []) listener(payload) }
  const listen = (name: string, handler: (payload: any) => void) => {
    const set = listeners.get(name) ?? new Set(); set.add(handler); listeners.set(name, set)
    return { dispose: () => { set.delete(handler) } }
  }
  let closing = false
  let writes: Promise<unknown> = Promise.resolve()
  async function call(method: string, input: unknown = {}, options: RequestOptions = {}, name?: string): Promise<any> {
    const started = Date.now()
    try {
      const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(options.timeoutMs ?? 120_000)])
      const response = await fetch('api', { method: 'POST', headers, body: JSON.stringify({ method, input, ...(name ? { name } : {}) }), signal })
      const body = await response.json()
      if (!response.ok) throw Object.assign(new Error(body.error?.message ?? 'The canvas connection failed.'), { code: body.error?.code ?? 'disconnected', status: response.status })
      return body.result
    } catch (error) {
      panelDiagnostics.record('canvas.request', 'failed', { ms: Date.now() - started, ...diagnosticError(error) })
      throw error
    }
  }
  const write = (method: string, input: unknown): Promise<void> => {
    const result = writes.catch(() => {}).then(() => call(method, input))
    writes = result
    return result
  }
  const client: PanelClient = {
    plugin: { request: (name, input, options) => call('request', input ?? {}, options, name), on: (name, handler) => listen(`plugin:${name}`, handler) },
    settings: {
      get: ((key?: string) => call('settings.get', key ? { key } : {})) as PanelClient['settings']['get'],
      set: (key, value) => write('settings.set', { key, value }), onDidChange: handler => listen('settings', handler)
    },
    storage: {
      get: key => call('storage.get', { key }), set: (key, value: JsonValue) => write('storage.set', { key, value }),
      delete: key => write('storage.delete', { key }), keys: () => call('storage.keys'), onDidChange: handler => listen('storage', handler)
    },
    on: (name, handler) => listen(name, handler),
    shell: { openExternal: async url => {
      const parsed = new URL(url)
      if (!['https:', 'http:'].includes(parsed.protocol)) return { opened: false }
      window.open(parsed.href, '_blank', 'noopener,noreferrer')
      return { opened: true }
    } },
    files: { saveAs: async options => {
      const blob = new Blob([options.data], { type: options.mimeType ?? 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = options.suggestedName ?? 'enhanced-prompt.txt'
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return { status: 'downloaded' }
    } }
  }
  bindPanel(client)
  let connected: boolean | undefined
  const connection = (next: boolean) => {
    if (next !== connected) panelDiagnostics.record('canvas.connection', next ? 'ok' : 'failed')
    connected = next
  }
  async function events() {
    while (!closing) {
      try {
        const response = await fetch('events', { headers })
        if (!response.ok || !response.body) throw new Error('Disconnected')
        connection(true)
        emit('workspace.changed', {})
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
        let pending = ''
        while (!closing) {
          const next = await reader.read()
          if (next.done) break
          pending += next.value
          let end: number
          while ((end = pending.indexOf('\n\n')) >= 0) {
            const line = pending.slice(0, end); pending = pending.slice(end + 2)
            if (!line.startsWith('data: ')) continue
            const event = JSON.parse(line.slice(6))
            if (event.kind === 'plugin') emit(`plugin:${event.name}`, event.payload)
            else if (event.kind === 'storage' || event.kind === 'settings') emit(event.kind, { key: event.key })
          }
        }
        if (!closing) connection(false)
      } catch { if (!closing) connection(false); emit('workspace.changed', {}) }
      if (!closing) await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  void events()
  const poll = setInterval(() => emit('workspace.changed', {}), 5000)
  window.addEventListener('pagehide', () => {
    closing = true; clearInterval(poll)
    void fetch('api', { method: 'POST', headers, body: JSON.stringify({ method: 'close' }), keepalive: true }).catch(() => {})
  })
}
