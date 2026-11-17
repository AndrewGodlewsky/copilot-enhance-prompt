// Maintainer-only preparation: writes an unreachable Git commit, never a ref or installation.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,relative,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {createRuntimePackage} from './runtime-package.mjs'
import {compareVersions} from '../src/updates/version.ts'

const catalogPath='.github/plugin/marketplace.json',channel='runtime-preview'
const hash=value=>createHash('sha256').update(value).digest('hex')
const allowed=path=>['plugin.json','assets/icon.svg','LICENSE','THIRD_PARTY_NOTICES.md','runtime-inventory.json','INSTALL.md','CHANGELOG.md',catalogPath].includes(path)||path.startsWith('com.github.copilot/extensions/enhance-prompt/')

export function verifyRuntimeChannel(marker,expected){
 const {schema,channel,repository,sourceCommit,version,files}=expected
 assert.deepEqual(marker,{schema,channel,repository,sourceCommit,version,files},'Downloaded channel differs from trusted source package')
}

export async function createRuntimeMarketplace({repo=process.cwd(),commit='HEAD',previous,output,repository='AndrewGodlewsky/copilot-enhance-prompt'}={}){
 assert.ok(output,'Choose a new output directory');assert.match(repository,/^[\w-]+\/[\w.-]+$/);assert.ok(!repository.includes('..'))
 const git=(args,options={})=>execFileSync('git',args,{cwd:repo,windowsHide:true,timeout:30_000,maxBuffer:32*1024*1024,...options})
 const text=(args,options)=>git(args,options).toString('utf8').trim()
 const sha=text(['rev-parse','--verify','--end-of-options',`${commit}^{commit}`]);assert.match(sha,/^[a-f0-9]{40}$/)
 const temp=await mkdtemp(join(tmpdir(),'enhance-channel-'))
 try{
  const packed=await createRuntimePackage({repo,commit:sha,output:join(temp,'package')})
  const catalog=git(['show',`${sha}:${catalogPath}`]),parsed=JSON.parse(catalog)
  assert.ok(parsed.name==='copilot-enhance-prompt'&&parsed.plugins?.length===1&&parsed.plugins[0].name==='enhance-prompt'&&parsed.plugins[0].source==='./','Review changed marketplace catalog before publishing')
  let parent
  if(previous){
   parent=text(['rev-parse','--verify','--end-of-options',`${previous}^{commit}`]);assert.match(parent,/^[a-f0-9]{40}$/)
   const history=text(['rev-list','--parents',parent]).split('\n');assert.ok(history.length<=1000,'Review channel history before extending beyond 1000 releases')
   for(const line of history){
    const [id,...parents]=line.split(' ');assert.ok(parents.length<=1,'Channel history must not merge source history')
    let marker;try{marker=JSON.parse(git(['show',`${id}:channel.json`]))}catch{throw Error('Previous history is not a runtime channel')}
    assert.ok(marker.schema===1&&marker.channel===channel&&marker.repository===repository,'Previous channel repository/identity differs')
    assert.match(marker.sourceCommit,/^[a-f0-9]{40}$/)
    assert.ok(Array.isArray(marker.files)&&marker.files.length<=200&&marker.files.every(file=>typeof file.path==='string'&&/^[\w./-]+$/.test(file.path)&&!file.path.split('/').includes('..')&&allowed(file.path)),'Channel history contains unexpected files')
    const tree=text(['ls-tree','-r',id]).split('\n').map(row=>{const match=/^100(?:644|755) blob [a-f0-9]{40}\t(.+)$/.exec(row);assert.ok(match,'Channel history must contain regular files');return match[1]})
    assert.deepEqual(tree.sort(),[...marker.files.map(file=>file.path),'channel.json'].sort(),'Channel history contains undeclared files')
    if(id===parent){
     for(const file of marker.files)assert.equal(hash(git(['show',`${id}:${file.path}`])),file.sha256,'Previous channel bytes differ')
     assert.equal(JSON.parse(git(['show',`${id}:plugin.json`])).version,marker.version,'Previous channel version differs')
     assert.equal(compareVersions(packed.report.version,marker.version),1,'Publish a newer version; never replace same-version channel bytes')
    }
   }
  }
  const files=[...packed.report.files,{path:catalogPath,bytes:catalog.length,sha256:hash(catalog)}].sort((a,b)=>a.path.localeCompare(b.path,'en'))
  const marker={schema:1,channel,repository,sourceCommit:sha,version:packed.report.version,files}
  const markerBytes=Buffer.from(JSON.stringify(marker,null,2)+'\n'),env={...process.env,GIT_INDEX_FILE:join(temp,'index')}
  text(['read-tree','--empty'],{env})
  for(const file of [...files,{path:'channel.json'}]){
   const bytes=file.path==='channel.json'?markerBytes:file.path===catalogPath?catalog:git(['show',`${sha}:${file.path}`])
   const blob=text(['hash-object','-w','--stdin'],{input:bytes})
   text(['update-index','--add','--cacheinfo',`100644,${blob},${file.path}`],{env})
  }
  const tree=text(['write-tree'],{env}),date=text(['show','-s','--format=%cI',sha])
  const candidate=text(['-c','commit.gpgsign=false','commit-tree',tree,...(parent?['-p',parent]:[]),'-m',`Runtime ${packed.report.version}\n\nSource: https://github.com/${repository}/commit/${sha}`],{env:{...process.env,GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}})
  const report={...marker,commit:candidate,...(parent?{parent}:{}),fileCount:files.length+1,packageBytes:files.reduce((sum,file)=>sum+file.bytes,markerBytes.length),sourceFiles:packed.report.sourceFiles,sourceBytes:packed.report.sourceBytes}
  await mkdir(resolve(output),{recursive:false});await writeFile(join(output,'channel-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  return report
 }finally{const part=relative(resolve(tmpdir()),temp);assert.ok(part&&!part.startsWith('..')&&!isAbsolute(part));await rm(temp,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [commit,output,previous,repository]=process.argv.slice(2)
 assert.ok(commit&&output,'Usage: node scripts/runtime-marketplace.mjs SOURCE_COMMIT NEW_OUTPUT [PREVIOUS_CHANNEL_COMMIT] [OWNER/REPO]')
 console.log(JSON.stringify(await createRuntimeMarketplace({commit,output,previous:previous==='-'?undefined:previous,repository}),null,2))
}
