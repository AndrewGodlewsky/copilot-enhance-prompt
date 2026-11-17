import test from 'node:test'
import assert from 'node:assert/strict'
import {createEnumerationPool} from './enumeration.ts'
import {walkFiles} from './files.ts'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const deferred=<T=void>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
const policy={allowGit:true,excludePatterns:'',exclude:new Set<string>()}
const facts={files:['src/a.ts'],refused:['.env'],isGit:true}

test('real fallback walker stops within a flat directory after cancellation or privacy revocation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'enhance-walk-interrupt-'))
  try {
    await Promise.all(Array.from({length:48},(_,i)=>writeFile(join(root,`${i}.ts`),'fixture')))
    const controller=new AbortController();let visited=0
    await assert.rejects(walkFiles(root,8000,6,controller.signal,()=>{visited++;controller.abort();return true}),/abort/i)
    assert.equal(visited,1)
    visited=0;let revoked=false
    const allow=Object.assign(()=>{visited++;revoked=true;return true},{beforeRead:async()=>{if(revoked)throw Error('Privacy revoked')}})
    await assert.rejects(walkFiles(root,8000,6,undefined,allow),/Privacy revoked/)
    assert.equal(visited,1)
  } finally {await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
})

test('equivalent overlapping discovery shares work but never shares a mutable result or completed cache',async()=>{
  const gate=deferred();let reads=0
  const pool=createEnumerationPool(async()=>{reads++;await gate.promise;return facts})
  const first=pool('project',policy), second=pool('project',{...policy,exclude:new Set()})
  gate.resolve();const [a,b]=await Promise.all([first,second])
  assert.equal(reads,1);assert.deepEqual(a,b)
  a.files.push('private-to-caller');assert.deepEqual(b.files,['src/a.ts'])
  await pool('project',policy);assert.equal(reads,2,'later requests always discover fresh names')
})

test('one cancelled or privacy-revoked participant cannot cancel or expose results to another',async()=>{
  const gate=deferred();let check!:()=>Promise<void>, shared!:AbortSignal, reads=0, revoked=false
  const pool=createEnumerationPool(async(_root,_policy,signal,beforeRead)=>{reads++;shared=signal;check=beforeRead;await gate.promise;await beforeRead();return facts})
  const stop=new AbortController()
  const first=pool('project',policy,{signal:stop.signal}), cancelled=assert.rejects(first,/abort/i)
  const second=pool('project',policy)
  await Promise.resolve();stop.abort();await cancelled;assert.equal(shared.aborted,false)
  const third=pool('project',policy,{ensureAccess:async()=>{if(revoked)throw Error('Privacy changed')}}), refused=assert.rejects(third,/Privacy changed/)
  await new Promise(resolve=>setImmediate(resolve))
  revoked=true;await check();await refused
  assert.equal(shared.aborted,false);gate.resolve();assert.deepEqual(await second,facts);assert.equal(reads,1)
})

test('all subscribers cancelling aborts discovery and a subsequent request cannot inherit that cancelled job',async()=>{
  const entered=deferred(),stopped=deferred();let reads=0
  const pool=createEnumerationPool(async(_root,_policy,signal)=>{if(++reads===1){entered.resolve();await new Promise<void>(resolve=>signal.addEventListener('abort',()=>{stopped.resolve();resolve()},{once:true}));signal.throwIfAborted()}return facts})
  const controller=new AbortController(), pending=pool('project',policy,{signal:controller.signal}), rejected=assert.rejects(pending,/abort/i)
  await entered.promise;controller.abort();await rejected;await stopped.promise
  assert.deepEqual(await pool('project',policy),facts);assert.equal(reads,2)
})

test('manual refresh, project and access/exclusion differences do not share in-flight discovery',async()=>{
  const gate=deferred();let reads=0
  const pool=createEnumerationPool(async()=>{reads++;await gate.promise;return facts})
  const runs=[pool('one',policy),pool('one',policy,{fresh:true}),pool('two',policy),pool('one',{...policy,allowGit:false}),pool('one',{...policy,excludePatterns:'src/'}),pool('one',{...policy,exclude:new Set(['file:src/a.ts'])})]
  gate.resolve();await Promise.all(runs);assert.equal(reads,6)
})

test('failed discovery rejects every owner, including an undefined rejection, and permits retry',async()=>{
  let failed=true
  const pool=createEnumerationPool(async()=>{if(failed) throw undefined;return facts})
  await Promise.all([assert.rejects(pool('project',policy)),assert.rejects(pool('project',policy))])
  failed=false;assert.deepEqual(await pool('project',policy),facts)
})

test('completion of an older refresh cannot evict the newer in-flight generation',async()=>{
  const gates=[deferred(),deferred()];let reads=0
  const pool=createEnumerationPool(async()=>{const index=reads++;await gates[index].promise;return {...facts,files:[String(index)]}})
  const old=pool('project',policy), newer=pool('project',policy,{fresh:true})
  gates[0].resolve();await old
  const joined=pool('project',policy);gates[1].resolve()
  assert.deepEqual(await joined,await newer);assert.equal(reads,2)
})

test('discovery bounds release capacity after failure without discarding ongoing owners',async()=>{
  const gate=deferred();let fail=true
  const pool=createEnumerationPool(async()=>{await gate.promise;if(fail)throw Error('fixture failure');return facts})
  const owners=Array.from({length:32},(_,index)=>assert.rejects(pool(String(index),policy),/fixture failure/))
  await assert.rejects(pool('overflow',policy),/busy/)
  gate.resolve();await Promise.all(owners)
  fail=false;assert.deepEqual(await pool('overflow',policy),facts)
})
