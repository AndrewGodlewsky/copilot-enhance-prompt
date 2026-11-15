// Exercise the production helper with the installed desktop SDK and a loopback model fixture.
// The dependency seam supplies synthetic account/catalog data; it never uses paid inference.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { access, writeFile } from 'node:fs/promises'
import { createCopilotModels } from '../src/copilot/models.ts'

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
const parent = { rpc: { model: { list: async () => catalog }, gitHubAuth: { getStatus: async () => auth } } }
const homes = []
const clients = []
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
      const session = await this.client.createSession({ ...config, provider: { type: 'openai', baseUrl: `http://127.0.0.1:${fixture.address().port}/v1`, apiKey: 'fixture', wireApi: 'completions' } })
      session.rpc.model.list = async () => catalog
      session.rpc.gitHubAuth.getStatus = async () => auth
      return session
    }
  }
}
const service = createCopilotModels(parent, async () => ({ sdk: bridge, path: process.env.COPILOT_CLI_PATH }))
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
  for (const directory of homes) await assert.rejects(access(directory))
  console.log('Production Copilot helper: output, model selection, images, no tools/unselected context, cancellation and cleanup passed. No paid inference.')
} finally {
  clearTimeout(watchdog)
  service.close()
  for (const client of clients) await client.forceStop()
  fixture.closeAllConnections()
  await new Promise(resolve => fixture.close(resolve))
}
