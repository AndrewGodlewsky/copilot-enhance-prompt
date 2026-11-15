import { test, assert, mockHost, mountWorker } from '#testing'
import * as main from '../worker.ts'

test('closing one canvas cancels its run without disturbing another canvas using the same run id', async () => {
  const waiting = new Map<string, { answer(): void; stopped: boolean }>()
  const rewrite = (input: { user: string }, options: { signal?: AbortSignal }) => new Promise((resolve, reject) => {
    const prompt = input.user.includes('first canvas') ? 'first' : 'second'
    const entry = { stopped: false, answer: () => resolve({ text: 'Enhanced ' + prompt }) }
    waiting.set(prompt, entry)
    options?.signal?.addEventListener('abort', () => { entry.stopped = true; reject(new DOMException('Cancelled', 'AbortError')) })
  })
  const host = mockHost({ storage: { models: { profiles: [{ id: 'test', name: 'Test', preset: 'copilot', provider: 'copilot', model: 'fixture', enabled: true }] } }, results: { 'copilot.rewrite': rewrite } })
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
  } finally { main.cancelPanelRuns(); await worker.deactivate() }
})
