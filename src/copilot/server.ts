import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { extname } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { createWorkerHost } from '../worker-host.ts'
import type { Disposable, JsonValue, RequestInput } from '../runtime.ts'
import type { PluginRequests } from '../protocol.ts'
import type { createUpdates } from '../updates/service.ts'
import { REQUEST_BYTES, busyError, validateJson } from '../limits.ts'
import { readConfinedFile } from '../confined-read.ts'

type Worker = ReturnType<typeof createWorkerHost>
type Canvas = { id: string; token: string; streams: Set<ServerResponse>; subscriptions: Disposable[]; pending: number }
const MODEL_WRITES = new Set(['models.save', 'models.delete', 'models.move', 'models.roles', 'consent.set', 'rules.save'])
const PANEL_KEYS = new Set(['tab', 'style', 'level', 'effort', 'structureChoice', 'terminalWorkspaces', 'optionsOpen', 'draft', 'result', 'lastRun', 'contextShown', 'contextNotes', 'files', 'workspaceKey', 'parked', 'sendAfterEnhance', 'historyScope'])
const readable = (key: string) => key === 'history' || key === 'colorTheme' || key.startsWith('panel:') && PANEL_KEYS.has(key.slice(6))
const writable = (key: string) => key === 'colorTheme' || key.startsWith('panel:') && PANEL_KEYS.has(key.slice(6))
const PRIVATE_PANEL_KEYS = new Set(['draft', 'result', 'lastRun', 'contextShown', 'contextNotes', 'files', 'workspaceKey', 'parked'])
const invalid = (message = 'Invalid canvas request.') => Object.assign(new Error(message), { status: 400 })

async function body(request: IncomingMessage, timeoutMs: number): Promise<Record<string, any>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw invalid()
  let size = 0
  let tooLarge = false
  const parts: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      request.off('data', data); request.off('end', end); request.off('error', fail); request.off('aborted', aborted)
      if (error) { request.pause(); parts.length = 0; reject(error) } else resolve()
    }
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > REQUEST_BYTES) { tooLarge = true; parts.length = 0 }
      else if (!tooLarge) parts.push(chunk)
    }
    const end = () => finish(tooLarge ? Object.assign(new Error('The canvas request is too large.'), { status: 413 }) : undefined)
    const fail = (error: Error) => finish(error)
    const aborted = () => finish(invalid('The request was disconnected.'))
    const timer = setTimeout(() => finish(Object.assign(new Error('The request body timed out. Retry when the connection is ready.'), { status: 408 })), timeoutMs)
    request.on('data', data); request.on('end', end); request.on('error', fail); request.on('aborted', aborted)
  })
  const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  validateJson(value)
  return value as Record<string, any>
}

export async function createCanvasServer(options: { worker: Worker; assets: string; onClose?: (id: string) => void; updates?: ReturnType<typeof createUpdates>; bodyTimeoutMs?: number }) {
  const { worker } = options
  const canvases = new Map<string, Canvas>()
  let pending = 0, streams = 0
  let origin = ''
  const assets = await realpath(options.assets)
  const json = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value ?? null)) }
  const broadcast = (canvas: Canvas, data: unknown) => {
    const message = `data: ${JSON.stringify(data)}\n\n`
    for (const stream of canvas.streams) {
      if (stream.writableLength > 1_000_000) stream.destroy()
      else stream.write(message)
    }
  }
  const closeCanvas = (id: string) => {
    const canvas = canvases.get(id)
    if (!canvas) return
    canvases.delete(id)
    worker.closePanel(id)
    options.onClose?.(id)
    for (const sub of canvas.subscriptions) sub.dispose()
    for (const stream of canvas.streams) stream.end()
  }
  const server = createServer(async (req, res) => {
    let release: (() => void) | undefined
    res.setHeader('cache-control', 'no-store')
    res.setHeader('referrer-policy', 'no-referrer')
    res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'")
    try {
      if (req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin) { json(res, 403, { error: 'Forbidden' }); return }
      const path = new URL(req.url ?? '/', origin).pathname
      const match = /^\/c\/([a-f0-9]{64})\/(.*)$/.exec(path)
      const canvas = match && [...canvases.values()].find(item => item.token === match[1])
      if (!canvas || !match) { json(res, 403, { error: 'Forbidden' }); return }
      const route = match[2]
      if (route === 'api' || route === 'events') {
        if (req.headers.authorization !== `Bearer ${canvas.token}`) { json(res, 403, { error: 'Forbidden' }); return }
        if (route === 'events') {
          if (req.method !== 'GET') throw invalid()
          if (canvas.streams.size >= 2 || streams >= 16) throw busyError()
          res.writeHead(200, { 'content-type': 'text/event-stream', connection: 'keep-alive' })
          res.write('data: {"kind":"connected"}\n\n')
          canvas.streams.add(res)
          streams++
          const ping = setInterval(() => res.write(': heartbeat\n\n'), 15_000)
          res.on('close', () => { clearInterval(ping); if (canvas.streams.delete(res)) streams-- })
          return
        }
        if (req.method !== 'POST') throw invalid()
        // Leave room for bounded startup reads alongside normal panel controls.
        if (canvas.pending >= 24 || pending >= 64) throw busyError()
        canvas.pending++; pending++
        release = () => { canvas.pending--; pending-- }
        const request = await body(req, options.bodyTimeoutMs ?? 10_000)
        const controller = new AbortController()
        res.on('close', () => { if (!res.writableEnded) controller.abort() })
        const { method, input = {} } = request
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid()
        let answer: unknown
        const client = worker.panel(canvas.id)
        const work = <T>(run: () => Promise<T>) => options.updates ? options.updates.withWork(run) : run()
        if (typeof method === 'string' && method.startsWith('updates.')) {
          if (!options.updates) throw invalid('Updates are unavailable in this runtime.')
          const action = method.slice(8)
          const expected = action === 'check' ? ['manual'] : action === 'automatic' ? ['enabled'] : []
          if (Object.keys(request).some(key => !['method', 'input'].includes(key)) || Object.keys(input).some(key => !expected.includes(key))) throw invalid()
          if (action === 'check' && typeof input.manual === 'boolean') answer = await options.updates.check(input.manual)
          else if (action === 'automatic' && typeof input.enabled === 'boolean') answer = await options.updates.automatic(input.enabled)
          else if (action === 'state') answer = await options.updates.state()
          else if (action === 'install') answer = await options.updates.install()
          else if (action === 'later') answer = await options.updates.later()
          else throw invalid()
        } else if (method === 'request') {
          if (typeof request.name !== 'string') throw invalid()
          const name = request.name as keyof PluginRequests
          const run = () => worker.request(name, input as RequestInput<typeof name>, { signal: controller.signal, panelId: canvas.id, timeoutMs: 120_000 })
          const guarded = async () => {
            const result = MODEL_WRITES.has(name) && worker.api.storage.transaction ? await worker.api.storage.transaction(run) : await run()
            if (name === 'data.clear' && input.what === 'all') {
              for (const key of await client.storage.keys()) if (key.startsWith('panel:')) await client.storage.delete(key)
            }
            return result
          }
          answer = ['logs.get', 'targets.list', 'models.get', 'rules.get', 'consents.get', 'data.summary', 'enhance.progress.get'].includes(name) ? await guarded() : await work(guarded)
        } else if (method === 'settings.get') answer = input.key === undefined ? await client.settings.get() : await client.settings.get(input.key)
        else if (method === 'settings.set') { await work(() => client.settings.set(input.key, input.value)); answer = true }
        else if (method === 'storage.keys') answer = (await client.storage.keys()).filter(readable)
        else if (method === 'storage.getMany') {
          if (Object.keys(input).some(key => key !== 'keys') || !Array.isArray(input.keys) || input.keys.length > 64 || input.keys.some((key: unknown) => typeof key !== 'string' || !readable(key))) throw invalid()
          const keys = [...new Set<string>(input.keys)]
          answer = client.storage.getMany ? await client.storage.getMany(keys) : Object.fromEntries(await Promise.all(keys.map(async key => [key, await client.storage.get(key)])))
        }
        else if (method === 'storage.get') {
          if (typeof input.key !== 'string' || !readable(input.key)) throw invalid()
          answer = await client.storage.get(input.key)
        } else if (method === 'storage.set' || method === 'storage.delete') {
          if (typeof input.key !== 'string' || !writable(input.key)) throw invalid()
          if (method === 'storage.set' && input.key === 'colorTheme' && !['system', 'light', 'dark'].includes(input.value)) throw invalid()
          await work(async () => {
            if (method === 'storage.set' && PRIVATE_PANEL_KEYS.has(input.key.slice(6)) && await client.settings.get('saveHistory') === false) await client.storage.delete(input.key)
            else if (method === 'storage.set') await client.storage.set(input.key, input.value as JsonValue)
            else await client.storage.delete(input.key)
          })
          answer = true
        } else if (method === 'close') {
          worker.closePanel(canvas.id); options.onClose?.(canvas.id); answer = true
        } else throw invalid()
        if (!res.destroyed) json(res, 200, { result: answer ?? null })
        return
      }
      if (req.method !== 'GET' || route.includes('%') || route.includes('\\') || route.split('/').includes('..')) { json(res, 404, { error: 'Not found' }); return }
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
      const file = await readConfinedFile(assets, route || 'index.html', 8 * 1024 * 1024, path => !!mime[extname(path)])
      if (!file) { json(res, 404, { error: 'Not found' }); return }
      res.writeHead(200, { 'content-type': mime[extname(file.path)] }); res.end(file.data)
    } catch (error) {
      if (!res.destroyed && !res.headersSent) {
        if (!req.complete) { res.shouldKeepAlive = false; res.once('finish', () => req.destroy()) }
        if ((error as any).status === 429) res.setHeader('retry-after', '2')
        json(res, (error as any).status ?? 400, { error: { message: error instanceof Error ? error.message : 'Canvas request failed.', code: (error as any)?.code ?? 'request_failed' } })
      }
    } finally { release?.() }
  })
  server.maxConnections = 128
  server.maxHeadersCount = 100
  server.headersTimeout = 10_000
  server.requestTimeout = 15_000
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    open(id: string) {
      let canvas = canvases.get(id)
      if (!canvas) {
        if (canvases.size >= 16) throw busyError()
        canvas = { id, token: randomBytes(32).toString('hex'), streams: new Set(), subscriptions: [], pending: 0 }
        const target = canvas
        target.subscriptions.push(
          worker.onPost(post => { if (!post.panel || post.panel === id) broadcast(target, { kind: 'plugin', name: post.event, payload: post.payload }) }),
          worker.api.storage.onDidChange(({ key }) => { if (readable(key)) broadcast(target, { kind: 'storage', key }) }),
          worker.api.settings.onDidChange(({ key }) => broadcast(target, { kind: 'settings', key }))
        )
        canvases.set(id, canvas)
      }
      return `${origin}/c/${canvas.token}/`
    },
    closeCanvas,
    async close() { for (const id of [...canvases.keys()]) closeCanvas(id); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  }
}
