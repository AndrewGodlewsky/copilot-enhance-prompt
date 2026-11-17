// Local, synthetic research evidence only. Never imported by the shipped plugin.
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
export function literalChecks(output, expectations) {
  return { missing: expectations.mustInclude.filter(text => !output.includes(text)),
    forbidden: expectations.mustNotInclude.filter(text => output.includes(text)) }
}
export function openLedger(path, protocol) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  try {
    db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS study(id INTEGER PRIMARY KEY CHECK(id=1), protocol TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generation(id TEXT PRIMARY KEY, phase TEXT NOT NULL, case_id TEXT NOT NULL,
      tier TEXT NOT NULL, candidate TEXT NOT NULL, context TEXT NOT NULL, planned TEXT NOT NULL,
      started TEXT, finished TEXT, result TEXT);
    CREATE TABLE IF NOT EXISTS review(generation_id TEXT NOT NULL REFERENCES generation(id), reviewer TEXT NOT NULL,
      recorded TEXT NOT NULL, assessment TEXT NOT NULL, PRIMARY KEY(generation_id,reviewer));`)
    const existing = db.prepare('SELECT protocol FROM study WHERE id=1').get()
    if (!existing && !protocol) throw new Error('New ledger requires a frozen protocol')
    const active = protocol ?? JSON.parse(existing.protocol)
    if (!Number.isSafeInteger(active.callCeiling) || active.callCeiling < 0) throw new Error('Invalid call ceiling')
    if (!existing) db.prepare('INSERT INTO study VALUES(1,?)').run(JSON.stringify(protocol))
    if (existing && protocol && existing.protocol !== JSON.stringify(protocol)) throw new Error('Protocol mismatch')
    return db
  } catch (error) { db.close(); throw error }
}
export function planGeneration(db, row) {
  const prior = db.prepare('SELECT planned FROM generation WHERE id=?').get(row.id)
  if (prior) {
    if (prior.planned !== JSON.stringify(row)) throw new Error('Planned generation changed')
    return false
  }
  db.prepare('INSERT INTO generation(id,phase,case_id,tier,candidate,context,planned) VALUES(?,?,?,?,?,?,?)')
    .run(row.id, row.phase, row.caseId, row.tier, row.candidate, row.context, JSON.stringify(row))
  return true
}
export function claimGeneration(db, id) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const protocol = JSON.parse(db.prepare('SELECT protocol FROM study').get().protocol)
    const used = db.prepare('SELECT count(*) AS n FROM generation WHERE started IS NOT NULL').get().n
    const row = db.prepare('SELECT started FROM generation WHERE id=?').get(id)
    if (!row) throw new Error('Unknown generation')
    if (row.started) { db.exec('ROLLBACK'); return false }
    if (used >= protocol.callCeiling) throw new Error('Study call ceiling reached')
    db.prepare('UPDATE generation SET started=? WHERE id=?').run(new Date().toISOString(), id)
    db.exec('COMMIT'); return true
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
export function finishGeneration(db, id, result) {
  const changed = db.prepare('UPDATE generation SET finished=?, result=? WHERE id=? AND started IS NOT NULL AND finished IS NULL')
    .run(new Date().toISOString(), JSON.stringify(result), id)
  if (!changed.changes) throw new Error('Generation not active or already finished')
}
export function recordReview(db, id, reviewer, assessment) {
  if (typeof reviewer !== 'string' || !reviewer.trim() || !Array.isArray(assessment.scores) || assessment.scores.length !== 4 ||
    assessment.scores.some(score => !Number.isInteger(score) || score < 0 || score > 2) ||
    !Array.isArray(assessment.hardFailures) || assessment.hardFailures.some(value => typeof value !== 'string' || !value.trim()) ||
    typeof assessment.reason !== 'string' || !assessment.reason.trim()) throw new Error('Invalid assessment')
  const generation = db.prepare('SELECT finished,result FROM generation WHERE id=?').get(id)
  if (!generation?.finished || JSON.parse(generation.result).status !== 'ok') throw new Error('Only completed successful generations can be scored')
  db.prepare('INSERT INTO review VALUES(?,?,?,?)').run(id, reviewer, new Date().toISOString(), JSON.stringify(assessment))
}
