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
  const calls = [], listeners = {}; let finish, stream, failDraft = false, finishSettings, holdSettings = false
  try {
    globalThis.location = { pathname: '/c/' + 'a'.repeat(64) + '/' }
    globalThis.window = { addEventListener: (event, callback) => { listeners[event] = callback } }
    globalThis.setInterval = () => 0; globalThis.clearInterval = () => {}
    globalThis.fetch = async (url, init) => {
      if (url === 'events') return new Response(new ReadableStream({ start(controller) { stream = controller } }))
      const body = JSON.parse(init.body); calls.push(body)
      if (body.method === 'settings.get' && holdSettings) {
        await new Promise(resolve => { finishSettings = resolve })
        return Response.json({result:false})
      }
      if (body.method === 'storage.patch' && body.input.changes.some(change => change.key === 'panel:draft')) {
        if (failDraft) return Response.json({ error: { message: 'Save failed' } }, { status: 500 })
        if (!finish) await new Promise(resolve => { finish = resolve })
      }
      return Response.json({ result: body.method === 'updates.install' ? { status: 'reload' } : true })
    }
    module.exports.connectCanvas()
    const client = module.exports.frame()
    const save = client.storage.set('panel:draft', 'Keep Unicode 日本語, code, and paths')
    const update = client.updates.install()
    const send = client.plugin.request('prompt.send', { terminalId: 'attached', text: 'Reviewed result' })
    const deadline = Date.now() + 1000
    while (!finish && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1))
    assert.ok(finish, 'draft edits use the atomic batch endpoint')
    assert.equal(calls.some(c => c.method === 'updates.install'), false)
    assert.equal(calls.some(c => c.name === 'prompt.send'), false)
    let prevented = false
    listeners.beforeunload({ preventDefault() { prevented = true }, returnValue: undefined })
    assert.equal(prevented, true)
    finish(); await save; await send; assert.equal((await update).status, 'reload')
    assert.deepEqual(calls.find(c => c.method === 'updates.install'), { method: 'updates.install', input: {} })
    failDraft = true
    await assert.rejects(client.storage.set('panel:draft', 'Still unsaved'), /Save failed/)
    await client.storage.set('colorTheme', 'dark')
    await assert.rejects(client.updates.install(), /could not be saved/)
    await assert.rejects(client.plugin.request('prompt.send', { terminalId: 'attached', text: 'Unsaved result' }), /could not be saved/)
    await assert.rejects(client.plugin.request('prompt.enhance', { prompt: 'Unsaved request' }), /could not be saved/)
    assert.equal(calls.filter(c => c.method === 'updates.install').length, 1)
    failDraft = false; await client.persistence.retry(); await client.updates.install()
    assert.equal(calls.filter(c => c.method === 'updates.install').length, 2)
    assert.equal(client.persistence.snapshot().phase, 'saved')
    failDraft = true
    await assert.rejects(client.storage.set('panel:draft', 'Do not resurrect after opting out'), /Save failed/)
    failDraft = false
    await client.settings.set('saveHistory', false)
    await client.settings.set('saveHistory', true)
    const beforeRetry = calls.length
    await client.persistence.retry()
    assert.equal(calls.length, beforeRetry, 'turning saving off discards failed private saves before re-enabling')
    holdSettings = true
    const olderSettings = client.settings.get('saveHistory')
    await client.settings.set('saveHistory', true)
    finishSettings(); await olderSettings
    await client.storage.set('panel:draft', 'Newly retained after re-enabling')
    assert.equal(calls.at(-1).input.changes[0].value, 'Newly retained after re-enabling', 'late settings reads must not turn an edit into a deletion')
    prevented = false
    listeners.beforeunload({ preventDefault() { prevented = true }, returnValue: undefined })
    assert.equal(prevented, false)
    finish = undefined
    const held = client.storage.set('panel:draft', 'Keep this despite cancelled send')
    const controller = new AbortController()
    const cancelled = client.plugin.request('prompt.send', { terminalId: 'attached', text: 'Never send' }, { signal: controller.signal })
    const rejected = assert.rejects(cancelled, /abort/i)
    const waitUntil = Date.now() + 1000
    while (!finish && Date.now() < waitUntil) await new Promise(resolve => setTimeout(resolve, 1))
    assert.ok(finish)
    controller.abort(); finish(); await held; await rejected
    assert.equal(calls.some(c => c.input.text === 'Never send'), false)
    // A queued last edit is attempted before our close request. The host can
    // still close independently; this only verifies the best-effort ordering.
    const final = client.storage.set('panel:draft', 'Final edit')
    listeners.pagehide()
    await final
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls.at(-1).method, 'close')
  } finally {
    listeners.pagehide?.(); stream?.close()
    await new Promise(resolve => setImmediate(resolve))
    for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
})
