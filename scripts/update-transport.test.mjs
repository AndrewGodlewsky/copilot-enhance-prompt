import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

test('Update flushes queued saves and refuses installation after an unrelated successful write hides a failed draft save', async () => {
  const compiled = await build({ stdin: { contents: `export {connectCanvas} from './src/transport.ts'; export {frame} from '../src/runtime.ts'`, resolveDir: fileURLToPath(new URL('../web/', import.meta.url)) }, tsconfig: 'web/tsconfig.json', bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports)
  const originals = new Map(['window', 'location', 'fetch', 'setInterval', 'clearInterval'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const calls = []; let close, finish, stream, failDraft = false
  try {
    globalThis.location = { pathname: '/c/' + 'a'.repeat(64) + '/' }
    globalThis.window = { addEventListener: (_event, callback) => { close = callback } }
    globalThis.setInterval = () => 0; globalThis.clearInterval = () => {}
    globalThis.fetch = async (url, init) => {
      if (url === 'events') return new Response(new ReadableStream({ start(controller) { stream = controller } }))
      const body = JSON.parse(init.body); calls.push(body)
      if (body.method === 'storage.set' && body.input.key === 'panel:draft') {
        if (failDraft) return Response.json({ error: { message: 'Save failed' } }, { status: 500 })
        if (!finish) await new Promise(resolve => { finish = resolve })
      }
      return Response.json({ result: body.method === 'updates.install' ? { status: 'reload' } : true })
    }
    module.exports.connectCanvas()
    const client = module.exports.frame()
    const save = client.storage.set('panel:draft', 'Keep Unicode 日本語, code, and paths')
    const update = client.updates.install()
    while (!finish) await new Promise(resolve => setTimeout(resolve, 1))
    assert.equal(calls.some(c => c.method === 'updates.install'), false)
    finish(); await save; assert.equal((await update).status, 'reload')
    assert.deepEqual(calls.find(c => c.method === 'updates.install'), { method: 'updates.install', input: {} })
    failDraft = true
    await assert.rejects(client.storage.set('panel:draft', 'Still unsaved'), /Save failed/)
    await client.storage.set('colorTheme', 'dark')
    await assert.rejects(client.updates.install(), /could not be saved/)
    assert.equal(calls.filter(c => c.method === 'updates.install').length, 1)
    failDraft = false; await client.storage.set('panel:draft', 'Saved now'); await client.updates.install()
    assert.equal(calls.filter(c => c.method === 'updates.install').length, 2)
  } finally {
    close?.(); stream?.close()
    for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
})
