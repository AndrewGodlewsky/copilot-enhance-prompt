import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { buildSystemPrompt, buildUserMessage } from '../../src/prompts.ts'
import { promptCases, CORPUS_VERSION, rubric } from './prompt-cases.mjs'
import { openLedger, hash, planGeneration, claimGeneration, finishGeneration, literalChecks, recordReview } from './ledger.mjs'
import { prepare, executePlan, blindPacket } from './research.mjs'

function temporaryLedger(t, protocol = { callCeiling: 20, corpusVersion: CORPUS_VERSION }) {
  const parent = resolve(tmpdir())
  const directory = mkdtempSync(join(parent, 'enhance-prompt-eval-test-'))
  const path = join(directory, 'results.sqlite')
  const connections = []
  t.after(() => {
    for (const db of connections) db.close()
    assert.equal(dirname(resolve(directory)), parent)
    assert.ok(basename(directory).startsWith('enhance-prompt-eval-test-'))
    rmSync(directory, { recursive: true, force: true })
  })
  const open = value => {
    const db = openLedger(path, value)
    connections.push(db)
    return db
  }
  return { db: open(protocol), path, open }
}

const spec = (id, overrides = {}) => ({
  id, phase: 'tuning', caseId: 't01-small-literal-edit', tier: 'low', candidate: 'baseline', context: 'relevant', ...overrides
})
const resultOf = (db, id) => JSON.parse(db.prepare('SELECT result FROM generation WHERE id=?').get(id).result)
const successful = output => ({ status: 'ok', output, durationMs: 1, actualModels: ['claude-haiku-5-5'] })
const validReview = () => ({ scores: [2, 2, 2, 1], hardFailures: [], reason: 'All details survive; the prompt contains one unnecessary sentence.' })

test('evaluation corpus has stable splits, valid replay variants and lossless Unicode literals', () => {
  assert.equal(promptCases.length, 12)
  assert.equal(new Set(promptCases.map(item => item.id)).size, 12)
  assert.equal(promptCases.filter(item => item.split === 'tuning').length, 6)
  assert.equal(promptCases.filter(item => item.split === 'holdout').length, 6)
  assert.equal(rubric.length, 4)
  assert.deepEqual(JSON.parse(JSON.stringify(promptCases)), promptCases)
  for (const fixture of promptCases) {
    assert.deepEqual(Object.keys(fixture.contextVariants), ['off', 'overview', 'relevant', 'noisy'])
    assert.deepEqual(fixture.contextVariants.off, [])
    assert.deepEqual(fixture.contextVariants.noisy.slice(0, -1), fixture.contextVariants.relevant)
    assert.ok(fixture.expectations.requiredIntent.length)
    for (const literal of fixture.expectations.mustInclude) assert.ok(fixture.input.includes(literal), fixture.id)
    for (const blocks of Object.values(fixture.contextVariants)) {
      for (const block of blocks) {
        for (const key of ['kind', 'label', 'content']) assert.equal(typeof block[key], 'string')
      }
    }
  }
  const unicode = promptCases.find(item => item.id === 't04-unicode-and-language')
  assert.deepEqual(literalChecks(unicode.input, unicode.expectations), { missing: [], forbidden: [] })
  assert.ok(literalChecks(unicode.input.replace('👩🏽‍💻', '👩‍💻'), unicode.expectations).missing.length > 0)
  assert.deepEqual(literalChecks('Alpha forbidden', { mustInclude: ['alpha'], mustNotInclude: ['forbidden'] }), {
    missing: ['alpha'], forbidden: ['forbidden']
  })
})

test('baseline uses byte-identical production system and user prompts for every case and replay variant', () => {
  for (const fixture of promptCases) {
    for (const context of Object.keys(fixture.contextVariants)) {
      const row = prepare(spec('baseline', { caseId: fixture.id, context }))
      assert.deepEqual(Buffer.from(row.system), Buffer.from(buildSystemPrompt(fixture.options)))
      assert.deepEqual(Buffer.from(row.user), Buffer.from(buildUserMessage(fixture.input, fixture.contextVariants[context])))
      assert.equal(row.systemHash, hash(row.system))
      assert.equal(row.userHash, hash(row.user))
    }
  }
})

test('candidate transformations preserve production style, custom instructions, task boundaries and output policy', () => {
  const boundary = '- Output just the final prompt text, starting with its first line: no preamble, no explanation, no surrounding code fence.'
  const candidates = {
    append: { kind: 'append', text: 'Evaluation-only appended instruction.' },
    replace: { kind: 'replace-base', text: 'Evaluation-only replacement core.' }
  }
  for (const fixture of promptCases) {
    const baseline = prepare(spec('baseline', { caseId: fixture.id }))
    const appended = prepare(spec('append', { caseId: fixture.id, candidate: 'append' }), candidates)
    const replaced = prepare(spec('replace', { caseId: fixture.id, candidate: 'replace' }), candidates)
    const suffix = baseline.system.slice(baseline.system.indexOf(boundary) + boundary.length)
    assert.ok(suffix.includes('Output policy: Write all final rewritten instructions and headings in English'))
    assert.equal(appended.system, baseline.system + '\n\n' + candidates.append.text)
    assert.equal(replaced.system, candidates.replace.text + suffix)
    assert.equal(appended.user, baseline.user)
    assert.equal(replaced.user, baseline.user)
  }
  assert.throws(() => prepare(spec('bad', { candidate: 'unknown' })), /Unregistered candidate/)
  assert.throws(() => prepare(spec('bad', { candidate: 'bad' }), { bad: { kind: 'unknown', text: 'x' } }), /Unsupported candidate/)
  assert.throws(() => prepare(spec('bad', { caseId: 'not-a-fixture' })), /Unknown synthetic case/)
  assert.throws(() => prepare(spec('bad', { context: 'live-project' })), /Unknown synthetic case/)
})

test('execution sends only prepared prompts and model configuration, never evaluation expectations', async t => {
  const { db } = temporaryLedger(t)
  const fixture = promptCases[0]
  const sentinel = 'EVALUATION_ONLY_EXPECTATION_948321'
  fixture.expectations.rubricNotes.push(sentinel)
  t.after(() => fixture.expectations.rubricNotes.splice(fixture.expectations.rubricNotes.indexOf(sentinel), 1))
  let invocations = 0
  await executePlan(db, { generations: [spec('input-contract')], concurrency: 1 }, async request => {
    invocations++
    assert.deepEqual(Object.keys(request).sort(), ['model', 'provider', 'reasoning', 'system', 'timeoutMs', 'user'])
    assert.equal(request.provider, 'claude')
    assert.ok(!JSON.stringify(request).includes(sentinel))
    assert.ok(!request.user.includes('mustInclude'))
    assert.ok(!request.user.includes('requiredIntent'))
    return successful('Change src/ui/SaveButton.tsx from Svae to Save.')
  })
  assert.equal(invocations, 1)
  const result = resultOf(db, 'input-contract')
  assert.deepEqual(result.literalChecks, { missing: [], forbidden: [] })
  assert.ok(result.inputCharacters > 0)
})

test('ledger preserves frozen protocols, immutable plans and exact synthetic text across reopen', t => {
  const protocol = { callCeiling: 4, corpusVersion: CORPUS_VERSION }
  const { db, path, open } = temporaryLedger(t, protocol)
  const row = prepare(spec('immutable', { caseId: 't04-unicode-and-language' }))
  assert.equal(planGeneration(db, row), true)
  assert.equal(planGeneration(db, row), false)
  assert.throws(() => planGeneration(db, { ...row, system: row.system + '\nChanged' }), /Planned generation changed/)
  assert.throws(() => openLedger(path, { ...protocol, callCeiling: 5 }), /Protocol mismatch/)
  const reopened = open()
  assert.deepEqual(JSON.parse(reopened.prepare('SELECT planned FROM generation WHERE id=?').get(row.id).planned), row)
  assert.deepEqual(JSON.parse(reopened.prepare('SELECT protocol FROM study').get().protocol), protocol)
  assert.throws(() => finishGeneration(db, row.id, successful('not started')), /not active/)
  assert.throws(() => claimGeneration(db, 'unknown'), /Unknown generation/)
})

test('resuming never repeats completed calls or silently retries interrupted calls', async t => {
  const { db } = temporaryLedger(t)
  const interrupted = prepare(spec('interrupted'))
  planGeneration(db, interrupted)
  assert.equal(claimGeneration(db, interrupted.id), true)
  let invocations = 0
  const plan = { generations: [spec('interrupted'), spec('completed')], concurrency: 1 }
  const invoke = async () => { invocations++; return successful('A synthetic result.') }
  await executePlan(db, plan, invoke)
  await executePlan(db, plan, invoke)
  assert.equal(invocations, 1)
  assert.equal(db.prepare('SELECT finished FROM generation WHERE id=?').get('interrupted').finished, null)
  assert.equal(resultOf(db, 'completed').status, 'ok')
  assert.throws(() => finishGeneration(db, 'completed', successful('replacement')), /already finished/)
  await assert.rejects(executePlan(db, { generations: [spec('completed', { context: 'off' })] }, invoke), /Planned generation changed/)
  assert.equal(invocations, 1)
})

test('invalid or exhausted budgets fail closed before another invocation', async t => {
  const { db, path } = temporaryLedger(t, { callCeiling: 0 })
  for (const callCeiling of [undefined, -1, 1.5, '2', null, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => openLedger(path, { callCeiling }), /Invalid call ceiling/)
  }
  let invocations = 0
  await assert.rejects(executePlan(db, { generations: [spec('zero-budget')] }, async () => {
    invocations++
    return successful('Unexpected')
  }), /call ceiling/)
  assert.equal(invocations, 0)
  assert.equal(db.prepare('SELECT count(*) AS n FROM generation WHERE started IS NOT NULL').get().n, 0)
})

test('concurrent budget exhaustion waits for already-started calls to persist', async t => {
  const { db } = temporaryLedger(t, { callCeiling: 1 })
  let invocations = 0
  await assert.rejects(executePlan(db, {
    generations: [spec('allowed'), spec('over-budget'), spec('also-over-budget')], concurrency: 3
  }, async () => {
    invocations++
    await new Promise(resolve => setTimeout(resolve, 10))
    return successful('Completed despite the sibling budget rejection.')
  }), /call ceiling/)
  assert.equal(invocations, 1)
  assert.equal(resultOf(db, 'allowed').status, 'ok')
  assert.equal(db.prepare('SELECT count(*) AS n FROM generation WHERE started IS NOT NULL').get().n, 1)
  assert.equal(db.prepare('SELECT count(*) AS n FROM generation WHERE finished IS NOT NULL').get().n, 1)
})

test('failed calls and model mismatches retain evidence and consume the call budget', async t => {
  const { db } = temporaryLedger(t, { callCeiling: 3 })
  let invocations = 0
  const plan = { generations: [spec('throws'), spec('provider-failure'), spec('wrong-model')], concurrency: 1 }
  await executePlan(db, plan, async () => {
    invocations++
    if (invocations === 1) throw new Error('Synthetic connection failure')
    if (invocations === 2) return { status: 'failed', error: 'Synthetic provider refusal', output: '', durationMs: 2 }
    return { ...successful('A retained response.'), actualModels: ['unexpected-synthetic-model'], usage: { input_tokens: 7 } }
  })
  assert.equal(resultOf(db, 'throws').status, 'runner_error')
  assert.equal(resultOf(db, 'throws').error, 'Synthetic connection failure')
  assert.equal(resultOf(db, 'provider-failure').status, 'failed')
  const mismatch = resultOf(db, 'wrong-model')
  assert.equal(mismatch.status, 'model_mismatch')
  assert.equal(mismatch.output, 'A retained response.')
  assert.deepEqual(mismatch.actualModels, ['unexpected-synthetic-model'])
  assert.deepEqual(mismatch.usage, { input_tokens: 7 })
  await executePlan(db, plan, async () => { throw new Error('Resume must not invoke') })
  await assert.rejects(executePlan(db, { generations: [spec('extra')] }, async () => {
    invocations++
    return successful('Unexpected')
  }), /call ceiling/)
  assert.equal(invocations, 3)
})

test('reviews require complete successful evidence, anchored scores and reviewer reasons', async t => {
  const { db } = temporaryLedger(t)
  planGeneration(db, prepare(spec('unfinished')))
  await executePlan(db, { generations: [spec('reviewable'), spec('failed')], concurrency: 1 }, async request =>
    db.prepare('SELECT finished FROM generation WHERE id=?').get('reviewable').finished
      ? { status: 'failed', output: '' } : successful('Synthetic reviewed output.'))
  assert.throws(() => recordReview(db, 'unfinished', 'reviewer', validReview()), /completed successful/)
  assert.throws(() => recordReview(db, 'failed', 'reviewer', validReview()), /completed successful/)
  for (const reviewer of ['', '   ', 123]) assert.throws(() => recordReview(db, 'reviewable', reviewer, validReview()), /Invalid assessment/)
  for (const patch of [
    { scores: [2, 2, 2] }, { scores: [2, 2, 2, 3] }, { scores: [2, 2, 2, 0.5] },
    { scores: [2, 2, 2, '1'] }, { reason: ' ' }, { hardFailures: 'none' }, { hardFailures: [7] }, { hardFailures: [''] }
  ]) assert.throws(() => recordReview(db, 'reviewable', 'reviewer', { ...validReview(), ...patch }), /Invalid assessment/)
  recordReview(db, 'reviewable', 'human-reviewer', validReview())
  assert.throws(() => recordReview(db, 'reviewable', 'human-reviewer', validReview()), /UNIQUE/)
  assert.deepEqual(JSON.parse(db.prepare('SELECT assessment FROM review').get().assessment), validReview())
})

test('blind export excludes treatment identity, unstarted rows and other phases while retaining judging evidence', async t => {
  const { db } = temporaryLedger(t)
  const generations = [
    spec('MODEL_ID_BASELINE_PRIVATE'),
    spec('MODEL_ID_CANDIDATE_PRIVATE', { candidate: 'CANDIDATE_ID_PRIVATE' }),
    spec('holdout-output', { phase: 'holdout', caseId: 'h01-refactor-with-exception' })
  ]
  await executePlan(db, {
    generations, concurrency: 1, candidates: { CANDIDATE_ID_PRIVATE: { kind: 'append', text: 'SYSTEM_TREATMENT_PRIVATE' } }
  }, async () => successful('A synthetic output without treatment identity.'))
  planGeneration(db, prepare(spec('never-started')))
  const packet = blindPacket(db, 'tuning')
  assert.equal(packet.length, 2)
  assert.equal(new Set(packet.map(item => item.blindId)).size, 2)
  assert.deepEqual(blindPacket(db, 'tuning'), packet)
  for (const item of packet) {
    assert.match(item.blindId, /^[a-f0-9]{14}$/)
    assert.deepEqual(Object.keys(item).sort(), ['blindId', 'context', 'expectations', 'options', 'output', 'request', 'status'])
    assert.deepEqual(item.context, promptCases[0].contextVariants.relevant)
    assert.equal(item.request, promptCases[0].input)
    assert.deepEqual(item.expectations, promptCases[0].expectations)
  }
  for (const identity of ['MODEL_ID_', 'CANDIDATE_ID_PRIVATE', 'SYSTEM_TREATMENT_PRIVATE', 'claude-haiku-5-5', 'holdout-output']) {
    assert.ok(!JSON.stringify(packet).includes(identity), identity)
  }
})
