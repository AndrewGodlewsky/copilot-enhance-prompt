import { test, assert } from '#testing'
import { sessionAdapter, type CopilotSession } from './session.ts'

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

test('an unresponsive SDK makes the session unavailable within a bounded time', async () => {
  const { session, adapter, sent } = fixture()
  session.rpc.metadata.activity = () => new Promise(() => {})
  const result = await Promise.race([adapter.state(), new Promise(resolve => setTimeout(() => resolve('hung'), 3500))])
  assert.equal(result, 'unknown')
  assert.equal(sent.length, 0)
})
