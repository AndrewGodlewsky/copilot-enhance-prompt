import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { registerSessionUse, sessionUse } from './session-activity.ts'
import { createServices } from './services.ts'
import type { CopilotSession } from './session.ts'

test('session ownership is conservative for missing, malformed, reused or inaccessible process identities', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-session-use-')), scope = 'a'.repeat(24)
  try {
    await mkdir(join(root,'data'))
    assert.equal(await sessionUse(root, scope), 'unknown')
    await registerSessionUse(root, scope)
    assert.equal(await sessionUse(root, scope), 'active')
    assert.equal(await sessionUse(root, scope, () => false), 'inactive')
    assert.equal(await sessionUse(root, scope, () => undefined), 'unknown')
    const path = join(root,'data','session-activity',scope + '.json')
    const before = await readFile(path,'utf8')
    await registerSessionUse(root, scope)
    assert.equal(await readFile(path,'utf8'), before, 'same worker is not duplicated')
    await writeFile(path, '{corrupt')
    assert.equal(await sessionUse(root, scope), 'unknown')
    await assert.rejects(registerSessionUse(root, scope), /activity/)
    assert.equal(await readFile(path,'utf8'), '{corrupt', 'unknown metadata is preserved')
    await assert.rejects(registerSessionUse(root, '../escape'), /session/)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('linked activity directories are neither trusted nor written through', async () => {
  const root = await mkdtemp(join(tmpdir(), 'enhance-session-link-')), outside = await mkdtemp(join(tmpdir(),'enhance-session-outside-'))
  try {
    await mkdir(join(root,'data'))
    await symlink(outside,join(root,'data','session-activity'),process.platform === 'win32' ? 'junction' : 'dir')
    assert.equal(await sessionUse(root, 'b'.repeat(24)), 'unknown')
    await assert.rejects(registerSessionUse(root, 'b'.repeat(24)), /activity/)
  } finally { await rm(root,{recursive:true,force:true}); await rm(outside,{recursive:true,force:true}) }
})

test('production adapters register before accessing drafts and refuse unreadable activity records without overwriting them', async () => {
  const root = await mkdtemp(join(tmpdir(),'enhance-adapter-activity-')), sessionId = 'registered-session'
  const scope = createHash('sha256').update(sessionId).digest('hex').slice(0,24)
  try {
    const services = createServices({sessionId} as CopilotSession,root)
    await services.storage.set('panel:draft','Original')
    assert.equal(await sessionUse(root,scope),'active')
    const path = join(root,'data','session-activity',scope+'.json')
    await writeFile(path,'{corrupt')
    const another = createServices({sessionId} as CopilotSession,root)
    await assert.rejects(another.storage.set('panel:draft','Must not replace'),/activity/)
    assert.equal(await readFile(path,'utf8'),'{corrupt')
    assert.equal(await services.storage.get('panel:draft'),'Original')
  } finally { await rm(root,{recursive:true,force:true}) }
})
