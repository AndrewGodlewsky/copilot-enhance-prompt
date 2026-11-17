import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve,relative,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
import {createRuntimePackage} from './runtime-package.mjs'
import {createRuntimeMarketplace,verifyRuntimeChannel} from './runtime-marketplace.mjs'

const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
test('runtime marketplace has separate history, exact verified payloads and safe monotonic successors',async()=>{
 const root=await mkdtemp(join(tmpdir(),'enhance-channel-test-')),repo=join(root,'repo')
 const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',windowsHide:true}).trim()
 const commit=message=>{git('add','.');git('-c','commit.gpgsign=false','commit','-qm',message);return git('rev-parse','HEAD')}
 try{
  const packed=await createRuntimePackage({repo:resolve(import.meta.dirname,'..'),output:join(root,'input')})
  await mkdir(repo);execFileSync('tar',['-xf',packed.archive,'-C',repo],{windowsHide:true})
  await mkdir(join(repo,'.github/plugin'),{recursive:true})
  const catalog=JSON.stringify({name:'copilot-enhance-prompt',owner:{name:'Fixture'},plugins:[{name:'enhance-prompt',source:'./'}]})
  await writeFile(join(repo,'.github/plugin/marketplace.json'),catalog)
  await mkdir(join(repo,'src'));await writeFile(join(repo,'src/private.txt'),'must not ship')
  git('init','-q','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false')
  const source=commit('source fixture'),index=git('write-tree')
  await writeFile(join(repo,'untracked.txt'),'must not ship either')
  const first=await createRuntimeMarketplace({repo,commit:source,output:join(root,'first'),repository:'fixture/fork'})
  assert.equal(git('rev-parse','HEAD'),source);assert.equal(git('write-tree'),index)
  assert.equal(git('show','-s','--format=%P',first.commit),'')
  assert.equal(spawnSync('git',['merge-base','--is-ancestor',source,first.commit],{cwd:repo}).status,1)
  const names=git('ls-tree','-r','--name-only',first.commit).split('\n')
  assert.deepEqual(names.sort(),[...packed.report.files.map(file=>file.path),'.github/plugin/marketplace.json','channel.json'].sort())
  assert.equal(git('show',`${first.commit}:.github/plugin/marketplace.json`),catalog)
  const manifest=JSON.parse(git('show',`${first.commit}:channel.json`));assert.equal(manifest.sourceCommit,source);assert.equal(manifest.repository,'fixture/fork')
  verifyRuntimeChannel(manifest,first)
  const forged=structuredClone(manifest),altered=forged.files.find(file=>file.path.endsWith('extension.mjs'))
  const replacement=Buffer.from('throw new Error("unexpected executable payload")')
  Object.assign(altered,{bytes:replacement.length,sha256:hash(replacement)})
  // A channel can claim the right source and hashes for its altered payload; trust the source packager instead.
  assert.equal(forged.sourceCommit,first.sourceCommit)
  assert.throws(()=>verifyRuntimeChannel(forged,first),/trusted source/)
  for(const file of packed.report.files)assert.equal(hash(execFileSync('git',['show',`${first.commit}:${file.path}`],{cwd:repo})),file.sha256)
  await assert.rejects(createRuntimeMarketplace({repo,commit:source,previous:first.commit,output:join(root,'same'),repository:'fixture/fork'}),/newer version/)
  await assert.rejects(createRuntimeMarketplace({repo,commit:source,previous:source,output:join(root,'bad-parent'),repository:'fixture/fork'}),/channel|history/i)
  await assert.rejects(createRuntimeMarketplace({repo,commit:source,previous:first.commit,output:join(root,'wrong-fork'),repository:'other/fork'}),/repository/)
  const plugin=JSON.parse(await readFile(join(repo,'plugin.json'),'utf8'));plugin.version='99.1.0'
  const bytes=JSON.stringify(plugin)+'\n';await writeFile(join(repo,'plugin.json'),bytes)
  const inventory=JSON.parse(await readFile(join(repo,'runtime-inventory.json'),'utf8'));inventory.version=plugin.version
  Object.assign(inventory.artifacts.find(file=>file.path==='plugin.json'),{bytes:Buffer.byteLength(bytes),sha256:hash(bytes)})
  await writeFile(join(repo,'runtime-inventory.json'),JSON.stringify(inventory));const newer=commit('next source')
  const next=await createRuntimeMarketplace({repo,commit:newer,previous:first.commit,output:join(root,'next'),repository:'fixture/fork'})
  assert.equal(git('show','-s','--format=%P',next.commit),first.commit)
  assert.equal(git('rev-list','--count',next.commit),'2');assert.equal(git('rev-parse','HEAD'),newer)
  await writeFile(join(repo,'.github/plugin/marketplace.json'),catalog.replace('"./"','"./different"'));const redirected=commit('unexpected catalog')
  await assert.rejects(createRuntimeMarketplace({repo,commit:redirected,output:join(root,'redirected'),repository:'fixture/fork'}),/catalog/i)
 }finally{const part=relative(resolve(tmpdir()),root);assert.ok(part&&!part.startsWith('..')&&!isAbsolute(part));await rm(root,{recursive:true,force:true})}
})
