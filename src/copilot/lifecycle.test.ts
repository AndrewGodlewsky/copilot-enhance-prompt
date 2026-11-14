import { test, assert, mockHost, mountWorker } from '#testing'
import * as main from '../worker.ts'

test('closing one canvas cancels its run without disturbing another canvas using the same run id', async () => {
  const originalFetch = globalThis.fetch
  const waiting = new Map<string, { answer(): void; stopped: boolean }>()
  globalThis.fetch = (async (_url, options) => new Promise((resolve, reject) => {
    const body = JSON.parse(String(options?.body))
    const prompt = body.messages.at(-1).content.includes('first canvas') ? 'first' : 'second'
    const entry = { stopped: false, answer: () => resolve(new Response(JSON.stringify({ choices: [{ message: { content: 'Enhanced ' + prompt } }] }))) }
    waiting.set(prompt, entry)
    options?.signal?.addEventListener('abort', () => { entry.stopped = true; reject(new DOMException('Cancelled', 'AbortError')) })
  })) as typeof fetch
  const host = mockHost({ storage: { models: { profiles: [{ id: 'test', name: 'Test', preset: 'ollama', provider: 'openai', model: 'fixture', baseUrl: 'http://127.0.0.1:11434/v1', enabled: true, maxTokens: 2000 }] } } })
  const worker = await mountWorker(main, { host })
  try {
    const first = worker.request('prompt.enhance', { prompt: 'first canvas', level: 'off', runId: 'same' }, { panelId: 'one' }).then(() => 'finished', () => 'cancelled')
    while (!waiting.has('first')) await new Promise(resolve => setTimeout(resolve, 5))
    const second = worker.request('prompt.enhance', { prompt: 'second canvas', level: 'off', runId: 'same' }, { panelId: 'two' })
    while (!waiting.has('second')) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(waiting.get('first')!.stopped, false)
    main.cancelPanelRuns('one')
    assert.equal(await first, 'cancelled')
    assert.equal(waiting.get('second')!.stopped, false)
    waiting.get('second')!.answer()
    assert.equal((await second).enhanced, 'Enhanced second')
  } finally { main.cancelPanelRuns(); await worker.deactivate(); globalThis.fetch = originalFetch }
})
