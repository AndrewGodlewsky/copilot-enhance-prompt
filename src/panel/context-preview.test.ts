import { test, assert, mockHost } from '#testing'
import { read, set } from '#panel'
import { mountPanel } from './testing.ts'
import { previewContext } from './actions.ts'
import { busy, contextShown, draft, level, optionsOpen, excluded } from './state.ts'
import { levelOptions } from './view.ts'

const item = (id: string) => ({ id, kind: 'rules', label: id, chars: 20 })
const answer = (id: string) => ({ context: [item(id)], notes: [], chars: 20 })
const pause = () => new Promise(resolve => setTimeout(resolve, 450))

test('preview follows request, level and preference changes while preserving unchecked choices', async () => {
  const host = mockHost({ requests: { 'context.preview': input => input.level === 'off' ? { context: [], notes: [], chars: 0 } : answer('rules:AGENTS.md') } })
  const panel = await mountPanel(host)
  try {
    set(optionsOpen, true)
    set(draft, 'Original task')
    await pause()
    assert.equal(read(contextShown)[0]?.id, 'rules:AGENTS.md')
    assert.equal(host.callsOf('plugin.request').filter(call => call.name === 'context.preview').at(-1).input.fresh, false)
    await previewContext()
    assert.equal(host.callsOf('plugin.request').filter(call => call.name === 'context.preview').at(-1).input.fresh, true)
    set(excluded, ['rules:AGENTS.md'])
    await pause()
    assert.ok(read(contextShown).some(item => item.id === 'rules:AGENTS.md'))
    set(level, 'off')
    set(draft, 'A different request')
    await pause()
    assert.equal(host.callsOf('plugin.request').filter(call => call.name === 'context.preview').at(-1).input.level, 'off')
    const before = host.callsOf('plugin.request').length
    await host.settings.set('extraContextFiles', 'guide.md')
    await pause()
    assert.ok(host.callsOf('plugin.request').length > before)
  } finally { await panel.unmount() }
})

test('late previews cannot overwrite a newer request or clear an enhancement busy state', async () => {
  const pending: ((value: ReturnType<typeof answer>) => void)[] = []
  const host = mockHost({ requests: { 'context.preview': () => new Promise(resolve => pending.push(resolve)) } })
  const panel = await mountPanel(host)
  try {
    set(draft, 'old')
    const old = previewContext()
    set(draft, 'new')
    const latest = previewContext()
    pending[1](answer('new'))
    await latest
    set(busy, 'enhance')
    pending[0](answer('old'))
    await old
    assert.equal(read(contextShown)[0]?.id, 'new')
    assert.equal(read(busy), 'enhance')
  } finally { await panel.unmount() }
})

test('AI Test joins the stable context choices and retains saved Basic selections without offering new ones', () => {
  assert.deepEqual(levelOptions().map(item => item.value), ['off', 'standard', 'deep', 'max', 'ai-test'])
  assert.ok(levelOptions('basic').some(item => item.value === 'basic'))
})
