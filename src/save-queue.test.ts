import test from 'node:test'
import assert from 'node:assert/strict'
import { createSaveQueue, type SaveOperation } from './save-queue.ts'

const edit = (text: string): SaveOperation => ({ scope: 'storage', key: 'panel:draft', value: text })
const turn = () => new Promise(resolve => setImmediate(resolve))

test('rapid edits keep only the final pending value and flush waits for durable acknowledgement', async () => {
  const writes: SaveOperation[][] = [], finish: (() => void)[] = []
  const queue = createSaveQueue(async ops => { writes.push(ops); await new Promise<void>(resolve => finish.push(resolve)) })
  const first = queue.enqueue(edit('First')); await turn()
  const pending = Array.from({ length: 1000 }, (_, n) => queue.enqueue(edit(`Latest ${n} 🧪`)))
  assert.equal(queue.snapshot().pending, 2)
  let flushed = false
  const flush = queue.flush().then(() => { flushed = true })
  finish.shift()!(); await first; await turn()
  assert.equal(flushed, false)
  assert.equal(writes.length, 2)
  assert.deepEqual(writes[1], [edit('Latest 999 🧪')])
  finish.shift()!(); await Promise.all(pending); await flush
  assert.deepEqual(queue.snapshot(), { pending: 0, failed: 0, phase: 'saved' })
})

test('settings are ordering barriers, deletes supersede text, and failed writes can be corrected or retried', async () => {
  const writes: SaveOperation[][] = []; let fail = true
  const queue = createSaveQueue(async ops => { writes.push(ops); if (fail) { fail = false; throw Error('Fixture disk failure') } })
  await assert.rejects(queue.enqueue(edit('Original')))
  assert.equal(queue.snapshot().phase, 'failed')
  await assert.rejects(queue.flush(), /saved/)
  await queue.retry()
  assert.equal(queue.snapshot().phase, 'saved')
  const pending = [queue.enqueue(edit('Before opt out')), queue.enqueue({ scope: 'settings', key: 'saveHistory', value: false }), queue.enqueue(edit('Must be filtered by backend')), queue.enqueue({ scope: 'storage', key: 'panel:draft', remove: true })]
  await Promise.all(pending); await queue.flush()
  assert.deepEqual(writes.slice(-3), [[edit('Before opt out')], [{ scope: 'settings', key: 'saveHistory', value: false }], [{ scope: 'storage', key: 'panel:draft', remove: true }]])
})

test('an older failure cannot overwrite a newer clear and separate canvas queues stay independent', async () => {
  let reject!: (error: Error) => void
  const writes: SaveOperation[][] = []
  const queue = createSaveQueue(async ops => { writes.push(ops); if (writes.length === 1) await new Promise<void>((_, fail) => { reject = fail }) })
  const old = queue.enqueue(edit('Older request')).catch(() => {})
  await turn()
  const clear = queue.enqueue(edit(''))
  reject(Error('Old request failed')); await old; await clear; await queue.retry()
  assert.equal(writes.length, 2, 'retry must never restore the failed older request')
  assert.deepEqual(writes[1], [edit('')])
  const other: SaveOperation[][] = []
  const second = createSaveQueue(async ops => { other.push(ops) })
  await second.enqueue(edit('Other session')); await second.flush()
  assert.equal(writes.length, 2)
  assert.deepEqual(other, [[edit('Other session')]])
})
