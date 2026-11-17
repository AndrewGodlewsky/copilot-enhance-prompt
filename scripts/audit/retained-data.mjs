// Synthetic storage inspection/cleanup stress fixture. No owner data or model calls.
import assert from 'node:assert/strict'
import { mkdtemp,mkdir,readFile,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRetainedData } from '../../src/copilot/retained-data.ts'
import { VERSION } from '../../src/version.ts'

const root = await mkdtemp(join(tmpdir(),'enhance-retained-scale-'))
const report = {version:VERSION,capturedAt:new Date().toISOString(),node:process.version,platform:process.platform,
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeModified:true,syntheticOnly:true,modelCalls:0,
  method:'One sample per size. Fixture creation excluded. Production scan/cleanup with deterministic process liveness; 15-second/50k-entry budgets unchanged. Every session and usage record verified after a 100-session maximum cleanup. Endpoint memory is not peak memory. No browser rendering.',measurements:[],sourceHashes:{}}
for (const path of ['src/copilot/retained-data.ts','src/copilot/session-activity.ts','src/copilot/storage.ts','scripts/audit/retained-data.mjs']) report.sourceHashes[path]=createHash('sha256').update((await readFile(path,'utf8')).replaceAll('\r\n','\n')).digest('hex')
const scope = n => n.toString(16).padStart(24,'0')
const body = n => ({'panel:draft':`Synthetic ${n} 日本語 🧪 `+'Request '.repeat(30),'panel:result':'Reviewed '.repeat(50),'panel:style':'balanced',unrelated:`Keep ${n}`})
async function parallel(count,run) {
  let next=0
  await Promise.all(Array.from({length:24},async()=>{while(next<count) await run(next++)}))
}
try {
  for (const count of [100,1000,10000,30000]) {
    const directory=join(root,String(count)), sessions=join(directory,'data','sessions'), owners=join(directory,'data','session-activity'), usage=join(directory,'usage','session-state')
    for (const path of [sessions,owners,usage]) await mkdir(path,{recursive:true})
    await writeFile(join(directory,'data','state.json'),JSON.stringify({history:[{original:'Keep history'}]}))
    await parallel(count,async n=>{
      await writeFile(join(sessions,scope(n)+'.json'),JSON.stringify(body(n)))
      if (n%10!==0) await writeFile(join(owners,scope(n)+'.json'),JSON.stringify({version:1,pids:[n%3===0?42:43]}))
      const receipt=join(usage,scope(n));await mkdir(receipt)
      await writeFile(join(receipt,'events.jsonl'),`{"syntheticUsage":${n}}\n`)
    })
    const manager=createRetainedData(directory,scope(0),{uploadsDirectory:join(directory,'absent-uploads'),alive:pid=>pid===42})
    global.gc?.();const memoryBefore=process.memoryUsage(), started=performance.now()
    const view=await manager.inspect('benchmark'), inspectMs=+(performance.now()-started).toFixed(3)
    const selected=new Set(view.cleanup?.sessions.map(item=>item.id)??[])
    assert.ok(selected.size<=100)
    assert.ok(selected.size>0)
    for (const id of selected) {const n=parseInt(id,16);assert.ok(n!==0&&n%10!==0&&n%3!==0)}
    const clearStarted=performance.now(), result=await manager.clear('benchmark',view.cleanup.token,true)
    const clearMs=+(performance.now()-clearStarted).toFixed(3), memoryAfter=process.memoryUsage()
    assert.equal(result.cleared,selected.size)
    await parallel(count,async n=>{
      const expected=body(n)
      if(selected.has(scope(n))) {delete expected['panel:draft'];delete expected['panel:result']}
      assert.deepEqual(JSON.parse(await readFile(join(sessions,scope(n)+'.json'),'utf8')),expected)
      assert.equal(await readFile(join(usage,scope(n),'events.jsonl'),'utf8'),`{"syntheticUsage":${n}}\n`)
    })
    assert.deepEqual(JSON.parse(await readFile(join(directory,'data','state.json'),'utf8')),{history:[{original:'Keep history'}]})
    report.measurements.push({sessions:count,usageRecords:count,inspectMs,clearMs,sessionSizes:view.sessions,usageSize:view.usage,otherSize:view.other,cleanup:result,allSessionValuesAndUsageVerified:true,heapUsedBytes:memoryAfter.heapUsed,heapDeltaBytes:memoryAfter.heapUsed-memoryBefore.heapUsed,rssBytes:memoryAfter.rss})
    console.log(`${count} sessions/usage records: inspect ${inspectMs} ms, clear ${result.cleared} in ${clearMs} ms; every value verified`)
  }
  await writeFile('docs/audits/v1/retained-data-measurements.json',JSON.stringify(report,null,2)+'\n')
} finally { await rm(root,{recursive:true,force:true}) }
