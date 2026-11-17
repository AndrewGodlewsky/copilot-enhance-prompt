import { createHash, randomUUID } from 'node:crypto'
import { lstat, opendir, realpath } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { ATTACHMENTS_DIR } from '../attachments.ts'
import { readConfinedFile } from '../confined-read.ts'
import { PRIVATE_PANEL_KEYS } from '../panel-storage.ts'
import { persistentStore } from './storage.ts'
import { sessionData } from './session-storage.ts'
import { processAlive, sessionUse, storageDirectory, type ProcessAlive } from './session-activity.ts'

export type StoredSize = { files: number; bytes: number; unreadable: number; partial: boolean }
type Candidate = { id: string; digest: string; bytes: number; removableBytes: number; updatedAt: number }
export type RetainedView = {
  checkedAt: number; location: string; uploadLocation: string
  sessions: Record<'current' | 'active' | 'inactive' | 'unknown', StoredSize>
  shared: StoredSize; uploads: StoredSize; usage: StoredSize; recovery: StoredSize; other: StoredSize
  history?: { entries: number; bytes: number }
  cleanup?: { token: string; count: number; bytes: number; expiresAt: number; sessions: {id:string;updatedAt:number;bytes:number}[] }
}
export type CleanupResult = { cleared: number; skipped: number; failed: number; bytes: number; cancelled: boolean }
export type RetainedClient = { inspect(signal?: AbortSignal): Promise<RetainedView>; clear(token: string, restarted: boolean, signal?: AbortSignal): Promise<CleanupResult> }
const empty = (): StoredSize => ({files:0,bytes:0,unreadable:0,partial:false})
const invalidPlan = () => Error('Inspect stored data again before clearing inactive drafts.')
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex')
const count = (size: StoredSize, bytes: number) => { size.files++; size.bytes += bytes }
const unsafe = (size: StoredSize) => { size.unreadable++; size.partial = true }
const existsOrUnreadable = (path:string) => lstat(path).then(()=>true,error=>(error as NodeJS.ErrnoException).code !== 'ENOENT')
const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_CLEAR = 100

async function snapshot(directory: string, path: string) {
  const file = await readConfinedFile(directory,path,MAX_FILE_BYTES,local=>local===path)
  if (!file) return
  try {
    const values = JSON.parse(file.data.toString('utf8'))
    if (!values || typeof values !== 'object' || Array.isArray(values)) return
    return {values: values as Record<string, any>, data:file.data}
  } catch { return }
}

/** User-requested, bounded local inspection. Plans contain hashes, never drafts.
 * Older unregistered workers/files cannot be proved inactive and stay protected. */
export function createRetainedData(root: string, currentScope: string, options: {
  uploadsDirectory?: string; alive?: ProcessAlive; now?: () => number; prepare?: () => Promise<void>; maxEntries?: number; maxMs?: number
} = {}) {
  if (!/^[a-f0-9]{24}$/.test(currentScope)) throw Error('Invalid session identity.')
  const now = options.now ?? Date.now, alive = options.alive ?? processAlive
  const uploadsDirectory = options.uploadsDirectory ?? ATTACHMENTS_DIR
  const plans = new Map<string,{token:string;expiresAt:number;candidates:Candidate[]}>()
  let operating = false
  let operatingOwner: string | undefined, closed = false
  const ensureOpen = (signal?:AbortSignal) => { signal?.throwIfAborted(); if (closed) throw Error('This canvas closed. Inspect stored data again after reopening.') }
  async function operation<T>(owner:string, run:()=>Promise<T>): Promise<T> {
    if (operating) throw Error('A storage inspection or cleanup is already running. Wait and retry.')
    operating = true; operatingOwner = owner; closed = false
    try { await options.prepare?.(); return await run() } finally { operating = false; operatingOwner = undefined }
  }
  async function inspect(owner: string, signal?: AbortSignal): Promise<RetainedView> {
    return operation(owner,async () => {
      ensureOpen(signal)
      plans.delete(owner)
      for (const [key, plan] of plans) if (plan.expiresAt <= now()) plans.delete(key)
      if (plans.size >= 16) throw Error('Too many storage previews are open. Close one and retry.')
      const started = now(), deadline = started + (options.maxMs ?? 15_000)
      let entries = 0
      const exhausted = () => { ensureOpen(signal); return entries >= (options.maxEntries ?? 50_000) || now() >= deadline }
      const view: RetainedView = {checkedAt:started,location:root,uploadLocation:uploadsDirectory,sessions:{current:empty(),active:empty(),inactive:empty(),unknown:empty()},shared:empty(),uploads:empty(),usage:empty(),recovery:empty(),other:empty()}
      if (!await storageDirectory(root)) {
        for (const size of [...Object.values(view.sessions),view.shared,view.uploads,view.usage,view.recovery,view.other]) unsafe(size)
        return view
      }
      const candidates: Candidate[] = [], processes = new Map<number,boolean|undefined>()
      const cachedAlive: ProcessAlive = pid => { if (!processes.has(pid)) processes.set(pid,alive(pid)); return processes.get(pid) }
      const directory = await storageDirectory(root,'data','sessions')
      if (directory) {
        const incomplete = () => { for (const size of Object.values(view.sessions)) size.partial = true }
        const inspectBatch = async (names: string[]) => {
          // Only small activity records run concurrently. Large private snapshots stay serial.
          const results = await Promise.allSettled(names.map(async name => {
            const id = name.slice(0,-5), info = await lstat(join(directory,name)).catch(()=>null)
            const safe = info?.isFile() && !info.isSymbolicLink() && info.nlink === 1
            return {name,id,info,use:safe && id !== currentScope ? await sessionUse(root,id,cachedAlive) : undefined}
          }))
          for (const result of results) {
            ensureOpen(signal)
            if (result.status === 'rejected') throw result.reason
            if (now() >= deadline) { incomplete(); break }
            const {name,id,info,use} = result.value
            if (!info?.isFile() || info.isSymbolicLink() || info.nlink !== 1) { unsafe(view.sessions.unknown); continue }
            if (id === currentScope) { count(view.sessions.current,info.size); continue }
            if (use !== 'inactive') { count(view.sessions[use ?? 'unknown'],info.size); continue }
            if (candidates.length >= MAX_CLEAR) { count(view.sessions.inactive,info.size); continue }
            const saved = await snapshot(directory,name)
            if (!saved) { count(view.sessions.unknown,info.size); unsafe(view.sessions.unknown); continue }
            count(view.sessions.inactive,info.size)
            const remaining = {...saved.values}
            const keys = [...PRIVATE_PANEL_KEYS].map(key=>`panel:${key}`).filter(key=>Object.hasOwn(remaining,key))
            if (keys.length) {
              for (const key of keys) delete remaining[key]
              candidates.push({id,digest:digest(saved.data),bytes:info.size,removableBytes:Math.max(0,saved.data.length-Buffer.byteLength(JSON.stringify(remaining))),updatedAt:info.mtimeMs})
            }
          }
        }
        let names: string[] = []
        for await (const entry of await opendir(directory)) {
          if (exhausted()) { incomplete(); break }
          entries++
          if (!/^[a-f0-9]{24}\.json$/.test(entry.name)) continue
          names.push(entry.name)
          if (names.length === 16) { await inspectBatch(names); names = [] }
        }
        if (names.length) await inspectBatch(names)
      } else if (await existsOrUnreadable(join(root,'data','sessions'))) unsafe(view.sessions.unknown)
      // Size scans stat regular files only; they never read uploads or usage text.
      async function scan(path: string, size: StoredSize, exclude: (path:string)=>boolean = ()=>false) {
        if (exhausted()) { size.partial = true; return }
        const initial = await lstat(path).catch(error=>{if ((error as NodeJS.ErrnoException).code !== 'ENOENT') unsafe(size); return null})
        if (!initial) return
        if (initial.isSymbolicLink()) { unsafe(size); return }
        const base = await realpath(path).catch(()=>undefined)
        if (!base) { unsafe(size); return }
        const visit = async (file: string, depth: number): Promise<void> => {
          if (exclude(relative(base,file).split(sep).join('/'))) return
          if (exhausted()) { size.partial = true; return }
          entries++
          const info = await lstat(file).catch(()=>null)
          if (!info || info.isSymbolicLink() || await realpath(file).catch(()=>undefined) !== file) { unsafe(size); return }
          if (info.isFile()) { if (info.nlink === 1) count(size,info.size); else unsafe(size); return }
          if (!info.isDirectory() || depth > 4) { unsafe(size); return }
          const children = await opendir(file).catch(()=>null)
          if (!children) { unsafe(size); return }
          for await (const child of children) {
            if (exhausted()) { size.partial = true; break }
            await visit(join(file,child.name),depth+1)
          }
        }
        await visit(base,0)
      }
      const data = await storageDirectory(root,'data')
      if (data) {
        await scan(join(data,'state.json'),view.shared)
        const saved = exhausted() ? undefined : await snapshot(data,'state.json')
        if (saved && Array.isArray(saved.values.history)) view.history = {entries:saved.values.history.length,bytes:Buffer.byteLength(JSON.stringify(saved.values.history))}
      } else unsafe(view.shared)
      const preferences = await storageDirectory(root,'preferences')
      if (preferences) await scan(join(preferences,'state.json'),view.shared)
      else if (await existsOrUnreadable(join(root,'preferences'))) unsafe(view.shared)
      await scan(uploadsDirectory,view.uploads)
      const usage = await storageDirectory(root,'usage')
      if (usage) {
        await scan(join(usage,'session-state'),view.usage)
        await scan(join(usage,'recovery'),view.recovery)
      } else if (await existsOrUnreadable(join(root,'usage'))) { unsafe(view.usage); unsafe(view.recovery) }
      await scan(root,view.other,path=>path==='data/state.json' || path==='preferences/state.json' || /^data\/sessions\/[a-f0-9]{24}\.json$/.test(path) || ['usage/session-state','usage/recovery'].includes(path))
      ensureOpen(signal)
      if (candidates.length) {
        const token = randomUUID(), expiresAt = now() + 5*60_000
        plans.set(owner,{token,expiresAt,candidates})
        view.cleanup = {token,expiresAt,count:candidates.length,bytes:candidates.reduce((sum,item)=>sum+item.removableBytes,0),sessions:candidates.map(({id,updatedAt,bytes})=>({id,updatedAt,bytes}))}
      }
      return view
    })
  }
  async function clear(owner: string, token: string, restarted: boolean, signal?: AbortSignal): Promise<CleanupResult> {
    if (!restarted) throw Error('Confirm you restarted Copilot after updating before cleanup.')
    return operation(owner,async () => {
      ensureOpen(signal)
      const plan = plans.get(owner)
      if (!plan || plan.token !== token || plan.expiresAt <= now()) throw invalidPlan()
      plans.delete(owner)
      const result: CleanupResult = {cleared:0,skipped:0,failed:0,bytes:0,cancelled:false}
      for (const item of plan.candidates) {
        if (signal?.aborted || closed) { result.cancelled = true; break }
        try {
          await persistentStore(join(root,'data')).transaction(async () => {
            if (item.id === currentScope || await sessionUse(root,item.id,alive) !== 'inactive') { result.skipped++; return }
            const directory = await storageDirectory(root,'data','sessions')
            if (!directory) { result.skipped++; return }
            const store = sessionData(root,item.id)
            await store.transaction(async () => {
              const saved = await snapshot(directory,`${item.id}.json`)
              if (!saved || digest(saved.data) !== item.digest) { result.skipped++; return }
              ensureOpen(signal)
              await store.patch(Object.fromEntries([...PRIVATE_PANEL_KEYS].map(key=>[`panel:${key}`,undefined])))
              result.cleared++; result.bytes += item.removableBytes
            })
          })
        } catch {
          if (signal?.aborted || closed) result.cancelled = true
          else result.failed++
          break
        }
      }
      return result
    })
  }
  return {inspect,clear,close(owner:string) { plans.delete(owner); if (operatingOwner === owner) closed = true }}
}
