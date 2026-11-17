import { test, assert } from '#testing'
import { isExpired, watchExpiry } from './expiry.ts'

test('a paused hidden-document Undo expires on resume without waiting for a delayed timer', () => {
  let now = 1_000, expired = 0, stopped = 0
  let timer = () => {}, resume = () => {}
  const stop = watchExpiry(61_000, () => expired++, {
    now: () => now,
    schedule: (callback, ms) => { timer = callback; assert.equal(ms, 60_000); return () => {} },
    onResume: callback => { resume = callback; return () => { stopped++ } }
  })
  assert.equal(expired, 0)
  now = 80_000 // Browser withheld timers while hidden; visibility/focus comes first.
  resume(); timer(); resume()
  assert.equal(expired, 1)
  stop()
  assert.equal(stopped, 1)
  assert.equal(isExpired(NaN), true)
  assert.equal(isExpired(61_000, 61_000), true)
})
