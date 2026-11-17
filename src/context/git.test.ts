import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitDiff, gitStatus } from './git.ts'

test('context Git reads disable included clean/process filters without changing repository config', async () => {
  for (const kind of ['clean', 'process']) {
    const root = mkdtempSync(join(tmpdir(), 'enhance-git-filter-'))
    const run = (...args: string[]) => execFileSync('git', args, { cwd: root, windowsHide: true, stdio: 'pipe' })
    try {
      run('init', '-q')
      writeFileSync(join(root, 'code.txt'), 'before\n')
      run('add', 'code.txt')
      run('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
      writeFileSync(join(root, 'code.txt'), 'after\n')
      writeFileSync(join(root, '.gitattributes'), '*.txt filter=Test.Driver\n')
      writeFileSync(join(root, 'filter.cjs'), "require('node:fs').writeFileSync('filter-ran', 'unexpected'); process.stdout.write(require('node:fs').readFileSync(0))")
      const included = join(root, 'included.config')
      const command = `"${process.execPath.replaceAll('\\', '/')}" "${join(root, 'filter.cjs').replaceAll('\\', '/')}"`
      run('config', '--file', included, `filter.Test.Driver.${kind}`, command)
      run('config', '--file', included, 'filter.Test.Driver.required', 'true')
      run('config', 'include.path', included)
      const before = readFileSync(join(root, '.git', 'config'), 'utf8')
      const status = await gitStatus(root)
      const diff = await gitDiff(root, 8000)
      assert.equal(existsSync(join(root, 'filter-ran')), false, `${kind} must never run`)
      assert.ok(status?.changed.some(line => line.includes('code.txt')))
      assert.match(diff?.diff ?? '', /\+after/)
      await gitDiff(root, 8000, path => path !== 'code.txt')
      assert.equal(existsSync(join(root, 'filter-ran')), false, 'excluded files must not trigger a filter in name discovery')
      assert.equal(readFileSync(join(root, '.git', 'config'), 'utf8'), before)
    } finally { rmSync(root, { recursive: true, force: true }) }
  }
})

test('unreadable or oversized effective Git configuration skips worktree reads', async () => {
  const root = mkdtempSync(join(tmpdir(), 'enhance-git-config-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: root, windowsHide: true })
    writeFileSync(join(root, '.git', 'config'), '[broken\n')
    assert.equal(await gitStatus(root), null)
    writeFileSync(join(root, '.git', 'config'), '[filter "' + 'x'.repeat(140_000) + '"]\nclean=ignored\n')
    assert.equal(await gitStatus(root), null)
    writeFileSync(join(root, '.git', 'config'), '[filter "contains=equals"]\nclean=ignored\n')
    assert.equal(await gitStatus(root), null, 'unrepresentable override names must fail closed')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('context Git reads do not run submodule-only filters or include submodule worktree content', async () => {
  const root = mkdtempSync(join(tmpdir(), 'enhance-git-child-'))
  const child = join(root, 'child')
  const run = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, windowsHide: true, stdio: 'pipe', encoding: 'utf8' }).trim()
  const commit = (cwd: string) => run(cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qam', 'fixture')
  try {
    mkdirSync(child)
    run(root, 'init', '-q')
    run(child, 'init', '-q')
    writeFileSync(join(child, 'code.txt'), 'original\n')
    writeFileSync(join(child, '.gitattributes'), '*.txt filter=ChildOnly\n')
    run(child, 'add', '.')
    commit(child)
    writeFileSync(join(root, '.gitmodules'), '[submodule "child"]\npath = child\nurl = https://example.invalid/fixture\n')
    run(root, 'add', '.gitmodules')
    run(root, 'update-index', '--add', '--cacheinfo', `160000,${run(child, 'rev-parse', 'HEAD')},child`)
    commit(root)
    // Commit movement may still be summarized, but never traverse the dirty child worktree.
    writeFileSync(join(child, 'committed.txt'), 'committed\n')
    run(child, 'add', 'committed.txt')
    commit(child)
    writeFileSync(join(root, 'filter.cjs'), "require('node:fs').writeFileSync('child-filter-ran', 'unexpected'); process.stdout.write(require('node:fs').readFileSync(0))")
    run(child, 'config', 'filter.ChildOnly.clean', `"${process.execPath.replaceAll('\\', '/')}" "${join(root, 'filter.cjs').replaceAll('\\', '/')}"`)
    run(root, 'config', 'diff.submodule', 'diff')
    writeFileSync(join(child, 'code.txt'), 'changed!\n')
    utimesSync(join(child, 'code.txt'), 1, 1)
    await gitStatus(root)
    const diff = await gitDiff(root, 8000)
    assert.equal(existsSync(join(child, 'child-filter-ran')), false)
    assert.match(diff?.diff ?? '', /Subproject commit/)
    assert.doesNotMatch(diff?.diff ?? '', /changed!|committed\.txt/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
