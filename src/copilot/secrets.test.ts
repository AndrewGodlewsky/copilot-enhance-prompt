import { test, assert } from '#testing'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistentStore } from './storage.ts'
import { protectedSecrets } from './secrets.ts'

test('Windows credentials survive restart without storing plaintext', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-secret-test-'))
  try {
    const secret = 'test-only-key-123456789'
    await protectedSecrets(persistentStore(directory)).set('test', secret)
    assert.equal((await readFile(join(directory, 'state.json'), 'utf8')).includes(secret), false)
    const restored = protectedSecrets(persistentStore(directory))
    assert.equal(await restored.get('test'), secret)
    await restored.delete('test')
    assert.equal(await restored.get('test'), null)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
