// Privacy, Git hardening and supported preset regressions.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after } from 'node:test'
import { assert, mockHost, mountWorker, test } from '#testing'
import { gitStatus } from './context/git.ts'
import * as main from './worker.ts'

const dirs: string[] = []
const tempDir = (name: string) => {
  const dir = mkdtempSync(join(tmpdir(), name))
  dirs.push(dir)
  return dir
}
after(() => {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    } catch {
      // a just-killed process may still hold it (Windows): the OS temp cleaner gets it
    }
  }
})


test('an unticked terminal output is not read at all', async () => {
  const host = mockHost({
    results: {
      'workspace.readContext': { branch: 'main', displayName: 'demo', terminals: [{ id: 't1', title: 'Claude' }] },
      'agents.list': { agents: [] },
      'workspace.list': { workspaces: [], truncated: false },
      'terminal.read': { lines: ['secret output'], truncated: false }
    }
  })
  const worker = await mountWorker(main, { host })
  const shown = await worker.request('context.preview', { prompt: 'x', level: 'max', terminalId: 't1' })
  assert.ok(shown.context.some((item) => item.id === 'terminal'))
  assert.equal(host.callsOf('terminal.read').length, 1)
  const unticked = await worker.request('context.preview', { prompt: 'x', level: 'max', terminalId: 't1', exclude: ['terminal'] })
  assert.ok(!unticked.context.some((item) => item.id === 'terminal'))
  assert.equal(host.callsOf('terminal.read').length, 1)
  await worker.deactivate()
})

test("git reads never run a repository's fsmonitor program", async () => {
  const root = tempDir('fsmonitor-')
  const marker = join(root, 'ran.txt').replace(/\\/g, '/')
  const hook = join(root, 'monitor.sh').replace(/\\/g, '/')
  writeFileSync(hook, `#!/bin/sh\necho ran > "${marker}"\n`, { mode: 0o755 })
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['config', 'core.fsmonitor', hook], { cwd: root })
  writeFileSync(join(root, 'a.txt'), 'a')
  const status = await gitStatus(root)
  assert.ok(status)
  assert.ok(!existsSync(marker), 'the fsmonitor program ran')
})
