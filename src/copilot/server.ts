import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { createWorkerHost } from '../worker-host.ts'
import type { Disposable, JsonValue, RequestInput } from '../runtime.ts'
import type { PluginRequests } from '../protocol.ts'

type Worker = ReturnType<typeof createWorkerHost>
type Canvas = { id: string; token: string; streams: Set<ServerResponse>; subscriptions: Disposable[] }
const LIMIT = 2_500_000
const MODEL_WRITES = new Set(['models.save', 'models.delete', 'models.move', 'models.roles', 'consent.set', 'rules.save'])
const PANEL_KEYS = new Set(['tab', 'style', 'level', 'profileChoice', 'modelChoice', 'outputChoice', 'structureChoice', 'terminalWorkspaces', 'optionsOpen', 'feedbackAsk', 'feedbackOff', 'draft', 'result', 'lastRun', 'contextShown', 'contextNotes', 'files', 'workspaceKey', 'parked', 'sendAfterEnhance', 'historyScope'])
const readable = (key: string) => key === 'history' || key.startsWith('panel:') && PANEL_KEYS.has(key.slice(6))
const writable = (key: string) => key.startsWith('panel:') && PANEL_KEYS.has(key.slice(6))
const PRIVATE_PANEL_KEYS = new Set(['draft', 'result', 'lastRun', 'contextShown', 'contextNotes', 'files', 'workspaceKey', 'parked'])
const invalid = (message = 'Invalid canvas request.') => Object.assign(new Error(message), { status: 400 })

async function body(request: IncomingMessage): Promise<Record<string, any>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw invalid()
  let size = 0
  const parts: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > LIMIT) reject(Object.assign(new Error('The canvas request is too large.'), { status: 413 }))
      else parts.push(chunk)
    })
    request.on('end', resolve)
    request.on('error', reject)
  })
  const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, any>
}

export async function createCanvasServer(options: { worker: Worker; assets: string; onClose?: (id: string) => void }) {
  const { worker } = options
  const canvases = new Map<string, Canvas>()
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
          res.writeHead(200, { 'content-type': 'text/event-stream', connection: 'keep-alive' })
          res.write('data: {"kind":"connected"}\n\n')
          canvas.streams.add(res)
          const ping = setInterval(() => res.write(': heartbeat\n\n'), 15_000)
          res.on('close', () => { clearInterval(ping); canvas.streams.delete(res) })
          return
        }
        if (req.method !== 'POST') throw invalid()
        const request = await body(req)
        const controller = new AbortController()
        res.on('close', () => { if (!res.writableEnded) controller.abort() })
        const { method, input = {} } = request
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid()
        let answer: unknown
        const client = worker.panel(canvas.id)
        if (method === 'request') {
          if (typeof request.name !== 'string') throw invalid()
          const name = request.name as keyof PluginRequests
          const run = () => worker.request(name, input as RequestInput<typeof name>, { signal: controller.signal, panelId: canvas.id, timeoutMs: 120_000 })
          answer = MODEL_WRITES.has(name) && worker.api.storage.transaction ? await worker.api.storage.transaction(run) : await run()
          if (name === 'data.clear' && input.what === 'all') {
            for (const key of await client.storage.keys()) if (key.startsWith('panel:')) await client.storage.delete(key)
          }
        } else if (method === 'settings.get') answer = input.key === undefined ? await client.settings.get() : await client.settings.get(input.key)
        else if (method === 'settings.set') { await client.settings.set(input.key, input.value); answer = true }
        else if (method === 'storage.keys') answer = (await client.storage.keys()).filter(readable)
        else if (method === 'storage.get') {
          if (typeof input.key !== 'string' || !readable(input.key)) throw invalid()
          answer = await client.storage.get(input.key)
        } else if (method === 'storage.set' || method === 'storage.delete') {
          if (typeof input.key !== 'string' || !writable(input.key)) throw invalid()
          if (method === 'storage.set' && PRIVATE_PANEL_KEYS.has(input.key.slice(6)) && await client.settings.get('saveHistory') === false) await client.storage.delete(input.key)
          else if (method === 'storage.set') await client.storage.set(input.key, input.value as JsonValue)
          else await client.storage.delete(input.key)
          answer = true
        } else if (method === 'close') {
          worker.closePanel(canvas.id); options.onClose?.(canvas.id); answer = true
        } else throw invalid()
        if (!res.destroyed) json(res, 200, { result: answer ?? null })
        return
      }
      if (req.method !== 'GET' || route.includes('%') || route.includes('\\') || route.split('/').includes('..')) { json(res, 404, { error: 'Not found' }); return }
      const file = await realpath(resolve(assets, route || 'index.html')).catch(() => '')
      if (!file.startsWith(assets + sep)) { json(res, 404, { error: 'Not found' }); return }
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
      if (!mime[extname(file)]) { json(res, 404, { error: 'Not found' }); return }
      res.writeHead(200, { 'content-type': mime[extname(file)] }); res.end(await readFile(file))
    } catch (error) {
      if (!res.destroyed && !res.headersSent) json(res, (error as any).status ?? 400, { error: { message: error instanceof Error ? error.message : 'Canvas request failed.', code: (error as any)?.code ?? 'request_failed' } })
    }
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    open(id: string) {
      let canvas = canvases.get(id)
      if (!canvas) {
        canvas = { id, token: randomBytes(32).toString('hex'), streams: new Set(), subscriptions: [] }
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
