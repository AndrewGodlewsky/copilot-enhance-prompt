// Cross-repository contract test. Synthetic accounting only; no account, model, or desktop calls.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createUsageRecorder } from '../src/copilot/usage.ts'

assert.ok(process.env.USAGE_INSIGHTS_DIR, 'Set USAGE_INSIGHTS_DIR to the Usage Insights checkout.')
const { createScanner } = await import(pathToFileURL(join(process.env.USAGE_INSIGHTS_DIR, 'src/node/copilot-source.mjs')).href)
const { buildReport } = await import(pathToFileURL(join(process.env.USAGE_INSIGHTS_DIR, 'src/core/copilot-report.mjs')).href)
const root = await mkdtemp(join(tmpdir(), 'enhance-insights-fixture-'))
const now = new Date()
const receipt = (sessionId, overrides = {}) => ({
  type: 'assistant.usage', id: randomUUID(), timestamp: now.toISOString(), data: {
    model: 'fixture-copilot-model', provider: { kind: 'copilot' },
    inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 10,
    copilotUsage: { totalNanoAiu: 250_000_000 }, aiCreditsStatus: 'complete',
    accounting: { sourceSessionId: sessionId, usageId: randomUUID(), sequence: 1 },
    prompt: 'PRIVATE_PROMPT', response: 'PRIVATE_RESPONSE', endpoint: 'https://PRIVATE_ENDPOINT.invalid',
    ...overrides
  }
})
try {
  const ids = [randomUUID(), randomUUID()]
  const [first, second] = await Promise.all(ids.map(id => createUsageRecorder(id, root)))
  const event = receipt(ids[0])
  first.record(event)
  first.record({ ...event, id: randomUUID() })
  await first.flush()
  const scanner = createScanner({ optionalHomes: [root] })
  assert.equal((await scanner.scan([])).records.length, 1)
  first.record(receipt(ids[0], { copilotUsage: undefined, aiCreditsStatus: 'unavailable' }))
  second.record(receipt(ids[1], { copilotUsage: { totalNanoAiu: 500_000_000 }, aiCreditsStatus: 'partial' }))
  second.record(receipt(ids[1], { isByok: true, byokKind: 'remote_user' }))
  await Promise.all([first.flush(), second.flush()])
  for (const force of [false, true]) {
    const scan = await scanner.scan([root], { force })
    const report = buildReport(scan.records, { range: 'all' }, now, scan)
    assert.equal(scan.records.length, 3)
    assert.equal(scan.coverage.excluded, 1)
    assert.deepEqual(report.projects.map(project => project.name), ['Enhanced Prompt'])
    assert.equal(report.sessions.length, 2)
    assert.ok(report.sessions.every(session => session.name.startsWith('Enhanced Prompt · ')))
    assert.deepEqual(new Set(report.sessions.map(session => session.id)), new Set(ids))
    assert.equal(report.totals.credits, 0.75)
    assert.equal(report.totals.missingCredits, 1)
    assert.equal(report.totals.partialCredits, 1)
    assert.equal(report.totals.inputTotal, 300)
    assert.equal(report.totals.output, 60)
    assert.equal(report.projects[0].userPrompts, null)
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_/)
  }
  assert.equal((await scanner.scan([], { disabled: [root] })).records.length, 0)
  for (const id of ids) {
    assert.doesNotMatch(await readFile(join(root, 'session-state', id, 'events.jsonl'), 'utf8'), /PRIVATE_|prompt|response|endpoint/)
  }
  console.log('Enhance writer → Usage Insights: exact credits/tokens, two sessions, project/names, privacy, BYOK exclusion, partial/missing coverage and refresh deduplication passed. Synthetic usage only.')
} finally {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()))
  await rm(root, { recursive: true, force: true })
}
