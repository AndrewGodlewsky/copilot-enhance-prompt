import { read } from '#panel'
import { assert, mockHost, test } from '#testing'
import { enhanceNow, previewContext } from './panel/actions.ts'
import { contextNotes, contextShown, draft, put, run, say } from './panel/state.ts'
import { mountPanel } from './panel/testing.ts'
import { itemWhy, SECTION_LABELS, styleOptions, structureOptions } from './panel/view.ts'
import { MESSAGES, msg } from './messages.ts'

test('the interface stays English with a non-English environment and legacy saved preferences', async t => {
  const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'zh-CN', languages: ['zh-CN', 'vi-VN'] } })
  t.after(() => { if (navigator) Object.defineProperty(globalThis, 'navigator', navigator); else Reflect.deleteProperty(globalThis, 'navigator') })
  let request: unknown
  const host = mockHost({
    settings: { uiLanguage: 'vi', outputLanguage: 'zh' },
    storage: { uiLocale: 'zh-CN' },
    requests: {
      'models.get': { profiles: [], selectorProfileId: null },
      'targets.list': { targets: [] },
      'context.preview': {
        context: [
          { id: 'tree', kind: 'tree', label: 'Repository tree (3 files)', chars: 10, title: msg('label.tree', { count: 3 }) },
          { id: 'file:src/你好.ts', kind: 'file', label: 'src/你好.ts', chars: 5, why: msg('why.ai') }
        ],
        notes: [msg('note.picker_skipped', { reason: msg('error.no_model') })], chars: 15
      },
      'prompt.enhance': input => {
        request = input
        throw Object.assign(new Error('All models failed.'), { code: 'action_failed', text: msg('error.all_failed', { list: [msg('error.attempt', { name: '模型', reason: msg('error.timeout') })] }) })
      }
    }
  })
  const view = await mountPanel(host, { persisted: { plugin: { outputChoice: 'vi', uiLanguage: 'zh', contextNotes: ['以前保存的内容'] } } })
  t.after(() => view.unmount())
  assert.deepEqual(read(contextNotes).map(say), ['以前保存的内容'])
  assert.equal(SECTION_LABELS.privacy, 'Settings')
  assert.equal(styleOptions()[0].label, 'General')
  assert.equal(structureOptions()[0].label, 'By style')
  const input = 'sửa lỗi "无法读取" trong src/你好.ts 🧪'
  put(draft, input)
  await previewContext()
  const [tree, file] = read(contextShown)
  assert.equal(say(tree.title!), 'Repository tree (3 files)')
  assert.equal(file.label, 'src/你好.ts')
  assert.match(itemWhy(file), /picked by AI/)
  assert.match(read(contextNotes).map(say).join('\n'), /^AI file picker skipped: Select a Copilot model/)
  await enhanceNow()
  assert.equal(read(run)?.status, 'error')
  assert.equal(read(run)?.error, 'All models failed. 模型: The request was cancelled or timed out.')
  assert.equal((request as { prompt: string }).prompt, input)
  assert.ok(!('language' in (request as object)))
  assert.ok(!('outputLanguage' in (request as object)))
  assert.ok(!host.callsOf('plugin.request').some(call => call.name === 'ui.locale'))
  assert.deepEqual(view.errors, [])
})

test('disabled-feature messages name the English Settings tab', () => {
  const sent = Object.entries(MESSAGES).filter(([, text]) => /\b(?:is|are) off in /.test(text))
  for (const code of ['note.terminal_off', 'note.project_files_off', 'error.send_off', 'error.open_off', 'error.lists_off']) {
    assert.ok(sent.some(([key]) => key === code), code)
  }
  for (const [code, text] of sent) assert.match(text, new RegExp(`\\b(?:is|are) off in ${SECTION_LABELS.privacy}(?:[.:,]|$)`), code)
})
