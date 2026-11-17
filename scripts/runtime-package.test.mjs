import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRuntimePackage } from './runtime-package.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
test('runtime archives are deterministic, allowlisted, exact-byte verified and refuse missing or stale release inputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-package-test-'))
  const repo = join(root, 'repo')
  await mkdir(repo)
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim()
  const put = async (path, text) => { await mkdir(dirname(join(repo, path)), { recursive: true }); await writeFile(join(repo, path), text) }
  try {
    git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'core.autocrlf', 'false')
    const files = {
      'plugin.json': JSON.stringify({ name: 'enhance-prompt', version: '1.2.3', extensions: { 'com.github.copilot': { logo: 'assets/icon.svg' } } }),
      'assets/icon.svg': '<svg>fixture</svg>', LICENSE: 'original copyright fixture',
      'com.github.copilot/extensions/enhance-prompt/extension.mjs': 'export const fixture = true\n',
      'com.github.copilot/extensions/enhance-prompt/web/index.html': '<html>fixture</html>',
      'com.github.copilot/extensions/enhance-prompt/web/assets/app.js': 'fixture\n'
    }
    for (const [path, text] of Object.entries(files)) await put(path, text)
    for (const path of ['INSTALL.md', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md']) await put(path, 'Fixture documentation\n')
    await put('src/unused.ts', 'PRIVATE developer fixture')
    await put('runtime-inventory.json', JSON.stringify({ plugin: 'enhance-prompt', version: '1.2.3', artifacts: Object.entries(files).map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: hash(text), normalization: 'lf' })) }))
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture')
    const sha = git('rev-parse', 'HEAD')
    const a = await createRuntimePackage({ repo, output: join(root, 'one'), commit: sha })
    const b = await createRuntimePackage({ repo, output: join(root, 'two'), commit: sha })
    assert.deepEqual(await readFile(a.archive), await readFile(b.archive))
    assert.equal(a.report.commit, sha)
    assert.equal(hash(await readFile(a.archive)), a.report.sha256)
    assert.equal(a.report.files.length, Object.keys(files).length + 4)
    assert.ok(a.report.omittedFiles > 0)
    assert.ok(a.report.files.every(file => !file.path.startsWith('src/')))
    const extracted = join(root, 'extracted'); await mkdir(extracted)
    execFileSync('tar', ['-xf', a.archive, '-C', extracted], { windowsHide: true })
    for (const file of a.report.files) assert.equal(hash(await readFile(join(extracted, file.path))), file.sha256)
    await assert.rejects(createRuntimePackage({ repo, output: join(root, 'one'), commit: sha }), /exist/i)
    await put('plugin.json', '{"uncommitted":"PRIVATE"}')
    const cleanSource = await createRuntimePackage({ repo, output: join(root, 'three'), commit: sha })
    assert.equal(cleanSource.report.sha256, a.report.sha256, 'working tree changes cannot enter a committed release')
    await put('plugin.json', files['plugin.json'])
    await put('com.github.copilot/extensions/enhance-prompt/extension.mjs', 'unbuilt change')
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'stale inventory')
    await assert.rejects(createRuntimePackage({ repo, output: join(root, 'bad') }), /inventory/i)
    git('reset', '--hard', sha)
    git('rm', 'THIRD_PARTY_NOTICES.md'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'missing notice')
    await assert.rejects(createRuntimePackage({ repo, output: join(root, 'missing') }), /Missing.*THIRD_PARTY_NOTICES/)
    git('reset', '--hard', sha)
    await put('.gitattributes', 'LICENSE export-ignore\n')
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'export omission')
    await assert.rejects(createRuntimePackage({ repo, output: join(root, 'excluded') }), /Archive member list/)
    git('reset', '--hard', sha)
    const iconBlob = git('rev-parse', 'HEAD:assets/icon.svg')
    git('update-index', '--cacheinfo', `120000,${iconBlob},assets/icon.svg`)
    git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'linked icon')
    await assert.rejects(createRuntimePackage({ repo, output: join(root, 'linked') }), /Links are not package files/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
