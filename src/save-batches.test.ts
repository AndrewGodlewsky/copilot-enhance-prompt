import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createSaveQueue } from './save-queue.ts'
import { storageSaveRequests } from './save-batches.ts'
import { createServices } from './copilot/services.ts'
import { createWorkerHost } from './worker-host.ts'
import { createCanvasServer } from './copilot/server.ts'
import type { CopilotSession } from './copilot/session.ts'

test('large Unicode and complex values that save individually also survive coalescing and Retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-save-bounds-'))
  const session = {sessionId:'large-save-fixture'} as CopilotSession
  const services = createServices(session, root), worker = createWorkerHost(services)
  const server = await createCanvasServer({worker, assets:root})
  try {
    const url = server.open('one'), token = new URL(url).pathname.split('/')[2]
    let failResult = false
    const queue = createSaveQueue(async operations => {
      for (const request of storageSaveRequests(operations)) {
        if (failResult && JSON.stringify(request.input).includes('panel:result')) { failResult = false; throw Error('Synthetic transient failure') }
        const response = await fetch(url + 'api', {method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(request)})
        const answer = await response.json()
        assert.equal(response.status, 200, `each request must respect actual HTTP byte/complexity limits: ${answer.error?.message ?? ''}`)
      }
    })
    const text = '日'.repeat(450_000)
    await queue.enqueue({scope:'storage',key:'panel:draft',value:text})
    await queue.enqueue({scope:'storage',key:'panel:result',value:text})
    await Promise.all([queue.enqueue({scope:'storage',key:'panel:draft',value:text}), queue.enqueue({scope:'storage',key:'panel:result',value:text})])
    failResult = true
    const saves = [queue.enqueue({scope:'storage',key:'panel:draft',value:text + ' 🧪'}), queue.enqueue({scope:'storage',key:'panel:result',value:text + ' path/src.ts'})]
    await Promise.all(saves.map(save => assert.rejects(save, /Synthetic transient failure/)))
    assert.equal(queue.snapshot().phase, 'failed')
    await queue.retry()
    const reopened = createServices(session, root)
    assert.equal(await reopened.storage.get('panel:draft'), text + ' 🧪')
    assert.equal(await reopened.storage.get('panel:result'), text + ' path/src.ts')
    const complex = Array.from({length:500}, () => Array(20).fill('Exact value'))
    await Promise.all([queue.enqueue({scope:'storage',key:'panel:parked',value:complex}), queue.enqueue({scope:'storage',key:'panel:contextNotes',value:complex})])
    assert.deepEqual(await reopened.storage.get('panel:parked'), complex)
    assert.deepEqual(await reopened.storage.get('panel:contextNotes'), complex)
    let deep: any = 'Leaf preserved'
    for (let n=0;n<22;n++) deep = {child:deep}
    await queue.enqueue({scope:'storage',key:'panel:parked',value:deep})
    assert.deepEqual(await reopened.storage.get('panel:parked'), deep, 'single-key fallback preserves the former envelope depth limit')
    await queue.flush()
    assert.equal(queue.snapshot().phase, 'saved')
  } finally { await server.close(); await worker.deactivate(); await rm(root,{recursive:true,force:true}) }
})
