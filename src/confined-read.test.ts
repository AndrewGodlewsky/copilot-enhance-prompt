import { mkdtemp, mkdir, writeFile, rename, symlink, link, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { assert, test } from '#testing'
import { readConfinedFile } from './confined-read.ts'

test('confined reads preserve Unicode and allow inside aliases but refuse outside links, hard links and oversized files', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'enhance-read-'))
  const root = join(fixture, 'root'), outside = join(fixture, 'outside')
  try {
    await mkdir(join(root, 'files'), { recursive: true }); await mkdir(outside)
    const text = '日本語 café / code="unchanged"'
    await writeFile(join(root, 'files', 'test.txt'), text)
    await writeFile(join(outside, 'private.txt'), 'OUTSIDE')
    await symlink(join(root, 'files'), join(root, 'alias'), 'junction')
    await symlink(outside, join(root, 'escape'), 'junction')
    await link(join(outside, 'private.txt'), join(root, 'hard.txt'))
    assert.equal((await readConfinedFile(root, 'alias/test.txt', 100))?.data.toString(), text)
    assert.equal(await readConfinedFile(root, 'files/test.txt', 5), null)
    assert.equal(await readConfinedFile(root, 'escape/private.txt', 100), null)
    assert.equal(await readConfinedFile(root, 'hard.txt', 100), null)
    assert.equal(await readConfinedFile(root, '../outside/private.txt', 100), null)
    assert.equal(await readConfinedFile(root, 'files', 100), null)
    assert.equal(await readConfinedFile(root, 'files/test.txt', Infinity), null)
    assert.equal(await readConfinedFile(root, 'files/test.txt', 100, () => false), null)
  } finally { await rm(fixture, { recursive: true, force: true }) }
})

test('confined reads refuse substitutions before opening and after holding the handle', async () => {
  for (const point of [1, 2, 3]) {
    const fixture = await mkdtemp(join(tmpdir(), 'enhance-read-swap-'))
    const root = join(fixture, 'root'), outside = join(fixture, 'outside')
    try {
      await mkdir(join(root, 'assets'), { recursive: true }); await mkdir(outside)
      await writeFile(join(root, 'assets', 'app.js'), 'SAFE')
      await writeFile(join(outside, 'app.js'), 'EVIL')
      let checks = 0, swapBlocked = false
      const result = await readConfinedFile(root, 'assets/app.js', 100, async () => {
        if (++checks === point) {
          try { await rename(join(root, 'assets'), join(root, 'old')) } catch (error) {
            if (process.platform !== 'win32' || point === 1 || (error as NodeJS.ErrnoException).code !== 'EPERM') throw error
            swapBlocked = true // Windows can prevent renaming a directory while its child is held open.
            return true
          }
          await symlink(outside, join(root, 'assets'), 'junction')
        }
        return true
      })
      // A replacement after the last read can return only the original held bytes.
      assert.ok(result === null || (swapBlocked || point === 3) && result.data.toString() === 'SAFE')
    } finally { await rm(fixture, { recursive: true, force: true }) }
  }
})

test('confined reads reject growth and replacements and propagate late access revocation', async () => {
  for (const change of ['grow', 'replace', 'revoke'] as const) {
    const root = await mkdtemp(join(tmpdir(), 'enhance-read-change-'))
    try {
      await writeFile(join(root, 'file.txt'), 'old')
      let checks = 0
      const reading = readConfinedFile(root, 'file.txt', 100, async () => {
        if (++checks === 2) {
          if (change === 'revoke') throw new Error('Access revoked')
          if (change === 'replace') await rename(join(root, 'file.txt'), join(root, 'saved.txt'))
          await writeFile(join(root, 'file.txt'), change === 'grow' ? 'x'.repeat(1000) : 'new')
        }
        return true
      })
      if (change === 'revoke') await assert.rejects(reading, /Access revoked/)
      else assert.equal(await reading, null)
      // Windows removal also verifies that all failure paths closed their handles.
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})
