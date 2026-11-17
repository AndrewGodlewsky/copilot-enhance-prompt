import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openLedger } from './ledger.mjs'

const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
const median = values => { const a = values.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2 : null }
export function evidenceRows(db) {
  return db.prepare('SELECT * FROM generation ORDER BY id').all().map(row => {
    const plan = JSON.parse(row.planned), result = row.result ? JSON.parse(row.result) : null
    const reviews = db.prepare('SELECT reviewer,assessment FROM review WHERE generation_id=? ORDER BY reviewer').all(row.id)
      .map(review => ({ reviewer: review.reviewer, ...JSON.parse(review.assessment) }))
    return { id: row.id, phase: row.phase, caseId: row.case_id, tier: row.tier, candidate: row.candidate, context: row.context,
      config: plan.config, status: result?.status ?? (row.started ? 'interrupted' : 'planned'),
      ms: result?.durationMs, words: result?.outputWords, inputCharacters: result?.inputCharacters,
      literalFailure: result?.literalChecks ? result.literalChecks.missing.length + result.literalChecks.forbidden.length > 0 : null,
      score: mean(reviews.map(review => review.scores.reduce((a, b) => a + b, 0))),
      anyHardFailure: reviews.some(review => review.hardFailures.length > 0),
      unanimousHardFailure: reviews.length > 1 && reviews.every(review => review.hardFailures.length > 0), reviews }
  })
}
export function aggregate(rows) {
  const ok = rows.filter(row => row.status === 'ok')
  return { attempts: rows.length, successful: ok.length, reviewed: rows.filter(row => row.score !== null).length,
    meanScore: mean(rows.map(row => row.score).filter(Number.isFinite)), literalFailures: ok.filter(row => row.literalFailure).length,
    anyReviewerHardFailures: rows.filter(row => row.anyHardFailure).length,
    unanimousHardFailures: rows.filter(row => row.unanimousHardFailure).length,
    medianMs: median(ok.map(row => row.ms)), medianWords: median(ok.map(row => row.words)),
    medianInputCharacters: median(ok.map(row => row.inputCharacters)) }
}
export function paired(rows, baselinePhase, candidatePhase, tier) {
  const base = rows.filter(row => row.phase === baselinePhase && row.tier === tier)
  const treatment = rows.filter(row => row.phase === candidatePhase && row.tier === tier)
  const pairs = base.flatMap(a => {
    const b = treatment.find(row => row.caseId === a.caseId)
    return b ? [{ caseId: a.caseId, baseline: a.id, treatment: b.id,
      delta: a.score !== null && b.score !== null ? b.score - a.score : null,
      newLiteralFailure: !!b.literalFailure && !a.literalFailure,
      newHardFailure: b.anyHardFailure && !a.anyHardFailure }] : []
  })
  const deltas = pairs.map(pair => pair.delta).filter(Number.isFinite)
  return { n: deltas.length, wins: deltas.filter(d => d > 0).length, ties: deltas.filter(d => d === 0).length,
    losses: deltas.filter(d => d < 0).length, meanDelta: mean(deltas), newHardFailures: pairs.filter(p => p.newHardFailure).length,
    newLiteralFailures: pairs.filter(p => p.newLiteralFailure).length, pairs }
}
export function summarize(db) {
  const rows = evidenceRows(db)
  const groups = {}
  for (const row of rows) {
    const key = [row.phase, row.tier, row.candidate, row.context, row.config.reasoning].join('/')
    ;(groups[key] ??= []).push(row)
  }
  return { protocol: JSON.parse(db.prepare('SELECT protocol FROM study').get().protocol),
    totals: aggregate(rows), groups: Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, aggregate(group)])),
    tuning: Object.fromEntries(['low', 'medium', 'high'].map(tier => [tier, paired(rows, 'baseline', 'compact', tier)])),
    rows }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openLedger(resolve(process.argv[2], 'results.sqlite'))
  try { process.stdout.write(JSON.stringify(summarize(db), null, 2) + '\n') } finally { db.close() }
}
