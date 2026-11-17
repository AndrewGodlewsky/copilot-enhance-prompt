// Compare overlapping production Standard gathers; no account, models or owner data.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import cp from 'node:child_process'
import {createRequire,syncBuiltinESMExports} from 'node:module'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import {gatherContext} from '../../src/context/index.ts'
import {mockHost} from '../../src/testing.ts'
import {createWorkerHost} from '../../src/worker-host.ts'
import {VERSION} from '../../src/version.ts'

const base='999bcc6f46df3c2963e946a8fa8d97a10ce0fd43', root=await mkdtemp(join(tmpdir(),'enhance-enumeration-scale-'))
const report={version:VERSION,at:new Date().toISOString(),baselineCommit:base,node:process.version,git:cp.execFileSync('git',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,syntheticOnly:true,modelCalls:0,
  method:'Three alternating samples of concurrent prior/current production Standard gathers over 1,001 and 30,001 tiny files; two and four simultaneous callers. Count real git ls-files launches and compare every emitted item. Fixture creation/bundling excluded. Endpoint memory is not peak RSS. Same extension process only; no sequential-cache speed claim.',sourceHashes:{},measurements:[]}
for(const path of ['src/context/enumeration.ts','src/context/index.ts','scripts/audit/context-enumeration.mjs']) report.sourceHashes[path]=createHash('sha256').update((await readFile(path,'utf8')).replaceAll('\r\n','\n')).digest('hex')
let listings=0
const original=cp.execFile
cp.execFile=function(file,args,...rest){if(file==='git'&&args.includes('ls-files'))listings++;return original.call(this,file,args,...rest)}
syncBuiltinESMExports()
const timed=async(label,count,owners,run)=>{listings=0;const start=performance.now(),result=await run();report.measurements.push({label,files:count+1,owners,ms:+(performance.now()-start).toFixed(3),listings,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss});assert.equal(listings,label==='current'?1:owners);return result}
try {
  const frozen=cp.execFileSync('git',['show',`${base}:src/context/index.ts`],{encoding:'utf8'})
  const compiled=await build({entryPoints:['src/context/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'frozen-baseline',setup(build){build.onLoad({filter:/[\\/]src[\\/]context[\\/]index\.ts$/},args=>args.path===resolve('src/context/index.ts')?{contents:frozen,loader:'ts'}:undefined)}}]})
  const baseline={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),baseline,baseline.exports)
  for(const count of [1000,30000]) {
    const project=join(root,String(count));await mkdir(project)
    for(let group=0;group<count/100;group++) {
      const folder=join(project,`module-${group}`);await mkdir(folder)
      for(let first=0;first<100;first+=20)await Promise.all(Array.from({length:20},(_,i)=>writeFile(join(folder,`source-${first+i}.ts`),'export const fixture = true\n')))
    }
    await writeFile(join(project,'README.md'),'# Synthetic project\n\n## Test\nUse the project test runner.\n')
    cp.execFileSync('git',['init','-q'],{cwd:project,windowsHide:true})
    const workspace={id:'audit',name:'audit',path:project,branch:null,hostId:null},host=createWorkerHost(mockHost({results:{'workspace.readContext':{displayName:'audit',branch:'',workspaceId:'audit'},'workspace.list':{workspaces:[workspace]}}})).api
    const options={level:'standard',prompt:'Explain this project',terminalLines:0,exclude:new Set(),extraFiles:[],excludePatterns:'',allowTerminal:false}
    for(const owners of [2,4])for(let sample=0;sample<3;sample++) {
      const prior=await timed('prior',count,owners,()=>Promise.all(Array.from({length:owners},()=>baseline.exports.gatherContext(host,options))))
      const current=await timed('current',count,owners,()=>Promise.all(Array.from({length:owners},()=>gatherContext(host,options))))
      for(let i=0;i<owners;i++){assert.deepEqual(current[i].items,prior[i].items);assert.deepEqual(current[i].notes,prior[i].notes)}
      console.log(`${count} files, ${owners} callers, sample ${sample+1}: every item verified`)
    }
  }
  report.everyContextItemVerified=true
  await writeFile('docs/audits/v1/context-enumeration-measurements.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report.measurements))
} finally {cp.execFile=original;syncBuiltinESMExports();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
