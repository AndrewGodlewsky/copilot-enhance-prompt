// Explicit opt-in research CLI. Production and the normal tests never invoke inference.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSystemPrompt, buildUserMessage, cleanOutput } from '../../src/prompts.ts'
import { promptCases, rubric, CORPUS_VERSION } from './prompt-cases.mjs'
import { runSubscription } from './subscription-models.mjs'
import { openLedger, hash, planGeneration, claimGeneration, finishGeneration, literalChecks, recordReview } from './ledger.mjs'

export const configurations = {
  low: { provider: 'claude', model: 'claude-haiku-5-5', reasoning: 'max' },
  medium: { provider: 'codex', model: 'gpt-6-sol', reasoning: 'high', proxyFor: 'gpt-6.1-sol' },
  high: { provider: 'claude', model: 'claude-opus-5-5', reasoning: 'medium' }
}
export function prepare(spec, candidates = {}) {
  const fixture = promptCases.find(item => item.id === spec.caseId)
  if (!fixture || !Object.hasOwn(fixture.contextVariants, spec.context)) throw new Error('Unknown synthetic case/context')
  const base = buildSystemPrompt(fixture.options)
  let system = base
  if (spec.candidate !== 'baseline') {
    const candidate = candidates[spec.candidate]
    if (!candidate) throw new Error('Unregistered candidate')
    if (candidate.kind === 'append') system += '\n\n' + candidate.text
    else if (candidate.kind === 'replace-base') {
      // Match the exact end of BASE; refuse a source change instead of replacing style policies.
      const boundary = '- Output just the final prompt text, starting with its first line: no preamble, no explanation, no surrounding code fence.'
      const index = base.indexOf(boundary)
      if (index < 0) throw new Error('Production base boundary changed')
      system = candidate.text + base.slice(index + boundary.length)
    } else throw new Error('Unsupported candidate transform')
  }
  const user = buildUserMessage(fixture.input, fixture.contextVariants[spec.context])
  return { ...spec, fixture, config: { ...configurations[spec.tier], ...spec.config }, system, user,
    systemHash: hash(system), userHash: hash(user), corpusVersion: CORPUS_VERSION }
}
export async function executePlan(db, plan, invoke = runSubscription) {
  const rows = plan.generations.map(spec => prepare(spec, plan.candidates))
  for (const row of rows) planGeneration(db, row)
  let index = 0
  const worker = async () => {
    while (index < rows.length) {
      const row = rows[index++]
      if (!claimGeneration(db, row.id)) continue
      let result
      try {
        result = await invoke({ ...row.config, system: row.system, user: row.user, timeoutMs: 150_000 })
        result.cleanedOutput = cleanOutput(result.output ?? '')
        result.literalChecks = literalChecks(result.cleanedOutput, row.fixture.expectations)
        result.inputCharacters = row.system.length + row.user.length
        result.outputWords = result.cleanedOutput.split(/\s+/).filter(Boolean).length
        if (result.actualModels?.length && result.actualModels.some(model => model !== row.config.model)) result.status = 'model_mismatch'
      } catch (error) { result = { status: 'runner_error', error: error.message } }
      finishGeneration(db, row.id, result)
      process.stdout.write(JSON.stringify({ id: row.id, status: result.status, ms: result.durationMs }) + '\n')
    }
  }
  const concurrency = plan.concurrency ?? 3
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error('Concurrency must be 1–3')
  const workers = await Promise.allSettled(Array.from({ length: concurrency }, worker))
  const failure = workers.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
}
export function blindPacket(db, phase) {
  return db.prepare('SELECT * FROM generation WHERE phase=? AND finished IS NOT NULL').all(phase).map(row => {
    const planned = JSON.parse(row.planned), result = JSON.parse(row.result)
    return { blindId: hash('blind-2026-11-16:' + row.id).slice(0, 14), request: planned.fixture.input,
      options: planned.fixture.options, context: planned.fixture.contextVariants[planned.context],
      expectations: planned.fixture.expectations, output: result.cleanedOutput, status: result.status }
  }).sort((a, b) => a.blindId.localeCompare(b.blindId))
}
async function main() {
  const [command, directory, input] = process.argv.slice(2)
  if (!directory) throw new Error('Usage: research.mjs init|run|export|import DIRECTORY FILE')
  const target = resolve(directory)
  await mkdir(target, { recursive: true })
  const data = input ? JSON.parse(await readFile(input, 'utf8')) : undefined
  const db = openLedger(resolve(target, 'results.sqlite'), command === 'init' ? data : undefined)
  try {
    if (command === 'init') return
    if (command === 'run') {
      if (process.env.ENHANCE_SUBSCRIPTION_EVAL !== '1') throw new Error('Set ENHANCE_SUBSCRIPTION_EVAL=1 only with subscription evaluation authorization')
      await executePlan(db, data)
    } else if (command === 'export') {
      const packet = { rubric, instructions: 'Judge each output independently against the visible request/evidence. Score each dimension 0–2. Material scope expansion, approval violations, critical literal loss or invented critical facts are hard failures. Missing context alone is not a failure. Do not guess model or treatment. Return {reviewer, assessments:[{blindId,scores:[intent,grounding,preservation,usefulness],hardFailures:[],reason}]}', cases: blindPacket(db, data.phase) }
      await writeFile(resolve(target, `blind-${data.phase}.json`), JSON.stringify(packet, null, 2))
    } else if (command === 'import') {
      const identities = new Map(db.prepare('SELECT id FROM generation').all().map(row => [hash('blind-2026-11-16:' + row.id).slice(0, 14), row.id]))
      db.exec('BEGIN')
      try {
        for (const assessment of data.assessments) {
          const id = identities.get(assessment.blindId)
          if (!id) throw new Error('Unknown blind identifier')
          recordReview(db, id, data.reviewer, assessment)
        }
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
    } else throw new Error('Unknown command')
  } finally { db.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
