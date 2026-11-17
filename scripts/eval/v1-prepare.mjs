// Offline only: no provider runner, credentials, model calls or production settings.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {buildRewriteSystemPrompt} from '../../src/prompt-sets.ts'
import {buildUserMessage} from '../../src/prompts.ts'
import {VERSION} from '../../src/version.ts'
import {openLedger,planGeneration,hash} from './ledger.mjs'
import {cases} from './v1-cases.mjs'

export function prepareV1(){
 const targets={low:{model:'claude-haiku-5-5',reasoning:'max'},medium:{model:'gpt-6.1-sol',reasoning:'high'},high:{model:'claude-opus-5-5',reasoning:'medium'}}
 return cases.flatMap(fixture=>Object.entries(targets).flatMap(([tier,target])=>[false,true].map(enhanced=>{
  const context=[{kind:'source',label:'Synthetic evidence',content:fixture.context}],candidate=enhanced?'enhanced':'original'
  const system=buildRewriteSystemPrompt({style:fixture.style,agent:'copilot',customInstructions:fixture.customInstructions},enhanced),user=buildUserMessage(fixture.input,context)
  return {id:`${fixture.id}-${tier}-${candidate}`,phase:'v1-frozen',caseId:fixture.id,tier,candidate,context:'frozen',fixture,system,user,systemHash:hash(system),userHash:hash(user),target,route:'unapproved',pluginVersion:VERSION}
 })))
}
export function savePreparedV1(directory){
 const root=resolve(directory);mkdirSync(root,{recursive:false})
 const rows=prepareV1(),protocol={id:'v1-paired-screen-1',callCeiling:0,executionAuthorized:false,rows:rows.length,pluginVersion:VERSION,preparedHash:hash(rows),sourceHashes:Object.fromEntries(['src/prompts.ts','src/prompt-sets.ts','scripts/eval/v1-cases.mjs','scripts/eval/v1-prepare.mjs','docs/research/v1-quality-gate.md'].map(path=>[path,hash(readFileSync(path,'utf8').replaceAll('\r\n','\n'))]))}
 const db=openLedger(join(root,'results.sqlite'),protocol)
 try{for(const row of rows)planGeneration(db,row)}finally{db.close()}
 writeFileSync(join(root,'protocol.json'),JSON.stringify(protocol,null,2)+'\n')
 return protocol
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==3)throw Error('Usage: node scripts/eval/v1-prepare.mjs NEW_OUTPUT_DIRECTORY (offline only)')
 console.log(JSON.stringify(savePreparedV1(process.argv[2]),null,2))
}
