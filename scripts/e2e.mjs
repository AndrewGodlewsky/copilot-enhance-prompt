// Loads the package in an isolated Copilot runtime. All model traffic goes to a local fixture.
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, cp } from 'node:fs/promises'
import { join, resolve } from 'node:path'
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
  captured.push(JSON.parse(data))
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: 'Fixture enhanced prompt' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }))
})
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve))
const baseUrl = `http://127.0.0.1:${fixture.address().port}/v1`
await mkdir(project)
await writeFile(join(project, 'README.md'), '# Disposable canvas test project\n')
const client = new CopilotClient({
  mode: 'empty', baseDirectory: join(temporary, 'copilot'), workingDirectory: project,
  builtinPluginDirectories: [resolve('.')],
  connection: RuntimeConnection.forStdio({ path: cli, args: ['--no-auto-update'], env: { ...process.env, ENHANCE_PROMPT_DATA_DIR: join(temporary, 'plugin-data') } })
})
let session
const deadline = setTimeout(() => { console.error('Runtime smoke test timed out.'); void client.forceStop() }, 45_000)
try {
  await client.start()
  console.log('Runtime started.')
  session = await client.createSession({ workingDirectory: project, availableTools: [], requestExtensions: true, requestCanvasRenderer: true, extensionSdkPath: sdkDirectory, pluginDirectories: [resolve('.')], model: 'gpt-4o', provider: { type: 'openai', baseUrl, apiKey: 'fixture', wireApi: 'completions' } })
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
  const request = async (name, input = {}) => {
    const response = await fetch(opened.url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'request', name, input }) })
    assert.equal(response.status, 200, await response.clone().text())
    return (await response.json()).result
  }
  const targets = await request('targets.list')
  assert.equal(targets.targets[0].terminalId, session.sessionId)
  assert.equal(targets.workspacePath.toLowerCase(), project.toLowerCase())
  assert.equal((await request('models.get')).profiles.length, 0)
  const preview = await request('context.preview', { prompt: 'Read the project README', level: 'standard' })
  assert.ok(Array.isArray(preview.context))
  const setting = async (key, value) => {
    const response = await fetch(opened.url + 'api', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'settings.set', input: { key, value } }) })
    assert.equal(response.status, 200)
  }
  await setting('autoEnhanceMode', 'rules')
  await setting('autoEnhanceAppend', 'HOOK FIXTURE: verify the result.')
  await session.sendAndWait({ prompt: 'Inspect the disposable project README' }, 15_000)
  assert.ok(JSON.stringify(captured.at(-1)).includes('HOOK FIXTURE: verify the result.'), 'packaged transformed hook reaches the model')
  console.log('Packaged prompt hook verified against local model fixture.')
  await request('models.save', { name: 'Local fixture', preset: 'ollama', provider: 'openai', baseUrl, model: 'fixture', maxTokens: 2000, enabled: true })
  const enhanced = await request('prompt.enhance', { prompt: 'Improve this test request', level: 'standard' })
  assert.equal(enhanced.enhanced, 'Fixture enhanced prompt')
  const beforeSend = captured.length
  const sent = await request('prompt.send', { terminalId: session.sessionId, text: enhanced.enhanced })
  assert.equal(sent.accepted, true)
  for (let i = 0; i < 40 && captured.length === beforeSend; i++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(captured.length > beforeSend, 'panel Send reached the attached session')
  const latestUser = captured.at(-1).messages.filter(message => message.role === 'user').at(-1)
  assert.ok(JSON.stringify(latestUser).includes(enhanced.enhanced))
  assert.ok(!JSON.stringify(latestUser).includes('HOOK FIXTURE:'), 'panel send bypasses automatic enhancement')
  console.log('Manual enhancement, session submission and hook bypass verified.')
  await session.rpc.canvas.close({ instanceId: 'enhance-smoke' })
  console.log('PASS: installed runtime discovered the canvas, read session metadata and context, and applied its packaged hook. No external model called.')
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
  await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}
