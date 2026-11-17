import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sessionData } from './session-storage.ts'
import { registerSessionUse } from './session-activity.ts'
import { persistentStore } from './storage.ts'
import { createRetainedData } from './retained-data.ts'
import { promises as fs } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'

const scopes = ['a','b','c','d','e'].map(char => char.repeat(24))
async function fixture() {
  const root = await mkdtemp(join(tmpdir(),'enhance-retained-data-'))
  await mkdir(join(root,'data'))
  for (const scope of scopes) await sessionData(root,scope).patch({'panel:draft':'Private 日本語 🧪','panel:result':'Reviewed','panel:style':'balanced','unrelated':'Keep'})
  for (const scope of scopes.slice(0,3)) await registerSessionUse(root,scope)
  await persistentStore(join(root,'data','session-activity'),scopes[2]+'.json').patch({pids:[999]})
  await registerSessionUse(root,scopes[4])
  await writeFile(join(root,'data','sessions',scopes[4]+'.json'),'{corrupt')
  await persistentStore(join(root,'data')).set('history',[{original:'Retained history'}])
  for (const path of ['uploads','usage/session-state/fixture','usage/recovery']) await mkdir(join(root,path),{recursive:true})
  await writeFile(join(root,'uploads','attachment.txt'),'Keep upload')
  await writeFile(join(root,'usage','session-state','fixture','events.jsonl'),'Keep usage')
  await writeFile(join(root,'usage','recovery','state.json'),'Keep recovery')
  return root
}

test('cleanup preview separates retained data and removes only unchanged, verified inactive private fields', async () => {
  const root = await fixture()
  const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),alive:pid=>pid===999})
  try {
    const view = await manager.inspect('one')
    assert.equal(view.sessions.current.files,1)
    assert.equal(view.sessions.active.files,1)
    assert.equal(view.sessions.unknown.files,2, 'unregistered and corrupt files stay protected')
    assert.equal(view.sessions.inactive.files,1)
    assert.equal(view.history?.entries,1)
    assert.ok(view.other.files >= 4, 'activity metadata is counted separately from saved composers')
    assert.ok(view.uploads.bytes > 0 && view.usage.bytes > 0 && view.recovery.bytes > 0)
    assert.equal(view.cleanup?.count,1)
    await assert.rejects(manager.clear('other',view.cleanup!.token,true),/Inspect/)
    await assert.rejects(manager.clear('one',view.cleanup!.token,false),/restart/)
    const result = await manager.clear('one',view.cleanup!.token,true)
    assert.equal(result.cleared,1)
    assert.deepEqual(await sessionData(root,scopes[1]).snapshot(),{'panel:style':'balanced',unrelated:'Keep'})
    for (const scope of [scopes[0],scopes[2],scopes[3]]) assert.equal(await sessionData(root,scope).get('panel:draft'),'Private 日本語 🧪')
    assert.equal(await readFile(join(root,'data','sessions',scopes[4]+'.json'),'utf8'),'{corrupt')
    assert.equal(await readFile(join(root,'uploads','attachment.txt'),'utf8'),'Keep upload')
    assert.equal(await readFile(join(root,'usage','session-state','fixture','events.jsonl'),'utf8'),'Keep usage')
    assert.equal(await readFile(join(root,'usage','recovery','state.json'),'utf8'),'Keep recovery')
    assert.deepEqual(await persistentStore(join(root,'data')).get('history'),[{original:'Retained history'}])
    await assert.rejects(manager.clear('one',view.cleanup!.token,true),/Inspect/)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('changed, newly active, expired and cancelled cleanup plans cannot remove drafts', async () => {
  const root = await fixture(); let now = 1, active = false
  const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),alive:pid=>pid===999 || active,now:()=>now})
  try {
    let view = await manager.inspect('one')
    await sessionData(root,scopes[1]).set('panel:draft','New content')
    assert.equal((await manager.clear('one',view.cleanup!.token,true)).skipped,1)
    assert.equal(await sessionData(root,scopes[1]).get('panel:draft'),'New content')
    view = await manager.inspect('one'); active = true
    assert.equal((await manager.clear('one',view.cleanup!.token,true)).skipped,1)
    active = false; view = await manager.inspect('one'); now += 10*60_000
    await assert.rejects(manager.clear('one',view.cleanup!.token,true),/Inspect/)
    view = await manager.inspect('one')
    const stop = new AbortController(); stop.abort()
    await assert.rejects(manager.clear('one',view.cleanup!.token,true,stop.signal),/abort/i)
    assert.equal(await sessionData(root,scopes[1]).get('panel:draft'),'New content')
    await assert.rejects(manager.inspect('two',stop.signal),/abort/i)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('linked, missing and bounded inspections never describe unknown sizes as complete or select them for cleanup', async () => {
  const root = await fixture(), outside = await mkdtemp(join(tmpdir(),'enhance-retained-outside-'))
  try {
    const missing = createRetainedData(join(root,'missing'),scopes[0],{uploadsDirectory:join(root,'uploads')})
    const absent = await missing.inspect('missing')
    assert.equal(absent.sessions.unknown.partial,true)
    assert.equal(absent.cleanup,undefined)
    const limited = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),maxEntries:1,alive:()=>false})
    const partial = await limited.inspect('limited')
    assert.equal(partial.sessions.inactive.partial,true)
    assert.equal(partial.uploads.partial,true)
    await symlink(outside,join(root,'data','sessions','f'.repeat(24)+'.json'),process.platform === 'win32' ? 'junction' : 'dir')
    const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),alive:pid=>pid===999})
    const view = await manager.inspect('one')
    assert.ok(view.sessions.unknown.unreadable >= 2)
    assert.equal(view.cleanup!.count,1)
    await symlink(outside,join(root,'preferences'),process.platform === 'win32' ? 'junction' : 'dir')
    const linkedPreferences = await manager.inspect('one')
    assert.equal(linkedPreferences.shared.partial,true,'an unreadable preferences scope cannot be described as fully counted')
    assert.ok(linkedPreferences.shared.unreadable > 0)
  } finally { await rm(root,{recursive:true,force:true}); await rm(outside,{recursive:true,force:true}) }
})

test('closing a canvas during inspection cannot leave a usable cleanup preview behind', async () => {
  const root = await fixture(); let closeWhileReading = true
  const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),alive:pid=>{
    if (closeWhileReading) manager.close('one')
    return pid===999
  }})
  try {
    await assert.rejects(manager.inspect('one'),/closed/)
    closeWhileReading = false
    const view = await manager.inspect('one')
    assert.equal(view.cleanup!.count,1)
    manager.close('one')
    await assert.rejects(manager.clear('one',view.cleanup!.token,true),/Inspect/)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('cancellation between files preserves the remainder and requires a new preview after partial cleanup', async () => {
  const root = await fixture(), stop = new AbortController(); let clearing = false, checks = 0
  await registerSessionUse(root,scopes[3])
  const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),alive:pid=>{
    if (clearing && ++checks === 2) stop.abort()
    return pid===999
  }})
  try {
    const view = await manager.inspect('one')
    assert.equal(view.cleanup!.count,2)
    clearing = true
    const result = await manager.clear('one',view.cleanup!.token,true,stop.signal)
    assert.equal(result.cleared,1)
    assert.equal(result.cancelled,true)
    assert.equal(await sessionData(root,view.cleanup!.sessions[0].id).get('panel:draft'),null)
    assert.equal(await sessionData(root,view.cleanup!.sessions[1].id).get('panel:draft'),'Private 日本語 🧪')
    await assert.rejects(manager.clear('one',view.cleanup!.token,true),/Inspect/)
  } finally { await rm(root,{recursive:true,force:true}) }
})

test('a preview reads private content only for its bounded cleanup batch and keeps remaining files intact', async () => {
  const root = await mkdtemp(join(tmpdir(),'enhance-retained-batch-')), original = fs.open
  try {
    await mkdir(join(root,'data','sessions'),{recursive:true}); await mkdir(join(root,'data','session-activity'))
    for (let n=1;n<=200;n++) {
      const id=n.toString(16).padStart(24,'0')
      await writeFile(join(root,'data','sessions',id+'.json'),JSON.stringify({'panel:draft':`Retain ${n}`}))
      await writeFile(join(root,'data','session-activity',id+'.json'),JSON.stringify({version:1,pids:[999]}))
    }
    let privateReads=0
    fs.open=(async (...args:Parameters<typeof fs.open>)=>{if (String(args[0]).includes(join('data','sessions'))) privateReads++; return original(...args)}) as typeof fs.open
    syncBuiltinESMExports()
    const manager=createRetainedData(root,'0'.repeat(24),{uploadsDirectory:join(root,'absent-uploads'),alive:()=>false})
    const view=await manager.inspect('one')
    assert.equal(view.sessions.inactive.files,200)
    assert.equal(view.cleanup!.count,100)
    assert.equal(privateReads,100,'private contents beyond the proposed batch must not be loaded')
    assert.equal(await readFile(join(root,'data','sessions',(200).toString(16).padStart(24,'0')+'.json'),'utf8'),JSON.stringify({'panel:draft':'Retain 200'}))
  } finally {fs.open=original;syncBuiltinESMExports();await rm(root,{recursive:true,force:true})}
})

test('a separate worker registering after the preview protects its draft until that process stops', async () => {
  const root = await mkdtemp(join(tmpdir(),'enhance-retained-live-'))
  const script = `import {registerSessionUse} from ${JSON.stringify(new URL('./session-activity.ts',import.meta.url).href)}; await registerSessionUse(process.env.TEST_STORAGE_ROOT,process.env.TEST_SCOPE);`
  const args = ['--input-type=module','-e'], env = {...process.env,TEST_STORAGE_ROOT:root,TEST_SCOPE:scopes[1]}
  let child: ReturnType<typeof spawn> | undefined
  try {
    await mkdir(join(root,'data'))
    await sessionData(root,scopes[1]).set('panel:draft','Keep my live draft')
    execFileSync(process.execPath,[...args,script],{env,windowsHide:true})
    const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'absent')})
    const view = await manager.inspect('one')
    assert.equal(view.cleanup!.count,1)
    child = spawn(process.execPath,[...args,script+"process.stdout.write('ready'); process.stdin.resume();"],{env,windowsHide:true,stdio:['pipe','pipe','pipe']})
    await once(child.stdout!,'data')
    assert.equal((await manager.clear('one',view.cleanup!.token,true)).skipped,1)
    assert.equal(await sessionData(root,scopes[1]).get('panel:draft'),'Keep my live draft')
    const stopped = once(child,'exit'); child.kill(); await stopped; child = undefined
    const fresh = await manager.inspect('one')
    assert.equal((await manager.clear('one',fresh.cleanup!.token,true)).cleared,1)
  } finally { if (child && child.exitCode === null) { const stopped = once(child,'exit');child.kill();await stopped }; await rm(root,{recursive:true,force:true}) }
})

test('failed cleanup replacement preserves the old file and stops before changing the remaining drafts', async () => {
  const root = await fixture(), original = fs.rename
  await registerSessionUse(root,scopes[3])
  const manager = createRetainedData(root,scopes[0],{uploadsDirectory:join(root,'uploads'),alive:pid=>pid===999})
  try {
    const view = await manager.inspect('one')
    const target = join(root,'data','sessions',view.cleanup!.sessions[0].id+'.json')
    const before = await readFile(target)
    fs.rename = (async (...args:Parameters<typeof fs.rename>)=>{ if (String(args[1])===target) throw Object.assign(Error('Fixture full disk'),{code:'ENOSPC'}); return original(...args) }) as typeof fs.rename
    syncBuiltinESMExports()
    const result = await manager.clear('one',view.cleanup!.token,true)
    assert.equal(result.cleared,0); assert.equal(result.failed,1)
    assert.deepEqual(await readFile(target),before)
    assert.equal(await sessionData(root,view.cleanup!.sessions[1].id).get('panel:result'),'Reviewed')
    await assert.rejects(manager.clear('one',view.cleanup!.token,true),/Inspect/)
  } finally { fs.rename=original;syncBuiltinESMExports();await rm(root,{recursive:true,force:true}) }
})
