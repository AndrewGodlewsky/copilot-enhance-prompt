import { test, assert, mockHost, mountWorker } from '#testing'
import * as main from './worker.ts'
import { VERSION } from './version.ts'
import { claimReleaseHistory } from './release-history.ts'
import { persistentStore } from './copilot/storage.ts'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KEY = 'releaseHistory.seenVersion'

test('release history establishes a quiet baseline and survives a new canvas or worker', async () => {
  const host = mockHost({ storage: { history: [{ original: 'keep' }], 'panel:draft': 'keep draft', rules: { keep: true } } })
  const before = structuredClone(host.data().storage)
  const a = await mountWorker(main, { host })
  assert.deepEqual(await a.request('release.check'), { version: VERSION, show: false })
  await a.deactivate()
  const b = await mountWorker(main, { host })
  try {
    assert.deepEqual(await b.request('release.check'), { version: VERSION, show: false })
    assert.deepEqual(host.data().storage, { ...before, [KEY]: VERSION })
  } finally { await b.deactivate() }
})

test('an upgrade is claimed once across simultaneous workers and older code cannot rewind its marker', async () => {
  const host = mockHost({ storage: { [KEY]: '0.1.0' } })
  const a = await mountWorker(main, { host }), b = await mountWorker(main, { host })
  try {
    const answers = await Promise.all([a.request('release.check'), b.request('release.check')])
    assert.deepEqual(answers.map(a => a.show).sort(), [false, true])
    assert.equal(host.data().storage[KEY], VERSION)
    await host.storage.set(KEY, '99.0.0')
    assert.equal((await a.request('release.check')).show, false)
    assert.equal(host.data().storage[KEY], '99.0.0')
  } finally { await a.deactivate(); await b.deactivate() }
})

test('unknown release markers initialize quietly and failed persistence remains retryable', async () => {
  const host = mockHost({ storage: { [KEY]: { invalid: true } } })
  const worker = await mountWorker(main, { host })
  try {
    assert.equal((await worker.request('release.check')).show, false)
    await host.storage.set(KEY, '0.1.0')
    const write = host.storage.set
    host.storage.set = async () => { throw Error('write fixture failed') }
    await assert.rejects(worker.request('release.check'))
    host.storage.set = write
    assert.equal(host.data().storage[KEY], '0.1.0')
    assert.equal((await worker.request('release.check')).show, true)
  } finally { await worker.deactivate() }
})

test('release markers compare semantic versions including prereleases and build metadata', async () => {
  for (const [previous, current, show, saved] of [
    ['1.2.3-beta.9', '1.2.3-beta.10', true, '1.2.3-beta.10'],
    ['1.2.3-beta.10', '1.2.3', true, '1.2.3'],
    ['1.2.3', '1.2.3-beta.11', false, '1.2.3'],
    ['1.2.3+build.1', '1.2.3+build.2', false, '1.2.3+build.1'],
    ['unknown', '1.2.3', false, '1.2.3']
  ] as const) {
    const host = mockHost({ storage: { [KEY]: previous } })
    assert.deepEqual(await claimReleaseHistory(host.storage, current), { version: current, show })
    assert.equal(host.data().storage[KEY], saved)
  }
})

test('independent production stores share one upgrade claim without touching saved user data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-release-history-'))
  const first = persistentStore(root), second = persistentStore(root)
  await first.patch({ [KEY]: '0.1.0', history: ['saved'], rules: { saved: true }, 'draft-fixture': 'private' })
  const a = await mountWorker(main, { host: { ...mockHost(), storage: first } })
  const b = await mountWorker(main, { host: { ...mockHost(), storage: second } })
  try {
    const answers = await Promise.all([a.request('release.check'), b.request('release.check')])
    assert.deepEqual(answers.map(a => a.show).sort(), [false, true])
    const reopened = persistentStore(root)
    assert.deepEqual(await reopened.snapshot(), { [KEY]: VERSION, history: ['saved'], rules: { saved: true }, 'draft-fixture': 'private' })
  } finally { await a.deactivate(); await b.deactivate(); await rm(root, { recursive: true, force: true }) }
})
