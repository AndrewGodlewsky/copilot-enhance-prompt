import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {walkListing,snippet,rememberHit} from './files.ts'
import {gitListing,parseGitListing} from './git.ts'
import {explicitPaths,extractKeywords} from './relevance.ts'
import {redactCode} from './secrets.ts'
import {fitBudget,type ContextItem} from './index.ts'

test('file discovery distinguishes bounded, complete and unavailable walks',async()=>{
  const root=await mkdtemp(join(tmpdir(),'enhance-coverage-'))
  try {
    await Promise.all(Array.from({length:12},(_,i)=>writeFile(join(root,`${i}.ts`),'fixture')))
    const limited=await walkListing(root,5)
    assert.equal(limited.files.length,5);assert.ok(limited.limits.includes('file limit'));assert.equal(limited.unavailable,false)
    const complete=await walkListing(root)
    assert.equal(complete.scanned,12);assert.deepEqual(complete.limits,[])
    await mkdir(join(root,'deep'));await writeFile(join(root,'deep','source.ts'),'fixture')
    assert.ok((await walkListing(root,8000,0)).limits.includes('depth limit'))
    assert.equal((await walkListing(join(root,'missing'))).unavailable,true)
  } finally {await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
})

test('Git listings preserve framed Unicode and unusual names and disclose truncated output',async()=>{
  const framed='src/日本語.ts\0name\twith\nline.ts\0last.ts\0'
  assert.deepEqual(parseGitListing(framed).files,['src/日本語.ts','name\twith\nline.ts','last.ts'])
  assert.deepEqual(parseGitListing('whole.ts\0partial').files,['whole.ts'])
  assert.ok(parseGitListing('whole.ts\0partial').limits.includes('incomplete output'))
  assert.ok(parseGitListing(framed,2).limits.includes('file limit'))
  const root=await mkdtemp(join(tmpdir(),'enhance-listing-'))
  try {
    execFileSync('git',['init','-q'],{cwd:root,windowsHide:true})
    await writeFile(join(root,'日本語 space.ts'),'fixture')
    assert.deepEqual((await gitListing(root)).files,['日本語 space.ts'])
  } finally {await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100})}
})

test('explicit paths preserve spelling and spaces while Unicode keywords remain searchable',()=>{
  assert.deepEqual(explicitPaths('Inspect `src/日本語 File.ts` and src/Other.ts, then ../private.ts and https://example.com/a.ts'),['src/日本語 File.ts','src/Other.ts'])
  assert.deepEqual(explicitPaths('Inspect "src/file.ts," and `file.ts,`'),['src/file.ts,','file.ts,'])
  const words=extractKeywords('Inspect 日本語処理 naïveSession in src/認証.ts')
  assert.ok(words.includes('日本語処理'));assert.ok(words.includes('naïvesession'));assert.ok(words.includes('src/認証.ts'))
})

test('snippets cover separated hit regions, mark long-line truncation and keep strict budgets',()=>{
  const lines=Array.from({length:180},(_,i)=>`line ${i+1}`)
  const out=snippet(lines.join('\n'),[10,11,12,13,14,15,150],350)
  assert.match(out,/10: line 10/);assert.match(out,/150: line 150/);assert.ok(out.length<=350)
  const long=snippet('Z'.repeat(1000),[1],300)
  assert.match(long,/…/);assert.ok(long.length<=300)
  for(const budget of [0,1,7,20,100,240,1400])assert.ok(snippet(lines.join('\n'),[1,150],budget).length<=budget)
  const masked=snippet(redactCode('const api_key = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"; // 日本語'),[1],1400)
  assert.ok(!masked.includes('abcdefghijklmnopqrstuvwxyz'));assert.match(masked,/日本語/)
  const item:ContextItem={id:'file:a',label:'a',kind:'file',content:'x'.repeat(1000),chars:1000}
  assert.ok(fitBudget([item],500).reduce((sum,item)=>sum+item.content.length,0)<=500)
  const hits:number[]=[]
  for(let i=10;i<40;i++)rememberHit(hits,i)
  rememberHit(hits,150)
  assert.equal(hits.length,20);assert.equal(hits[0],10);assert.equal(hits.at(-1),150)
  assert.match(snippet(lines.join('\n'),hits,350),/150: line 150/)
})
