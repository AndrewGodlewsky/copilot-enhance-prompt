// Installed-runtime contract checks. All generation goes to a loopback fixture.
// This does not install a provider or exercise a paid model or the desktop UI.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'

const sdkDirectory = process.env.COPILOT_SDK_DIR
const cli = process.env.COPILOT_CLI_PATH
if (!sdkDirectory || !cli) throw new Error('Set COPILOT_SDK_DIR and COPILOT_CLI_PATH to the installed desktop SDK and runtime.')
const { CopilotClient, RuntimeConnection } = await import(pathToFileURL(join(sdkDirectory, 'index.js')).href)
const temporary = await mkdtemp(join(tmpdir(), 'enhance-model-access-e2e-'))
const project = join(temporary, 'project')
const helperDirectory = join(temporary, 'helper-project')
const plugin = join(temporary, 'plugin')
const extension = join(plugin, 'com.github.copilot', 'extensions', 'model-probe')
const readyPath = join(temporary, 'ready.json')
const clients = []
const sessions = []
const captured = []
const modelResult = 'Fixture enhanced prompt'
const rewriteInstructions = 'Rewrite only the supplied request. Return only the rewritten prompt.'
const rewriteRequest = 'Rewrite this request: add a dark mode setting.'
const privateMarkers = ['PARENT_HISTORY_SENTINEL', 'PARENT_SYSTEM_SENTINEL', 'PROJECT_INSTRUCTIONS_SENTINEL', 'PRIVATE_FILENAME_SENTINEL', 'UNSELECTED_FILE_CONTENT_SENTINEL']
let heldResponse
let heldResponseClosed = false
const fixture = createServer(async (request, response) => {
  let data = ''
  for await (const chunk of request) data += chunk
  const body = JSON.parse(data)
  captured.push(body)
  if (data.includes('CANCEL_SENTINEL')) {
    heldResponse = response
    response.once('close', () => { heldResponseClosed = true })
    return
  }
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: modelResult }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }))
})
const until = async (read, description) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read()
    if (value) return value
    await new Promise(done => setTimeout(done, 100))
  }
  throw new Error(`Timed out: ${description}`)
}
const startClient = async (name, plugins = []) => {
  const client = new CopilotClient({
    mode: 'empty', baseDirectory: join(temporary, name), workingDirectory: project,
    builtinPluginDirectories: plugins, logLevel: 'error',
    connection: RuntimeConnection.forStdio({ path: cli, args: ['--no-auto-update'] })
  })
  clients.push(client)
  await client.start()
  return client
}
const isolatedOptions = {
  enableConfigDiscovery: false, skipCustomInstructions: true, enableSkills: false,
  enableFileHooks: false, enableOnDemandInstructionDiscovery: false, enableSessionStore: false,
  enableHostGitOperations: false, skipEmbeddingRetrieval: true, embeddingCacheStorage: 'in-memory',
  memory: { enabled: false }, mcpServers: {}, skillDirectories: [], hookDirectories: [], agentDirectories: [], instructionDirectories: [],
  availableTools: [], onPermissionRequest: () => ({ kind: 'denied-by-rules', rules: [] })
}
const deadline = setTimeout(() => {
  console.error('Model access integration check timed out.')
  process.exitCode = 1
  for (const client of clients) void client.forceStop()
}, 50_000)

try {
  await new Promise(done => fixture.listen(0, '127.0.0.1', done))
  const provider = { type: 'openai', baseUrl: `http://127.0.0.1:${fixture.address().port}/v1`, apiKey: 'fixture', wireApi: 'completions' }
  await mkdir(extension, { recursive: true })
  for (const directory of [project, helperDirectory]) {
    await mkdir(directory)
    await writeFile(join(directory, 'AGENTS.md'), 'PROJECT_INSTRUCTIONS_SENTINEL: instructions that the plugin has not selected.\n')
    await writeFile(join(directory, 'PRIVATE_FILENAME_SENTINEL.txt'), 'UNSELECTED_FILE_CONTENT_SENTINEL\n')
  }
  // The schema selects Agent Plugins discovery; omitting it uses another manifest format.
  await writeFile(join(plugin, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'model-access-fixture', version: '0.0.0', description: 'Disposable model access checks' }))
  await writeFile(join(extension, 'extension.mjs'), `
import { joinSession, defineWorkflow } from '@github/copilot-sdk/extension'
import { writeFile } from 'node:fs/promises'
const rewrite = defineWorkflow({
  meta: { name: 'fixture-rewrite', description: 'Local fixture rewrite', phases: [], limits: { maxTotalSubagents: 1, timeoutSeconds: 15 } },
  run: async ctx => ctx.agent(ctx.args.prompt, { agent: 'fixture-text-only', model: 'gpt-4.1', label: 'rewrite' })
})
const wait = defineWorkflow({
  meta: { name: 'fixture-wait', description: 'Cooperative cancellation check', phases: [], limits: { timeoutSeconds: 15 } },
  run: async ctx => new Promise((done, reject) => {
    const timer = setTimeout(() => done('late'), 12000)
    ctx.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Cancelled')) }, { once: true })
  })
})
await joinSession({ workflows: [rewrite, wait], customAgents: [{ name: 'fixture-text-only', prompt: ${JSON.stringify(rewriteInstructions)}, tools: [], infer: false, skills: [], model: 'gpt-4.1', modelPolicy: 'required' }] })
await writeFile(${JSON.stringify(readyPath)}, 'ready')
`)

  const nativeClient = await startClient('native-runtime', [plugin])
  const parent = await nativeClient.createSession({
    ...isolatedOptions, workingDirectory: project, model: 'gpt-4o', provider,
    skipCustomInstructions: false, instructionDirectories: [project],
    systemMessage: { mode: 'append', content: 'PARENT_SYSTEM_SENTINEL: unrelated instructions.' },
    availableTools: ['view', 'powershell', 'task', 'web_fetch'],
    requestExtensions: true, extensionSdkPath: sdkDirectory, pluginDirectories: [plugin]
  })
  sessions.push([nativeClient, parent])
  await until(() => readFile(readyPath, 'utf8').catch(() => null), 'extension registration')
  await parent.sendAndWait({ prompt: 'PARENT_HISTORY_SENTINEL: unrelated conversation.' }, 10_000)
  const parentRequest = captured.at(-1)
  for (const marker of privateMarkers.slice(0, 3)) assert.ok(JSON.stringify(parentRequest).includes(marker), `parent control contains ${marker}`)
  assert.ok(parentRequest.tools.some(tool => tool.function?.name === 'view'), 'parent has tools available')
  const originalModel = await parent.rpc.model.getCurrent()
  const countBeforeRewrite = captured.length
  const rewritten = await parent.workflow.run('fixture-rewrite', { args: { prompt: rewriteRequest }, notifyOnComplete: false, logPhaseNames: false })
  assert.equal(rewritten.status, 'completed')
  assert.equal(rewritten.result, modelResult)
  assert.equal(captured.length, countBeforeRewrite + 1)
  const nativeRequest = captured.at(-1)
  assert.equal(nativeRequest.model, 'gpt-4.1', 'workflow honors its selected model')
  assert.equal(nativeRequest.tools?.length ?? 0, 0, 'custom agent exposes no tools')
  for (const marker of privateMarkers.slice(0, 3)) assert.ok(!JSON.stringify(nativeRequest).includes(marker), `workflow excludes ${marker}`)
  assert.deepEqual(await parent.rpc.model.getCurrent(), originalModel, 'rewrite does not switch the parent model')
  const inheritedDirectoryListing = JSON.stringify(nativeRequest).includes('PRIVATE_FILENAME_SENTINEL')
  console.log(`Native workflow: output, model choice and tool isolation passed; unselected directory listing included: ${inheritedDirectoryListing}.`)
  if (inheritedDirectoryListing) console.log('Native workflow does not meet the plugin context-isolation requirement on this runtime.')

  const waiting = parent.workflow.run('fixture-wait', { notifyOnComplete: false, logPhaseNames: false })
  const waitingRun = await until(async () => (await parent.workflow.listRuns()).find(run => run.status === 'running'), 'running cancellation fixture')
  assert.equal((await parent.workflow.cancel(waitingRun.runId)).status, 'cancelled')
  assert.equal((await waiting).status, 'cancelled')
  console.log('Native workflow cooperative cancellation passed.')

  const helperClient = await startClient('helper-runtime')
  const helper = await helperClient.createSession({
    ...isolatedOptions, workingDirectory: helperDirectory, model: 'gpt-4.1', provider,
    systemMessage: { mode: 'replace', content: rewriteInstructions },
    requestExtensions: false, requestCanvasRenderer: false, pluginDirectories: [], infiniteSessions: { enabled: false }
  })
  sessions.push([helperClient, helper])
  const countBeforeHelper = captured.length
  const helperResult = await helper.sendAndWait({ prompt: rewriteRequest }, 10_000)
  assert.equal(helperResult?.data.content, modelResult)
  assert.equal(captured.length, countBeforeHelper + 1)
  const helperRequest = captured.at(-1)
  assert.equal(helperRequest.model, 'gpt-4.1')
  assert.equal(helperRequest.tools?.length ?? 0, 0)
  assert.equal(helperRequest.messages.length, 2)
  assert.deepEqual(helperRequest.messages[0], { role: 'system', content: rewriteInstructions })
  assert.equal(helperRequest.messages[1].role, 'user')
  // Copilot adds a timestamp even when the system message is fully replaced.
  assert.equal(helperRequest.messages[1].content.replace(/^<current_datetime>[^<]+<\/current_datetime>\s*/, ''), rewriteRequest)
  for (const marker of privateMarkers) assert.ok(!JSON.stringify(helperRequest).includes(marker), `helper excludes ${marker}`)
  assert.deepEqual(await parent.rpc.model.getCurrent(), originalModel, 'helper leaves the parent model unchanged')
  await helper.send({ prompt: 'CANCEL_SENTINEL' })
  await until(() => heldResponse, 'in-flight helper model request')
  await helper.abort()
  await until(() => heldResponseClosed, 'aborted model HTTP connection closes')
  console.log('PASS: headless rewrite, selected model, exact input isolation and in-flight cancellation. All model calls used the local fixture.')
} finally {
  clearTimeout(deadline)
  for (const [client, session] of sessions.reverse()) {
    await session.disconnect().catch(() => {})
    await client.deleteSession(session.sessionId).catch(() => {})
  }
  for (const client of clients.reverse()) await client.forceStop()
  fixture.closeAllConnections()
  fixture.close()
  const location = relative(resolve(tmpdir()), resolve(temporary))
  assert.ok(location && !location.startsWith('..') && !isAbsolute(location), 'cleanup remains under the temporary directory')
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
