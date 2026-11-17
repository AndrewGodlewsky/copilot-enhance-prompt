// Disposable 30k-file comparison of the prior and current production gather paths.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import {gitGrepCounts,gitGrepCount} from '../../src/context/git.ts'
import {gatherContext,cachedStatic} from '../../src/context/index.ts'
import {mockHost} from '../../src/testing.ts'
import {createWorkerHost} from '../../src/worker-host.ts'
import {VERSION} from '../../src/version.ts'

const base='ef6f55ccefe8a3ecc015377777c5e6e30bb8eeb4', root=await mkdtemp(join(tmpdir(),'enhance-context-search-scale-'))
const report={version:VERSION,at:new Date().toISOString(),baselineCommit:base,node:process.version,git:execFileSync('git',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,syntheticOnly:true,modelCalls:0,
  method:'Three alternating samples of prior/current production search and full Deep gather over 30,001 tiny files. Fixture creation/bundling excluded. Both use their production time/output budgets. Compare every keyword count and every emitted context item. No browser/model; endpoint memory is not peak RSS.',sourceHashes:{},measurements:[]}
for(const path of ['src/context/git.ts','src/context/index.ts','scripts/audit/context-search.mjs']) report.sourceHashes[path]=createHash('sha256').update((await readFile(path,'utf8')).replaceAll('\r\n','\n')).digest('hex')
const timed=async(label,run)=>{const start=performance.now(),result=await run();report.measurements.push({label,ms:+(performance.now()-start).toFixed(3),heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss});return result}
try {
  const project=join(root,'project');await mkdir(project)
  for(let group=0;group<100;group++) {
    const folder=join(project,`module-${group}`);await mkdir(folder)
    for(let first=0;first<300;first+=30) await Promise.all(Array.from({length:30},(_,offset)=>{
      const n=group*300+first+offset
      return writeFile(join(folder,`source-${n}.ts`),`export function validateSession${n}() { return ${n} }\n// Synthetic context fixture\n`)
    }))
  }
  await writeFile(join(project,'README.md'),'# Synthetic project\n\n## Test\nUse the project test runner.\n')
  execFileSync('git',['init','-q'],{cwd:project,windowsHide:true})
  const baselineSources=new Map(['src/context/index.ts','src/context/git.ts'].map(path=>[resolve(path),execFileSync('git',['show',`${base}:${path}`],{encoding:'utf8',maxBuffer:4_000_000})]))
  const compiled=await build({entryPoints:['src/context/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'frozen-baseline',setup(build){build.onLoad({filter:/[\\/]src[\\/]context[\\/](index|git)\.ts$/},args=>baselineSources.has(args.path)?{contents:baselineSources.get(args.path),loader:'ts'}:undefined)}}]})
  const baseline={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),baseline,baseline.exports)
  const workspace={id:'audit',name:'audit',path:project,branch:null,hostId:null},host=createWorkerHost(mockHost({results:{'workspace.readContext':{displayName:'audit',branch:'',workspaceId:'audit'},'workspace.list':{workspaces:[workspace]}}})).api
  const words=['validateSession14999','session14999','synthetic','source','investigate']
  const options={level:'deep',prompt:'Investigate validateSession14999 source-14999.ts',terminalLines:0,exclude:new Set(),extraFiles:[],excludePatterns:'',allowTerminal:false}
  for(let n=0;n<3;n++) {
    const prior=await timed('search.prior',()=>Promise.all(words.map(word=>gitGrepCount(project,word))))
    const current=await timed('search.current',()=>gitGrepCounts(project,words))
    assert.equal(current.unavailable,false);assert.equal(current.limited,false);assert.deepEqual(current.counts,prior)
    const oldGather=await timed('gather.prior',()=>baseline.exports.gatherContext(host,options))
    const newGather=await timed('gather.current',()=>gatherContext(host,options))
    assert.deepEqual(newGather.items,oldGather.items)
    assert.deepEqual(newGather.notes,oldGather.notes)
    assert.equal(cachedStatic(project).files.length,30001)
    assert.ok(newGather.items.some(item=>item.id==='file:module-49/source-14999.ts'))
    console.log(`sample ${n+1}: every count and emitted context item matches`)
  }
  report.everyKeywordAndContextItemVerified=true
  await writeFile('docs/audits/v1/context-search-measurements.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report.measurements))
} finally {await rm(root,{recursive:true,force:true})}
