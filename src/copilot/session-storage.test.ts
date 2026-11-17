import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { persistentStore } from './storage.ts'
import { createServices } from './services.ts'
import type { CopilotSession } from './session.ts'
import { promises as fs } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

const scope = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 24)
const session = (sessionId: string): CopilotSession => {
  const unused = async (): Promise<never> => { throw new Error('No host calls in storage fixture') }
  return { sessionId, send: unused, rpc: { metadata: { snapshot: unused, activity: unused, isProcessing: unused }, permissions: { pendingRequests: unused }, queue: { pendingItems: unused } } }
}
async function fixture(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-session-storage-'))
  try { await run(dir) } finally { await rm(dir, { recursive: true, force: true }) }
}
const seed = async (dir: string) => {
  await mkdir(join(dir, 'data'), { recursive: true })
  const values = { history: [{ original: 'Keep history 日本語' }], rules: { text: 'Saved rules' }, unknown: { keep: true },
    [`session:${scope('one')}:panel:draft`]: 'Original 🧪', [`session:${scope('one')}:panel:files`]: [{ path: 'C:\\owned\\file.png' }],
    [`session:${scope('two')}:panel:result`]: 'Reviewed result' }
  await writeFile(join(dir, 'data/state.json'), JSON.stringify(values))
  return values
}

test('legacy sessions move intact to independent files and edits never read or rewrite other sessions', async () => fixture(async dir => {
  const before = await seed(dir), a = createServices(session('one'), dir), b = createServices(session('two'), dir)
  await Promise.all([a.settings.get(), b.settings.get()])
  assert.equal(await a.storage.get('panel:draft'), 'Original 🧪')
  assert.equal(await b.storage.get('panel:result'), 'Reviewed result')
  assert.deepEqual(await a.storage.get('panel:files'), before[`session:${scope('one')}:panel:files`])
  const shared = await readFile(join(dir, 'data/state.json'), 'utf8')
  assert.ok(!shared.includes('Original 🧪'), 'session bodies must leave the shared JSON')
  const other = join(dir, 'data/sessions', `${scope('two')}.json`), otherBytes = await readFile(other)
  const originalRead = fs.readFile, reads: string[] = []
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => { reads.push(String(args[0])); return originalRead(...args) }) as typeof fs.readFile
  syncBuiltinESMExports()
  try {
    await a.storage.set('panel:draft', 'Edited')
    assert.equal(await a.storage.get('panel:draft'), 'Edited')
    assert.ok(reads.every(path => path === join(dir, 'data/sessions', `${scope('one')}.json`)), JSON.stringify(reads))
  } finally { fs.readFile = originalRead; syncBuiltinESMExports() }
  assert.deepEqual(await readFile(other), otherBytes)
  assert.equal(await readFile(join(dir, 'data/state.json'), 'utf8'), shared)
  for (const key of ['history', 'rules', 'unknown']) assert.deepEqual(await a.storage.get(key), before[key as keyof typeof before])
  assert.equal(await b.storage.get('panel:draft'), null)
  assert.ok(!(await a.storage.keys()).some(key => key.startsWith('session:') || key.startsWith('internal:')))
  await assert.rejects(a.storage.get(`session:${scope('two')}:panel:result`))
}))

test('an interrupted split preserves the legacy file and retries before allowing writes', async () => fixture(async dir => {
  await seed(dir)
  const sharedPath = join(dir, 'data/state.json'), original = await readFile(sharedPath)
  const rename = fs.rename
  let fail = true
  fs.rename = (async (from, to) => {
    if (String(to) === sharedPath && fail) { fail = false; throw Object.assign(new Error('Fixture interrupted migration'), { code: 'EIO' }) }
    return rename(from, to)
  }) as typeof fs.rename
  syncBuiltinESMExports()
  const first = createServices(session('one'), dir)
  try { await assert.rejects(first.storage.set('panel:draft', 'Must not write yet'), /interrupted migration/) }
  finally { fs.rename = rename; syncBuiltinESMExports() }
  assert.deepEqual(await readFile(sharedPath), original)
  await access(join(dir, 'data/sessions', `${scope('one')}.json`))
  assert.equal(await first.storage.get('panel:draft'), 'Original 🧪')
  await first.storage.set('panel:draft', 'After recovery')
  assert.equal(await createServices(session('one'), dir).storage.get('panel:draft'), 'After recovery')
  assert.equal(await createServices(session('two'), dir).storage.get('panel:result'), 'Reviewed result')
}))

test('concurrent processes migrate and transact without losing session writes or shared history', async () => fixture(async dir => {
  await seed(dir)
  const code = `const {createServices}=await import(process.argv[1]); const unused=async()=>{throw Error('No host')};
    const s=createServices({sessionId:'one',send:unused,rpc:{metadata:{snapshot:unused,activity:unused,isProcessing:unused},permissions:{pendingRequests:unused},queue:{pendingItems:unused}}},process.argv[2]);
    for(let i=0;i<6;i++) await s.storage.transaction(async()=>{await s.storage.set('panel:count',Number(await s.storage.get('panel:count'))+1);await s.storage.set('total',Number(await s.storage.get('total'))+1)});`
  await Promise.all([1, 2].map(() => promisify(execFile)(process.execPath, ['--input-type=module', '-e', code, new URL('./services.ts', import.meta.url).href, dir], { windowsHide: true })))
  const own = createServices(session('one'), dir)
  assert.equal(await own.storage.get('panel:count'), 12)
  assert.equal(await own.storage.get('total'), 12)
  assert.equal(await own.storage.get('panel:draft'), 'Original 🧪')
  await access(join(dir, 'data/sessions', `${scope('two')}.json`))
}))

test('a session-file failure waits for other migration writes to settle and keeps all legacy values', async () => fixture(async dir => {
  await seed(dir)
  const before = await readFile(join(dir, 'data/state.json')), rename = fs.rename
  let unblock!: () => void, held!: () => void
  const barrier = new Promise<void>(resolve => { unblock = resolve }), started = new Promise<void>(resolve => { held = resolve })
  let rejected = false
  fs.rename = (async (from, to) => {
    if (String(to) === join(dir, 'data/sessions', `${scope('one')}.json`)) throw new Error('Fixture split-file failure')
    if (String(to) === join(dir, 'data/sessions', `${scope('two')}.json`)) { held(); await barrier }
    return rename(from, to)
  }) as typeof fs.rename
  syncBuiltinESMExports()
  const migration = createServices(session('one'), dir).storage.get('panel:draft').catch(error => { rejected = true; return error })
  try {
    await started
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(rejected, false, 'the global lock must survive until every writer settles')
    assert.deepEqual(await readFile(join(dir, 'data/state.json')), before)
  } finally { unblock(); await migration; fs.rename = rename; syncBuiltinESMExports() }
  assert.equal(rejected, true)
  assert.equal(await createServices(session('one'), dir).storage.get('panel:draft'), 'Original 🧪')
  assert.equal(await createServices(session('two'), dir).storage.get('panel:result'), 'Reviewed result')
}))

test('unexpected old-version writes and unknown layouts fail without overwriting either copy', async () => fixture(async dir => {
  await seed(dir)
  const current = createServices(session('one'), dir)
  await current.storage.set('panel:draft', 'Current edited draft')
  const legacy = persistentStore(join(dir, 'data')), key = `session:${scope('one')}:panel:draft`
  await legacy.set(key, 'Older worker edit')
  await assert.rejects(createServices(session('one'), dir).storage.get('panel:draft'), /older Enhance Prompt version/)
  assert.equal(await current.storage.get('panel:draft'), 'Current edited draft')
  assert.equal(await legacy.get(key), 'Older worker edit')
  await legacy.delete(key)
  await legacy.set('internal:sessionStorage', 2)
  await assert.rejects(createServices(session('one'), dir).storage.get('panel:draft'), /newer Enhance Prompt/)
}))

test('same-session notifications cross processes while unrelated session changes remain isolated', async () => fixture(async dir => {
  const a = createServices(session('one'), dir), b = createServices(session('two'), dir)
  await Promise.all([a.settings.get(), b.settings.get()])
  const seen: string[] = []
  let received!: () => void
  const remote = new Promise<void>(resolve => { received = resolve })
  const listener = a.storage.onDidChange(({ key }) => { seen.push(key); if (key === 'panel:remote') received() })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await b.storage.set('panel:other', 'Not mine')
    await a.storage.set('panel:own', 'Mine')
    const code = `const {persistentStore}=await import(process.argv[1]);await persistentStore(process.argv[2],process.argv[3]).set('panel:remote','Remote saved')`
    await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code, new URL('./storage.ts', import.meta.url).href, join(dir, 'data/sessions'), `${scope('one')}.json`], { windowsHide: true })
    await Promise.race([remote, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Missing remote change')), 4000) })])
    assert.ok(seen.includes('panel:own'))
    assert.ok(!seen.includes('panel:other'))
    assert.equal(await a.storage.get('panel:remote'), 'Remote saved')
  } finally { clearTimeout(timer); listener.dispose() }
}))

test('future layouts and mixed-version state refuse startup before changing preferences or shared values', async () => fixture(async dir => {
  await seed(dir)
  const shared = persistentStore(join(dir, 'data')), prefs = persistentStore(join(dir, 'preferences'))
  await prefs.set('uiLanguage', 'zh'); await prefs.set('keep', 'Private preference')
  await shared.set('uiLocale', 'vi'); await shared.set('models', { future: 'preserve' })
  for (const marker of [2, 1]) {
    await shared.set('internal:sessionStorage', marker)
    const before = await readFile(join(dir, 'data/state.json')), preferenceBytes = await readFile(join(dir, 'preferences/state.json'))
    await assert.rejects(createServices(session('one'), dir).settings.get())
    assert.deepEqual(await readFile(join(dir, 'data/state.json')), before)
    assert.deepEqual(await readFile(join(dir, 'preferences/state.json')), preferenceBytes)
  }
}))

test('retry refuses changed or deleted legacy values after a partial split instead of resurrecting text', async () => fixture(async dir => {
  await seed(dir)
  const shared = persistentStore(join(dir, 'data')), rename = fs.rename
  fs.rename = (async (from, to) => {
    if (String(to) === join(dir, 'data/state.json')) throw new Error('Fixture interrupted commit')
    return rename(from, to)
  }) as typeof fs.rename
  syncBuiltinESMExports()
  try { await assert.rejects(createServices(session('one'), dir).storage.get('panel:draft'), /interrupted commit/) }
  finally { fs.rename = rename; syncBuiltinESMExports() }
  const copied = await readFile(join(dir, 'data/sessions', `${scope('one')}.json`))
  await shared.delete(`session:${scope('one')}:panel:draft`)
  await assert.rejects(createServices(session('one'), dir).storage.get('panel:draft'), /conflicting/)
  assert.equal(await shared.get(`session:${scope('one')}:panel:draft`), null)
  assert.deepEqual(await readFile(join(dir, 'data/sessions', `${scope('one')}.json`)), copied)
  await shared.delete(`session:${scope('one')}:panel:files`)
  await assert.rejects(createServices(session('one'), dir).storage.get('panel:draft'), /conflicting/)
  assert.equal(await shared.get('internal:sessionStorage'), null)
}))
