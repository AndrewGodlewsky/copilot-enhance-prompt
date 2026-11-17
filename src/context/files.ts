// File listing (git or a bounded walk), path filters, tree summaries and snippets.
import { readdir, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { readConfinedFile } from '../confined-read.ts'

const WALK_SKIP = new Set([
  '.git', 'node_modules', '.copilot', 'dist', 'build', 'out', 'target', '.next', '.nuxt', '.venv', 'venv',
  '__pycache__', '.cache', 'coverage', 'vendor', '.idea', '.vscode', '.turbo', '.svelte-kit', 'Pods'
])

/** Paths that may hold secrets: never read, never listed for the model. */
export function isSensitive(path: string): boolean {
  const name = path.split('/').pop() ?? path
  return (
    /^\.env(\..*)?$/i.test(name) ||
    /\.(pem|key|p12|pfx|keystore|jks)$/i.test(name) ||
    /(^|[._-])(secret|secrets|credentials?)([._-]|$)/i.test(name) ||
    /^id_(rsa|ed25519|ecdsa)/.test(name)
  )
}

const BINARY = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tgz|7z|rar|jar|exe|dll|so|dylib|wasm|woff2?|ttf|otf|mp[34]|mov|avi|bin|dat|db|sqlite)$/i

export function isBinaryPath(path: string): boolean {
  return BINARY.test(path)
}

/** `*` matches within a segment, `**` across segments; a pattern without `/` matches any segment or the name. */
export function compilePatterns(lines: string): RegExp[] {
  return lines
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((pattern) => {
      const dirOnly = pattern.endsWith('/')
      const body = pattern.replace(/\/$/, '')
      const escaped = body
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\u0000/g, '.*')
      if (body.includes('/')) {
        return new RegExp(`^${escaped}${dirOnly ? '/' : '(/|$)'}`, 'i')
      }
      return new RegExp(`(^|/)${escaped}${dirOnly ? '/' : '(/|$)'}`, 'i')
    })
}

export function isExcluded(path: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(path))
}

export type FileFilter = ((path: string) => boolean | Promise<boolean>) & { beforeRead?: () => Promise<void> }

export type FilePolicy = { excludePatterns?: string; exclude?: ReadonlySet<string>; ensureAccess?: () => Promise<void> }

/** The same file decision applies to every representation, including resolved link targets. */
export function fileAllowed(policy: FilePolicy = {}): (path: string) => boolean {
  const patterns = compilePatterns(policy.excludePatterns ?? '')
  const normalize = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path
  const unchecked = new Set([...policy.exclude ?? []].filter(id => /^(file|rules):/.test(id)).map(id => normalize(id.slice(id.indexOf(':') + 1).replace(/\\/g, '/'))))
  return path => {
    path = path.replace(/\\/g, '/')
    return !isSensitive(path) && !isBinaryPath(path) && !isExcluded(path, patterns) && !unchecked.has(normalize(path))
  }
}

/** Resolve both unchecked paths and candidates before any context route uses them. */
export async function projectFileAllowed(root: string, policy: FilePolicy = {}): Promise<FileFilter> {
  await policy.ensureAccess?.()
  const exclude = new Set(policy.exclude)
  const base = await realpath(root).catch(() => null)
  if (!base) return () => false
  const resolved = new Map<string, Promise<string | null>>()
  const canonical = (full: string): Promise<string | null> => {
    let value = resolved.get(full)
    if (!value) {
      value = realpath(full).catch(async (error: NodeJS.ErrnoException) => {
        // Keep deleted-file diffs only when the immediate parent still resolves.
        // A missing directory could have been an alias to an excluded location.
        if (error.code !== 'ENOENT' || full === base || dirname(full) === full) return null
        const parent = await realpath(dirname(full)).catch(() => null)
        return parent ? join(parent, basename(full)) : null
      })
      resolved.set(full, value)
    }
    return value
  }
  const localPath = async (path: string): Promise<string | null> => {
    if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) return null
    const actual = await canonical(join(base, path))
    if (!actual) return null
    const local = relative(base, actual).split(sep).join('/')
    return local.startsWith('..') || isAbsolute(local) ? null : local
  }
  for (const id of policy.exclude ?? []) {
    if (!/^(file|rules):/.test(id)) continue
    const local = await localPath(id.slice(id.indexOf(':') + 1))
    if (local !== null) exclude.add(`file:${local}`)
  }
  const lexical = fileAllowed({ ...policy, exclude })
  return Object.assign(async (path: string) => {
    if (!lexical(path)) return false
    const local = await localPath(path)
    return local !== null && lexical(local + (path.endsWith('/') ? '/' : ''))
  }, { beforeRead: policy.ensureAccess })
}

/** Bound filesystem concurrency while preserving the original file order. */
export async function filterAllowed(paths: string[], allow: FileFilter, signal?: AbortSignal): Promise<string[]> {
  const result: string[] = []
  for (let i = 0; i < paths.length; i += 64) {
    signal?.throwIfAborted()
    await allow.beforeRead?.()
    const batch = paths.slice(i, i + 64)
    const allowed = await Promise.all(batch.map(allow))
    result.push(...batch.filter((_, index) => allowed[index]))
  }
  return result
}

export type FileListing = {files:string[];scanned:number;limits:string[];unavailable:boolean}

export async function walkListing(root: string, maxFiles = 8000, maxDepth = 6, signal?: AbortSignal, allow: FileFilter = () => true): Promise<FileListing> {
  const out: string[] = []
  const limits=new Set<string>();let scanned=0,unavailable=false
  async function visit(dir: string, depth: number): Promise<void> {
    signal?.throwIfAborted()
    if (out.length >= maxFiles) {limits.add('file limit');return}
    if (depth > maxDepth) {limits.add('depth limit');return}
    let entries
    await allow.beforeRead?.()
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      limits.add('unreadable directory');if(dir===root)unavailable=true
      return
    }
    for (const entry of entries) {
      signal?.throwIfAborted()
      await allow.beforeRead?.()
      signal?.throwIfAborted()
      if (out.length >= maxFiles) {
        limits.add('file limit')
        return
      }
      const path = relative(root, join(dir, entry.name)).split(sep).join('/')
      if (entry.isDirectory()) {
        if (await allow(`${path}/`) && !WALK_SKIP.has(entry.name) && (!entry.name.startsWith('.') || path === '.github' || path === '.cursor')) {
          await visit(join(dir, entry.name), depth + 1)
        }
      } else if (entry.isFile()) {
        scanned++
        if(await allow(path))out.push(path)
      }
    }
  }
  await visit(root, 0)
  signal?.throwIfAborted()
  await allow.beforeRead?.()
  return {files:out,scanned,limits:[...limits],unavailable}
}

export async function walkFiles(root:string,maxFiles=8000,maxDepth=6,signal?:AbortSignal,allow:FileFilter=()=>true):Promise<string[]> {
  return (await walkListing(root,maxFiles,maxDepth,signal,allow)).files
}

/** Directories (depth <= 2) with file counts, plus top-level files: a compact map of the repo. */
export function treeSummary(files: string[], maxLines = 70): string {
  const dirs = new Map<string, number>()
  const topFiles: string[] = []
  for (const file of files) {
    const parts = file.split('/')
    if (parts.length === 1) {
      topFiles.push(file)
      continue
    }
    dirs.set(`${parts[0]}/`, (dirs.get(`${parts[0]}/`) ?? 0) + 1)
    if (parts.length > 2) {
      const sub = `${parts[0]}/${parts[1]}/`
      dirs.set(sub, (dirs.get(sub) ?? 0) + 1)
    }
  }
  const lines = [...dirs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, count]) => `${dir.split('/').length > 2 ? '  ' : ''}${dir} (${count})`)
  const all = [...lines, ...topFiles.sort((a, b) => a.localeCompare(b))]
  return all.length > maxLines ? `${all.slice(0, maxLines).join('\n')}\n…(${all.length - maxLines} more)` : all.join('\n')
}

export async function readText(root: string, path: string, maxBytes = 200_000, allow: FileFilter = () => true): Promise<string | null> {
  await allow.beforeRead?.()
  if (!await allow(path) || isSensitive(path) || isBinaryPath(path) || path.includes('..')) {
    return null
  }
  const result = await readConfinedFile(root, path, maxBytes, async actual => {
    await allow.beforeRead?.()
    return !isSensitive(actual) && !isBinaryPath(actual) && await allow(path) && await allow(actual)
  })
  const text = result?.data.toString('utf8')
  return text === undefined || text.includes('\u0000') ? null : text
}

/** Keep early and late evidence in fixed space instead of losing every later region. */
export function rememberHit(hits:number[],line:number):void {
  if(hits.at(-1)===line)return
  if(hits.length===20)hits.splice(10,1)
  hits.push(line)
}

/** Lines around each hit (or the head of the file), numbered, within `maxChars`. */
export function snippet(text: string, hits: number[], maxChars: number): string {
  if(maxChars<=0)return ''
  const lines = text.split(/\r?\n/)
  const valid=[...new Set(hits.filter(hit=>Number.isInteger(hit)&&hit>0&&hit<=lines.length))].sort((a,b)=>a-b)
  const regions=valid.filter((hit,index)=>index===0||hit-valid[index-1]>7)
  const centers=regions.length<=6?regions:Array.from({length:6},(_,i)=>regions[Math.round(i*(regions.length-1)/5)])
  // Give each distinct hit region a line before spending the budget on neighbors.
  const order=centers.length?[...centers.map(hit=>hit-1),...valid.map(hit=>hit-1),...[-1,1,-2,2,-3,-4].flatMap(offset=>valid.map(hit=>hit-1+offset))]:Array.from({length:Math.min(lines.length,40)},(_,i)=>i)
  const width=Math.max(0,Math.min(240,Math.floor(maxChars/Math.max(1,centers.length))-12))
  const cut=(value:string,length:number)=>{const end=value.slice(0,Math.max(0,length));return /[\uD800-\uDBFF]$/.test(end)?end.slice(0,-1):end}
  const display=(i:number)=>`${i+1}: ${lines[i].length>width?cut(lines[i],width)+'…':lines[i]}`
  const render=(indices:Set<number>)=>{let last=-2;const out:string[]=[];for(const i of [...indices].sort((a,b)=>a-b)){if(out.length&&i!==last+1)out.push('…');out.push(display(i));last=i}return out.join('\n')}
  const keep=new Set<number>();let omitted=false
  for(const i of order){
    if(i<0||i>=lines.length||keep.has(i))continue
    const proposed=new Set([...keep,i])
    if(render(proposed).length<=maxChars)keep.add(i)
    else omitted=true
  }
  const out=render(keep)
  if(!out)return '…'.slice(0,maxChars)
  return omitted&&out.length+2<=maxChars?out+'\n…':out
}
