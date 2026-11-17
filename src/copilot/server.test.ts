import { test, assert, mockHost, mountWorker } from '#testing'
import { createCanvasServer } from './server.ts'
import { mkdtemp, mkdir, writeFile, rm, symlink, link } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUpdates } from '../updates/service.ts'
import { persistentStore } from './storage.ts'
import { request as httpRequest } from 'node:http'
import { createServices } from './services.ts'
import { createWorkerHost } from '../worker-host.ts'
import type { CopilotSession } from './session.ts'

test('static assets use confined bounded reads and preserve MIME and CSP protections', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'enhance-static-'))
  const assets = join(fixture, 'assets'), outside = join(fixture, 'outside')
  await mkdir(assets); await mkdir(outside)
  await writeFile(join(assets, 'index.html'), '<html>safe</html>')
  await writeFile(join(assets, 'state.json'), '{"private":true}')
  await writeFile(join(outside, 'private.js'), 'PRIVATE')
  await writeFile(join(assets, 'large.js'), Buffer.alloc(8 * 1024 * 1024 + 1))
  await symlink(outside, join(assets, 'escape'), 'junction')
  await link(join(outside, 'private.js'), join(assets, 'hard.js'))
  const worker = await mountWorker({ default: () => {} }, { host: mockHost() })
  const server = await createCanvasServer({ worker, assets })
  try {
    const url = server.open('static')
    const response = await fetch(url)
    assert.equal(response.status, 200); assert.equal(await response.text(), '<html>safe</html>')
    assert.match(response.headers.get('content-type')!, /^text\/html/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.match(response.headers.get('content-security-policy')!, /script-src 'self'/)
    for (const path of ['escape/private.js', 'hard.js', 'large.js', 'state.json', 'missing.js']) {
      const denied = await fetch(url + path)
      assert.equal(denied.status, 404, path)
      assert.deepEqual(await denied.json(), { error: 'Not found' })
    }
  } finally { await server.close(); await worker.deactivate(); await rm(fixture, { recursive: true, force: true }) }
})

test('the canvas rejects unauthenticated, cross-origin and oversized requests, and confines storage writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-http-'))
  await writeFile(join(directory, 'index.html'), '<html>test</html>')
  const host = mockHost()
  const worker = await mountWorker({ default: api => { api.panels.handle('models.get', () => ({ profiles: [], selectorProfileId: null })) } }, { host })
  const server = await createCanvasServer({ worker, assets: directory })
  try {
    const url = server.open('one')
    const token = new URL(url).pathname.split('/')[2]
    const api = url + 'api'
    const post = (body: unknown, headers: Record<string, string> = {}) => fetch(api, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body) })
    assert.equal((await fetch(api, { method: 'POST', body: '{}' })).status, 403)
    assert.equal((await post({}, { origin: 'https://example.com' })).status, 403)
    assert.equal((await post({ method: 'storage.set', input: { key: 'models', value: [] } })).status, 400)
    assert.equal((await post({ method: 'storage.set', input: { key: 'panel:outputChoice', value: 'vi' } })).status, 400)
    assert.equal((await post({ method: 'storage.get', input: { key: 'panel:outputChoice' } })).status, 400)
    for (const key of ['panel:feedbackAsk', 'panel:feedbackOff', 'panel:hookLast']) {
      assert.equal((await post({ method: 'storage.set', input: { key, value: true } })).status, 400)
      assert.equal((await post({ method: 'storage.get', input: { key } })).status, 400)
    }
    assert.equal((await post({ method: 'request', name: 'ui.locale', input: { locale: 'zh-CN' } })).status, 400)
    assert.equal((await post({ method: 'storage.set', input: { key: 'colorTheme', value: 'light' } })).status, 200)
    assert.deepEqual(await (await post({ method: 'storage.get', input: { key: 'colorTheme' } })).json(), { result: 'light' })
    assert.equal((await post({ method: 'storage.set', input: { key: 'colorTheme', value: 'arbitrary' } })).status, 400)
    assert.equal((await post({ method: 'request', name: 'models.get' })).status, 200)
    const logs = { method: 'request', name: 'logs.get' }
    assert.equal((await post(logs, { authorization: '' })).status, 403)
    assert.equal((await post(logs, { origin: 'https://example.com' })).status, 403)
    const report = await (await post(logs)).json()
    assert.ok(report.result.entries.some((entry: any) => entry.operation === 'worker.ready'))
    assert.equal((await post({ method: 'storage.set', input: { key: 'panel:draft', value: 'x'.repeat(3_000_000) } })).status, 413)
    assert.equal((await fetch(url + '%2e%2e%2fstate.json')).status, 404)
    server.closeCanvas('one')
    assert.equal((await post({ method: 'request', name: 'models.get' })).status, 403)
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})

test('updating is human-UI-only, rejects client targets, preserves drafts and survives a disconnected response', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-update-http-'))
  await writeFile(join(directory, 'index.html'), '<html>test</html>')
  const worker = await mountWorker({ default: () => {} }, { host: mockHost() })
  let installed = '1.0.0', updates = 0, finish!: () => void
  const update = createUpdates({ running: installed, store: persistentStore(join(directory, 'updates')),
    installation: async () => ({ scope: 'test', installed, target: 'enhance-prompt@fixture', canUpdate: true, source: { repo: 'fixture/repo' } }),
    metadata: async () => ({ version: '1.1.0', changes: 'https://github.com/fixture/repo/blob/main/CHANGELOG.md' }),
    update: async target => { assert.equal(target, 'enhance-prompt@fixture'); updates++; await new Promise<void>(resolve => { finish = resolve }); installed = '1.1.0' }
  })
  const server = await createCanvasServer({ worker, assets: directory, updates: update })
  try {
    const url = server.open('one'), token = new URL(url).pathname.split('/')[2]
    const post = (body: unknown, headers: Record<string, string> = {}, signal?: AbortSignal) => fetch(url + 'api', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body), signal })
    const install = { method: 'updates.install' }
    assert.equal((await post(install, { authorization: '' })).status, 403)
    assert.equal((await post(install, { origin: 'https://evil.example' })).status, 403)
    assert.equal((await post({ ...install, input: { name: 'another-plugin' } })).status, 400)
    assert.equal((await post({ ...install, name: 'another-plugin' })).status, 400)
    assert.equal((await post({ method: 'request', name: 'updates.install' })).status, 400)
    assert.equal(updates, 0)
    await post({ method: 'storage.set', input: { key: 'panel:draft', value: 'Keep this request 日本語' } })
    await post({ method: 'updates.check', input: { manual: true } })
    const abort = new AbortController()
    const pending = post(install, {}, abort.signal).catch(() => null)
    while (!finish) await new Promise(resolve => setTimeout(resolve, 5))
    abort.abort(); await pending; finish()
    for (let i = 0; i < 100 && (await update.state()).status === 'updating'; i++) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal((await update.state()).status, 'reload'); assert.equal(updates, 1)
    assert.equal((await (await post({ method: 'storage.get', input: { key: 'panel:draft' } })).json()).result, 'Keep this request 日本語')
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true, maxRetries: 5 }) }
})

test('HTTP and SSE saturation is bounded per canvas and released after work/streams close', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-http-quota-'))
  const finish: (() => void)[] = []
  const worker = await mountWorker({ default: api => { api.panels.handle('models.get', async () => {
    await new Promise<void>(resolve => finish.push(resolve)); return { profiles: [], selectorProfileId: null }
  }) } }, { host: mockHost() })
  const server = await createCanvasServer({ worker, assets: directory })
  const streams: AbortController[] = []
  const requests: Promise<Response>[] = []
  try {
    const url = server.open('one'), other = server.open('two')
    const headers = (url: string) => ({ authorization: `Bearer ${new URL(url).pathname.split('/')[2]}`, 'content-type': 'application/json' })
    const post = (url: string, name: string) => fetch(url + 'api', { method: 'POST', headers: headers(url), body: JSON.stringify({ method: 'request', name }) })
    for (let i = 0; i < 24; i++) requests.push(post(url, 'models.get'))
    while (finish.length !== 24) await new Promise(resolve => setTimeout(resolve, 1))
    const busy = await post(url, 'logs.get')
    assert.equal(busy.status, 429); assert.equal(busy.headers.get('retry-after'), '2')
    assert.equal((await post(other, 'logs.get')).status, 200, 'a healthy second canvas remains usable')
    finish.forEach(done => done()); await Promise.all(requests)
    assert.equal((await post(url, 'logs.get')).status, 200)
    for (let i = 0; i < 2; i++) {
      const stop = new AbortController(); streams.push(stop)
      assert.equal((await fetch(url + 'events', { headers: headers(url), signal: stop.signal })).status, 200)
    }
    assert.equal((await fetch(url + 'events', { headers: headers(url) })).status, 429)
    streams.forEach(stop => stop.abort())
    await new Promise(resolve => setTimeout(resolve, 20))
    const stop = new AbortController(); streams.push(stop)
    assert.equal((await fetch(url + 'events', { headers: headers(url), signal: stop.signal })).status, 200)
    for (let i = 2; i < 16; i++) server.open(`canvas-${i}`)
    assert.throws(() => server.open('overflow'), { code: 'rate_limited' })
    server.closeCanvas('canvas-2')
    assert.ok(server.open('replacement'))
  } finally {
    finish.forEach(done => done()); streams.forEach(stop => stop.abort())
    await server.close(); await Promise.allSettled(requests); await worker.deactivate(); await rm(directory, { recursive: true, force: true })
  }
})

test('a stalled request body times out and releases capacity without waiting for its sender', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-http-body-'))
  const worker = await mountWorker({ default: () => {} }, { host: mockHost() })
  const server = await createCanvasServer({ worker, assets: directory, bodyTimeoutMs: 40 })
  try {
    const url = server.open('one'), authorization = `Bearer ${new URL(url).pathname.split('/')[2]}`
    const response = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(url + 'api', { method: 'POST', headers: { authorization, 'content-type': 'application/json', 'content-length': '1000' } }, result => { result.resume(); resolve(result.statusCode!) })
      request.on('error', reject); request.write('{')
    })
    assert.equal(response, 408)
    assert.equal((await fetch(url + 'api', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'request', name: 'logs.get' }) })).status, 200)
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})

test('four simultaneous canvas startups restore eighty saved atoms without exceeding capacity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-startup-quota-'))
  const worker = await mountWorker({ default: () => {} }, { host: mockHost() })
  let active = 0, peak = 0
  worker.api.storage.get = async () => {
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 10))
    active--; return 'Saved request 日本語'
  }
  const server = await createCanvasServer({ worker, assets: directory })
  try {
    await Promise.all(Array.from({ length: 4 }, async (_, index) => {
      const runtime = await import(new URL(`../runtime.ts?startup-${index}`, import.meta.url).href)
      const atoms = Array.from({ length: 20 }, () => runtime.atom('draft', '', { persist: 'plugin' }))
      const url = server.open(`startup-${index}`), authorization = `Bearer ${new URL(url).pathname.split('/')[2]}`
      runtime.bindPanel({ storage: {
        async get(key: string) {
          const response = await fetch(url + 'api', { method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'storage.get', input: { key } }) })
          const value = await response.json()
          if (!response.ok) throw Object.assign(new Error(value.error.message), { code: value.error.code })
          return value.result
        }, onDidChange: () => ({ dispose() {} })
      } })
      await runtime.ready()
      assert.ok(atoms.every(atom => runtime.read(atom) === 'Saved request 日本語'))
    }))
    assert.ok(peak <= 16, `peak concurrent startup reads: ${peak}`)
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})

test('HTTP bulk restore is authenticated, bounded and confined to readable keys in this session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-bulk-http-'))
  const services = createServices({ sessionId: 'bulk-http' } as CopilotSession, join(directory, 'state'))
  await services.settings.get(); await services.storage.set('panel:draft', 'Only my request 🧪')
  await services.storage.set('history', [{ original: 'Saved history' }]); await services.data.set('private-key', 'Never expose')
  const worker = createWorkerHost(services), server = await createCanvasServer({ worker, assets: directory })
  try {
    const url = server.open('one'), token = new URL(url).pathname.split('/')[2]
    const post = (input: unknown, authenticated = true) => fetch(url + 'api', { method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ method: 'storage.getMany', input }) })
    assert.equal((await post({ keys: ['panel:draft'] }, false)).status, 403)
    for (const input of [{ keys: 'panel:draft' }, { keys: ['private-key'] }, { keys: ['internal:sessionStorage'] }, { keys: ['session:' + '0'.repeat(24) + ':panel:draft'] }, { keys: Array(65).fill('panel:draft') }, { keys: [null] }, { keys: ['history'], target: 'other-session' }]) assert.equal((await post(input)).status, 400)
    const response = await post({ keys: ['panel:draft', 'history', 'panel:draft', 'panel:result'] })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).result, { 'panel:draft': 'Only my request 🧪', history: [{ original: 'Saved history' }], 'panel:result': null })
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})

test('atomic panel saves retain their session and privacy opt-out prevents queued text from returning', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-save-http-'))
  const services = createServices({ sessionId: 'first' } as CopilotSession, join(directory, 'state'))
  const other = createServices({ sessionId: 'second' } as CopilotSession, join(directory, 'state'))
  await services.settings.get(); await other.storage.set('panel:draft', 'Other session retained')
  const worker = createWorkerHost(services), server = await createCanvasServer({ worker, assets: directory })
  try {
    const url = server.open('one'), token = new URL(url).pathname.split('/')[2]
    const post = (method: string, input: unknown, authenticated = true) => fetch(url + 'api', { method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ method, input }) })
    const changes = [{ key: 'panel:draft', value: 'Latest Unicode 🧪' }, { key: 'panel:result', value: 'Reviewed' }]
    assert.equal((await post('storage.patch', { changes }, false)).status, 403)
    for (const input of [{ changes, target: 'second' }, { changes: [{ key: 'history', value: [] }] }, { changes: [{ key: 'panel:draft', value: 'Invalid', remove: true }] }, { changes: [{ key: 'panel:draft' }] }, { changes: Array(65).fill(changes[0]) }]) assert.equal((await post('storage.patch', input)).status, 400)
    assert.equal((await post('storage.patch', { changes })).status, 200)
    assert.equal(await services.storage.get('panel:draft'), 'Latest Unicode 🧪')
    assert.equal(await services.storage.get('panel:result'), 'Reviewed')
    assert.equal(await other.storage.get('panel:draft'), 'Other session retained')
    assert.equal((await post('settings.set', { key: 'saveHistory', value: false })).status, 200)
    assert.equal(await services.storage.get('panel:draft'), null)
    assert.equal(await services.storage.get('panel:result'), null)
    assert.equal((await post('storage.patch', { changes })).status, 200)
    assert.equal(await services.storage.get('panel:draft'), null, 'late queued text must be discarded with saving off')
    assert.equal(await other.storage.get('panel:draft'), 'Other session retained', 'opt-out must not expire inactive drafts')
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})

test('retained-data cleanup is human HTTP only, canvas-bound and restricted to a stopped fixture session', async () => {
  const { execFileSync } = await import('node:child_process')
  const { createHash } = await import('node:crypto')
  const { sessionData } = await import('./session-storage.ts')
  const directory = await mkdtemp(join(tmpdir(),'enhance-retained-http-'))
  const services = createServices({sessionId:'current'} as CopilotSession,directory)
  await services.storage.set('panel:draft','Keep current')
  execFileSync(process.execPath,['--input-type=module','--eval',`import {createServices} from ${JSON.stringify(new URL('./services.ts',import.meta.url).href)}; const service=createServices({sessionId:'stopped'},process.env.TEST_STORAGE_ROOT); await service.storage.set('panel:draft','Inactive fixture'); await service.storage.set('panel:style','balanced');`],{env:{...process.env,TEST_STORAGE_ROOT:directory},windowsHide:true})
  const stopped = createHash('sha256').update('stopped').digest('hex').slice(0,24)
  const worker = createWorkerHost(services), server = await createCanvasServer({worker,assets:directory,retained:services.retained})
  try {
    const urls = [server.open('one'),server.open('two')]
    const post = (index:number, method:string,input:unknown, authenticated = true) => fetch(urls[index]+'api',{method:'POST',headers:{'content-type':'application/json',...(authenticated?{authorization:`Bearer ${new URL(urls[index]).pathname.split('/')[2]}`}:{})},body:JSON.stringify({method,input})})
    assert.equal((await post(0,'retained.inspect',{},false)).status,403)
    assert.equal((await post(0,'retained.inspect',{target:directory})).status,400)
    const response = await post(0,'retained.inspect',{})
    assert.equal(response.status,200)
    const view = (await response.json()).result
    assert.equal(view.cleanup.count,1)
    const input = {token:view.cleanup.token,restarted:true}
    assert.equal((await post(1,'retained.clear',input)).status,400)
    assert.equal((await post(0,'retained.clear',{...input,target:'other'})).status,400)
    assert.equal((await post(0,'retained.clear',{...input,restarted:false})).status,400)
    assert.equal((await post(0,'retained.clear',input)).status,200)
    assert.equal(await sessionData(directory,stopped).get('panel:draft'),null)
    assert.equal(await sessionData(directory,stopped).get('panel:style'),'balanced')
    assert.equal(await services.storage.get('panel:draft'),'Keep current')
    await assert.rejects(worker.request('retained.clear' as any,input as any),/Unknown request/)
  } finally { await server.close(); await worker.deactivate(); await rm(directory,{recursive:true,force:true}) }
})
