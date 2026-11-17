import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import {join,isAbsolute,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {VERSION} from '../src/version.ts'
// Observation only: accepted unauthenticated sessions do not prove managed policy.
const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('probe-timeout')),15000)})])}finally{clearTimeout(timer)}}
const {COPILOT_SDK_DIR:dir,COPILOT_CLI_PATH:path}=process.env
assert.ok(dir&&path&&isAbsolute(path)&&/^(copilot|copilot-runtime)(\.exe)?$/i.test(basename(path)))
const sdk=await import(pathToFileURL(join(dir,'index.js')).href)
const root=await mkdtemp(join(tmpdir(),'enhance-managed-probe-'))
let client
try{
 const workspace=join(root,'workspace'),home=join(root,'home');await mkdir(workspace);await mkdir(home)
 const env=Object.fromEntries(Object.entries(process.env).filter(([key,value])=>/^(SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|LANG|LC_ALL)$/i.test(key)&&typeof value==='string'))
 Object.assign(env,{PATH:'',HOME:home,USERPROFILE:home,APPDATA:home,LOCALAPPDATA:home,XDG_CONFIG_HOME:home,XDG_CACHE_HOME:home,TEMP:root,TMP:root,GH_CONFIG_DIR:home,COPILOT_HOME:home,COPILOT_TELEMETRY_DISABLED:'true',HTTP_PROXY:'http://127.0.0.1:9',HTTPS_PROXY:'http://127.0.0.1:9',ALL_PROXY:'http://127.0.0.1:9'})
 client=new sdk.CopilotClient({mode:'empty',workingDirectory:workspace,baseDirectory:home,env,useLoggedInUser:false,logLevel:'error',builtinPluginDirectories:[],connection:sdk.RuntimeConnection.forStdio({path,args:['--no-auto-update']})})
 await bounded(client.start())
 const runtime=execFileSync(path,['--version'],{env,encoding:'utf8',windowsHide:true,timeout:15000}).trim().split(/\r?\n/)[0]
 const declarationHash=createHash('sha256').update(await readFile(join(dir,'types.d.ts'))).digest('hex')
 const report={pluginVersion:VERSION,node:process.version,platform:process.platform,runtime,declarationHash,inferenceCalls:0,credentialsSupplied:false,loggedInFallback:false,results:[]}
 for(const enabled of [false,true]){
  let session
  try{
   session=await bounded(client.createSession({workingDirectory:workspace,configDirectory:home,availableTools:[],onPermissionRequest:()=>({kind:'denied-by-rules',rules:[]}),requestExtensions:false,requestCanvasRenderer:false,pluginDirectories:[],mcpServers:{},enableConfigDiscovery:false,skipCustomInstructions:true,enableSkills:false,enableFileHooks:false,enableOnDemandInstructionDiscovery:false,enableSessionStore:false,enableHostGitOperations:false,skipEmbeddingRetrieval:true,embeddingCacheStorage:'in-memory',enableSessionTelemetry:false,memory:{enabled:false},skillDirectories:[],agentDirectories:[],instructionDirectories:[],hookDirectories:[],infiniteSessions:{enabled:false},enableManagedSettings:enabled,enforceManagedModelDefaults:true}))
  }catch(error){
   if(String(error).includes('probe-timeout'))throw Error('Session creation timed out; no compatibility result')
   report.results.push({managedSettings:enabled,sessionCreated:false,classification:/gitHubToken|github.token/i.test(String(error))?'token-required':/auth|credential|login/i.test(String(error))?'authentication-required':'other-rejection'})
  }
  if(session){
   const auth=await bounded(session.rpc.gitHubAuth.getStatus());assert.equal(auth.isAuthenticated,false,'Credential-free probe must never authenticate')
   report.results.push({managedSettings:enabled,sessionCreated:true,authenticated:false})
  }
 }
 console.log(JSON.stringify(report,null,2))
}finally{
 // Failed stop retains only this synthetic root; never delete files beneath a live client.
 if(client)await bounded(client.forceStop())
 assert.ok(root.startsWith(join(tmpdir(),'enhance-managed-probe-')))
 await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})
}
