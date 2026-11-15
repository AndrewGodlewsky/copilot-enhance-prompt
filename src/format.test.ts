import { assert, test } from '#testing'
import { formatText } from './format.ts'
import { english, msg, raw, render } from './messages.ts'

test('named placeholders preserve numbers, repeated values, Unicode and literal replacement characters', () => {
  const literal = '文件/$&/C:\\项目\\{count}.ts 🧪'
  assert.equal(formatText('{name}: {count}; {name}; {missing}', { name: literal, count: 0 }), `${literal}: 0; ${literal}; {missing}`)
  assert.equal(formatText('No placeholders'), 'No placeholders')
  assert.equal(formatText('{constructor} {toString}'), '{constructor} {toString}')
  assert.equal(formatText('{name}', Object.create({ name: 'inherited' })), '{name}')
})

test('structured errors render English templates while external text and nested parameters stay verbatim', () => {
  const external = '错误: {seconds} $& "无法读取"'
  const message = msg('error.all_failed', { list: [msg('error.attempt', { name: '模型', reason: msg('error.timeout') }), raw(external)] })
  assert.equal(render(message), `All models failed. 模型: The request was cancelled or timed out. · ${external}`)
  assert.equal(english(message), render(message))
  assert.equal(render(raw(external)), external)
})
