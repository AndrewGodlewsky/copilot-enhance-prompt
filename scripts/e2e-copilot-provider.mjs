// Exercise the production helper with the installed desktop SDK and a loopback model fixture.
// The dependency seam supplies synthetic account/catalog data; it never uses paid inference.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { access, writeFile, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { createCopilotModels } from '../src/copilot/models.ts'
import { createUsageRecorder } from '../src/copilot/usage.ts'
import { resolveEffort } from '../src/effort.ts'

assert.ok(process.env.COPILOT_SDK_DIR && process.env.COPILOT_CLI_PATH, 'Set installed desktop SDK/runtime paths.')
const sdk = await import(pathToFileURL(join(process.env.COPILOT_SDK_DIR, 'index.js')).href)
const requests = []
let heldClosed = false
const fixture = createServer(async (request, response) => {
  let text = ''
  for await (const chunk of request) text += chunk
  requests.push(JSON.parse(text))
  if (text.includes('CANCEL_SENTINEL')) { response.once('close', () => { heldClosed = true }); return }
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: 'Fixture rewritten request' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }))
})
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve))
const auth = { isAuthenticated: true, login: 'fixture', host: 'https://github.com' }
const catalog = { list: [{ id: 'gpt-4.1', name: 'Fixture model', provider: { kind: 'copilot' }, policy: { state: 'enabled' }, capabilities: { supports: { vision: true } } }] }
catalog.list.push({ id: 'gpt-5', name: 'Reasoning fixture', provider: { kind: 'copilot' }, policy: { state: 'enabled' }, capabilities: { supports: { vision: true, reasoningEffort: true } }, supportedReasoningEfforts: ['low', 'medium', 'high'] })
// Synthetic entitlement and capabilities; these calls stay on the loopback fixture.
for (const [id, name, reasoning] of [['gpt-6.1-sol', 'GPT-6.1 Sol', 'high'], ['claude-opus-5.5', 'Claude Opus 5.5', 'medium']]) {
  catalog.list.push({ id, name, provider: { kind: 'copilot' }, policy: { state: 'enabled' }, capabilities: { supports: { reasoning_effort: [reasoning] } } })
}
const parent = { rpc: { model: { list: async () => catalog }, gitHubAuth: { getStatus: async () => auth } } }
const homes = []
const clients = []
let suppressedUsage = 0
const bridge = {
  RuntimeConnection: sdk.RuntimeConnection,
  CopilotClient: class {
    constructor(options) {
      homes.push(options.baseDirectory)
      this.client = new sdk.CopilotClient({ ...options, env: { ...options.env, GH_TOKEN: undefined, GITHUB_TOKEN: undefined }, useLoggedInUser: false })
      clients.push(this.client)
    }
    start() { return this.client.start() }
    forceStop() { return this.client.forceStop() }
    async createSession(config) {
      // Deliberately plant unselected files in the empty helper workspace before session creation.
      await writeFile(join(config.workingDirectory, 'AGENTS.md'), 'PRIVATE_INSTRUCTIONS_SENTINEL')
      await writeFile(join(config.workingDirectory, 'PRIVATE_FILENAME_SENTINEL.txt'), 'PRIVATE_CONTENT_SENTINEL')
      const dropLiveUsage = homes.length === 1
      const session = await this.client.createSession({ ...config,
        onEvent(event) {
          if (dropLiveUsage && event.type === 'assistant.usage') suppressedUsage++
          else config.onEvent(event)
        },
        provider: { type: 'openai', baseUrl: `http://127.0.0.1:${fixture.address().port}/v1`, apiKey: 'fixture', wireApi: 'completions' } })
      session.rpc.model.list = async () => catalog
      session.rpc.gitHubAuth.getStatus = async () => auth
      return session
    }
  }
}
const retained = await mkdtemp(join(tmpdir(), 'enhance-usage-fixture-'))
const service = createCopilotModels(parent, async () => ({ sdk: bridge, path: process.env.COPILOT_CLI_PATH }), undefined, (id, _root, options) => createUsageRecorder(id, retained, options))
const watchdog = setTimeout(() => { service.close(); for (const client of clients) void client.forceStop(); process.exitCode = 1 }, 55_000)
try {
  const result = await service.rewrite({ model: 'gpt-4.1', system: 'Rewrite only the supplied request.', user: 'Add a dark mode setting.' })
  assert.equal(result, 'Fixture rewritten request')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].model, 'gpt-4.1')
  assert.equal(requests[0].tools?.length ?? 0, 0)
  assert.ok(!JSON.stringify(requests[0]).includes('PRIVATE_'))
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  await service.rewrite({ model: 'gpt-4.1', system: 'Rewrite only.', user: 'Use the attached picture.', images: [{ type: 'image/png', base64: png }] })
  assert.equal(requests.length, 2)
  assert.ok(JSON.stringify(requests[1]).includes(`data:image/png;base64,${png}`), 'explicit image bytes reach the model')
  assert.ok(!JSON.stringify(requests[1]).includes('PRIVATE_'))
  const controller = new AbortController()
  const pending = service.rewrite({ model: 'gpt-4.1', system: 'Rewrite only.', user: 'CANCEL_SENTINEL' }, controller.signal)
  const rejection = assert.rejects(pending)
  for (let i = 0; i < 150 && requests.length < 3; i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(requests.length, 3)
  controller.abort()
  await rejection
  for (let i = 0; i < 30 && !heldClosed; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.ok(heldClosed, 'cancel closes the fixture request')
  await service.rewrite({ model: 'gpt-5', reasoningEffort: 'high', system: 'Rewrite only.', user: 'Check the reasoning setting.' })
  assert.equal(requests.length, 4)
  assert.equal(requests[3].model, 'gpt-5')
  assert.equal(requests[3].reasoning_effort, 'high', 'the real runtime sends the requested reasoning level')
  const available = await service.catalog()
  for (const [effort, model, reasoning] of [['medium', 'gpt-6.1-sol', 'high'], ['high', 'claude-opus-5.5', 'medium']]) {
    const selected = resolveEffort(effort, 'recommended', 'default', [], available)
    assert.equal(selected.profile.model, model)
    assert.equal(selected.reasoningEffort, reasoning)
    await service.rewrite({ model: selected.profile.model, reasoningEffort: selected.reasoningEffort, system: 'Rewrite only.', user: 'Check the recommended preset.' })
    assert.equal(requests.at(-1).model, model)
    assert.equal(requests.at(-1).reasoning_effort, reasoning, 'recommended reasoning reaches the local fixture through the installed runtime')
  }
  assert.equal(requests.length, 6)
  for (const directory of homes) await assert.rejects(access(directory))
  assert.deepEqual(await readdir(join(retained, 'recovery')), [], 'successful cleanup removes every owned recovery registration')
  const sessions = await readdir(join(retained, 'session-state'))
  assert.equal(sessions.length, 6)
  const journals = await Promise.all(sessions.map(id => readFile(join(retained, 'session-state', id, 'events.jsonl'), 'utf8')))
  const events = journals.flatMap(text => text.trim().split('\n').map(line => JSON.parse(line)))
  const receipts = events.filter(event => event.type === 'session.usage_record')
  assert.equal(receipts.length, 5, 'real runtime accounting survives helper cleanup')
  assert.ok(suppressedUsage > 0, 'a missing live event is recovered from the real runtime journal')
  assert.ok(receipts.every(event => event.data.usage.inputTokens === 1 && event.data.usage.outputTokens === 1))
  assert.ok(receipts.every(event => event.data.usage.isByok === true), 'local fixture is never relabeled as Copilot usage')
  assert.ok(receipts.every(event => sessions.includes(event.data.usage.accounting.sourceSessionId)))
  assert.doesNotMatch(journals.join('\n'), /PRIVATE_|Add a dark mode|Rewrite only|Fixture rewritten|CANCEL_SENTINEL|127\.0\.0\.1|apiKey|data:image/)
  console.log('Production Copilot helper: output, model selection, applied reasoning, images, isolation, cancellation, retained usage and cleanup passed. No paid inference.')
} finally {
  clearTimeout(watchdog)
  service.close()
  for (const client of clients) await client.forceStop()
  fixture.closeAllConnections()
  await new Promise(resolve => fixture.close(resolve))
  assert.equal(dirname(resolve(retained)), resolve(tmpdir()))
  await rm(retained, { recursive: true, force: true })
}
