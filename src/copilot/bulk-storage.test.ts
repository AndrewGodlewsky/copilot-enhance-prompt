import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { promises as fs } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createServices } from './services.ts'
import { persistentStore } from './storage.ts'
import type { CopilotSession } from './session.ts'

test('bulk restore reads each participating store once and never exposes another session or cached privacy', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-bulk-')), original = fs.readFile
  try {
    const services = createServices({ sessionId: 'one' } as CopilotSession, dir)
    await services.settings.get()
    await services.storage.set('panel:draft', 'Unicode 日本語 🧪')
    await services.storage.set('history', ['Saved'])
    await services.storage.set('colorTheme', 'dark')
    const reads: string[] = []
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => { reads.push(String(args[0])); return original(...args) }) as typeof fs.readFile
    syncBuiltinESMExports()
    const values = await services.storage.getMany!(['panel:draft', 'panel:result', 'history', 'history', 'colorTheme'])
    assert.deepEqual(values, { 'panel:draft': 'Unicode 日本語 🧪', 'panel:result': null, history: ['Saved'], colorTheme: 'dark' })
    assert.equal(reads.length, 2)
    assert.equal(new Set(reads).size, 2)
    await assert.rejects(services.storage.getMany!(['session:' + '0'.repeat(24) + ':panel:draft']))
    await assert.rejects(services.storage.getMany!(['internal:sessionStorage']))
    await persistentStore(join(dir, 'preferences')).set('saveHistory', false)
    assert.equal(await services.settings.get('saveHistory'), false)
    await services.storage.delete('panel:draft')
    assert.equal((await services.storage.getMany!(['panel:draft']))['panel:draft'], null)
  } finally { fs.readFile = original; syncBuiltinESMExports(); await rm(dir, { recursive: true, force: true }) }
})

test('observers share one read per change, ignore corrupt snapshots, and release their watcher', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-shared-observer-')), file = join(dir, 'state.json'), original = fs.readFile
  const stops: { dispose(): void }[] = []
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  try {
    const store = persistentStore(dir)
    await store.patch({ value: 'Before', remove: 'Keep until deletion' })
    let reads = 0
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => { if (String(args[0]) === file) reads++; return original(...args) }) as typeof fs.readFile
    syncBuiltinESMExports()
    const events: string[][] = [[], [], []]
    for (const seen of events) stops.push(persistentStore(dir).onDidChange(({ key }) => seen.push(key)))
    await wait(100)
    assert.equal(reads, 1, 'one initial parse for all subscribers')
    await writeFile(file, JSON.stringify({ value: 'After 日本語' }))
    await wait(650)
    assert.equal(reads, 2, 'one parse when the shared file changes')
    for (const seen of events) assert.deepEqual(seen.sort(), ['remove', 'value'])
    await writeFile(file, '{incomplete')
    await wait(650)
    for (const seen of events) assert.equal(seen.length, 2, 'parse failure must not look like deletion')
    await writeFile(file, JSON.stringify({ value: 'Recovered' }))
    await wait(650)
    for (const seen of events) assert.equal(seen.length, 3)
    stops.forEach(stop => stop.dispose())
    const before = reads
    await writeFile(file, '{}'); await wait(650)
    assert.equal(reads, before, 'last unsubscribe removes the watcher')
  } finally { stops.forEach(stop => stop.dispose()); fs.readFile = original; syncBuiltinESMExports(); await rm(dir, { recursive: true, force: true }) }
})

test('a delayed observer read cannot replace a newer locally committed snapshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-observer-race-')), file = join(dir, 'state.json'), original = fs.readFile
  let release!: () => void, captured!: () => void, first = true
  const held = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { captured = resolve })
  let stop: { dispose(): void } | undefined
  try {
    const store = persistentStore(dir)
    await store.set('value', { label: 'Before' })
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      const value = await original(...args)
      if (String(args[0]) === file && first) { first = false; captured(); await held }
      return value
    }) as typeof fs.readFile
    syncBuiltinESMExports()
    const events: string[] = []
    stop = store.onDidChange(({ key }) => events.push(key))
    await started
    const value = { label: 'Committed' }
    await store.set('value', value)
    value.label = 'Caller changed its own object'
    release()
    await new Promise(resolve => setTimeout(resolve, 650))
    assert.deepEqual(events, ['value'], 'stale initial read and caller mutation must not cause a false later change')
    assert.deepEqual(await store.get('value'), { label: 'Committed' })
    await writeFile(file, '{}')
    await new Promise(resolve => setTimeout(resolve, 650))
    assert.deepEqual(events, ['value', 'value'], 'a real external deletion must still be reported')
  } finally { release(); stop?.dispose(); fs.readFile = original; syncBuiltinESMExports(); await rm(dir, { recursive: true, force: true }) }
})

test('a local write cannot hide external changes or deletions between stat polls', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-observer-external-')), file = join(dir, 'state.json')
  let stop: { dispose(): void } | undefined
  try {
    const store = persistentStore(dir)
    await store.patch({ own: 0, saveHistory: true, removed: 'Private saved value' })
    const events: string[] = []
    stop = store.onDidChange(({ key }) => events.push(key))
    await new Promise(resolve => setTimeout(resolve, 60))
    await writeFile(file, JSON.stringify({ own: 0, saveHistory: false }))
    await store.set('own', 1)
    await new Promise(resolve => setTimeout(resolve, 650))
    assert.deepEqual([...new Set(events)].sort(), ['own', 'removed', 'saveHistory'])
    assert.equal(await store.get('saveHistory'), false)
  } finally { stop?.dispose(); await rm(dir, { recursive: true, force: true }) }
})

test('changes during the first observer read remain visible when a local write finishes first', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'enhance-observer-initial-')), file = join(dir, 'state.json'), original = fs.readFile
  let release!: () => void, captured!: () => void, first = true
  const held = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { captured = resolve })
  let stop: { dispose(): void } | undefined
  try {
    const store = persistentStore(dir)
    await store.patch({ own: 0, removed: 'Old', saveHistory: true })
    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      const value = await original(...args)
      if (String(args[0]) === file && first) { first = false; captured(); await held }
      return value
    }) as typeof fs.readFile
    syncBuiltinESMExports()
    const events: string[] = []
    stop = store.onDidChange(({ key }) => events.push(key))
    await started
    await writeFile(file, JSON.stringify({ own: 0, saveHistory: false }))
    await store.set('own', 1)
    release()
    await new Promise(resolve => setTimeout(resolve, 650))
    assert.deepEqual(events.sort(), ['own', 'removed', 'saveHistory'])
  } finally { release(); stop?.dispose(); fs.readFile = original; syncBuiltinESMExports(); await rm(dir, { recursive: true, force: true }) }
})
