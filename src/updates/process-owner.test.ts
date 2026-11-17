import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { processIdentity } from './process-owner.ts'

test('creation identity is stable for this process, distinct for a disposable child, and unknown after exit', { skip: !['win32', 'linux'].includes(process.platform) }, async () => {
  const own = await processIdentity(process.pid)
  assert.ok(own)
  assert.equal(await processIdentity(process.pid), own)
  const child = spawn(process.execPath, ['-e', 'process.stdout.write("ready"); process.stdin.resume()'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  const ended = once(child, 'exit')
  try {
    await once(child.stdout, 'data')
    const other = await processIdentity(child.pid!)
    assert.ok(other)
    assert.notEqual(other, own)
  } finally { child.stdin.end(); await ended }
  assert.equal(await processIdentity(child.pid!), undefined)
  for (const invalid of [0, -1, 1.5, NaN, Infinity]) assert.equal(await processIdentity(invalid), undefined)
})
