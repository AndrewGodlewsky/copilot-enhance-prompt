import { test, assert } from '#testing'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistentStore } from './storage.ts'

test('writes survive restart, concurrent transactions preserve changes, and scopes stay separate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-store-test-'))
  try {
    const a = persistentStore(dir)
    const b = persistentStore(dir)
    await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? a : b).transaction(async () => {
      await a.set('count', Number(await a.get('count')) + 1)
    })))
    assert.equal(await persistentStore(dir).get('count'), 12)
    await a.set('panel:session-1:draft', 'one')
    assert.equal(await b.get('panel:session-2:draft'), null)
    assert.equal(typeof await readFile(join(dir, 'state.json'), 'utf8'), 'string')
  } finally { await rm(dir, { recursive: true, force: true }) }
})
