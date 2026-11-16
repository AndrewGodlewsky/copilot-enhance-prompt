// Disposable installation only. No desktop UI, real account, inference, or owner plugin mutation.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { join, dirname, resolve, sep, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const sdk = process.env.COPILOT_SDK_DIR, runtime = process.env.COPILOT_CLI_PATH
assert.ok(sdk && runtime, 'Set COPILOT_SDK_DIR and COPILOT_CLI_PATH to the installed desktop SDK/runtime.')
const { CopilotClient, RuntimeConnection } = await import(pathToFileURL(join(sdk, 'index.js')).href)
const dir = await mkdtemp(join(tmpdir(), 'enhance-update-e2e-'))
const home = join(dir, 'copilot'), project = join(dir, 'project'), source = join(dir, 'source')
const extension = join(source, 'com.github.copilot/extensions/probe')
await mkdir(extension, { recursive: true }); await mkdir(project)
let bootstrap
for (const candidate of [join(dirname(sdk), 'copilot-extension-host/preloads/extension_bootstrap.mjs'), join(sdk, 'preloads/extension_bootstrap.mjs')]) {
  try { await access(candidate); bootstrap = candidate; break } catch {}
}
assert.ok(bootstrap, 'The desktop extension bootstrap could not be resolved.')
const executable = basename(runtime) === 'copilot-runtime.exe' ? join(dirname(runtime), 'copilot.exe') : runtime
await access(executable)
const clients = []
function makeClient() {
  const client = new CopilotClient({ mode: 'empty', baseDirectory: home, workingDirectory: project, useLoggedInUser: false,
    connection: RuntimeConnection.forStdio({ path: runtime }),
    extensionLaunchProvider: { async resolve({ modulePath }) {
      assert.ok(resolve(modulePath).startsWith(resolve(dir) + sep), 'Only fixture extensions may launch')
      return { launch: { executable, args: [bootstrap], env: { EXTENSION_PATH: modulePath } } }
    } }
  })
  clients.push(client); return client
}
async function publish(version) {
  await writeFile(join(source, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'enhance-update-fixture', version, extensions: { 'com.github.copilot': {} } }))
  await writeFile(join(extension, 'extension.mjs'), `
    import {joinSession,createCanvas} from '@github/copilot-sdk/extension';
    import {createServer} from 'node:http'; import {randomBytes} from 'node:crypto';
    const token=randomBytes(32).toString('hex'); let session;
    const server=createServer(async(req,res)=>{try{
      if(req.headers.authorization!=='Bearer '+token){res.writeHead(403);res.end();return}
      let result;
      if(req.method==='POST'&&req.url==='/update') result=await session.rpc.plugins.update({name:'enhance-update-fixture'});
      else if(req.method!=='GET'||req.url!=='/status'){res.writeHead(400);res.end();return}
      res.setHeader('content-type','application/json');res.end(JSON.stringify({running:${JSON.stringify(version)},pid:process.pid,result,inventory:await session.rpc.plugins.list()}));
    }catch(e){res.writeHead(500);res.end(String(e))}});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    session=await joinSession({canvases:[createCanvas({id:'update-fixture',displayName:'Update fixture',description:'Disposable update fixture',inputSchema:{type:'object',properties:{},additionalProperties:false},async open(){return {url:'http://127.0.0.1:'+server.address().port+'/#'+token}}})]});
  `)
}
async function open(session, instanceId) {
  for (let i = 0; i < 80; i++) {
    if ((await session.rpc.canvas.list()).canvases.some(c => c.canvasId === 'update-fixture')) return session.rpc.canvas.open({ canvasId: 'update-fixture', instanceId })
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('Fixture canvas did not load')
}
async function request(opened, update = false) {
  const url = new URL(opened.url), token = url.hash.slice(1)
  const response = await fetch(url.origin + (update ? '/update' : '/status'), { method: update ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}` } })
  assert.equal(response.status, 200, await response.clone().text())
  return response.json()
}
const timer = setTimeout(() => { for (const client of clients) void client.forceStop() }, 60_000)
try {
  await publish('1.0.0')
  const client = makeClient(); await client.start()
  console.log('Runtime:', JSON.stringify(await client.getStatus()))
  const config = { workingDirectory: project, availableTools: [], model: 'fixture', provider: { type: 'openai', baseUrl: 'http://127.0.0.1:1', apiKey: 'fixture' } }
  const installer = await client.createSession(config)
  await installer.rpc.plugins.install({ source })
  const installed = JSON.parse((await readFile(join(home, 'config.json'), 'utf8')).replace(/^\/\/.*$/gm, '')).installedPlugins[0]
  assert.ok(resolve(installed.cache_path).startsWith(resolve(home) + sep))
  const panelConfig = { ...config, requestExtensions: true, requestCanvasRenderer: true, extensionSdkPath: sdk, pluginDirectories: [installed.cache_path] }
  const session = await client.createSession(panelConfig), sessionId = session.sessionId
  const opened = await open(session, 'before-update')
  const before = await request(opened); assert.equal(before.running, '1.0.0')
  await publish('1.1.0')
  const changed = await request(opened, true)
  assert.equal(changed.result.newVersion, '1.1.0'); assert.equal(changed.inventory.plugins[0].version, '1.1.0')
  assert.equal(JSON.parse(await readFile(join(installed.cache_path, 'plugin.json'), 'utf8')).version, '1.1.0')
  assert.equal(changed.running, '1.0.0'); assert.equal(changed.pid, before.pid)
  await session.rpc.canvas.close({ instanceId: 'before-update' })
  assert.equal((await request(await open(session, 'reopened'))).running, '1.0.0')
  const fresh = await client.createSession(panelConfig)
  assert.equal((await request(await open(fresh, 'new-session'))).running, '1.1.0')
  await fresh.disconnect(); await session.disconnect(); await installer.disconnect(); await client.forceStop()
  const resumedClient = makeClient(); await resumedClient.start()
  const resumed = await resumedClient.resumeSession(sessionId, panelConfig)
  assert.equal((await request(await open(resumed, 'cold-resume'))).running, '1.1.0')
  await resumed.disconnect()
  console.log('PASS: attached extension updates its own cached package; inventory and disk verified; existing process and reopened canvas stay old; new session and cold resume load the new code. No model calls.')
  if (process.argv.includes('--github-source')) {
    // Explicit opt-in: download this public package into the disposable home, without loading its extension.
    const { installationReader } = await import('../src/copilot/update-installation.ts')
    const { remoteMetadata } = await import('../src/updates/metadata.ts')
    const catalogSession = await resumedClient.createSession(config)
    await catalogSession.rpc.plugins.marketplaces.add({ source: 'AndrewGodlewsky/copilot-enhance-prompt#main' })
    await catalogSession.rpc.plugins.install({ source: 'enhance-prompt@copilot-enhance-prompt' })
    const records = JSON.parse((await readFile(join(home, 'config.json'), 'utf8')).replace(/^\/\/.*$/gm, '')).installedPlugins
    const own = records.find(record => record.name === 'enhance-prompt')
    assert.ok(resolve(own.cache_path).startsWith(resolve(home) + sep))
    const installation = await installationReader(catalogSession, own.cache_path)()
    assert.equal(installation.canUpdate, true); assert.equal(installation.source.ref, 'main')
    assert.equal(installation.target, 'enhance-prompt@copilot-enhance-prompt')
    const available = await remoteMetadata()(installation)
    assert.ok(available.version); assert.ok(available.changes?.startsWith('https://github.com/andrewgodlewsky/copilot-enhance-prompt/blob/'))
    await catalogSession.disconnect()
    console.log('PASS: real public GitHub marketplace provenance and selected-branch metadata resolve in the disposable profile; its extension was not loaded.')
  }
} finally {
  clearTimeout(timer)
  for (const client of clients) await client.forceStop().catch(() => {})
  assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep) && basename(dir).startsWith('enhance-update-e2e-'))
  await rm(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 })
}
