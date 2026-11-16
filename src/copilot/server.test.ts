import { test, assert, mockHost, mountWorker } from '#testing'
import { createCanvasServer } from './server.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUpdates } from '../updates/service.ts'
import { persistentStore } from './storage.ts'

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
