import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { evidenceRows, aggregate } from './summarize.mjs'
import { compareRows, readReport, renderReport } from './report.mjs'

const review = (total, hardFailures = []) => ({ scores: [Math.min(total, 2), Math.min(Math.max(total - 2, 0), 2), Math.min(Math.max(total - 4, 0), 2), Math.max(total - 6, 0)], hardFailures, reason: 'PRIVATE_REVIEW_REASON' })
const row = (id, patch = {}) => ({
  id, phase: 'baseline', caseId: 't01-synthetic', tier: 'low', candidate: 'baseline', context: 'relevant',
  config: { model: 'claude-haiku-5-5', reasoning: 'max' }, status: 'ok', ms: 1200, words: 24,
  inputCharacters: 600, literalFailure: false, score: 8, reviews: [review(8), review(8)], ...patch
})

test('summary preserves missing reviews as null while a reviewed zero remains zero', t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec('CREATE TABLE generation(id, phase, case_id, tier, candidate, context, planned, started, result); CREATE TABLE review(generation_id, reviewer, assessment)')
  const insert = db.prepare('INSERT INTO generation VALUES (?,?,?,?,?,?,?,?,?)')
  for (const identity of ['unreviewed', 'zero', 'averaged', 'timeout']) {
    insert.run(identity, 'baseline', identity, 'low', 'baseline', 'relevant', JSON.stringify({ config: { reasoning: 'max' } }), 'started',
      JSON.stringify({ status: identity === 'timeout' ? 'timeout' : 'ok', durationMs: 100, outputWords: 5 }))
  }
  const assessment = db.prepare('INSERT INTO review VALUES (?,?,?)')
  assessment.run('zero', 'first', JSON.stringify(review(0)))
  assessment.run('averaged', 'first', JSON.stringify(review(8)))
  assessment.run('averaged', 'second', JSON.stringify(review(6)))
  const rows = evidenceRows(db)
  assert.equal(rows.find(item => item.id === 'unreviewed').score, null)
  assert.equal(rows.find(item => item.id === 'timeout').score, null)
  assert.equal(rows.find(item => item.id === 'zero').score, 0)
  assert.equal(rows.find(item => item.id === 'averaged').score, 7)
  assert.equal(aggregate(rows).meanScore, 3.5)
  assert.equal(aggregate(rows).reviewed, 2)
})

test('failed, missing and unreviewed sides never become zero-score losses or scored pairs', () => {
  const base = row('base')
  for (const treatment of [row('unknown', { score: null, reviews: [] }), row('undefined', { score: undefined, reviews: [] }),
    row('failed', { status: 'timeout', score: 0 }), row('invalid', { score: NaN })]) {
    const [pair] = compareRows([base], [treatment])
    assert.equal(pair.comparable, false)
    assert.equal(pair.delta, null)
    assert.equal(pair.newHardFailure, null)
  }
  assert.equal(compareRows([base], [])[0].delta, null)
  const [zero] = compareRows([base], [row('zero', { score: 0, reviews: [review(0), review(0)] })])
  assert.equal(zero.comparable, true)
  assert.equal(zero.delta, -8)
  assert.throws(() => compareRows([base, row('duplicate')], []), /Ambiguous duplicate/)
})

test('appendix retains timeout evidence, separates hard votes, and exports no raw or private fields', () => {
  const rows = [
    row('baseline-low-t01', { reviews: [review(8), review(8, ['PRIVATE_HARD_FAILURE'])] }),
    row('compact-low-t01', { phase: 'compact', candidate: 'compact', score: null, reviews: [], ms: null, words: null, inputCharacters: null }),
    row('context-low-t01-off', { phase: 'context', context: 'off', status: 'timeout', score: null, reviews: [], ms: 150000, words: 0 }),
    row('context-low-t01-overview', { phase: 'context', context: 'overview', score: 0, reviews: [review(0), review(0)] }),
    row('context-low-t01-noisy', { phase: 'context', context: 'noisy', score: 7, reviews: [review(6), review(8)] })
  ]
  rows[0].rawOutput = 'PRIVATE_RAW_OUTPUT'
  rows[0].credentials = 'PRIVATE_CREDENTIALS'
  rows[0].path = 'C:\\PRIVATE_PATH\\results.sqlite'
  const report = renderReport({ rows, protocol: { secret: 'PRIVATE_PROTOCOL', hiddenReasoning: 'PRIVATE_REASONING' } })
  assert.ok(!report.includes('PRIVATE_'))
  assert.ok(report.includes('`compact-low-t01`<br>ok · — · — · —'))
  assert.ok(report.includes('| compact/low/compact/relevant/max | 1 | 0 | 1 | 0 / 0 | — | — | 0 | — | — | — |'))
  assert.ok(report.includes('`context-low-t01-off`<br>timeout · — · 150.0 · 0'))
  assert.ok(report.includes('`context-low-t01-overview`<br>ok · 0.00 · 1.2 · 24'))
  assert.ok(report.includes('| Baseline → Compact / low | 1 | 0 | 0 | 0 | 0 | — | — |'))
  assert.ok(report.includes('| Relevant (baseline reused) → Off / low | 1 | 0 | 0 | 0 | 0 | — | — |'))
  assert.ok(report.includes('| Relevant (baseline reused) → Overview / low | 1 | 1 | 0 | 0 | 1 | -8.00 | 0 |'))
  assert.ok(report.includes('**5 attempted generations**'))
  assert.ok(report.includes('**4 successful generations**'))
  assert.ok(report.includes('**3/4 successful generations**'))
  assert.ok(report.includes('union hard flags affect **1/3** and unanimous hard flags affect **0/3**'))
  assert.ok(report.includes('| 1/2 | — |'))
})

test('report CLI reads a synthetic database without changing it and refuses to create a missing database', t => {
  const directory = mkdtempSync(join(tmpdir(), 'enhance-report-test-'))
  const path = join(directory, 'results.sqlite')
  t.after(() => { if (existsSync(path)) unlinkSync(path); rmdirSync(directory) })
  assert.throws(() => readReport(path))
  assert.equal(existsSync(path), false)
  const db = new DatabaseSync(path)
  try {
    db.exec('CREATE TABLE study(protocol); CREATE TABLE generation(id, phase, case_id, tier, candidate, context, planned, started, result); CREATE TABLE review(generation_id, reviewer, assessment)')
    db.prepare('INSERT INTO study VALUES (?)').run(JSON.stringify({ private: 'PRIVATE_PROTOCOL' }))
    db.prepare('INSERT INTO generation VALUES (?,?,?,?,?,?,?,?,?)').run('planned-low-t01', 'baseline', 't01-synthetic', 'low', 'baseline', 'relevant',
      JSON.stringify({ config: { model: 'claude-haiku-5-5', reasoning: 'max' } }), null, null)
  } finally { db.close() }
  const before = readFileSync(path)
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./report.mjs', import.meta.url)), directory], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes('`planned-low-t01`<br>planned · — · — · —'))
  assert.ok(result.stdout.includes('**0 attempted generations**'))
  assert.ok(!result.stdout.includes(directory))
  assert.ok(!result.stdout.includes('PRIVATE_'))
  assert.deepEqual(readFileSync(path), before)
})
