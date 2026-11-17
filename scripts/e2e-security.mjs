import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve, isAbsolute } from 'node:path'

const runtime = process.env.COPILOT_CLI_PATH
assert.ok(runtime && isAbsolute(runtime), 'Set COPILOT_CLI_PATH to an installed Copilot executable.')
const root = await mkdtemp(join(tmpdir(), 'enhance-pause-e2e-'))
const home = join(root, 'home'), source = join(root, 'fixture'), project = join(root, 'project')
const env = { ...process.env, COPILOT_HOME: home, COPILOT_AUTO_UPDATE: 'false', COPILOT_TELEMETRY_DISABLED: 'true', USE_TGREP: 'false', CI: '1' }
for (const key of Object.keys(env)) if (/TOKEN|API_KEY|OTEL|COPILOT_PROVIDER/i.test(key)) delete env[key]
env.COPILOT_OTEL_ENABLED = 'false'
const run = async (...args) => (await promisify(execFile)(runtime, args, { cwd: project, env, windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 })).stdout
try {
  await mkdir(source); await mkdir(project); await mkdir(home)
  await writeFile(join(source, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'enhance-pause-fixture', version: '1.0.0', extensions: { 'com.github.copilot': {} } }))
  const list = async () => JSON.parse(await run('plugin', 'list', '--json')).filter(row => row.source !== 'builtin')
  assert.deepEqual(await list(), [], 'Fixture home must start with no user-installed plugins')
  await run('plugin', 'install', source)
  const installed = await list()
  assert.equal(installed.length, 1)
  assert.equal(installed[0].name, 'enhance-pause-fixture')
  assert.equal(installed[0].enabled, true)
  const sentinel = join(home, 'retained-data.txt'), text = 'Draft 日本語 / usage fixture — do not delete'
  await writeFile(sentinel, text)
  await run('plugin', 'disable', 'enhance-pause-fixture')
  assert.equal((await list())[0].enabled, false)
  assert.equal(await readFile(sentinel, 'utf8'), text)
  await run('plugin', 'enable', 'enhance-pause-fixture')
  assert.equal((await list())[0].enabled, true)
  assert.equal(await readFile(sentinel, 'utf8'), text)
  console.log('PASS: disposable CLI install/disable/enable persists across processes and retains a data sentinel. No inference, desktop UI or owner profile. This does not verify desktop presentation or loaded-worker shutdown.')
} finally {
  const part = relative(resolve(tmpdir()), resolve(root))
  assert.ok(part && !part.startsWith('..') && !isAbsolute(part))
  await rm(root, { recursive: true, force: true })
}
