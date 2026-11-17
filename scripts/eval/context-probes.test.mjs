import test from 'node:test'
import assert from 'node:assert/strict'
import { runContextProbes } from './context-probes.mjs'

test('offline probes preserve their synthetic fixtures and return repeatable JSON', async () => {
  const result = await runContextProbes()
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
  assert.deepEqual(await runContextProbes(), result)
  assert.equal(result.inferenceCalls, 0)
  assert.deepEqual(result.probes.map(probe => probe.id), ['keyword-languages', 'late-hit-snippet', 'budget-marker-overage'])
  const [keywords, excerpts, budgets] = result.probes
  assert.ok(keywords.fixture.requests.some(({ request }) => request === '修复登录按钮'))
  assert.ok(keywords.fixture.requests.some(({ request }) => request === 'Sửa nút đăng nhập'))
  assert.deepEqual(keywords.observation.cases.map(({ language, request }) => ({ language, request })), keywords.fixture.requests)
  assert.ok(excerpts.fixture.hitLines.every(line => line > 0 && line <= excerpts.fixture.lineCount))
  assert.ok(excerpts.fixture.inputCharacters < 200_000, 'fixture fits the protected reader')
  assert.ok(budgets.fixture.items.reduce((sum, item) => sum + item.chars, 0) > budgets.fixture.budget, 'fixture reaches the budget boundary')
})
