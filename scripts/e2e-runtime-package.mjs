// Packages the current verified build in a disposable Git repository/profile.
// No published source, owner installation, real account or desktop UI is used.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, relative, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRuntimePackage } from './runtime-package.mjs'
import { createServices } from '../src/copilot/services.ts'

const cli = process.env.COPILOT_CLI_PATH
assert.ok(cli && isAbsolute(cli) && process.env.COPILOT_SDK_DIR, 'Set installed COPILOT_CLI_PATH and COPILOT_SDK_DIR')
const sourceRoot = fileURLToPath(new URL('..', import.meta.url))
const root = await mkdtemp(join(tmpdir(), 'enhance-package-e2e-'))
const repo = join(root, 'repo'), home = join(root, 'home'), extracted = join(root, 'extracted'), project = join(root, 'project')
const env = { ...process.env, COPILOT_HOME: home, COPILOT_AUTO_UPDATE: 'false', COPILOT_TELEMETRY_DISABLED: 'true', USE_TGREP: 'false', CI: '1' }
for (const key of Object.keys(env)) if (/TOKEN|API_KEY|OTEL|COPILOT_PROVIDER/i.test(key)) delete env[key]
env.COPILOT_OTEL_ENABLED = 'false'
const run = async (exe, args, cwd = project, timeout = 30_000) => (await promisify(execFile)(exe, args, { cwd, env, timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })).stdout
const plugin = (...args) => run(cli, ['plugin', ...args])
const git = (...args) => run('git', args, repo)
const hash = value => createHash('sha256').update(value).digest('hex')
try {
  for (const dir of [repo, home, extracted, project]) await mkdir(dir)
  const inventory = JSON.parse(await readFile(join(sourceRoot, 'runtime-inventory.json'), 'utf8'))
  for (const path of [...inventory.artifacts.map(file => file.path), 'runtime-inventory.json', 'THIRD_PARTY_NOTICES.md', 'INSTALL.md', 'CHANGELOG.md']) {
    await mkdir(dirname(join(repo, path)), { recursive: true }); await cp(join(sourceRoot, path), join(repo, path))
  }
  await git('init', '-q'); await git('config', 'user.name', 'Fixture'); await git('config', 'user.email', 'fixture@example.invalid'); await git('config', 'core.autocrlf', 'false')
  await git('add', '.'); await git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'verified build fixture')
  const packed = await createRuntimePackage({ repo, output: join(root, 'packages') })
  await run('tar', ['-xf', packed.archive, '-C', extracted])
  const list = async () => JSON.parse(await plugin('list', '--json')).filter(row => row.source !== 'builtin')
  assert.deepEqual(await list(), [])
  await plugin('install', extracted)
  assert.equal((await list()).length, 1)
  assert.equal((await list())[0].name, 'enhance-prompt')
  assert.equal((await list())[0].version, inventory.version)
  const installed = JSON.parse((await readFile(join(home, 'config.json'), 'utf8')).replace(/^\/\/.*$/gm, '')).installedPlugins.find(row => row.name === 'enhance-prompt')
  const cache = resolve(installed.cache_path), part = relative(home, cache)
  assert.ok(part && !part.startsWith('..') && !isAbsolute(part), 'Only the disposable profile can be inspected')
  for (const file of packed.report.files) assert.equal(hash(await readFile(join(cache, file.path))), file.sha256)
  console.log(await run(process.execPath, [join(sourceRoot, 'scripts/e2e.mjs')], cache, 90_000))

  const unused = async () => { throw new Error('No session calls for stored-data verification') }
  const session = { sessionId: 'retained-package-fixture', send: unused, rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } } }
  const dataRoot = join(home, 'retained-plugin-data'), services = createServices(session, dataRoot)
  await services.settings.get()
  await services.storage.set('panel:draft', 'Keep 日本語 request 🧪')
  await services.storage.set('panel:result', 'Keep reviewed output')
  await services.settings.set('chatTextSize', 'large')
  // Prove the host copies newer package metadata; this synthetic bump is not
  // evidence of a new runtime version or live reload (covered by e2e-updates).
  const manifest = JSON.parse(await readFile(join(extracted, 'plugin.json'), 'utf8'))
  manifest.version = '99.0.0'
  await writeFile(join(extracted, 'plugin.json'), JSON.stringify(manifest))
  await plugin('update', 'enhance-prompt')
  assert.equal((await list())[0].version, '99.0.0')
  assert.equal(JSON.parse(await readFile(join(cache, 'plugin.json'), 'utf8')).version, '99.0.0')
  for (const file of packed.report.files.filter(file => file.path !== 'plugin.json')) assert.equal(hash(await readFile(join(cache, file.path))), file.sha256)
  const reopened = createServices(session, dataRoot)
  assert.equal(await reopened.storage.get('panel:draft'), 'Keep 日本語 request 🧪')
  assert.equal(await reopened.storage.get('panel:result'), 'Keep reviewed output')
  assert.equal(await reopened.settings.get('chatTextSize'), 'large')
  console.log('PASS: all expected runtime-only package files match exact hashes; it registers/serves the canvas and owns its icon identity. Local managed metadata update preserves all other expected package bytes and synthetic stored data. Extra host cache files, desktop rendering and live reload are not verified.')
} finally {
  const part = relative(resolve(tmpdir()), resolve(root))
  assert.ok(part && !part.startsWith('..') && !isAbsolute(part))
  await rm(root, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 })
}
