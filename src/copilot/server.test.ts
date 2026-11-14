import { test, assert, mockHost, mountWorker } from '#testing'
import { createCanvasServer } from './server.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('the canvas rejects unauthenticated, cross-origin and oversized requests, and confines storage writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-http-'))
  await writeFile(join(directory, 'index.html'), '<html>test</html>')
  const host = mockHost()
  const worker = await mountWorker({ default: api => { api.panels.handle('models.get', () => ({ profiles: [], presets: [], hookProfileId: null, selectorProfileId: null, fromEnv: false })) } }, { host })
  const server = await createCanvasServer({ worker, assets: directory })
  try {
    const url = server.open('one')
    const token = new URL(url).pathname.split('/')[2]
    const api = url + 'api'
    const post = (body: unknown, headers: Record<string, string> = {}) => fetch(api, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body) })
    assert.equal((await fetch(api, { method: 'POST', body: '{}' })).status, 403)
    assert.equal((await post({}, { origin: 'https://example.com' })).status, 403)
    assert.equal((await post({ method: 'storage.set', input: { key: 'models', value: [] } })).status, 400)
    assert.equal((await post({ method: 'request', name: 'models.get' })).status, 200)
    assert.equal((await post({ method: 'storage.set', input: { key: 'panel:draft', value: 'x'.repeat(3_000_000) } })).status, 413)
    assert.equal((await fetch(url + '%2e%2e%2fstate.json')).status, 404)
    server.closeCanvas('one')
    assert.equal((await post({ method: 'request', name: 'models.get' })).status, 403)
  } finally { await server.close(); await worker.deactivate(); await rm(directory, { recursive: true, force: true }) }
})
