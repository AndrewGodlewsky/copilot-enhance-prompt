import { test, assert, mockHost, mount } from '#testing'
import { createDiagnostics, diagnosticError } from './diagnostics.ts'
import { createWorkerHost } from './worker-host.ts'
import { msg, withMessage } from './messages.ts'
import { collectDiagnostics } from './panel/diagnostics.ts'

test('support logs accept only known fields and codes, cap memory and return independent snapshots', () => {
  const logs = createDiagnostics()
  const secret = 'private prompt /home/person/project sk-test-key'
  logs.record(secret, 'failed')
  logs.record('prompt.send', 'failed', { ms: NaN, code: secret, status: 999, text: secret } as any)
  assert.deepEqual(Object.keys(logs.snapshot().entries[0]), ['at', 'operation', 'outcome'])
  assert.deepEqual(diagnosticError(Object.assign(new Error(secret), { code: secret, status: 429 })), { code: 'request_failed', status: 429 })
  const encoded = new Error(withMessage(msg('error.agent_blocked', { name: secret })))
  assert.deepEqual(diagnosticError(encoded), { code: 'error.agent_blocked' })
  assert.deepEqual(diagnosticError({ text: { code: 'raw', params: { text: secret } }, code: 'timeout' }), { code: 'timeout' })
  for (const status of [401, 429, 503]) {
    const text = msg('error.http', { status, detail: secret })
    assert.deepEqual(diagnosticError({ text }), { code: 'error.http', status })
    assert.deepEqual(diagnosticError(new Error(withMessage(text))), { code: 'error.http', status })
  }
  assert.deepEqual(diagnosticError({ text: msg('error.http', { status: secret, detail: secret }) }), { code: 'error.http' })
  for (let i = 0; i < 205; i++) logs.record('prompt.enhance', 'ok', { ms: i })
  const snapshot = logs.snapshot()
  assert.equal(snapshot.entries.length, 200)
  assert.equal(snapshot.entries[0].ms, 5)
  snapshot.entries[0].operation = secret
  assert.doesNotMatch(JSON.stringify(logs.snapshot()), /private prompt|sk-test-key/)
})

test('worker report captures real failures, returned errors and durations without request or response content', async () => {
  const host = mockHost()
  const worker = createWorkerHost(host)
  const secret = 'SECRET_KEY private prompt C:/private/project'
  worker.api.panels.handle('prompt.send', () => { throw Object.assign(new Error(withMessage(msg('error.agent_blocked', { name: secret }))), { code: 'conflict' }) })
  worker.api.panels.handle('models.test', () => ({ ok: false, message: secret, text: msg('error.copilot_account'), ms: 12 }))
  worker.api.panels.handle('models.catalog', () => ({ models: [], source: secret, fetchedAt: 0, error: secret }))
  worker.api.panels.handle('prompt.copy', () => ({ copied: true }))
  worker.api.panels.handle('history.restore', () => ({ restored: false }))
  worker.api.panels.handle('targets.list', () => ({ targets: [], workspace: secret }))
  try {
    await assert.rejects(worker.request('prompt.send', { terminalId: secret, text: secret }))
    await worker.request('models.test', { id: secret })
    await worker.request('models.catalog', { preset: 'custom', apiKey: secret })
    await worker.request('prompt.copy', { text: secret })
    await worker.request('history.restore', { id: secret })
    await worker.request('targets.list', {})
    const report = await worker.request('logs.get')
    assert.ok(report.entries.some(entry => entry.operation === 'prompt.send' && entry.code === 'error.agent_blocked'))
    assert.ok(report.entries.some(entry => entry.operation === 'models.test' && entry.outcome === 'failed' && entry.code === 'error.copilot_account'))
    assert.ok(report.entries.some(entry => entry.operation === 'models.catalog' && entry.outcome === 'failed'))
    assert.ok(report.entries.some(entry => entry.operation === 'prompt.copy' && entry.outcome === 'ok' && typeof entry.ms === 'number'))
    assert.ok(report.entries.some(entry => entry.operation === 'history.restore' && entry.outcome === 'failed'))
    assert.ok(!report.entries.some(entry => entry.operation === 'targets.list'))
    assert.equal((await worker.request('logs.get')).entries.length, report.entries.length, 'reading logs does not fill the buffer')
    assert.doesNotMatch(JSON.stringify(report), /SECRET_KEY|private|terminalId|apiKey/)
    assert.deepEqual(await host.storage.keys(), [], 'no diagnostic persistence')
  } finally { await worker.deactivate() }
})

test('Show Logs still produces a copyable panel report when the worker is unavailable', async () => {
  const panel = await mount({ setup() {} }, { host: mockHost() })
  try {
    const report = await collectDiagnostics()
    assert.equal(report.connected, false)
    const parsed = JSON.parse(report.text)
    assert.equal(parsed.worker, null)
    assert.equal(parsed.plugin, 'Enhance Prompt')
    assert.ok(parsed.entries.some((entry: any) => entry.operation === 'canvas.request' && entry.outcome === 'failed'))
  } finally { await panel.unmount() }
})
