import test from 'node:test'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { createCopilotModels, hostRuntime, runtimeEnvironment, type DesktopSdk, type ModelSession } from './models.ts'

function fixture() {
  const state = { helperLogin: 'person', parentLogin: 'person', host: 'https://github.com', tools: [] as unknown[], selected: 'model-a', provider: 'copilot', policy: 'enabled', currentDirectory: '', sent: [] as unknown[], stopped: 0, config: {} as Record<string, unknown>, options: {} as Record<string, unknown>, hold: false }
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
      async forceStop() { state.stopped++; release?.() }
      async createSession(config: Record<string, unknown>) {
        state.config = config
        state.currentDirectory = config.workingDirectory as string
        return { sessionId: 'owned', rpc: {
          ...parent.rpc,
          model: { list: async () => ({ list: [model()] }), getCurrent: async () => ({ modelId: state.selected }) },
          gitHubAuth: { getStatus: async () => ({ isAuthenticated: true, login: state.helperLogin, host: state.host }) },
          metadata: { snapshot: async () => ({ workingDirectory: state.currentDirectory, isRemote: false }) },
          tools: { initializeAndValidate: async () => ({}), getCurrentMetadata: async () => ({ tools: state.tools }) }
        },
        sendAndWait: async (input: unknown) => { state.sent.push(input); if (state.hold) await new Promise<void>(resolve => { release = resolve }); return { data: { content: 'Rewritten request' } } }
      }
      }
    }
  }
  return { state, provider: createCopilotModels(parent, async () => ({ sdk, path: process.execPath })) }
}

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
  await assert.rejects(access(state.options.baseDirectory as string))
})
