import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {prepareV1,savePreparedV1} from './v1-prepare.mjs'
import {openLedger,claimGeneration,hash} from './ledger.mjs'
import {buildSystemPrompt} from '../../src/prompts.ts'
import {buildRewriteSystemPrompt} from '../../src/prompt-sets.ts'

test('v1 pairs freeze both production prompt sets with identical evidence and exact Unicode',()=>{
 const rows=prepareV1();assert.equal(rows.length,48);assert.equal(new Set(rows.map(row=>row.id)).size,48)
 for(let i=0;i<rows.length;i+=2){
  const [original,enhanced]=rows.slice(i,i+2),options={style:original.fixture.style,agent:'copilot',customInstructions:original.fixture.customInstructions}
  assert.equal(original.candidate,'original');assert.equal(enhanced.candidate,'enhanced')
  assert.equal(original.system,buildSystemPrompt(options));assert.equal(enhanced.system,buildRewriteSystemPrompt(options,true));assert.notEqual(original.system,enhanced.system)
  assert.equal(original.user,enhanced.user);assert.equal(original.userHash,hash(original.user));assert.equal(original.systemHash,hash(original.system))
  assert.equal(original.route,'unapproved');assert.deepEqual(original.target,enhanced.target)
  for(const literal of original.fixture.mustInclude)assert.ok(original.user.includes(literal),literal)
 }
 const unicode=rows.find(row=>row.caseId==='v1-unicode');assert.ok(unicode.user.includes('Cafe\u0301 東京 🧪'));assert.ok(unicode.user.includes('Caf\u00e9 京都 🧪'))
 assert.ok(rows.filter(row=>row.tier==='medium').every(row=>row.target.model==='gpt-6.1-sol'&&!row.target.proxyFor))
})

test('v1 preparation persists 48 unstarted rows, refuses execution and does not overwrite evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'enhance-quality-stage-')),path=join(root,'prepared')
 try{
  const protocol=savePreparedV1(path);assert.equal(protocol.callCeiling,0);assert.equal(protocol.executionAuthorized,false);assert.equal(protocol.preparedHash,hash(prepareV1()))
  assert.equal(protocol.sourceHashes['docs/research/v1-quality-gate.md'],hash(readFileSync('docs/research/v1-quality-gate.md','utf8').replaceAll('\r\n','\n')))
  const db=openLedger(join(path,'results.sqlite'))
  try{
   const rows=db.prepare('SELECT id,planned,started FROM generation').all();assert.equal(rows.length,48);assert.ok(rows.every(row=>row.started===null))
   assert.throws(()=>claimGeneration(db,rows[0].id),/ceiling/);assert.equal(db.prepare('SELECT count(*) AS n FROM generation WHERE started IS NOT NULL').get().n,0)
   for(const row of rows){const planned=JSON.parse(row.planned);assert.equal(planned.systemHash,hash(planned.system));assert.equal(planned.userHash,hash(planned.user))}
  }finally{db.close()}
  const sentinel=join(path,'sentinel');writeFileSync(sentinel,'retain');assert.throws(()=>savePreparedV1(path),/EEXIST/);assert.equal(readFileSync(sentinel,'utf8'),'retain')
  assert.deepEqual(JSON.parse(readFileSync(join(path,'protocol.json'),'utf8')),protocol)
 }finally{assert.ok(root.startsWith(join(tmpdir(),'enhance-quality-stage-')));rmSync(root,{recursive:true,force:true})}
})
