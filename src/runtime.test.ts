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
