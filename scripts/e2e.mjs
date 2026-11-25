// Loads the package in an isolated Copilot runtime. All model traffic goes to a local fixture.
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, cp } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'

const sdkDirectory = process.env.COPILOT_SDK_DIR
const cli = process.env.COPILOT_CLI_PATH
if (!sdkDirectory || !cli) throw new Error('Set COPILOT_SDK_DIR and COPILOT_CLI_PATH to the installed desktop SDK and runtime.')
const { CopilotClient, RuntimeConnection } = await import(pathToFileURL(join(sdkDirectory, 'index.js')).href)
const temporary = await mkdtemp(join(tmpdir(), 'enhance-copilot-e2e-'))
const project = join(temporary, 'project')
const captured = []
const fixture = createServer(async (req, res) => {
  let data = ''
  for await (const chunk of req) data += chunk
  // Current runtimes also list a named provider's models (GET /v1/models); only inference requests are captured.
  if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) { res.statusCode = 404; res.end(); return }
  captured.push(JSON.parse(data))
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: 'Fixture enhanced prompt' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }))
})
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve))
const baseUrl = `http://127.0.0.1:${fixture.address().port}/v1`
await mkdir(project)
await writeFile(join(project, 'README.md'), '# Disposable canvas test project\n')
await mkdir(join(project, 'src'))
await mkdir(join(project, '.github'))
await writeFile(join(project, '.github/copilot-instructions.md'), 'CONTEXT_RULE_FIXTURE')
await writeFile(join(project, 'src/service.ts'), `${'// header\n'.repeat(50)}export const validateSession = true`)
// By SDK 1.0.115 the stdio factory was renamed, child-process settings moved onto it and `provider` gave way to named providers.
const current = typeof RuntimeConnection.forSpawnedStdio === 'function'
const launch = { path: cli, args: ['--no-auto-update'], env: { ...process.env, ENHANCE_PROMPT_DATA_DIR: join(temporary, 'plugin-data') } }
const client = new CopilotClient(current
  ? { mode: 'empty', plugins: { builtinDirectories: [resolve('.')] },
    runtime: RuntimeConnection.forSpawnedStdio({ ...launch, workingDirectory: project, baseDirectory: join(temporary, 'copilot') }) }
  : { mode: 'empty', baseDirectory: join(temporary, 'copilot'), workingDirectory: project, builtinPluginDirectories: [resolve('.')],
    connection: RuntimeConnection.forStdio(launch) })
const provider = { type: 'openai', baseUrl, apiKey: 'fixture', wireApi: 'completions' }
// Copilot API models stay off so the unqualified session model can only reach the loopback fixture.
const fixtureModel = current
  ? { inference: { providers: [{ name: 'fixture', ...provider }], defaultProvider: 'fixture' }, github: { capi: { enabled: false } } }
  : { provider }
let session
const deadline = setTimeout(() => { console.error('Runtime smoke test timed out.'); void client.forceStop() }, 45_000)
try {
  await client.start()
  console.log('Runtime started.')
  session = await client.createSession({ workingDirectory: project, availableTools: [], requestExtensions: true, requestCanvasRenderer: true, extensionSdkPath: sdkDirectory, pluginDirectories: [resolve('.')], model: 'gpt-4o', ...fixtureModel })
  console.log('Disposable session created.')
  await new Promise(resolve => setTimeout(resolve, 2000))
  let canvases
  console.log('Waiting for canvas registration.')
  for (let attempt = 0; attempt < 40; attempt++) {
    canvases = await session.rpc.canvas.list()
    if (JSON.stringify(canvases).includes('enhance-prompt')) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  console.log('Registered canvases:', JSON.stringify(canvases))
  if (!JSON.stringify(canvases).includes('enhance-prompt')) {
    console.error(JSON.stringify(await session.rpc.extensions.list(), null, 2))
    throw new Error('The runtime did not discover Enhance Prompt.')
  }
  const discovered = canvases.canvases.find(canvas => canvas.canvasId === 'enhance-prompt')
  const manifest = JSON.parse(await readFile('plugin.json', 'utf8'))
  assert.equal(discovered?.extensionId, `plugin:${manifest.name}:enhance-prompt`, 'canvas identifies its owning plugin for desktop logo lookup')
  const openedEvent = new Promise(resolve => {
    const unsubscribe = session.on('session.canvas.opened', event => {
      if (event.data.instanceId === 'enhance-smoke') { unsubscribe(); resolve(event.data) }
    })
  })
  const opened = await session.rpc.canvas.open({ canvasId: 'enhance-prompt', instanceId: 'enhance-smoke' })
  console.log('Canvas opened.')
  assert.ok(opened.url, 'canvas returned a URL')
  const live = await session.rpc.canvas.listOpen()
  assert.equal((await openedEvent).extensionId, discovered.extensionId, 'the opening event identifies the owning plugin')
  assert.equal(live.openCanvases.find(canvas => canvas.instanceId === 'enhance-smoke')?.extensionId, discovered.extensionId, 'the open canvas retains its plugin identity')
  console.log('Canvas ownership verified. Desktop plugin inventory, logo enrichment and rendering require a manual check.')
  const page = await fetch(opened.url)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Enhance Prompt/)
  const token = new URL(opened.url).pathname.split('/')[2]
  const themeStorage = async (url, method, value) => {
    const auth = new URL(url).pathname.split('/')[2]
    const response = await fetch(url + 'api', { method: 'POST', headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' }, body: JSON.stringify({ method, input: { key: 'colorTheme', ...(value ? { value } : {}) } }) })
    assert.equal(response.status, 200)
    return (await response.json()).result
  }
  assert.equal(await themeStorage(opened.url, 'storage.get'), null)
  await themeStorage(opened.url, 'storage.set', 'light')
  const themeCanvas = await session.rpc.canvas.open({ canvasId: 'enhance-prompt', instanceId: 'theme-smoke' })
  assert.equal(await themeStorage(themeCanvas.url, 'storage.get'), 'light')
  await session.rpc.canvas.close({ instanceId: 'theme-smoke' })
  console.log('Theme preference survives a new canvas URL.')
  const request = async (name, input = {}) => {
    const response = await fetch(opened.url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'request', name, input }) })
    assert.equal(response.status, 200, await response.clone().text())
    return (await response.json()).result
  }
  const targets = await request('targets.list')
  assert.equal(targets.targets[0].terminalId, session.sessionId)
  assert.equal(targets.workspacePath.toLowerCase(), project.toLowerCase())
  assert.equal((await request('models.get')).profiles.length, 0)
  const beforeRefresh = captured.length
  const copilotList = await request('models.catalog', { preset: 'copilot', refresh: true })
  assert.equal(copilotList.errorText?.code, 'error.copilot_no_models', 'the isolated external fixture has no eligible Copilot models')
  const discovery = (await request('logs.get')).copilotModelDiscovery
  assert.equal(discovery.outcome, 'empty')
  for (const check of ['executableAllowed', 'bootstrapPresent', 'sdkPathPresent', 'parentMatches', 'runtimePathResolved', 'sdkImported', 'clientAvailable', 'stdioAvailable', 'modelListAvailable', 'responseIsList']) {
    assert.equal(discovery.checks[check], true, check)
  }
  assert.equal(discovery.counts.eligible, 0)
  await request('models.catalog', { preset: 'copilot', refresh: true })
  assert.equal((await request('logs.get')).copilotModelDiscovery.attempt, discovery.attempt + 1)
  assert.equal(captured.length, beforeRefresh, 'refresh performs no model inference')
  console.log('Copilot refresh exercises desktop runtime/SDK checks and reports the empty fixture catalog without inference.')
  const setting = async (key, value) => {
    const response = await fetch(opened.url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'settings.set', input: { key, value } }) })
    assert.equal(response.status, 200)
  }
  const beforePreviews = captured.length
  for (const level of ['off', 'basic', 'standard', 'deep', 'max', 'ai-test']) {
    const preview = await request('context.preview', { prompt: 'Fix validateSession', level })
    if (level === 'off') assert.deepEqual(preview.context, [])
    else assert.ok(preview.context.some(item => item.kind === 'workspace'), `${level} identifies the attached project`)
    assert.equal(preview.context.some(item => item.id === 'rules:.github/copilot-instructions.md'), ['standard', 'deep', 'max', 'ai-test'].includes(level))
    assert.equal(preview.context.some(item => item.id === 'file:src/service.ts'), ['deep', 'max', 'ai-test'].includes(level))
  }
  assert.equal(captured.length, beforePreviews, 'previews never call a model, including AI-assisted and AI Test')
  await setting('allowProjectFiles', false)
  const privatePreview = await request('context.preview', { prompt: 'Fix validateSession', level: 'max' })
  assert.ok(privatePreview.context.every(item => ['workspace', 'agent'].includes(item.kind)))
  await setting('allowProjectFiles', true)
  await writeFile(join(project, '.github/copilot-instructions.md'), 'UPDATED_CONTEXT_RULE_FIXTURE')
  const freshPreview = await request('context.preview', { prompt: 'Fix validateSession', level: 'deep', exclude: ['file:src/service.ts'] })
  assert.ok(freshPreview.context.some(item => item.id === 'rules:.github/copilot-instructions.md' && item.chars === 'UPDATED_CONTEXT_RULE_FIXTURE'.length))
  assert.ok(!freshPreview.context.some(item => item.id === 'file:src/service.ts'))
  console.log('All context levels, fresh file edits, file exclusions, non-Git source search and privacy verified through the packaged adapter.')
  for (const key of ['autoEnhanceMode', 'notifyWhenDone', 'allowEnvKeys']) {
    const response = await fetch(opened.url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'settings.set', input: { key, value: true } }) })
    assert.equal(response.status, 400, `${key} is retired`)
  }
  const externalSave = await fetch(opened.url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'request', name: 'models.save', input: { name: 'Retired provider', preset: 'ollama', provider: 'openai', baseUrl, model: 'fixture', enabled: true } }) })
  assert.equal(externalSave.status, 400, 'external providers are rejected by the packaged worker')
  // The runtime fixture has no Copilot catalog. Rewrite execution is covered by the
  // fake-Copilot unit tests and e2e-copilot-provider.mjs, never a paid live model here.
  const enhanced = { enhanced: 'Fixture reviewed prompt' }
  const beforeSend = captured.length
  const sent = await request('prompt.send', { terminalId: session.sessionId, text: enhanced.enhanced })
  assert.equal(sent.accepted, true)
  for (let i = 0; i < 40 && captured.length === beforeSend; i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(captured.length > beforeSend, 'panel Send reached the attached session')
  const latestUser = captured.at(-1).messages.filter(message => message.role === 'user').at(-1)
  assert.ok(JSON.stringify(latestUser).includes(enhanced.enhanced))
  console.log('Retired settings/provider rejection and guarded session submission verified.')
  const diagnostics = await request('logs.get')
  const recovered = await request('usage.recover')
  assert.deepEqual(recovered, { pending: 0, unconfirmed: 0, recovered: 0, failed: 0, deferred: 0 })
  assert.deepEqual(await request('usage.status'), recovered)
  assert.ok(diagnostics.entries.some(entry => entry.operation === 'prompt.send' && entry.outcome === 'ok'))
  for (const privateValue of [project, 'Improve this test request', 'Fixture enhanced prompt', token, session.sessionId]) {
    assert.ok(!JSON.stringify(diagnostics).includes(privateValue), 'diagnostics exclude private request and connection data')
  }
  console.log('Copyable diagnostic report verified without prompts, project paths or connection tokens.')
  await session.rpc.canvas.close({ instanceId: 'enhance-smoke' })
  console.log('PASS: installed runtime discovered the canvas, read session metadata and context, and submitted to its fixture session. No paid model called.')
} catch (error) {
  await mkdir('.artifacts', { recursive: true })
  await cp(join(temporary, 'copilot', 'logs'), '.artifacts/runtime-logs', { recursive: true }).catch(() => {})
  throw error
} finally {
  clearTimeout(deadline)
  await session?.disconnect().catch(() => {})
  await client.forceStop()
  fixture.closeAllConnections()
  fixture.close()
  assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep) && temporary.includes('enhance-copilot-e2e-'))
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
