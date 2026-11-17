// Opt-in, synthetic production-storage/context stress. Never reads owner data.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {promises as fs} from 'node:fs'
import {syncBuiltinESMExports} from 'node:module'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {fork,execFileSync} from 'node:child_process'
import {once} from 'node:events'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {persistentStore} from '../../src/copilot/storage.ts'
import {createServices} from '../../src/copilot/services.ts'
import {createSaveQueue} from '../../src/save-queue.ts'
import {gatherContext} from '../../src/context/index.ts'
import {mockHost} from '../../src/testing.ts'
import {createWorkerHost} from '../../src/worker-host.ts'
import {VERSION} from '../../src/version.ts'

if(process.argv[2]==='child') {
  const [directory,mode,id]=process.argv.slice(3), store=persistentStore(directory)
  if(mode==='transactions') {
    for(let n=0;n<100;n++) await store.transaction(async()=>{const values=await store.snapshot();await store.patch({counter:(values.counter??0)+1,[`writer-${id}`]:n})})
    process.send({done:true});process.disconnect()
  } else {
    await store.set('acknowledged','Retain 日本語 🧪');process.send({ack:true})
    await once(process,'message')
    const rename=fs.rename
    fs.rename=async(...args)=>{if(String(args[1])===join(directory,'state.json')){process.send({blocked:true});await new Promise(()=>{})}return rename(...args)}
    syncBuiltinESMExports()
    await store.set('acknowledged','Unacknowledged replacement')
  }
} else {
  const root=await mkdtemp(join(tmpdir(),'enhance-concurrency-scale-')), children=new Set()
  const report={version:VERSION,at:new Date().toISOString(),node:process.version,platform:process.platform,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeModified:true,syntheticOnly:true,modelCalls:0,
    method:'Three samples per 4-session typing mode, 10 waves of 3000 edits per session (120000 edits/sample), 5ms injected write delay, 0 or 12 observers. New store per sample; no excluded warm-up, later samples warm filesystem/JIT. Shared writes: four real child processes x100 atomic transactions over 500 retained rows. Interruption: kill owned child after acknowledged save and before replacement rename, then wait 31s for its renewable lock to expire. Tracked repository: 10000 files, 6000-line source, 2.5MB diff, 1MiB binary image, three cold/warm gathers. Fixture creation excluded. Timings are observations, no performance thresholds; memory endpoints are parent process only, not peaks or child/browser totals.',sourceHashes:{},typing:[],transactions:[],context:[]}
  const paths=['src/save-queue.ts','src/copilot/storage.ts','src/copilot/store-observer.ts','src/copilot/services.ts','src/context/index.ts','src/context/git.ts','src/context/search.ts','scripts/audit/concurrency-scale.mjs']
  for(const path of paths)report.sourceHashes[path]=createHash('sha256').update((await readFile(path,'utf8')).replaceAll('\r\n','\n')).digest('hex')
  const child=(directory,mode,id='0')=>{const process=fork(fileURLToPath(import.meta.url),['child',directory,mode,id],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});children.add(process);process.on('exit',()=>children.delete(process));return process}
  const message=(process,key)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error(`Child ${key} timed out`))},45000);const receive=value=>{if(value[key]){cleanup();resolve(value)}};const failed=()=>{cleanup();reject(Error('Child exited early'))};const cleanup=()=>{clearTimeout(timer);process.off('message',receive);process.off('exit',failed)};process.on('message',receive);process.on('exit',failed)})
  try {
    for(const watchers of [false,true])for(let sample=1;sample<=3;sample++){
      const dir=join(root,`typing-${watchers}-${sample}`), services=Array.from({length:4},(_,i)=>createServices({sessionId:`session-${i}`},dir)),stops=[]
      await Promise.all(services.map(service=>service.settings.get()))
      let writes=0,observations=0,maxPending=0
      const subscriberNotifications=[]
      const queues=services.map(service=>createSaveQueue(async ops=>{await new Promise(resolve=>setTimeout(resolve,5));await service.storage.patch(Object.fromEntries(ops.map(op=>[op.key,op.value])));writes++}))
      if(watchers)for(const service of services)for(let i=0;i<3;i++){
        const index=subscriberNotifications.push(0)-1
        stops.push(service.storage.onDidChange(({key})=>{assert.equal(key,'panel:draft');observations++;subscriberNotifications[index]++}))
      }
      const start=performance.now()
      try {
        for(let wave=0;wave<10;wave++){
          const pending=[]
          for(let i=0;i<4;i++)pending.push(queues[i].enqueue({scope:'storage',key:'panel:draft',value:`initial ${wave}`}))
          await new Promise(resolve=>setImmediate(resolve))
          for(let n=0;n<3000;n++)for(let i=0;i<4;i++)pending.push(queues[i].enqueue({scope:'storage',key:'panel:draft',value:`session-${i} wave-${wave} edit-${n} 日本語 🧪`}))
          maxPending=Math.max(maxPending,...queues.map(queue=>queue.snapshot().pending))
          await Promise.all(pending);await Promise.all(queues.map(queue=>queue.flush()))
        }
        for(let i=0;i<4;i++){const reopen=createServices({sessionId:`session-${i}`},dir);assert.equal(await reopen.storage.get('panel:draft'),`session-${i} wave-9 edit-2999 日本語 🧪`)}
        assert.equal(maxPending,2);assert.equal(writes,80);if(watchers){assert.equal(observations,240);assert.deepEqual(subscriberNotifications,Array(12).fill(20))}
        const result={watchers,sample,edits:120000,writes,maxPending,observations,subscriberNotifications,ms:+(performance.now()-start).toFixed(3),memory:process.memoryUsage(),isolatedFinalValues:true};report.typing.push(result);console.log('typing',JSON.stringify(result))
      }finally{for(const stop of stops)stop.dispose()}
    }
    for(let sample=1;sample<=3;sample++){
      const dir=join(root,`transactions-${sample}`),store=persistentStore(dir),history=Array.from({length:500},(_,id)=>({id,text:'Retained synthetic prompt '.repeat(10)}))
      await store.patch({history,counter:0});const start=performance.now(),workers=Array.from({length:4},(_,id)=>child(dir,'transactions',String(id)))
      await Promise.all(workers.map(worker=>message(worker,'done')))
      const values=await store.snapshot();assert.equal(values.counter,400);assert.deepEqual(values.history,history);for(let i=0;i<4;i++)assert.equal(values[`writer-${i}`],99)
      const result={sample,transactions:400,ms:+(performance.now()-start).toFixed(3),memory:process.memoryUsage(),allAcknowledged:true};report.transactions.push(result);console.log('transactions',JSON.stringify(result))
    }
    const dir=join(root,'interruption'),worker=child(dir,'interruption'),store=persistentStore(dir)
    await message(worker,'ack');const blocked=message(worker,'blocked');worker.send('continue');await blocked
    const exited=once(worker,'exit');worker.kill();await exited
    assert.equal(await store.get('acknowledged'),'Retain 日本語 🧪')
    console.log('interruption: acknowledged value intact; waiting for owned stale lock')
    await new Promise(resolve=>setTimeout(resolve,31000))
    await store.set('next','Recovery write');assert.equal(await store.get('acknowledged'),'Retain 日本語 🧪');assert.equal(await store.get('next'),'Recovery write')
    report.interruption={acknowledgedRetained:true,recoveryWrite:true,waitMs:31000,osPowerLoss:false}
    const repo=join(root,'repo');await mkdir(repo)
    const git=(...args)=>execFileSync('git',['-c','core.fsmonitor=false',...args],{cwd:repo,stdio:'pipe',windowsHide:true,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:join(root,'absent.gitconfig'),GIT_TEMPLATE_DIR:''}})
    git('init','-q');git('config','user.name','Synthetic fixture');git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false')
    for(let group=0;group<100;group++){const folder=join(repo,`module-${group}`);await mkdir(folder);await Promise.all(Array.from({length:100},(_,n)=>writeFile(join(folder,`file-${n}.ts`),`export const item${n}=true\n`)))}
    await writeFile(join(repo,'README.md'),'# Synthetic tracked project\n')
    await writeFile(join(repo,'long.ts'),Array.from({length:6000},(_,n)=>`export const value${n}=${n}\n`).join('')+'export const visibleEvidence="LONG_SOURCE_MARKER"\n')
    await writeFile(join(repo,'large.txt'),'baseline\n');await writeFile(join(repo,'image.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(1024*1024)]))
    git('add','.');git('-c','core.hooksPath=NUL','commit','-qm','Synthetic baseline')
    await writeFile(join(repo,'large.txt'),'Large changed line '.repeat(100)+'\n'+Array.from({length:25000},(_,n)=>`${n} ${'z'.repeat(96)}\n`).join(''))
    const workspace={id:'scale',name:'scale',path:repo,branch:'main',hostId:null},host=createWorkerHost(mockHost({results:{'workspace.readContext':{displayName:'scale',workspaceId:'scale'},'workspace.list':{workspaces:[workspace]}}}))
    try{for(let sample=1;sample<=3;sample++){
      const start=performance.now(),result=await gatherContext(host.api,{level:'deep',prompt:'Review `long.ts` LONG_SOURCE_MARKER and `large.txt`',terminalLines:0,exclude:new Set(),extraFiles:[],excludePatterns:'',allowTerminal:false,allowGit:true})
      const chars=result.items.reduce((sum,item)=>sum+item.chars,0);assert.ok(chars<=28000);assert.ok(!result.items.some(item=>item.id==='file:image.png'))
      assert.ok(result.items.some(item=>item.id==='file:long.ts'&&item.content.includes('LONG_SOURCE_MARKER')))
      assert.ok(result.items.some(item=>item.id==='git:diff'));assert.ok(result.notes.some(note=>note.code==='note.explicit_unreadable'),'large file read omission stays visible')
      const value={sample,ms:+(performance.now()-start).toFixed(3),chars,items:result.items.map(item=>({id:item.id,chars:item.chars})),notes:result.notes,memory:process.memoryUsage()};report.context.push(value);console.log('context',JSON.stringify(value))
    }}finally{await host.deactivate()}
    await writeFile('docs/audits/v1/concurrency-scale-measurements.json',JSON.stringify(report,null,2)+'\n')
  }finally{await Promise.all([...children].map(async child=>{const exited=once(child,'exit');child.kill();await exited}));assert.ok(root.startsWith(join(tmpdir(),'enhance-concurrency-scale-')));await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
}
