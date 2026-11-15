import test from 'node:test'
import assert from 'node:assert/strict'
import { access, rm } from 'node:fs/promises'
import { createCopilotModels, hostRuntime, runtimeEnvironment, type DesktopSdk, type ModelSession } from './models.ts'
import { createDiagnostics } from '../diagnostics.ts'

function fixture() {
  const state = { helperLogin: 'person', parentLogin: 'person', host: 'https://github.com', tools: [] as unknown[], selected: 'model-a', provider: 'copilot', policy: 'enabled', currentDirectory: '', sent: [] as unknown[], stopped: 0, config: {} as Record<string, unknown>, options: {} as Record<string, unknown>, hold: false,
    prepared: '', recorded: [] as unknown[], flushed: false, prepareFails: false, flushFails: false, generateFails: false }
  const emit = (event: unknown) => (state.config.onEvent as ((event: unknown) => void) | undefined)?.(event)
  const model = () => ({ id: 'model-a', name: 'Model A', provider: { kind: state.provider }, policy: { state: state.policy }, capabilities: { supports: { vision: true } } })
  const parent: ModelSession = { rpc: {
    model: { list: async () => ({ list: [model()] }), getCurrent: async () => ({ modelId: 'model-a' }) },
    gitHubAuth: { getStatus: async () => ({ isAuthenticated: true, login: state.parentLogin, host: state.host }) },
    metadata: { snapshot: async () => ({ workingDirectory: 'parent-project', isRemote: false }) }
  } }
  let release: (() => void) | undefined
  const sdk: DesktopSdk = {
    RuntimeConnection: { forStdio: options => options },
    CopilotClient: class {
      constructor(options: Record<string, unknown>) { state.options = options }
      async start() {}
      async forceStop() { state.stopped++; emit({ type: 'assistant.usage', data: { inputTokens: 11, outputTokens: 3 } }); release?.() }
      async createSession(config: Record<string, unknown>) {
        state.config = config
        state.currentDirectory = config.workingDirectory as string
        return { sessionId: config.sessionId as string, rpc: {
          ...parent.rpc,
          model: { list: async () => ({ list: [model()] }), getCurrent: async () => ({ modelId: state.selected }) },
          gitHubAuth: { getStatus: async () => ({ isAuthenticated: true, login: state.helperLogin, host: state.host }) },
          metadata: { snapshot: async () => ({ workingDirectory: state.currentDirectory, isRemote: false }) },
          tools: { initializeAndValidate: async () => ({}), getCurrentMetadata: async () => ({ tools: state.tools }) }
        },
        sendAndWait: async (input: unknown) => { state.sent.push(input); if (state.hold) await new Promise<void>(resolve => { release = resolve }); if (state.generateFails) throw new Error('PRIVATE provider failure'); return { data: { content: 'Rewritten request' } } }
      }
      }
    }
  }
  const diagnostics = createDiagnostics()
  return { state, diagnostics, parent, provider: createCopilotModels(parent, async () => ({ sdk, path: process.execPath }), diagnostics, async sessionId => {
    if (state.prepareFails) throw new Error('PRIVATE disk failure')
    state.prepared = sessionId
    return { record(event: unknown) { state.recorded.push(event) }, async flush() {
      assert.equal(state.stopped, 1, 'flush waits for the helper to stop')
      if (state.flushFails) throw new Error('PRIVATE disk failure')
      state.flushed = true
    } }
  }) }
}

test('helper usage is prepared before inference and flushed after late shutdown receipts', async () => {
  const { provider, state } = fixture()
  await provider.rewrite({ model: 'model-a', system: 'Rewrite', user: 'Draft' })
  assert.match(state.prepared, /^[0-9a-f-]{36}$/)
  assert.equal(state.prepared, state.config.sessionId)
  assert.equal(state.flushed, true)
  assert.equal(state.recorded.length, 1)
})

test('a usage storage preparation failure prevents inference and exposes only a safe error', async () => {
  const { provider, state, diagnostics } = fixture()
  state.prepareFails = true
  await assert.rejects(provider.rewrite({ model: 'model-a', system: 'Rewrite', user: 'Draft' }), { text: { code: 'error.copilot_usage' } })
  assert.equal(state.sent.length, 0)
  assert.ok(diagnostics.snapshot().entries.some(entry => entry.operation === 'copilot.usage' && entry.code === 'error.copilot_usage'))
  assert.doesNotMatch(JSON.stringify(diagnostics.snapshot()), /PRIVATE/)
})

test('generation failure still flushes any reported usage before removing temporary files', async () => {
  const { provider, state } = fixture()
  state.generateFails = true
  await assert.rejects(provider.rewrite({ model: 'model-a', system: 'Rewrite', user: 'Draft' }))
  assert.equal(state.flushed, true)
  assert.equal(state.recorded.length, 1)
  await assert.rejects(access(state.options.baseDirectory as string))
})

test('a usage flush failure is visible and preserves the helper directory for recovery', async () => {
  const { provider, state, diagnostics } = fixture()
  state.flushFails = true
  try {
    await assert.rejects(provider.rewrite({ model: 'model-a', system: 'Rewrite', user: 'Draft' }), { text: { code: 'error.copilot_usage' } })
    await access(state.currentDirectory)
    assert.ok(diagnostics.snapshot().entries.some(entry => entry.operation === 'copilot.usage' && entry.outcome === 'failed'))
    assert.doesNotMatch(JSON.stringify(diagnostics.snapshot()), /PRIVATE/)
  } finally {
    // The fixture owns this newly created isolated workspace; never remove a caller's path.
    const { dirname, basename } = await import('node:path')
    const root = dirname(state.currentDirectory)
    assert.ok(basename(root).startsWith('enhance-copilot-'))
    await rm(root, { recursive: true, force: true })
  }
})

test('runtime discovery accepts only the running Copilot bootstrap, never PATH or an override', () => {
  const env = { COPILOT_EXTENSION_PARENT_PID: '17', COPILOT_SDK_PATH: '/app/sdk', COPILOT_CLI_PATH: '/project/malicious' }
  assert.equal(hostRuntime('/app/copilot.exe', ['/app/copilot.exe', '/app/preloads/extension_bootstrap.mjs'], 17, env), '/app/copilot.exe')
  assert.throws(() => hostRuntime('/app/node.exe', ['/app/preloads/extension_bootstrap.mjs'], 17, env))
  assert.throws(() => hostRuntime('/app/copilot.exe', ['/project/script.mjs'], 17, env))
  assert.throws(() => hostRuntime('/app/copilot.exe', ['/app/preloads/extension_bootstrap.mjs'], 18, env))
  const clean = runtimeEnvironment({ PATH: '/app/bin', NODE_OPTIONS: '--require /project/evil.js', COPILOT_CLI_PATH: '/evil', COPILOT_API_URL: 'https://evil', OTEL_EXPORTER_OTLP_ENDPOINT: 'https://evil', GH_TOKEN: 'existing-auth' })
  assert.equal(clean.NODE_OPTIONS, undefined)
  assert.equal(clean.COPILOT_API_URL, undefined)
  assert.equal(clean.OTEL_EXPORTER_OTLP_ENDPOINT, undefined)
  assert.equal(clean.GH_TOKEN, 'existing-auth')
})

test('runtime discovery recognizes the embedded bootstrap but rejects other relative scripts and unverified hosts', () => {
  const executable = '/app/copilot.exe'
  const argv = [executable, 'extension_bootstrap.mjs']
  const env = { COPILOT_EXTENSION_PARENT_PID: '17', COPILOT_SDK_PATH: '/app/sdk' }
  const diagnostics = createDiagnostics()
  assert.equal(hostRuntime(executable, argv, 17, env, diagnostics.beginModelDiscovery()), executable)
  assert.equal(diagnostics.snapshot().copilotModelDiscovery?.checks.bootstrapPresent, true)
  assert.equal(diagnostics.snapshot().copilotModelDiscovery?.checks.bootstrapEmbedded, true)
  for (const script of ['./extension_bootstrap.mjs', '../extension_bootstrap.mjs', 'project/extension_bootstrap.mjs', 'extension_bootstrap.mjs.js']) {
    assert.throws(() => hostRuntime(executable, [executable, script], 17, env))
  }
  assert.throws(() => hostRuntime('/app/node.exe', argv, 17, env))
  assert.throws(() => hostRuntime(executable, argv, 18, env))
  assert.throws(() => hostRuntime(executable, argv, 17, { ...env, COPILOT_SDK_PATH: '' }))
})

test('Copilot rewrite uses an empty helper, returns text, and removes its temporary home', async () => {
  const { provider, state } = fixture()
  assert.equal((await provider.catalog()).models[0].id, 'model-a')
  assert.equal(await provider.rewrite({ model: 'model-a', system: 'Rewrite only', user: 'Draft' }), 'Rewritten request')
  assert.deepEqual(state.sent, [{ prompt: 'Draft', attachments: [] }])
  assert.deepEqual(state.config.availableTools, [])
  assert.equal(state.config.enableConfigDiscovery, false)
  assert.equal(state.config.enableFileHooks, false)
  assert.equal(state.config.requestExtensions, false)
  assert.equal(state.config.provider, undefined)
  assert.equal(state.options.mode, 'empty')
  assert.equal(state.stopped, 1)
  await assert.rejects(access(state.options.baseDirectory as string))
})

test('missing auth, account mismatch, unattributed models, policy blocks, tools and model substitution fail before sending', async () => {
  for (const change of [
    { helperLogin: '' }, { helperLogin: 'someone-else' }, { provider: 'loki' }, { provider: '' }, { policy: 'disabled' }, { tools: [{ name: 'powershell' }] }, { selected: 'different-model' }
  ]) {
    const { provider, state } = fixture()
    Object.assign(state, change)
    await assert.rejects(provider.rewrite({ model: 'model-a', system: 'Rewrite', user: 'Private text' }))
    assert.equal(state.sent.length, 0)
  }
})

test('cancellation stops only the helper and cannot return a late result', async () => {
  const { provider, state } = fixture()
  state.hold = true
  const controller = new AbortController()
  const result = provider.rewrite({ model: 'model-a', system: 'Rewrite', user: 'Draft' }, controller.signal)
  while (!state.sent.length) await new Promise(resolve => setTimeout(resolve, 5))
  controller.abort()
  await assert.rejects(result)
  assert.ok(state.stopped >= 1)
  assert.equal(state.flushed, true)
  assert.equal(state.recorded.length, 1)
  await assert.rejects(access(state.options.baseDirectory as string))
})

test('Copilot diagnostics identify the failed check and cleanup without account names or prompts', async () => {
  const { provider, state, diagnostics } = fixture()
  state.helperLogin = 'PRIVATE-ACCOUNT'
  await assert.rejects(provider.rewrite({ model: 'model-a', system: 'PRIVATE-SYSTEM', user: 'PRIVATE-PROMPT' }))
  const report = diagnostics.snapshot()
  assert.ok(report.entries.some(entry => entry.operation === 'copilot.access' && entry.code === 'error.copilot_account' && entry.outcome === 'failed'))
  assert.ok(report.entries.some(entry => entry.operation === 'copilot.cleanup' && entry.outcome === 'ok'))
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE-|person|github.com|enhance-copilot-/)
})

test('model refresh identifies unavailable session APIs in a dedicated diagnostic section without raw errors', async () => {
  const { parent, provider, diagnostics } = fixture()
  parent.rpc.model.list = async () => { throw Object.assign(new Error('PRIVATE token and path'), { code: -32601 }) }
  await assert.rejects(provider.catalog())
  const report = diagnostics.snapshot().copilotModelDiscovery
  assert.equal(report?.stage, 'model_list')
  assert.equal(report?.outcome, 'failed')
  assert.equal(report?.failure?.rpcCode, -32601)
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE|token|path/)
})

test('model discovery distinguishes an invalid response from an empty or filtered catalog and retries live', async () => {
  const { parent, provider, diagnostics } = fixture()
  parent.rpc.model.list = async () => ({ list: null as any })
  await assert.rejects(provider.catalog())
  assert.equal(diagnostics.snapshot().copilotModelDiscovery?.checks.responseIsList, false)
  parent.rpc.model.list = async () => ({ list: [null, { id: 'private-a' }, { id: 'private-b', provider: { kind: 'external' } }, { id: 'private-c', provider: { kind: 'copilot' }, policy: { state: 'disabled' } }] })
  await assert.rejects(provider.catalog(), /No eligible Copilot models/)
  const empty = diagnostics.snapshot().copilotModelDiscovery
  assert.equal(empty?.outcome, 'empty')
  assert.deepEqual(empty?.counts, { received: 4, eligible: 0, invalid: 1, unattributed: 1, otherProvider: 1, policyBlocked: 1 })
  parent.rpc.model.list = async input => { assert.equal(input?.refresh, true); return { list: [{ id: 'available', provider: { kind: 'copilot' } }] } }
  assert.equal((await provider.catalog()).models[0].id, 'available')
  const recovered = diagnostics.snapshot().copilotModelDiscovery
  assert.equal(recovered?.attempt, 3)
  assert.equal(recovered?.outcome, 'ok')
  assert.equal(recovered?.counts.eligible, 1)
  assert.doesNotMatch(JSON.stringify(recovered), /private-|available/)
})
