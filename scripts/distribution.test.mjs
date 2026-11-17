import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('the shipped distribution includes actual bundled dependencies, complete notices and asset provenance', async () => {
  const inventory = JSON.parse(await readFile('runtime-inventory.json', 'utf8'))
  const notices = await readFile('THIRD_PARTY_NOTICES.md', 'utf8')
  for (const name of ['proper-lockfile', 'graceful-fs', 'retry', 'signal-exit', 'react', 'react-dom', 'lucide-react', 'tailwindcss', 'tw-animate-css']) {
    assert.ok(inventory.packages.some(item => item.name === name), name)
    assert.ok(notices.includes(name), name)
  }
  assert.ok(!inventory.packages.some(item => item.name === 'typescript' || item.name === 'vite'))
  assert.match(notices, /Copyright \(c\) 2023 shadcn/)
  assert.match(notices, /Copyright \(c\) 2025 Keenthemes Inc/)
  assert.match(notices, /Cole Bemis/)
  assert.match(notices, /MOXY/)
  assert.match(notices, /No font files/)
  assert.ok(inventory.assets.some(item => item.path === 'assets/icon.svg'))
  assert.ok(inventory.hostProvided.includes('@github/copilot-sdk'))
  for (const file of ['web/node_modules/tailwindcss/preflight.css', 'web/node_modules/tailwindcss/theme.css', 'web/node_modules/tw-animate-css/dist/tw-animate.css']) {
    assert.ok(inventory.inputs.some(input => input.path === file), `CSS source drift is checked: ${file}`)
    assert.ok(inventory.packages.some(item => item.kind === 'css' && item.files.includes(file)))
  }
  const { checkDistribution } = await import('./distribution.mjs')
  await checkDistribution()
})

test('distribution hashing rejects changed files and missing license text', async () => {
  const { hashFiles, packageNotices } = await import('./distribution.mjs')
  const root = await mkdtemp(join(tmpdir(), 'enhance-notices-'))
  try {
    await mkdir(join(root, 'package'))
    await writeFile(join(root, 'package', 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', license: 'MIT' }))
    await assert.rejects(packageNotices(join(root, 'package')), /license/i)
    await writeFile(join(root, 'package', 'LICENSE'), 'MIT\nCopyright fixture\nPermission fixture')
    const first = await hashFiles(['package/LICENSE'], root)
    await writeFile(join(root, 'package', 'LICENSE'), 'changed')
    assert.notDeepEqual(await hashFiles(['package/LICENSE'], root), first)
    assert.equal((await packageNotices(join(root, 'package')))[0].text, 'changed')
    await writeFile(join(root, 'package', 'LICENSE'), '')
    await assert.rejects(packageNotices(join(root, 'package')), /Empty license/)
    await writeFile(join(root, 'line.txt'), 'one\r\ntwo\r\n')
    const windows = await hashFiles(['line.txt'], root)
    await writeFile(join(root, 'line.txt'), 'one\ntwo\n')
    assert.deepEqual(await hashFiles(['line.txt'], root), windows)
  } finally { await rm(root, { recursive: true, force: true }) }
})
