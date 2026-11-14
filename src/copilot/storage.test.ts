import { test, assert } from '#testing'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistentStore } from './storage.ts'
import { createServices } from './services.ts'
import type { CopilotSession } from './session.ts'

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

test('the color theme survives new sessions without sharing their drafts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-theme-test-'))
  try {
    const unused = async (): Promise<never> => { throw new Error('Theme persistence must not call the session RPC.') }
    const session = (sessionId: string): CopilotSession => ({
      sessionId, send: unused,
      rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } }
    })
    const first = createServices(session('first'), dir)
    await first.storage.set('colorTheme', 'light')
    await first.storage.set('panel:draft', 'Private draft')
    const second = createServices(session('second'), dir)
    assert.equal(await second.storage.get('colorTheme'), 'light')
    assert.equal(await second.storage.get('panel:draft'), null)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
