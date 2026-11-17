import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('generated drift check rejects modified, removed and new output, including staged changes', async () => {
  const { changedGenerated } = await import('./check-generated.mjs')
  const directory = await mkdtemp(join(tmpdir(), 'enhance-generated-'))
  const git = (...args) => execFileSync('git', args, { cwd: directory, windowsHide: true, stdio: 'pipe' })
  try {
    git('init'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture')
    await mkdir(join(directory, 'src/web-dist'), { recursive: true })
    await writeFile(join(directory, 'src/web-dist/app.js'), 'current')
    await writeFile(join(directory, 'runtime-inventory.json'), '{}')
    git('add', '.'); git('-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture')
    assert.equal(changedGenerated(directory), '')
    await writeFile(join(directory, 'unrelated.txt'), 'outside generated scope')
    assert.equal(changedGenerated(directory), '')
    await writeFile(join(directory, 'src/web-dist/app.js'), 'stale')
    assert.match(changedGenerated(directory), /app.js/)
    git('add', '.'); assert.match(changedGenerated(directory), /app.js/)
    git('-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture changes')
    await rm(join(directory, 'runtime-inventory.json'))
    assert.match(changedGenerated(directory), /runtime-inventory/)
    await writeFile(join(directory, 'src/web-dist/retired.js'), 'unexpected chunk')
    assert.match(changedGenerated(directory), /retired.js/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
