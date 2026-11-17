import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atom, bindPanel, derived, read, ready, set, subscribe, type PanelClient } from './runtime.ts'

test('panel atoms are isolated and computed values follow updates', () => {
  const a = atom(1)
  const b = atom(1)
  const twice = derived(() => read(a) * 2)
  let changes = 0
  const stop = subscribe(() => changes++)
  set(a, 4)
  assert.equal(read(twice), 8)
  assert.equal(read(b), 1)
  assert.equal(changes, 1)
  stop()
})

test('persisted panel atoms hydrate from durable storage across new clients', async () => {
  const data = new Map<string, unknown>()
  const storage = {
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: unknown) => { data.set(key, value) },
    onDidChange: () => ({ dispose() {} })
  }
  const saved = atom('runtime-test', '', { persist: 'plugin' })
  bindPanel({ storage } as unknown as PanelClient)
  await ready()
  set(saved, 'keep this draft')
  await new Promise(resolve => setImmediate(resolve))
  bindPanel({ storage } as unknown as PanelClient)
  await ready()
  assert.equal(read(saved), 'keep this draft')
})

test('startup bounds concurrent reads, retries capacity errors and preserves saved text', async () => {
  const saved = Array.from({ length: 20 }, (_, i) => atom(`bounded-${i}`, '', { persist: 'plugin' }))
  let active = 0, peak = 0, limited = false
  bindPanel({ storage: {
    async get(key: string) {
      if (!limited) { limited = true; throw Object.assign(new Error('Busy'), { code: 'rate_limited' }) }
      peak = Math.max(peak, ++active)
      await new Promise(resolve => setTimeout(resolve, 2))
      active--
      return key.includes('bounded-') ? 'Saved Unicode 日本語' : null
    }, onDidChange: () => ({ dispose() {} })
  } } as unknown as PanelClient)
  await ready()
  assert.ok(peak <= 4, `peak concurrent reads: ${peak}`)
  assert.ok(saved.every(value => read(value) === 'Saved Unicode 日本語'))
})

test('bulk startup deduplicates keys and preserves an edit made while hydration waits', async () => {
  const a = atom('bulk-draft', '', { persist: 'plugin' }), b = atom('bulk-draft', '', { persist: 'plugin' })
  let finish!: (values: Record<string, string>) => void, keys: string[] = [], singles = 0
  bindPanel({ storage: {
    get: async () => { singles++; return null },
    getMany: async (requested: string[]) => { keys = requested; return new Promise(resolve => { finish = resolve }) },
    set: async () => {}, onDidChange: () => ({ dispose() {} })
  } } as unknown as PanelClient)
  const loading = ready()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(singles, 0)
  assert.equal(keys.filter(key => key === 'panel:bulk-draft').length, 1)
  set(a, 'Edited while loading')
  finish({ 'panel:bulk-draft': 'Saved Unicode 🧪' })
  await loading
  assert.equal(read(a), 'Edited while loading')
  assert.equal(read(b), 'Saved Unicode 🧪')
})

test('shared changes batch into one reload and late startup snapshots cannot undo newer state', async () => {
  const runtime = await import(new URL('./runtime.ts?batch-race', import.meta.url).href)
  const first = runtime.atom('history', [], { persist: 'storage' }), second = runtime.atom('other', '', { persist: 'storage' })
  const pending: { keys: string[]; resolve: (values: unknown) => void }[] = []
  let change!: (event: { key: string }) => void
  runtime.bindPanel({ storage: {
    getMany: (keys: string[]) => new Promise(resolve => pending.push({ keys, resolve })),
    onDidChange: (listener: typeof change) => { change = listener; return { dispose() {} } }
  } })
  const initial = runtime.ready()
  change({ key: 'history' }); change({ key: 'other' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(pending.length, 2)
  assert.deepEqual(pending[1].keys, ['history', 'other'])
  pending[1].resolve({ history: ['Newer'], other: null })
  await new Promise(resolve => setImmediate(resolve))
  pending[0].resolve({ history: ['Stale'], other: 'Stale' })
  await initial
  assert.deepEqual(runtime.read(first), ['Newer'])
  assert.equal(runtime.read(second), '')
  change({ key: 'history' })
  await new Promise(resolve => setImmediate(resolve))
  runtime.bindPanel({ storage: { get: async () => null, onDidChange: () => ({ dispose() {} }) } })
  pending[2].resolve({ history: ['Disconnected old canvas'] })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(runtime.read(first), [])
})
