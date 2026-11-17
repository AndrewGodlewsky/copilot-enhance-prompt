import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { versionParts } from '../src/updates/version.ts'

const runtimePrefix = 'com.github.copilot/extensions/enhance-prompt/'
const required = ['plugin.json', 'assets/icon.svg', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'runtime-inventory.json', 'INSTALL.md', 'CHANGELOG.md', `${runtimePrefix}extension.mjs`, `${runtimePrefix}web/index.html`]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

/** Reads only a committed tree; never builds, downloads or publishes. */
export async function createRuntimePackage({ repo = process.cwd(), output = join(repo, '.artifacts', 'packages'), commit = 'HEAD' } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
  const sha = git('rev-parse', '--verify', '--end-of-options', `${commit}^{commit}`).toString().trim()
  assert.match(sha, /^[a-f0-9]{40}$/)
  const tree = git('ls-tree', '-rlz', sha).toString().split('\0').filter(Boolean).map(line => {
    const match = /^(\d+) blob ([a-f0-9]+)\s+(\d+)\t(.+)$/.exec(line)
    assert.ok(match, 'Unsupported Git tree entry')
    return { mode: match[1], bytes: Number(match[3]), path: match[4] }
  })
  const selected = tree.filter(file => required.includes(file.path) || file.path.startsWith(runtimePrefix)).sort((a, b) => a.path.localeCompare(b.path, 'en'))
  for (const name of required) assert.ok(selected.some(file => file.path === name), `Missing package input: ${name}`)
  assert.ok(selected.reduce((sum, file) => sum + file.bytes, 0) <= 32 * 1024 * 1024, 'Review an unexpectedly large runtime package')
  assert.ok(!tree.some(file => file.path.startsWith('com.github.copilot/') && !file.path.startsWith(runtimePrefix)), 'Review newly registered plugin components before packaging')
  const contents = new Map(selected.map(file => {
    assert.ok(file.mode === '100644' || file.mode === '100755', `Links are not package files: ${file.path}`)
    assert.match(file.path, /^[a-zA-Z0-9_.\/-]+$/)
    assert.ok(!file.path.split('/').some(part => part === '..' || !part), 'Unsafe package path')
    return [file.path, git('show', `${sha}:${file.path}`)]
  }))
  const manifest = JSON.parse(contents.get('plugin.json')), inventory = JSON.parse(contents.get('runtime-inventory.json'))
  assert.equal(manifest.name, 'enhance-prompt')
  assert.ok(versionParts(manifest.version), 'Package version must be valid SemVer')
  assert.equal(manifest.extensions?.['com.github.copilot']?.logo, 'assets/icon.svg')
  assert.equal(inventory.plugin, manifest.name, 'Inventory identity differs')
  assert.equal(inventory.version, manifest.version, 'Inventory version differs')
  const artifacts = selected.filter(file => !['THIRD_PARTY_NOTICES.md', 'runtime-inventory.json', 'INSTALL.md', 'CHANGELOG.md'].includes(file.path))
  assert.deepEqual(inventory.artifacts.map(file => file.path).sort(), artifacts.map(file => file.path).sort(), 'Inventory package file list differs')
  for (const item of inventory.artifacts) {
    const raw = contents.get(item.path)
    assert.ok(item.normalization === 'lf' || item.normalization === 'none', 'Unknown inventory normalization')
    const bytes = item.normalization === 'lf' ? Buffer.from(raw.toString('utf8').replaceAll('\r\n', '\n')) : raw
    assert.equal(hash(bytes), item.sha256, `Stale inventory: ${item.path}`)
    assert.equal(bytes.length, item.bytes, `Stale inventory size: ${item.path}`)
  }
  for (const path of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'INSTALL.md']) assert.ok(contents.get(path).toString().trim(), `Empty ${path}`)
  const bytes = git('-c', 'core.attributesFile=', 'archive', '--format=zip', sha, '--', ...selected.map(file => file.path))
  // Check the real archive, including any Git export attributes; never assume
  // its members/bytes match the tree just because git archive succeeded.
  const temporary = await mkdtemp(join(tmpdir(), 'enhance-archive-'))
  try {
    const archive = join(temporary, 'verify.zip'), extracted = join(temporary, 'contents')
    await writeFile(archive, bytes); await mkdir(extracted)
    const names = execFileSync('tar', ['-tf', archive], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/).filter(name => name && !name.endsWith('/')).sort()
    assert.deepEqual(names, selected.map(file => file.path).sort(), 'Archive member list differs from allowlist')
    execFileSync('tar', ['-xf', archive, '-C', extracted], { windowsHide: true })
    for (const file of selected) assert.deepEqual(await readFile(join(extracted, file.path)), contents.get(file.path), `Archive bytes differ: ${file.path}`)
  } finally { await rm(temporary, { recursive: true, force: true }) }
  const name = `enhance-prompt-${manifest.version}-${sha.slice(0, 12)}.zip`
  const archive = join(resolve(output), name)
  const report = { schema: 1, plugin: manifest.name, version: manifest.version, commit: sha, archive: name, sha256: hash(bytes), archiveBytes: bytes.length,
    sourceFiles: tree.length, sourceBytes: tree.reduce((sum, file) => sum + file.bytes, 0),
    packageBytes: selected.reduce((sum, file) => sum + file.bytes, 0), omittedFiles: tree.length - selected.length,
    files: selected.map(file => ({ path: file.path, bytes: file.bytes, sha256: hash(contents.get(file.path)) })) }
  await mkdir(output, { recursive: true })
  await writeFile(archive, bytes, { flag: 'wx' })
  await writeFile(`${archive}.sha256`, `${report.sha256}  ${name}\n`, { flag: 'wx' })
  await writeFile(`${archive}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  return { archive, report }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await createRuntimePackage({ commit: process.argv[2] || 'HEAD', output: process.argv[3] || join(process.cwd(), '.artifacts', 'packages') })
  console.log(JSON.stringify(result, null, 2))
}
