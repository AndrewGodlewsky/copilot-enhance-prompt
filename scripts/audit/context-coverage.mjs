import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {build} from 'esbuild'
import {gatherContext} from '../../src/context/index.ts'
import {mockHost} from '../../src/testing.ts'
import {createWorkerHost} from '../../src/worker-host.ts'
import {VERSION} from '../../src/version.ts'

const baselineCommit='190ee12600160be9345ac43f3379955f87d1eb70',root=await mkdtemp(join(tmpdir(),'enhance-coverage-scale-'))
const report={version:VERSION,baselineCommit,at:new Date().toISOString(),node:process.version,platform:process.platform,syntheticOnly:true,modelCalls:0,files:30001,
  method:'Three alternating production Deep gathers on a non-Git 30,001-file project. First sample cold within process; later samples warm. Fixture creation/bundling excluded. Target explicitly named beyond the 8,000-file traversal cap. No increased payload budget. RSS/heap at completion are not peaks.',sourceHashes:{},samples:[]}
const paths=['index','enumeration','files','git','search','relevance'].map(name=>`src/context/${name}.ts`)
for(const path of [...paths,'scripts/audit/context-coverage.mjs'])report.sourceHashes[path]=createHash('sha256').update((await readFile(path,'utf8')).replaceAll('\r\n','\n')).digest('hex')
try{
  const sources=new Map(paths.map(path=>[resolve(path),execFileSync('git',['show',`${baselineCommit}:${path}`],{encoding:'utf8'})]))
  const compiled=await build({entryPoints:['src/context/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',plugins:[{name:'baseline',setup(build){build.onLoad({filter:/[\\/]src[\\/]context[\\/].*\.ts$/},args=>sources.has(args.path)?{contents:sources.get(args.path),loader:'ts'}:undefined)}}]})
  const baseline={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),baseline,baseline.exports)
  for(let group=0;group<50;group++){
    const folder=join(root,`module-${String(group).padStart(2,'0')}`);await mkdir(folder)
    for(let start=0;start<600;start+=30)await Promise.all(Array.from({length:30},(_,i)=>writeFile(join(folder,`source-${String(start+i).padStart(3,'0')}.ts`),`export const fixture${group}_${start+i} = true\n`)))
  }
  await writeFile(join(root,'README.md'),'# Fixture\nSynthetic project overview.\n')
  const target='module-49/source-599.ts'
  await writeFile(join(root,target),'export const evidence = "EXPLICIT_TARGET_FOUND"\n')
  const workspace={id:'audit',name:'audit',path:root,branch:null,hostId:null},host=createWorkerHost(mockHost({results:{'workspace.readContext':{displayName:'audit',branch:'',workspaceId:'audit'},'workspace.list':{workspaces:[workspace]}}})).api
  const options={level:'deep',prompt:`Inspect \`${target}\``,terminalLines:0,exclude:new Set(),extraFiles:[],excludePatterns:'',allowTerminal:false,allowGit:false}
  for(let sample=0;sample<3;sample++)for(const [label,gather]of [['prior',baseline.exports.gatherContext],['current',gatherContext]]){
    const started=performance.now(),result=await gather(host,options),ms=performance.now()-started
    const found=result.items.some(item=>item.id===`file:${target}`&&item.content.includes('EXPLICIT_TARGET_FOUND')),chars=result.items.reduce((sum,item)=>sum+item.chars,0)
    assert.equal(found,label==='current');assert.ok(chars<=28000)
    if(label==='current')assert.ok(result.notes.some(note=>note.code==='note.discovery_partial'))
    report.samples.push({sample:sample+1,label,ms:+ms.toFixed(3),targetFound:found,chars,notes:result.notes,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss})
    console.log(`${label} ${sample+1}: target=${found}, chars=${chars}, ms=${ms.toFixed(1)}`)
  }
  const excluded=await gatherContext(host,{...options,excludePatterns:'module-49/'})
  assert.ok(!excluded.items.some(item=>item.content.includes('EXPLICIT_TARGET_FOUND')))
  report.exclusionVerified=true
  await writeFile('docs/audits/v1/context-coverage-measurements.json',JSON.stringify(report,null,2)+'\n')
}finally{await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
