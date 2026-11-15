import { assert, test } from '#testing'
import { isTransient, LlmError, messageOf } from './llm.ts'
import { msg } from './messages.ts'

test('structured errors preserve their message and retry only temporary failures', () => {
  const error = new LlmError(msg('error.copilot_usage'), 'action_failed')
  assert.deepEqual(messageOf(error), msg('error.copilot_usage'))
  assert.equal(isTransient(error), false)
  for (const code of ['timeout', 'unavailable', 'rate_limited']) assert.equal(isTransient(new LlmError('Try again', code)), true)
  assert.equal(isTransient(new LlmError('Server failed', 'action_failed', 503)), true)
  assert.equal(isTransient(new LlmError('Invalid', 'invalid_params', 400)), false)
  assert.equal(isTransient(new Error('unknown')), false)
})
