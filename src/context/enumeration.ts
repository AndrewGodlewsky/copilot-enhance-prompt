import {realpath} from 'node:fs/promises'
import {filterAllowed,projectFileAllowed,walkListing,type FilePolicy,type FileListing} from './files.ts'
import {gitListing,isGitRepo} from './git.ts'

export type Coverage = Omit<FileListing,'files'> & {eligible:number;source:'git'|'walk'}
export type Enumeration = {files:string[];refused:string[];isGit:boolean;coverage?:Coverage}
type Policy = {allowGit:boolean;excludePatterns?:string;exclude?:ReadonlySet<string>}
type Options = {signal?:AbortSignal;ensureAccess?:()=>Promise<void>;fresh?:boolean}
type Reader = (root:string,policy:Policy,signal:AbortSignal,ensureAccess:()=>Promise<void>)=>Promise<Enumeration>
type Subscriber = {check?:()=>Promise<void>;finish:(value?:Enumeration,error?:unknown)=>void}
type Job = {controller:AbortController;subscribers:Set<Subscriber>}

/** Share only a currently running enumeration, never file contents or completed facts.
 * Each caller owns its cancellation/privacy checks and receives independent arrays. */
export function createEnumerationPool(read:Reader) {
  const jobs=new Map<string,Job>()
  let active=0
  return async (root:string,policy:Policy,options:Options={}):Promise<Enumeration>=>{
    const snapshot={allowGit:policy.allowGit,excludePatterns:policy.excludePatterns??'',exclude:new Set(policy.exclude)}
    options.signal?.throwIfAborted();await options.ensureAccess?.();options.signal?.throwIfAborted()
    const key=JSON.stringify([root,snapshot.allowGit,snapshot.excludePatterns,[...snapshot.exclude].sort()])
    let job=options.fresh?undefined:jobs.get(key), start=false
    if (!job) {
      if(active>=32) throw Error('Project discovery is busy. Wait for active requests and retry.')
      job={controller:new AbortController(),subscribers:new Set()};jobs.set(key,job);active++;start=true
    }
    const current=job
    if(current.subscribers.size>=64) throw Error('Too many requests are waiting for this project. Wait and retry.')
    const promise=new Promise<Enumeration>((resolve,reject)=>{
      const subscriber:Subscriber={check:options.ensureAccess,finish(value,error){
        if(!current.subscribers.delete(subscriber)) return
        options.signal?.removeEventListener('abort',abort)
        if(!value) reject(error??new Error('Project discovery failed.'))
        else resolve({...value,files:[...value.files],refused:[...value.refused],...(value.coverage?{coverage:{...value.coverage,limits:[...value.coverage.limits]}}:{})})
        if(!current.subscribers.size) {
          if(jobs.get(key)===current) jobs.delete(key)
          current.controller.abort()
        }
      }}
      const abort=()=>subscriber.finish(undefined,options.signal?.reason??new Error('Project discovery was aborted.'))
      current.subscribers.add(subscriber);options.signal?.addEventListener('abort',abort,{once:true})
    })
    if(start) {
      const guard=async()=>{
        current.controller.signal.throwIfAborted()
        const owners=[...current.subscribers]
        const checks=await Promise.allSettled(owners.map(owner=>Promise.resolve().then(()=>owner.check?.())))
        checks.forEach((check,index)=>{if(check.status==='rejected') owners[index].finish(undefined,check.reason)})
        current.controller.signal.throwIfAborted()
      }
      void (async()=>{
        try {
          await guard()
          const result=await read(root,snapshot,current.controller.signal,guard)
          // No caller arriving after this read may join a completed discovery.
          if(jobs.get(key)===current) jobs.delete(key)
          await guard()
          for(const owner of [...current.subscribers]) owner.finish(result)
        } catch(error) {for(const owner of [...current.subscribers]) owner.finish(undefined,error)}
        finally {active--;if(jobs.get(key)===current) jobs.delete(key)}
      })()
    }
    return promise
  }
}

const pool=createEnumerationPool(async(root,policy,signal,ensureAccess)=>{
  const access={...policy,ensureAccess},allow=await projectFileAllowed(root,access)
  const isGit=policy.allowGit&&await isGitRepo(root,signal,ensureAccess)
  const git=isGit?await gitListing(root,signal,ensureAccess):null
  const listing=git&&!git.unavailable?git:await walkListing(root,undefined,undefined,signal,allow)
  if(git?.unavailable)listing.limits.push('Git listing unavailable; used filesystem walk')
  const listed=listing.files
  signal.throwIfAborted();await ensureAccess()
  const files=await filterAllowed([...new Set(listed)],allow,signal),permitted=new Set(files)
  return {files,refused:listed.filter(path=>!permitted.has(path)),isGit,coverage:{scanned:listing.scanned,eligible:files.length,limits:listing.limits,unavailable:listing.unavailable,source:listing===git?'git':'walk'}}
})

export async function enumerateProject(root:string,allowGit:boolean,policy:FilePolicy={},signal?:AbortSignal,fresh=false):Promise<Enumeration> {
  signal?.throwIfAborted();await policy.ensureAccess?.()
  const canonical=await realpath(root).catch(()=>null)
  signal?.throwIfAborted();await policy.ensureAccess?.()
  if(!canonical) return {files:[],refused:[],isGit:false,coverage:{scanned:0,eligible:0,limits:['project unavailable'],unavailable:true,source:'walk'}}
  return pool(canonical,{...policy,allowGit},{signal,ensureAccess:policy.ensureAccess,fresh})
}
