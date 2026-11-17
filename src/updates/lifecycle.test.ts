import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mockHost, mountWorker } from '../testing.ts'
import * as workerModule from '../worker.ts'
import { persistentStore } from '../copilot/storage.ts'
import { createUpdates } from './service.ts'

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done }); return { promise, resolve } }
const run = promisify(execFile)

test('cancelled enhancement and model tests reserve updates in other processes until cleanup settles', async () => {
  for (const operation of ['prompt.enhance', 'models.test'] as const) {
    const dir = await mkdtemp(join(tmpdir(), 'enhance-work-lifetime-'))
    const entered = deferred(), cleanup = deferred(), finished = deferred()
    const host = mockHost({ storage: { models: { profiles: [{ id: 'model', name: 'Fixture', preset: 'copilot', provider: 'copilot', model: 'test', enabled: true }] } }, results: {
      'copilot.rewrite': async (_input: unknown, { signal }: { signal: AbortSignal }) => {
        entered.resolve()
        await new Promise<void>(resolve => { if (signal.aborted) resolve(); else signal.addEventListener('abort', () => resolve(), { once: true }) })
        await cleanup.promise
        finished.resolve()
        throw new Error('Cancelled after cleanup')
      }
    } })
    const worker = await mountWorker(workerModule, { host })
    const store = persistentStore(dir)
    const service = createUpdates({ running: '1.0.0', store,
      installation: async () => ({ scope: 'fixture', installed: '1.0.0', target: 'enhance-prompt@fixture', source: { repo: 'fixture/repo' }, canUpdate: true }),
      metadata: async () => ({ version: '1.1.0' }), update: async () => { throw new Error('Only the child fixture updates') },
      busy: () => workerModule.hasActiveRuns() || worker.hasActiveWork?.()
    })
    const child = async () => (await run(process.execPath, ['--input-type=module', '-e', `
      import {persistentStore} from ${JSON.stringify(new URL('../copilot/storage.ts', import.meta.url).href)};
      import {createUpdates} from ${JSON.stringify(new URL('./service.ts', import.meta.url).href)};
      let installed='1.0.0';
      const client=createUpdates({running:'1.0.0',store:persistentStore(${JSON.stringify(dir)}),
        installation:async()=>({scope:'fixture',installed,target:'enhance-prompt@fixture',source:{repo:'fixture/repo'},canUpdate:true}),
        metadata:async()=>({version:'1.1.0'}),update:async()=>{installed='1.1.0'}});
      try{console.log((await client.install()).status)}catch(error){console.log(error.message)}
    `], { windowsHide: true, timeout: 15_000 })).stdout.trim()
    try {
      await service.check(true)
      const abort = new AbortController()
      const request = service.withWork<unknown>(() => operation === 'prompt.enhance'
        ? worker.request(operation, { prompt: 'Never retain this cancelled result', level: 'off' }, { signal: abort.signal, panelId: 'owner' })
        : worker.request(operation, { id: 'model' }, { signal: abort.signal, panelId: 'owner' }))
      const rejected = assert.rejects(request, /aborted/)
      await entered.promise
      abort.abort(); workerModule.cancelPanelRuns('owner')
      await Promise.race([rejected, new Promise((_, reject) => setTimeout(() => reject(new Error('Caller did not cancel promptly')), 500))])
      assert.match(await child(), /Finish active plugin work/, operation)
      cleanup.resolve(); await finished.promise
      for (let i = 0; i < 250; i++) {
        const state = await store.get('state') as { work?: Record<string, number> }
        if (!Object.keys(state.work ?? {}).length) break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert.equal(await child(), 'reload', operation)
      assert.equal(await host.storage.get('history'), null)
    } finally {
      cleanup.resolve(); workerModule.cancelPanelRuns('owner'); await worker.deactivate()
      await rm(dir, { recursive: true, force: true, maxRetries: 5 })
    }
  }
})
