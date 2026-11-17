import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import * as search from './git.ts'
import { contentScores, scoreFiles } from './relevance.ts'
import { gatherContext } from './index.ts'
import { mockHost } from '../testing.ts'
import { createWorkerHost } from '../worker-host.ts'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(),'enhance-batched-grep-'))
  execFileSync('git',['init','-q'],{cwd:root,windowsHide:true})
  const files = ['normal.ts','日本 語.ts','spaces [literal].ts','-leading.ts']
  if (process.platform !== 'win32') files.push('colon:2:name.ts','line\nbreak.ts','tab\tname.ts')
  for (const file of files) await writeFile(join(root,file),'validateSession VALIDATESESSION 日本語\nabab kernel Kernel ſession\nΣigma ςigma Éclair\nno_match\nvalidateSession\n')
  await writeFile(join(root,'.env'),'validateSession=private')
  await writeFile(join(root,'refused.ts'),'validateSession secret')
  await writeFile(join(root,'.gitignore'),'ignored.ts\n')
  await writeFile(join(root,'ignored.ts'),'validateSession ignored')
  await writeFile(join(root,'binary.bin'),Buffer.from('validateSession\0binary'))
  return {root,files}
}

test('one Git pass preserves per-keyword line counts, overlap, Unicode, exclusions and file ranking',async()=>{
  const {root,files}=await fixture()
  try {
    const words=['validatesession','日本語','aba','bab','kernel','session','σigma','éclair']
    const result=await search.gitGrepCounts(root,words,{refused:['refused.ts']})
    assert.equal(result.limited,false);assert.equal(result.unavailable,false)
    for (let i=0;i<words.length;i++) {
      const expected=await search.gitGrepCount(root,words[i],undefined,['refused.ts'])
      // The old newline parser loses unusual names; the new framed output must retain them.
      for(const file of files.filter(file=>!/[\n\t]/.test(file))) assert.equal(result.counts[i].get(file),expected.get(file),`${words[i]} in ${file}`)
      for(const file of files) assert.equal(result.counts[i].get(file),i===0?2:i===5?3:1,`${words[i]} in ${file}`)
      for(const excluded of ['.env','refused.ts','ignored.ts','binary.bin']) assert.equal(result.counts[i].has(excluded),false,excluded)
    }
    const baseline=await Promise.all(words.map(word=>search.gitGrepCount(root,word,undefined,['refused.ts'])))
    const safeFiles=files.filter(file=>!/[\n\t]/.test(file))
    const trim=(maps:Map<string,number>[])=>maps.map(map=>new Map([...map].filter(([file])=>safeFiles.includes(file))))
    assert.deepEqual(scoreFiles(safeFiles,words,contentScores(trim(result.counts),safeFiles.length),new Set(),false),scoreFiles(safeFiles,words,contentScores(trim(baseline),safeFiles.length),new Set(),false))
    assert.deepEqual(result.hits.get('normal.ts'),[1,2,3,5])
  } finally {await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})

test('batched search distinguishes no matches, invalid input, output limits, missing Git roots and cancellation',async()=>{
  const {root}=await fixture()
  try {
    const absent=await search.gitGrepCounts(root,['neverFound'])
    assert.equal(absent.limited,false);assert.equal(absent.unavailable,false);assert.equal(absent.counts[0].size,0)
    for(const words of [[''],['a\nb'],['a\0b'],Array(13).fill('term')]) assert.equal((await search.gitGrepCounts(root,words)).unavailable,true)
    const limited=await search.gitGrepCounts(root,['validatesession'],{maxBytes:50})
    assert.equal(limited.limited,true)
    for(const value of limited.counts[0].values()) assert.ok(Number.isSafeInteger(value)&&value>0)
    const stop=new AbortController();stop.abort()
    const cancelled=await search.gitGrepCounts(root,['validatesession'],{signal:stop.signal})
    assert.equal(cancelled.counts[0].size,0);assert.equal(cancelled.limited,true)
    const missing=await search.gitGrepCounts(join(root,'absent'),['validatesession'])
    assert.equal(missing.unavailable,true)
    await assert.rejects(search.gitGrepCounts(root,['validatesession'],{ensureAccess:async()=>{throw Error('Revoked')}}),/Revoked/)
  } finally {await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})

test('framed matches preserve unusual names and discard malformed or truncated records',()=>{
  const path='line\nbreak:23:\t日本語.ts'
  const result=search.parseGrepMatches(`${path}\0${2}\0a.b [literal] 日本語\nnormal.ts\0${3}\0partial`,['a.b','[literal]','日本語'])
  assert.equal(result.limited,true)
  for(const counts of result.counts) assert.deepEqual([...counts],[[path,1]])
  assert.deepEqual([...result.hits],[[path,[2]]])
  assert.equal(search.parseGrepMatches('bad.ts\0NaN\0match\n',['match']).limited,true)
  assert.equal(search.parseGrepMatches('.env\0'+1+'\0secret\n',['secret']).counts[0].size,0)
})

test('integrated context gathering executes one grep, reuses its excerpt positions and preserves exclusions',async()=>{
  const {root}=await fixture(), original=childProcess.execFile
  const workspace={id:'search',name:'search',path:root,branch:null,hostId:null}
  const host=mockHost({results:{'workspace.readContext':{displayName:'search',branch:'',workspaceId:'search'},'workspace.list':{workspaces:[workspace]}}})
  let greps=0
  childProcess.execFile=((...args:any[])=>{if(args[0]==='git'&&args[1].includes('grep')) greps++;return (original as any)(...args)}) as typeof original
  syncBuiltinESMExports()
  try {
    const result=await gatherContext(createWorkerHost(host).api,{level:'deep',prompt:'Investigate validateSession and kernel in normal.ts',terminalLines:0,exclude:new Set(['file:refused.ts']),extraFiles:[],excludePatterns:'',allowTerminal:false})
    assert.equal(greps,1)
    assert.ok(result.items.some(item=>item.id==='file:normal.ts'&&item.content.includes('validateSession')))
    assert.equal(result.items.some(item=>item.id==='file:refused.ts'),false)
    assert.equal(result.notes.some(note=>note.code==='note.git_search_limited'||note.code==='note.git_search_unavailable'),false)
  } finally {childProcess.execFile=original;syncBuiltinESMExports();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})

test('a running search can be cancelled and timeout/output truncation never masquerades as a complete search',async()=>{
  const {root}=await fixture(), original=childProcess.execFile
  try {
    // Deterministic execution-edge fixtures exercise the same callback used by real Git.
    childProcess.execFile=((...args:any[])=>{
      const callback=args.at(-1)
      setImmediate(()=>callback(Object.assign(Error('Timed out'),{killed:true,code:null}),'normal.ts\0'+1+'\0validatesession\nnormal.ts\0'+2+'\0incomplete'))
      return {pid:undefined,kill(){},exitCode:null,signalCode:null}
    }) as typeof original
    syncBuiltinESMExports()
    const timed=await search.gitGrepCounts(root,['validatesession'])
    assert.equal(timed.limited,true);assert.equal(timed.counts[0].get('normal.ts'),1)
    const controller=new AbortController()
    const running=search.gitGrepCounts(root,['validatesession'],{signal:controller.signal})
    await Promise.resolve();controller.abort()
    const cancelled=await running
    assert.equal(cancelled.limited,true);assert.equal(cancelled.counts[0].size,0)
  } finally {childProcess.execFile=original;syncBuiltinESMExports();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})
