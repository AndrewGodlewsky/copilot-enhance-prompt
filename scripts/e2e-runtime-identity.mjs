// Verify both desktop launch forms with the installed runtime and a synthetic catalog.
// No desktop session, account lookup, or model inference is used.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { build } from 'esbuild'

const sdkDirectory = process.env.COPILOT_SDK_DIR
const runtime = process.env.COPILOT_CLI_PATH
assert.ok(sdkDirectory && runtime, 'Set installed desktop SDK/runtime paths.')
assert.ok(isAbsolute(runtime) && /^(copilot|copilot-runtime)(\.exe)?$/i.test(basename(runtime)),
  'COPILOT_CLI_PATH must point to the installed Copilot SDK CLI executable, not the desktop launcher.')
const temporary = await mkdtemp(join(tmpdir(), 'enhance-runtime-identity-'))
const entry = join(temporary, 'probe.mjs')
try {
  // The bare entry must use the runtime's bundled bootstrap, never a same-named project file.
  await writeFile(join(temporary, 'extension_bootstrap.mjs'), 'process.exit(42)\n')
  await build({
    stdin: { contents: `
      import { createCopilotModels } from './src/copilot/models.ts'
      import { createDiagnostics } from './src/diagnostics.ts'
      const diagnostics = createDiagnostics()
      let requests = 0
      const parent = { rpc: {
        gitHubAuth: { getStatus: async () => ({ isAuthenticated: true, login: 'fixture', host: 'https://github.com' }) },
        model: { list: async input => {
        if (input.refresh !== true) throw new Error('Refresh required')
        requests++
        return { list: [{ id: 'fixture', provider: { kind: 'copilot' } }] }
      } } } }
      const provider = createCopilotModels(parent, undefined, diagnostics)
      let ok = false
      try {
        const first = await provider.catalog()
        const second = await provider.catalog()
        ok = first.models[0]?.id === 'fixture' && second.models[0]?.id === 'fixture'
      } catch {}
      const missingDiagnostics = createDiagnostics()
      let missingAuthRejected = false
      try { await createCopilotModels({ rpc: { model: parent.rpc.model } }, undefined, missingDiagnostics).catalog() }
      catch { missingAuthRejected = true }
      console.log('IDENTITY_RESULT:' + JSON.stringify({ ok, requests, missingAuthRejected,
        missingAuth: missingDiagnostics.snapshot().copilotModelDiscovery,
        bareArgument: process.argv.includes('extension_bootstrap.mjs'),
        discovery: diagnostics.snapshot().copilotModelDiscovery }))
      process.exit(0)
    `, resolveDir: resolve('.'), sourcefile: 'runtime-identity-fixture.mjs' },
    bundle: true, platform: 'node', format: 'esm', outfile: entry,
    external: ['@github/copilot-sdk'], logLevel: 'silent'
  })
  for (const [launch, bootstrap] of [
    ['absolute', join(sdkDirectory, 'preloads', 'extension_bootstrap.mjs')],
    ['embedded', 'extension_bootstrap.mjs']
  ]) {
    const { stdout } = await promisify(execFile)(runtime, [bootstrap], {
      cwd: temporary, windowsHide: true, timeout: 15_000,
      env: { ...process.env, COPILOT_SDK_PATH: sdkDirectory,
        COPILOT_EXTENSION_PARENT_PID: String(process.pid), COPILOT_EXTENSION_SANDBOXED: '0', EXTENSION_PATH: entry }
    }).catch(() => { throw new Error(`${launch} bootstrap process failed; raw output withheld.`) })
    const line = stdout.split(/\r?\n/).find(line => line.startsWith('IDENTITY_RESULT:'))
    assert.ok(line, `${launch}: fixture did not report a result`)
    const result = JSON.parse(line.slice('IDENTITY_RESULT:'.length))
    assert.equal(result.ok, true, `${launch}: ${JSON.stringify(result)}`)
    assert.equal(result.requests, 2, `${launch}: each refresh reaches the catalog`)
    assert.equal(result.missingAuthRejected, true, `${launch}: a missing authentication contract must fail closed`)
    assert.equal(result.missingAuth.stage, 'authentication')
    assert.equal(result.missingAuth.outcome, 'failed')
    assert.equal(result.discovery.attempt, 2)
    assert.equal(result.discovery.outcome, 'ok')
    assert.equal(result.discovery.checks.sdkImported, true)
    assert.equal(result.bareArgument, launch === 'embedded')
    assert.equal(result.discovery.checks.bootstrapEmbedded, launch === 'embedded')
    assert.equal(result.discovery.counts.eligible, 1)
    console.log(`PASS: ${launch} bootstrap imports the desktop SDK and refreshes twice.`)
  }
} finally {
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
