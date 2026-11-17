// Real installed SDK/CLI, private profiles and Git fixtures. No model calls or owner settings.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,writeFile,cp,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,resolve,relative,isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createRuntimeMarketplace,verifyRuntimeChannel} from './runtime-marketplace.mjs'
import {createServices} from '../src/copilot/services.ts'
import {createUsageRecorder} from '../src/copilot/usage.ts'
import {installationReader,parseCommentedJson} from '../src/copilot/update-installation.ts'
import {remoteMetadata,UpdateError} from '../src/updates/metadata.ts'

const sdk=process.env.COPILOT_SDK_DIR,cli=process.env.COPILOT_CLI_PATH
assert.ok(sdk&&cli&&isAbsolute(cli),'Set installed COPILOT_SDK_DIR and COPILOT_CLI_PATH')
const {CopilotClient,RuntimeConnection}=await import(pathToFileURL(join(sdk,'index.js')).href)
const sourceRoot=resolve(import.meta.dirname,'..'),root=await mkdtemp(join(tmpdir(),'enhance-channel-e2e-'))
const repo=join(root,'repo'),project=join(root,'project'),gitConfig=join(root,'gitconfig'),repository='AndrewGodlewsky/copilot-enhance-prompt'
const env={...process.env,HOME:root,USERPROFILE:root,APPDATA:join(root,'appdata'),LOCALAPPDATA:join(root,'local'),GIT_CONFIG_GLOBAL:gitConfig,GIT_CONFIG_NOSYSTEM:'1',COPILOT_AUTO_UPDATE:'false',COPILOT_TELEMETRY_DISABLED:'true',COPILOT_OTEL_ENABLED:'false',CI:'1'}
for(const key of Object.keys(env))if(/TOKEN|API_KEY|OTEL_EXPORTER|COPILOT_PROVIDER/i.test(key))delete env[key]
delete env.ENHANCE_PROMPT_DATA_DIR
const git=(...args)=>execFileSync('git',args,{cwd:repo,env,encoding:'utf8',windowsHide:true,timeout:30_000,maxBuffer:32*1024*1024}).trim()
const hash=value=>createHash('sha256').update(value).digest('hex')
const clients=[],results={fixture:true,modelCalls:0,checks:[]},target='enhance-prompt@copilot-enhance-prompt'
const guard=path=>{const part=relative(root,resolve(path));assert.ok(part&&!part.startsWith('..')&&!isAbsolute(part));return path}
async function snapshot(path){
 const files={};async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const p=join(dir,entry.name);assert.ok(!entry.isSymbolicLink());if(entry.isDirectory())await visit(p);else files[relative(path,p).replaceAll('\\','/')]=hash(await readFile(p))}}
 await visit(path);return files
}
async function session(home){
 await mkdir(home)
 const client=new CopilotClient({mode:'empty',baseDirectory:home,workingDirectory:project,env:{...env,COPILOT_HOME:home},useLoggedInUser:false,builtinPluginDirectories:[],logLevel:'error',connection:RuntimeConnection.forStdio({path:cli,args:['--no-auto-update']})})
 clients.push(client);await client.start()
 return client.createSession({workingDirectory:project,availableTools:[],model:'fixture',provider:{type:'openai',baseUrl:'http://127.0.0.1:1',apiKey:'fixture'}})
}
async function installed(home,session,report){
 const records=parseCommentedJson(await readFile(join(home,'config.json'),'utf8')).installedPlugins
 const record=records.find(row=>row.name==='enhance-prompt');assert.ok(record);assert.equal(record.marketplace,'copilot-enhance-prompt')
 const cache=guard(record.cache_path),files=await snapshot(cache)
 assert.deepEqual(Object.keys(files).sort(),[...report.files.map(file=>file.path),'channel.json'].sort())
 for(const file of report.files)assert.equal(files[file.path],file.sha256)
 const state=await installationReader(session,cache)();assert.equal(state.canUpdate,true);assert.equal(state.target,target)
 assert.equal(state.source.ref,'runtime-preview');assert.equal(state.marketplace.ref,'runtime-preview')
 return {cache,state}
}
const timer=setTimeout(()=>{for(const client of clients)void client.forceStop()},180_000)
try{
 await mkdir(repo);await mkdir(project);await writeFile(gitConfig,'')
 const published=process.argv.indexOf('--published-source')
 if(published>=0){
  const expected=process.argv[published+1];assert.match(expected??'',/^[a-f0-9]{40}$/)
  const trusted=await createRuntimeMarketplace({repo:sourceRoot,commit:expected,output:join(root,'trusted-channel'),repository})
  const home=join(root,'public'),attached=await session(home)
  await attached.rpc.plugins.marketplaces.add({source:`${repository}#runtime-preview`});await attached.rpc.plugins.install({source:target})
  const record=parseCommentedJson(await readFile(join(home,'config.json'),'utf8')).installedPlugins.find(row=>row.name==='enhance-prompt')
  const marker=JSON.parse(await readFile(join(guard(record.cache_path),'channel.json'),'utf8'));verifyRuntimeChannel(marker,trusted)
  const current=await installed(home,attached,trusted);assert.equal((await remoteMetadata()(current.state)).version,marker.version)
  execFileSync(process.execPath,[join(sourceRoot,'scripts/e2e.mjs')],{cwd:current.cache,env:{...env,COPILOT_HOME:home},windowsHide:true,timeout:90_000,maxBuffer:4*1024*1024})
  console.log(JSON.stringify({publicGitHub:true,modelCalls:0,sourceCommit:expected,version:marker.version,files:marker.files.length+1,checks:['published branch exact files and source','actual inventory and selected-branch update metadata','built canvas/context/privacy/sending fixture']},null,2))
 }else{
 const inventory=JSON.parse(await readFile(join(sourceRoot,'runtime-inventory.json'),'utf8'))
 for(const file of [...inventory.artifacts.map(f=>f.path),'runtime-inventory.json','THIRD_PARTY_NOTICES.md','INSTALL.md','CHANGELOG.md','.github/plugin/marketplace.json']){
  await mkdir(dirname(join(repo,file)),{recursive:true});await cp(join(sourceRoot,file),join(repo,file))
 }
 await mkdir(join(repo,'src'));await writeFile(join(repo,'src/development-only.txt'),'omit this source fixture')
 git('init','-q','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');git('config','core.autocrlf','false')
 git('add','.');git('-c','commit.gpgsign=false','commit','-qm','built source fixture')
 const initial=await createRuntimeMarketplace({repo,output:join(root,'channel-one')});git('update-ref','refs/heads/runtime-preview',initial.commit)
 // Only Git subprocesses in these private profiles see this rewrite. Actual GitHub sources/provenance are parsed by Copilot.
 for(const url of [`https://github.com/${repository}.git`,`https://github.com/${repository}`])git('config','--file',gitConfig,'--add',`url.${pathToFileURL(repo).href}.insteadOf`,url)
 git('config','--file',gitConfig,'protocol.file.allow','always');git('config','--file',gitConfig,'credential.helper','')
 const freshHome=join(root,'fresh'),fresh=await session(freshHome)
 await fresh.rpc.plugins.marketplaces.add({source:`${repository}#runtime-preview`});await fresh.rpc.plugins.install({source:target})
 await installed(freshHome,fresh,initial);results.checks.push('fresh exact runtime-only marketplace installation')
 const home=join(root,'migration'),attached=await session(home)
 await attached.rpc.plugins.marketplaces.add({source:`${repository}#main`});await attached.rpc.plugins.install({source:target})
 const beforeSource=parseCommentedJson(await readFile(join(home,'config.json'),'utf8')).installedPlugins.find(row=>row.name==='enhance-prompt')
 assert.equal(await readFile(join(guard(beforeSource.cache_path),'src/development-only.txt'),'utf8'),'omit this source fixture')
 const unrelated=join(root,'unrelated');await mkdir(unrelated);await writeFile(join(unrelated,'plugin.json'),JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:'unrelated-fixture',version:'1.0.0'}))
 await attached.rpc.plugins.install({source:unrelated})
 const unrelatedBefore=(await attached.rpc.plugins.list()).plugins.find(row=>row.name==='unrelated-fixture')
 const data=join(env.LOCALAPPDATA,'copilot-enhance-prompt'),services=createServices(attached,data)
 await services.settings.get();await services.settings.set('chatTextSize','large')
 for(const [key,value] of Object.entries({'panel:draft':'Keep 日本語 request 🧪','panel:result':'Keep reviewed output',history:[{id:'fixture',at:1,original:'Keep original',enhanced:'Keep enhanced',style:'balanced',model:'fixture',source:'panel'}],models:{profiles:[]},rules:[{id:'fixture',text:'Keep saved rule'}],'panel:attachments':[{name:'fixture.txt',path:join(data,'uploads/fixture.txt')}]}))await services.storage.set(key,value)
 await mkdir(join(data,'uploads'),{recursive:true});await writeFile(join(data,'uploads/fixture.txt'),'Keep attached bytes')
 const usage=join(data,'usage'),recorder=await createUsageRecorder('12345678-1234-4234-8234-123456789abc',usage)
 recorder.record({type:'assistant.usage',id:'fixture',timestamp:'2026-11-17T00:00:00Z',data:{model:'fixture',inputTokens:3,outputTokens:4,copilotUsage:{totalNanoAiu:10}}});await recorder.flush()
 const retained=await snapshot(data),receipts=await snapshot(usage)
 // The installed runtime refuses an implicit source replacement and non-forced marketplace removal.
 await assert.rejects(attached.rpc.plugins.marketplaces.add({source:`${repository}#runtime-preview`}),/already registered/)
 const blocked=await attached.rpc.plugins.marketplaces.remove({name:'copilot-enhance-prompt'})
 assert.equal(blocked.removed,false);assert.ok(blocked.dependentPlugins.some(name=>name.includes('enhance-prompt')))
 assert.equal((await attached.rpc.plugins.list()).plugins.find(row=>row.name==='enhance-prompt').version,inventory.version)
 // An explicit switch only removes this fixture plugin's installation, never its separate data.
 await attached.rpc.plugins.uninstall({name:target})
 assert.equal((await attached.rpc.plugins.marketplaces.remove({name:'copilot-enhance-prompt'})).removed,true)
 await attached.rpc.plugins.marketplaces.add({source:`${repository}#runtime-preview`})
 await attached.rpc.plugins.install({source:target})
 const migrated=await installed(home,attached,initial)
 assert.deepEqual(await snapshot(data),retained);assert.deepEqual(await snapshot(usage),receipts)
 assert.deepEqual((await attached.rpc.plugins.list()).plugins.find(row=>row.name==='unrelated-fixture'),unrelatedBefore)
 results.checks.push('implicit source replacement/removal refused; explicit reinstall preserves exact synthetic data')
 const manifest=JSON.parse(await readFile(join(repo,'plugin.json'),'utf8'));manifest.version='99.0.0'
 const bytes=JSON.stringify(manifest)+'\n';await writeFile(join(repo,'plugin.json'),bytes);inventory.version=manifest.version
 Object.assign(inventory.artifacts.find(f=>f.path==='plugin.json'),{bytes:Buffer.byteLength(bytes),sha256:hash(bytes)})
 await writeFile(join(repo,'runtime-inventory.json'),JSON.stringify(inventory));git('add','.');git('-c','commit.gpgsign=false','commit','-qm','synthetic next metadata version')
 const next=await createRuntimeMarketplace({repo,previous:initial.commit,output:join(root,'channel-two')});git('update-ref','refs/heads/runtime-preview',next.commit,initial.commit)
 const read=async(url,head)=>{
  if(url.includes('/git/ref/tags/'))throw new UpdateError('No fixture tag','not_found')
  if(url.includes('/git/ref/heads/'))return {object:{sha:next.commit,type:'commit'}}
  if(head)return true
  const path=new URL(url).pathname.split('/').slice(4).join('/');return JSON.parse(git('show',`${next.commit}:${path}`))
 }
 assert.equal((await remoteMetadata(read)(migrated.state)).version,'99.0.0')
 await attached.rpc.plugins.update({name:target});await installed(home,attached,next)
 assert.deepEqual(await snapshot(data),retained);assert.deepEqual(await snapshot(usage),receipts)
 assert.deepEqual((await attached.rpc.plugins.list()).plugins.find(row=>row.name==='unrelated-fixture'),unrelatedBefore)
 results.checks.push('attached-session update follows selected runtime branch; exact payload and retained data')
 const reopened=createServices(attached,data);assert.equal(await reopened.storage.get('panel:draft'),'Keep 日本語 request 🧪');assert.equal(await reopened.settings.get('chatTextSize'),'large')
 results.files=initial.fileCount;results.packageBytes=initial.packageBytes;results.sourceFiles=initial.sourceFiles;results.sourceBytes=initial.sourceBytes
 results.pluginVersion=inventory.version==='99.0.0'?initial.version:inventory.version
 results.sourceHashes=Object.fromEntries(await Promise.all(['scripts/runtime-marketplace.mjs','scripts/e2e-runtime-marketplace.mjs','scripts/runtime-package.mjs'].map(async file=>[file,hash(Buffer.from((await readFile(join(sourceRoot,file),'utf8')).replaceAll('\r\n','\n')))])))
 results.runtime=execFileSync(cli,['--version'],{env,encoding:'utf8',windowsHide:true,timeout:15_000}).trim().split(/\r?\n/)[0]
 console.log(JSON.stringify(results,null,2))
 }
}finally{
 clearTimeout(timer);for(const client of clients)await client.forceStop()
 const part=relative(resolve(tmpdir()),root);assert.ok(part&&!part.startsWith('..')&&!isAbsolute(part));await rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:100})
}
