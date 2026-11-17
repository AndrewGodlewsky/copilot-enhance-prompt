import { test, assert } from '#testing'
import { sessionAdapter, type CopilotSession } from './session.ts'
import { fileURLToPath } from 'node:url'

function fixture() {
  const sent: unknown[] = []
  const state = { busy: false, pending: [] as unknown[], queue: [] as unknown[], remote: false, fail: false }
  const session: CopilotSession = {
    sessionId: 'session-1',
    rpc: {
      metadata: {
        snapshot: async () => ({ workingDirectory: process.cwd(), isRemote: state.remote }),
        activity: async () => { if (state.fail) throw new Error('disconnected'); return { hasActiveWork: state.busy } },
        isProcessing: async () => ({ processing: state.busy })
      },
      permissions: { pendingRequests: async () => ({ items: state.pending }) },
      queue: { pendingItems: async () => ({ items: state.queue, steeringMessages: [] }) }
    },
    send: async options => { sent.push(options); return 'message-1' }
  }
  return { session, state, sent, adapter: sessionAdapter(session) }
}

test('the source workspace comes from session metadata, and remote sessions expose no local files', async () => {
  const { adapter, state } = fixture()
  const local = await adapter.call('workspace.list', {})
  assert.equal(local.workspaces[0].path, process.cwd())
  state.remote = true
  assert.deepEqual((await adapter.call('workspace.list', {})).workspaces, [])
})

test('sending is bound to the attached, idle session and never uses immediate steering', async () => {
  const { adapter, sent } = fixture()
  await assert.rejects(adapter.call('session.send', { sessionId: 'another', text: 'hello' }))
  assert.equal((await adapter.call('session.send', { sessionId: 'session-1', text: 'hello' })).accepted, true)
  assert.deepEqual(sent, [{ prompt: 'hello', mode: 'enqueue' }])
})

test('busy, blocked, queued, disconnected and unknown sessions cannot receive a prompt', async () => {
  for (const field of ['busy', 'pending', 'queue', 'fail'] as const) {
    const { adapter, state, sent } = fixture()
    if (field === 'pending' || field === 'queue') state[field] = [{}]
    else state[field] = true
    await assert.rejects(adapter.call('session.send', { sessionId: 'session-1', text: 'hello' }))
    assert.equal(sent.length, 0)
  }
})

test('concurrent Send clicks produce only one message', async () => {
  const { adapter, sent } = fixture()
  const answers = await Promise.allSettled([
    adapter.call('session.send', { sessionId: 'session-1', text: 'hello' }),
    adapter.call('session.send', { sessionId: 'session-1', text: 'hello' })
  ])
  assert.equal(answers.filter(answer => answer.status === 'fulfilled').length, 1)
  assert.equal(sent.length, 1)
})

test('project discovery fails closed for incomplete metadata and non-directory paths', async () => {
  const { session, adapter } = fixture()
  for (const snapshot of [null, {}, { isRemote: false }, { workingDirectory: process.cwd() },
    ...[undefined, null, 0, 'false', true].map(isRemote => ({ workingDirectory: process.cwd(), isRemote })),
    ...[null, 12, 'relative', fileURLToPath(import.meta.url), fileURLToPath(new URL('./missing-project-fixture-dir', import.meta.url))].map(workingDirectory => ({ workingDirectory, isRemote: false }))]) {
    session.rpc.metadata.snapshot = async () => snapshot as never
    assert.equal(await adapter.project(), null, JSON.stringify(snapshot))
  }
  session.rpc.metadata.snapshot = async () => { throw new Error('disconnected') }
  assert.equal(await adapter.project(), null)
})

test('Send cancellation after the idle check starts prevents enqueue and permits a later retry', async () => {
  for (const check of ['activity', 'processing', 'permissions', 'queue']) {
    const { session, adapter, sent } = fixture()
    let release!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve })
    if (check === 'activity') session.rpc.metadata.activity = async () => { await waiting; return { hasActiveWork: false } }
    if (check === 'processing') session.rpc.metadata.isProcessing = async () => { await waiting; return { processing: false } }
    if (check === 'permissions') session.rpc.permissions.pendingRequests = async () => { await waiting; return { items: [] } }
    if (check === 'queue') session.rpc.queue.pendingItems = async () => { await waiting; return { items: [], steeringMessages: [] } }
    const controller = new AbortController()
    const sending = adapter.call('session.send', { sessionId: 'session-1', text: 'hello' }, { signal: controller.signal })
    controller.abort()
    release()
    await assert.rejects(sending, { name: 'AbortError' })
    assert.equal(sent.length, 0)
    await assert.rejects(adapter.call('session.send', { sessionId: 'session-1', text: 'hello' }, { signal: controller.signal }), { name: 'AbortError' })
    await adapter.call('session.send', { sessionId: 'session-1', text: 'retry' })
    assert.deepEqual(sent, [{ prompt: 'retry', mode: 'enqueue' }])
  }
})

test('an unresponsive SDK makes the session unavailable within a bounded time', async () => {
  const { session, adapter, sent } = fixture()
  session.rpc.metadata.activity = () => new Promise(() => {})
  const result = await Promise.race([adapter.state(), new Promise(resolve => setTimeout(() => resolve('hung'), 3500))])
  assert.equal(result, 'unknown')
  assert.equal(sent.length, 0)
})
