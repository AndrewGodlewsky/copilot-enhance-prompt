import { test, assert, mockHost, mountWorker } from '#testing'
import * as main from './worker.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistentStore } from './copilot/storage.ts'

const entry = (id: string, at = 1) => ({ id, at, original: `Request ${id}`, enhanced: `Result ${id}`, model: 'fixture', style: 'balanced', source: 'panel' })

test('history recovery advertises its absolute deadline and is isolated to the deleting worker', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100_000 })
  const host = mockHost({ storage: { history: [entry('one')] } })
  const a = await mountWorker(main, { host })
  const b = await mountWorker(main, { host })
  try {
    assert.deepEqual(await a.request('history.remove', { id: 'one' }), { ok: true, undo: { id: 'one', expiresAt: 160_000 } })
    assert.deepEqual(await a.request('history.removed'), { entries: [{ id: 'one', label: 'Request one', expiresAt: 160_000 }] })
    assert.deepEqual(await b.request('history.removed'), { entries: [] })
    assert.deepEqual(await b.request('history.restore', { id: 'one' }), { restored: false })
    t.mock.timers.tick(60_000)
    assert.deepEqual(await a.request('history.restore', { id: 'one' }), { restored: false })
    assert.deepEqual(await a.request('history.removed'), { entries: [] })
  } finally { await a.deactivate(); await b.deactivate() }
})

test('recovery survives failed persistence and concurrent restore succeeds only once', async () => {
  const host = mockHost({ storage: { history: [entry('one')] } })
  const worker = await mountWorker(main, { host })
  try {
    await worker.request('history.remove', { id: 'one' })
    const write = host.storage.set
    host.storage.set = async () => { throw Error('disk fixture failed') }
    await assert.rejects(worker.request('history.restore', { id: 'one' }))
    host.storage.set = write
    assert.equal((await worker.request('history.removed')).entries.length, 1)
    const results = await Promise.all([worker.request('history.restore', { id: 'one' }), worker.request('history.restore', { id: 'one' })])
    assert.deepEqual(results.map(r => r.restored).sort(), [false, true])
    assert.equal((await worker.request('history.removed')).entries.length, 0)
    assert.equal(host.data().storage.history.length, 1)
  } finally { await worker.deactivate() }
})

test('ten recoverable deletions retain their promised window and clear invalidates recovery', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100_000 })
  const host = mockHost({ storage: { history: Array.from({ length: 11 }, (_, i) => entry(String(i), i)) } })
  const worker = await mountWorker(main, { host })
  try {
    for (let i = 0; i < 10; i++) await worker.request('history.remove', { id: String(i) })
    await assert.rejects(worker.request('history.remove', { id: '10' }), /recoverable/i)
    assert.equal(host.data().storage.history.length, 1)
    assert.equal((await worker.request('history.removed')).entries.length, 10)
    t.mock.timers.tick(60_000)
    await worker.request('history.remove', { id: '10' })
    await worker.request('history.clear')
    assert.deepEqual(await worker.request('history.restore', { id: '10' }), { restored: false })
  } finally { await worker.deactivate() }
})

test('recovery rechecks privacy and capacity without discarding a still-valid entry', async () => {
  const host = mockHost({ settings: { historyLimit: 1 }, storage: { history: [entry('old', 1)] } })
  const worker = await mountWorker(main, { host })
  try {
    await worker.request('history.remove', { id: 'old' })
    await host.storage.set('history', [entry('new', 2)])
    assert.deepEqual(await worker.request('history.restore', { id: 'old' }), { restored: false })
    await host.settings.set('historyLimit', 2)
    await host.settings.set('saveHistory', false)
    assert.deepEqual(await worker.request('history.restore', { id: 'old' }), { restored: false })
    await host.settings.set('saveHistory', true)
    assert.deepEqual(await worker.request('history.restore', { id: 'old' }), { restored: true })
  } finally { await worker.deactivate() }
})

test('restore rechecks its deadline and saving preference after a delayed history read', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100_000 })
  for (const change of ['expiry', 'privacy', 'limit']) {
    const host = mockHost({ storage: { history: [entry(change)] } })
    const worker = await mountWorker(main, { host })
    try {
      await worker.request('history.remove', { id: change })
      const get = host.storage.get
      let changed = false
      host.storage.get = async key => {
        const value = await get(key)
        if (key === 'history' && !changed) {
          changed = true
          if (change === 'expiry') t.mock.timers.tick(60_000)
          else await host.settings.set(change === 'privacy' ? 'saveHistory' : 'historyLimit', change === 'privacy' ? false : 0)
        }
        return value
      }
      assert.deepEqual(await worker.request('history.restore', { id: change }), { restored: false }, change)
      assert.equal(host.data().storage.history.length, 0)
    } finally { await worker.deactivate() }
  }
})

test('clearing shared history invalidates other workers recovery even after new entries arrive', async () => {
  for (const action of ['history.clear', 'data.clear'] as const) {
    const host = mockHost({ storage: { history: [entry('old')] } })
    const a = await mountWorker(main, { host }), b = await mountWorker(main, { host })
    try {
      await a.request('history.remove', { id: 'old' })
      if (action === 'history.clear') await b.request(action)
      else await b.request(action, { what: 'history' })
      await host.storage.set('history', [entry('new')])
      assert.deepEqual(await a.request('history.removed'), { entries: [] })
      assert.deepEqual(await a.request('history.restore', { id: 'old' }), { restored: false })
      assert.deepEqual(host.data().storage.history.map((e: {id: string}) => e.id), ['new'])
    } finally { await a.deactivate(); await b.deactivate() }
  }
})

test('production atomic Clear persists invalidation across independent store adapters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-history-recovery-'))
  const first = persistentStore(root), second = persistentStore(root)
  await first.set('history', [entry('old')])
  const a = await mountWorker(main, { host: { ...mockHost(), storage: first } })
  const b = await mountWorker(main, { host: { ...mockHost(), storage: second } })
  try {
    await a.request('history.remove', { id: 'old' })
    await b.request('history.clear')
    const reopened = persistentStore(root)
    assert.equal(await reopened.get('history'), null)
    assert.equal(typeof await reopened.get('history.undoEpoch'), 'string')
    await reopened.set('history', [entry('new')])
    assert.deepEqual(await a.request('history.restore', { id: 'old' }), { restored: false })
  } finally { await a.deactivate(); await b.deactivate(); await rm(root, { recursive: true, force: true }) }
})
