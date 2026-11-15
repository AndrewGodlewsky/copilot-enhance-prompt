import { assert, mockHost, mountWorker, test } from '#testing'
import * as main from './worker.ts'

test('legacy auto-enhance preferences do not register chat operations or commands', async () => {
  const host = mockHost({ settings: { autoEnhanceMode: 'rules', autoEnhanceAppend: 'Old rules', notifyWhenDone: true } })
  const worker = await mountWorker(main, { host })
  try {
    for (const name of ['hook.last', 'models.detect']) await assert.rejects(worker.request(name as never), /Unknown/)
    const settings = await main.readSettings(worker.api)
    assert.ok(!('autoEnhanceMode' in settings))
    assert.ok(!('notifyWhenDone' in settings))
  } finally { await worker.deactivate() }
})
