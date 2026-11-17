// Runs the other repository's actual consumer read-only against owned synthetic receipts.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile,appendFile,rename,cp,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {pathToFileURL} from 'node:url'
import {createHash,randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createUsageRecorder} from '../../src/copilot/usage.ts'
import {VERSION} from '../../src/version.ts'

const consumer=process.env.USAGE_INSIGHTS_REPO
if(!consumer)throw Error('Set USAGE_INSIGHTS_REPO to a clean local Usage Insights source checkout. No files there will be modified.')
const repo=resolve(consumer),git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',windowsHide:true}).trim()
assert.equal(git('status','--porcelain'),'','Consumer source must be clean so its commit identifies the measured code')
const consumerCommit=git('rev-parse','HEAD')
const root=await mkdtemp(join(tmpdir(),'enhance-consumer-scale-')),home=join(root,'data','usage'),copy=join(root,'copy'),priorDataDir=process.env.ENHANCE_PROMPT_DATA_DIR
process.env.ENHANCE_PROMPT_DATA_DIR=join(root,'data')
const report={version:VERSION,at:new Date().toISOString(),node:process.version,platform:process.platform,consumerCommit,syntheticOnly:true,modelCalls:0,sessions:10000,receipts:20000,
  method:'Actual clean Usage Insights scanner and all/90d report builder imported from the explicitly supplied checkout. 10000 production-recorder sessions with 2 receipts each spread across120days. Producer creation timed separately. One cold and3 warm then3 forced scans, with three all/90d report samples. Mutation scenarios are single samples with exact count/integer credit assertions; no browser, WSL, VSCode, account or SQLite fixture. No cache flush/warm-up; memory endpoints are this process including fixtures/consumer, not peaks or desktop totals.',sourceHashes:{},consumerHashes:{},scans:[],reports:[],mutations:[]}
const sourcePaths=['src/copilot/usage.ts','scripts/audit/usage-consumer.mjs']
const consumerPaths=['src/node/copilot-source.mjs','src/node/read-queue.mjs','src/core/copilot.mjs','src/core/copilot-report.mjs','src/core/query.mjs','src/core/prompt-credits.mjs']
const hash=async path=>createHash('sha256').update((await readFile(path,'utf8')).replaceAll('\r\n','\n')).digest('hex')
try{
  for(const path of sourcePaths)report.sourceHashes[path]=await hash(path)
  for(const path of consumerPaths)report.consumerHashes[path]=await hash(join(repo,path))
  const {createScanner}=await import(pathToFileURL(join(repo,'src/node/copilot-source.mjs')).href)
  const {buildReport}=await import(pathToFileURL(join(repo,'src/core/copilot-report.mjs')).href)
  let metrics=[],last
  const diagnostics={measure(operation,fields,work){
    const start=performance.now()
    const finish=()=>{const row={operation,ms:+(performance.now()-start).toFixed(3)};for(const key of ['filesRead','filesReused','filesAppended','bytesRead','bytesHashed','folders','records'])if(Number.isFinite(fields[key]))row[key]=fields[key];metrics.push(row)}
    let result
    try{result=work()}catch(error){finish();throw error}
    if(result && typeof result.then==='function')return Promise.resolve(result).finally(finish)
    finish();return result
  }}
  assert.equal(diagnostics.measure('fixture.sync',{},()=>42),42,'Synchronous stages must return and finish synchronously')
  metrics=[]
  const scanner=createScanner({optionalHomes:[],diagnostics})
  const now=new Date('2026-11-17T12:00:00.000Z'),ids=[],nowMs=now.getTime()
  const receipt=(sid,id,amount,days=0)=>({type:'session.usage_record',id:randomUUID(),timestamp:new Date(nowMs-days*86400000).toISOString(),data:{usage:{model:'fixture-model',provider:{kind:'copilot'},inputTokens:100,outputTokens:20,copilotUsage:{totalNanoAiu:amount},accounting:{sourceSessionId:sid,usageId:id,sequence:1}}}})
  const start=performance.now()
  for(let i=0;i<10000;i++){const sid=randomUUID();ids.push(sid);const recorder=await createUsageRecorder(sid,home);recorder.record(receipt(sid,'one',1000,i%120));recorder.record(receipt(sid,'two',2000,i%120));await recorder.flush()}
  report.producer={ms:+(performance.now()-start).toFixed(3),memory:process.memoryUsage()};console.log('producer',report.producer.ms)
  const scan=async(label,expectedCount,expectedNano,options={})=>{
    metrics=[];const start=performance.now(),result=await scanner.scan([home,...(options.copy?[copy]:[])],{includeWsl:false,includeVSCode:false,force:options.force??false})
    const ms=performance.now()-start,nano=result.records.reduce((sum,record)=>sum+record.nanoAiu,0)
    assert.equal(result.records.length,expectedCount);assert.equal(nano,expectedNano);assert.ok(result.records.every(record=>record.project==='Enhanced Prompt'))
    const row={label,ms:+ms.toFixed(3),records:result.records.length,nanoAiu:nano,sameResult:result===last,metrics,memory:process.memoryUsage()}
    last=result;console.log(label,row.ms);return {row,result}
  }
  for(const label of ['cold','warm-1','warm-2','warm-3','forced-1','forced-2','forced-3']){
    const {row}=await scan(label,20000,30000000,{force:label.startsWith('forced')});report.scans.push(row)
    if(label.startsWith('warm')){assert.ok(row.sameResult);assert.equal(row.metrics.find(metric=>metric.operation==='history.journals').filesRead,0)}
  }
  for(let sample=1;sample<=3;sample++)for(const range of ['all','90d']){
    const begin=performance.now(),result=buildReport(last.records,{range},now,last),ms=performance.now()-begin
    const expected=range==='all'?20000:Array.from({length:10000},(_,i)=>i%120<90?2:0).reduce((a,b)=>a+b,0)
    assert.equal(result.totals.requests,expected)
    assert.equal(result.totals.credits,expected*1500/1e9)
    report.reports.push({sample,range,ms:+ms.toFixed(3),requests:expected,credits:result.totals.credits,memory:process.memoryUsage()})
  }
  let count=20000,nano=30000000
  const file=join(home,'session-state',ids[0],'events.jsonl')
  const mutation=async(label,options={})=>{const {row}=await scan(label,count,nano,options);report.mutations.push(row)}
  await appendFile(file,JSON.stringify(receipt(ids[0],'one',1000))+'\n');await mutation('duplicate-identity')
  await appendFile(file,JSON.stringify(receipt(ids[0],'three',500))+'\n');count++;nano+=500;await mutation('append-new-receipt')
  const lines=(await readFile(file,'utf8')).trim().split('\n').map(JSON.parse)
  lines.find(line=>line.data?.usage?.accounting?.usageId==='one').data.usage.copilotUsage.totalNanoAiu=1700
  await writeFile(file+'.fixture',lines.map(line=>JSON.stringify(line)).join('\n')+'\n');await rename(file+'.fixture',file);nano+=700;await mutation('atomic-replacement-correction')
  const restored=await createUsageRecorder(ids[0],home,{resume:true});restored.record(receipt(ids[0],'late',900));restored.record(receipt(ids[0],'late',900));await restored.flush();count++;nano+=900;await mutation('late-producer-recovery')
  await mkdir(join(copy,'session-state'),{recursive:true});await cp(join(home,'session-state',ids[0]),join(copy,'session-state',ids[0]),{recursive:true});await mutation('copied-journal',{copy:true})
  const before=await readFile(file,'utf8');await appendFile(file,JSON.stringify(receipt(ids[0],'conflicting',1)).slice(0,-5));await mutation('partial-tail')
  await writeFile(file,before);await mutation('truncated-partial-tail')
  await appendFile(file,JSON.stringify(receipt(ids[0],'one',9999))+'\n');await mutation('conflicting-duplicate-first-wins')
  await mutation('forced-reconciliation',{force:true})
  const recreated=createScanner({optionalHomes:[]}),snapshot=await recreated.scan([home,copy],{includeWsl:false,includeVSCode:false})
  assert.equal(snapshot.records.length,count);assert.equal(snapshot.records.reduce((sum,record)=>sum+record.nanoAiu,0),nano)
  report.restartReconciled=true;report.conflictingDuplicatePolicy='first observed identity wins; append is not a correction protocol'
  const parallel=await Promise.all([recreated.scan([home,copy],{includeWsl:false,includeVSCode:false}),recreated.scan([home,copy],{includeWsl:false,includeVSCode:false})])
  assert.equal(parallel[0],parallel[1]);assert.equal(parallel[0].records.length,count)
  report.concurrentRefreshSameSnapshot=true
  assert.equal(git('rev-parse','HEAD'),consumerCommit);assert.equal(git('status','--porcelain'),'')
  for(const path of consumerPaths)assert.equal(await hash(join(repo,path)),report.consumerHashes[path])
  await writeFile('docs/audits/v1/usage-consumer-measurements.json',JSON.stringify(report,null,2)+'\n')
}finally{
  if(priorDataDir===undefined)delete process.env.ENHANCE_PROMPT_DATA_DIR;else process.env.ENHANCE_PROMPT_DATA_DIR=priorDataDir
  assert.ok(root.startsWith(join(tmpdir(),'enhance-consumer-scale-')));await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})
}
