import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportLegacySessions } from './recover-session-state.mjs'

test('private recovery export preserves all values, refuses conflicts and never overwrites saved files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-recovery-export-'))
  try {
    const scope = '0'.repeat(24), dir = join(root, 'data', 'sessions'), output = join(root, 'private-export.json')
    await mkdir(dir, { recursive: true })
    const shared = { 'internal:sessionStorage': 1, history: [{ original: '日本語 🧪' }], rules: { user: 'Keep' }, unknown: true }
    const own = { 'panel:draft': 'Preserve café', 'panel:files': [{ path: 'C:\\owned\\image.png' }], 'panel:result': null }
    await writeFile(join(root, 'data/state.json'), JSON.stringify(shared))
    await writeFile(join(dir, `${scope}.json`), JSON.stringify(own))
    const before = await readFile(join(root, 'data/state.json'))
    await assert.rejects(exportLegacySessions({ directory: root, output }), /close Copilot/)
    await exportLegacySessions({ directory: root, output, copilotClosed: true })
    const expected = { ...shared }; delete expected['internal:sessionStorage']
    for (const [key, value] of Object.entries(own)) expected[`session:${scope}:${key}`] = value
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), expected)
    assert.deepEqual(await readFile(join(root, 'data/state.json')), before)
    await assert.rejects(exportLegacySessions({ directory: root, output, copilotClosed: true }), /EEXIST/)
    shared[`session:${scope}:panel:draft`] = 'Older worker conflict'
    await writeFile(join(root, 'data/state.json'), JSON.stringify(shared))
    await assert.rejects(exportLegacySessions({ directory: root, output: join(root, 'conflict.json'), copilotClosed: true }), /conflicting/)
    delete shared[`session:${scope}:panel:draft`]
    shared['internal:sessionStorage'] = 2
    await writeFile(join(root, 'data/state.json'), JSON.stringify(shared))
    await assert.rejects(exportLegacySessions({ directory: root, output: join(root, 'newer.json'), copilotClosed: true }), /format/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
