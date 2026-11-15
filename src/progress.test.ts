// Real progress: the worker reports each step it actually reaches; the panel shows it, then ends the
// run as done, failed or cancelled.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { after } from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { read, set } from '#panel'
import { assert, mockHost, mountWorker, test } from '#testing'
import { messageIn, msg, plainText, withMessage } from './messages.ts'
import { applyProgress, beginRun, cancel, enhanceNow, finishRun } from './panel/actions.ts'
import { draft, lastRun, put, result, run, tick } from './panel/state.ts'
import { mountPanel } from './panel/testing.ts'
import { runSeconds, seconds, stepShare, stepText } from './panel/view.ts'
import { type ProfileView } from './presets.ts'
import { createProgress, planSteps, stepPercent, STEP_WEIGHTS, totalPercent, type ProgressSnapshot, type Step } from './progress.ts'
import * as main from './worker.ts'

// Every temporary folder a test makes is removed when the file's tests are done.
const tempDirs: string[] = []
after(() => {
  for (const folder of tempDirs) {
    try {
      rmSync(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    } catch {
      // still in use (Windows): the OS temp cleaner gets it
    }
  }
})
function tempDir(prefix: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(folder)
  return folder
}

test('planSteps follows the level and Privacy', () => {
  assert.deepEqual(planSteps('off', true), ['model'])
  assert.deepEqual(planSteps('basic', true), ['workspace', 'model'])
  assert.deepEqual(planSteps('standard', true), ['workspace', 'project', 'model'])
  assert.deepEqual(planSteps('deep', true), ['workspace', 'project', 'git', 'search', 'model'])
  assert.deepEqual(planSteps('max', true), ['workspace', 'project', 'git', 'search', 'pick', 'terminal', 'model'])
  assert.deepEqual(planSteps('deep', false), ['workspace', 'model'])
})

test('createProgress sends a full snapshot on every change, with when each step started and how far it got', () => {
  const sent: ProgressSnapshot[] = []
  let now = 1000
  const step = createProgress('r1', ['workspace', 'git', 'model'], (snapshot) => sent.push(snapshot), () => now)
  step('workspace', 'running')
  now = 1100
  step('workspace', 'done', 'demo')
  step('git', 'running')
  step('git', 'running', undefined, 2 / 3)
  step('git', 'done', '3')
  now = 2000
  step('model', 'running', 'GitHub Copilot · gpt')
  assert.equal(sent.length, 7)
  assert.deepEqual(sent.at(-1)!.steps, [
    { key: 'workspace', status: 'done', detail: 'demo', startedAt: 1000 },
    { key: 'git', status: 'done', detail: '3', startedAt: 1100 },
    { key: 'model', status: 'running', detail: 'GitHub Copilot · gpt', startedAt: 2000 }
  ])
  assert.equal(sent[4].steps[1].fraction, 2 / 3)
})

test('step and total percentages: 0 to 100, consistent, never over 100, never 100 before the end', () => {
  const at = 10_000
  const steps = (...list: Partial<Step>[]): Step[] => list.map((entry) => ({ key: 'workspace', status: 'pending', ...entry }) as Step)
  // Nothing known yet, or nothing planned.
  assert.equal(totalPercent([]), 0)
  assert.equal(totalPercent(steps({ key: 'workspace' }, { key: 'model' })), 0)
  // Counted fraction of a running step; done is 100; skipped is left out.
  assert.equal(stepPercent({ key: 'git', status: 'running', fraction: 2 / 3 }), 67)
  assert.equal(stepPercent({ key: 'git', status: 'running', fraction: 1 }), 99)
  assert.equal(stepPercent({ key: 'git', status: 'skipped' }), null)
  // The model estimate grows with time, stays at or under 95 while running.
  const model = (ms: number) => stepPercent({ key: 'model', status: 'running', startedAt: at }, at + ms)!
  assert.equal(model(0), 0)
  assert.ok(model(4000) > 20 && model(4000) < model(12_000) && model(12_000) < 95)
  // A slow model: the bar is still moving after a minute and after three (a run may take five),
  // not sitting at its end from half a minute on.
  assert.deepEqual([model(8000), model(18_000), model(60_000), model(120_000), model(180_000), model(300_000)], [41, 60, 77, 86, 90, 94])
  assert.equal(model(10 * 60_000), 95)
  // The total is the weighted mean of the step shares, skipped steps excluded.
  const mixed = steps({ key: 'workspace', status: 'done' }, { key: 'git', status: 'skipped' }, { key: 'search', status: 'running', fraction: 0.5 }, { key: 'model' })
  const expected = (100 * STEP_WEIGHTS.workspace + 50 * STEP_WEIGHTS.search + 0 * STEP_WEIGHTS.model) / (STEP_WEIGHTS.workspace + STEP_WEIGHTS.search + STEP_WEIGHTS.model)
  assert.equal(totalPercent(mixed), Math.round(expected))
  // Never 100 before every step is done, even when rounding would say so; exactly 100 at the end.
  const almost = steps({ key: 'workspace', status: 'done' }, { key: 'model', status: 'running', fraction: 0.999 })
  assert.equal(totalPercent(almost), 99)
  assert.equal(totalPercent(steps({ key: 'workspace', status: 'done' }, { key: 'model', status: 'done' })), 100)
  assert.equal(totalPercent(steps({ key: 'workspace', status: 'skipped' }, { key: 'model', status: 'done' })), 100)
  // A failed step keeps what it reached; the total does not pass it and never goes past 100.
  const failed = steps({ key: 'workspace', status: 'done' }, { key: 'model', status: 'failed', fraction: 0.4 })
  assert.equal(stepPercent(failed[1]), 40)
  assert.ok(totalPercent(failed) < 100)
})

test('the worker reports the real steps of a Deep run, in order, to the asking panel only', async () => {
  const root = tempDir('progress-')
  writeFileSync(join(root, 'AGENTS.md'), 'Use pnpm.')
  writeFileSync(join(root, 'login.ts'), 'export const login = 1\n')
  const host = mockHost({
    storage: { models: { profiles: [{ id: 'oa', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-4.1-mini', enabled: true }] } },
    results: {
      'copilot.rewrite': { text: 'ok' },
      'workspace.readContext': { branch: 'main', displayName: 'demo', terminals: [] },
      'workspace.list': { workspaces: [{ id: 'w', kind: 'folder', name: 'demo', path: root, branch: 'main', hostId: null }], truncated: false },
      'agents.list': { agents: [] }
    }
  })
  const worker = await mountWorker(main, { host })
  await worker.request('prompt.enhance', { prompt: 'fix login', level: 'deep', runId: 'run-1' }, { panel: 'enhance' })
  const snapshots = worker.posts.filter((post) => post.event === 'enhance.progress').map((post) => post.payload as ProgressSnapshot)
  assert.ok(snapshots.length >= 8, `got ${snapshots.length}`)
  assert.ok(snapshots.every((snapshot) => snapshot.runId === 'run-1'))
  // First snapshot: the plan, all pending. Last: everything finished, the model done.
  assert.deepEqual(snapshots[0].steps.map((step) => step.status), ['pending', 'pending', 'pending', 'pending', 'pending'])
  const last = snapshots.at(-1)!.steps
  assert.deepEqual(last.map((step) => step.key), ['workspace', 'project', 'git', 'search', 'model'])
  assert.deepEqual(last.map((step) => step.status), ['done', 'done', 'skipped', 'done', 'done'])
  assert.match(last[4].detail ?? '', /GitHub Copilot · gpt-4.1-mini/)
  // Without a runId (other callers), nothing is posted.
  const before = worker.posts.length
  await worker.request('prompt.enhance', { prompt: 'fix login', level: 'off' })
  assert.equal(worker.posts.length, before)
  await worker.deactivate()
})

test('a failing model marks the model step failed', async () => {
  const host = mockHost({
    storage: { models: { profiles: [{ id: 'oa', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt', enabled: true }] } },
    results: { 'workspace.readContext': null, 'copilot.rewrite': () => { throw new Error('Copilot unavailable') } }
  })
  const worker = await mountWorker(main, { host })
  // Why it failed is the run's error (which the panel shows in its own language)...
  await assert.rejects(worker.request('prompt.enhance', { prompt: 'x', level: 'off', runId: 'r' }), /Copilot unavailable/)
  const last = (worker.posts.filter((post) => post.event === 'enhance.progress').at(-1)!.payload as ProgressSnapshot).steps
  assert.equal(last.at(-1)!.status, 'failed')
  // ...and the failed step names the model that was tried, not an English sentence.
  assert.equal(last.at(-1)!.detail, 'GitHub Copilot · gpt')
  await worker.deactivate()
})

const gpt: ProfileView = { id: 'gpt', name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: 'gpt-4.1-mini', enabled: true, effectiveModel: 'gpt-4.1-mini' }
const models = { profiles: [gpt], selectorProfileId: null }

test('the panel shows live steps, ignores old runs, and ends with the result or Try again', async () => {
  let fail = false
  const host = mockHost({
    requests: {
      'models.get': models,
      'targets.list': { targets: [] },
      'prompt.enhance': (input) => {
        if (fail) throw Object.assign(new Error('All models failed.'), { code: 'action_failed' })
        return { enhanced: `Better: ${input.prompt}`, model: 'gpt-4.1-mini', profileName: 'GitHub Copilot', ms: 1500, attempts: [], context: [], notes: [] }
      }
    }
  })
  const view = await mountPanel(host)

  // While a run is going: the worker's snapshots drive the card.
  beginRun('r1')
  applyProgress({
    runId: 'r1',
    startedAt: Date.now(),
    steps: [
      { key: 'workspace', status: 'done', detail: 'demo' },
      { key: 'model', status: 'running', detail: 'GitHub Copilot · gpt-4.1-mini' }
    ]
  })
  const live = read(run)!
  assert.equal(stepText(live.steps[1]), 'Writing the prompt · GitHub Copilot · gpt-4.1-mini')
  // Workspace done (weight 0.5), model just started (weight 5): 100 × 0.5 / 5.5 ≈ 9%.
  assert.equal(totalPercent(live.steps, read(tick)), 9)
  assert.equal(stepShare(live.steps[0], read(tick)), '100%')
  // A snapshot of an older run is ignored.
  applyProgress({ runId: 'old', startedAt: 0, steps: [{ key: 'git', status: 'running' }] })
  assert.deepEqual(read(run)!.steps.map((step) => step.key), ['workspace', 'model'])

  // A real run replaces it and ends with the result (the card goes; the result says "Done · 1.5 s").
  put(draft, 'fix it')
  await enhanceNow()
  assert.equal(read(run)?.status, 'done')
  assert.equal(seconds(read(lastRun)!.ms), '1.5 s')
  const sent = host.callsOf('plugin.request').at(-1) as { input: { runId: string } }
  assert.ok(sent.input.runId)

  // A failure keeps the card, with the error, for Try again.
  fail = true
  await enhanceNow()
  assert.equal(read(run)?.status, 'error')
  assert.match(read(run)?.error ?? '', /All models failed/)
  fail = false
  await enhanceNow()
  assert.equal(read(run)?.status, 'done')
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('a failed run uses English despite a legacy language preference, with only the error code and text', async () => {
  // What the real Copilot hands the panel when the worker's handler throws: an Error with a code and
  // the text, and no other field of the thrown error.
  let thrown = withMessage(msg('error.too_slow', { reason: msg('error.model_timeout', { model: 'claude-fable-5-2', seconds: 109 }) }))
  const host = mockHost({
    settings: { uiLanguage: 'vi' },
    requests: {
      'models.get': models,
      'targets.list': { targets: [] },
      'prompt.enhance': () => {
        throw Object.assign(new Error(thrown), { code: 'timeout' })
      }
    }
  })
  const view = await mountPanel(host)
  put(draft, 'fix it')
  await enhanceNow()
  assert.equal(read(run)?.status, 'error')
  assert.equal(read(run)?.error, 'claude-fable-5-2 did not answer within 109 s. A lower context level or a faster model answers sooner.')
  // Cut short on the way: the sentence as it came, without the marks of what it carried.
  thrown = thrown.slice(0, -6)
  await enhanceNow()
  assert.equal(read(run)?.error, 'claude-fable-5-2 did not answer within 109 s. A lower context level or a faster model answers sooner.')
  // An error that carries nothing (Copilot's own) is shown as it is.
  thrown = 'The plugin worker could not start.'
  await enhanceNow()
  assert.equal(read(run)?.error, 'The plugin worker could not start.')
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('a run that outlasts one request: the panel keeps asking until the prompt is there, and Cancel still stops it', async () => {
  // Copilot ends a panel's request after 120 s. The worker answers "pending" before that, and the run
  // goes on there; here it does so twice, then answers.
  const inputs: Record<string, unknown>[] = []
  let pendingAnswers = 2
  let holding = false
  let stopWaiting: ((error: Error) => void) | null = null
  const still = { pending: true, enhanced: '', model: '', profileName: '', ms: 100_000, attempts: [], context: [], notes: [] }
  const host = mockHost({
    requests: {
      'models.get': models,
      'targets.list': { targets: [] },
      'prompt.enhance': async (input) => {
        inputs.push({ ...input })
        if (holding) await new Promise<void>((_resolve, reject) => (stopWaiting = reject))
        if (pendingAnswers > 0) {
          pendingAnswers -= 1
          return still
        }
        return { enhanced: `Better: ${input.prompt}`, model: 'claude-fable-5-2', profileName: 'Claude Code', ms: 215_000, attempts: [], context: [], notes: [] }
      }
    }
  })
  const view = await mountPanel(host)
  put(draft, 'fix it')
  await enhanceNow()
  assert.equal(read(run)?.status, 'done')
  assert.equal(read(result), 'Better: fix it')
  assert.equal(seconds(read(lastRun)!.ms), '215.0 s')
  // The first request starts the run and says the panel keeps waiting; the next ones only ask again.
  assert.equal(inputs.length, 3)
  assert.equal(inputs[0].resumable, true)
  assert.equal(inputs[0].resume, undefined)
  assert.deepEqual(inputs.slice(1).map((input) => [input.resume, input.runId === inputs[0].runId]), [[true, true], [true, true]])

  // Cancel while the panel waits: Copilot ends the waiting request (and stops the worker's side with
  // it, which stops the run); the run card says cancelled and nothing is shown.
  put(result, '')
  inputs.length = 0
  pendingAnswers = 5
  holding = true
  const enhancing = enhanceNow()
  for (let i = 0; i < 200 && !stopWaiting; i++) await new Promise((resolve) => setTimeout(resolve, 5))
  cancel()
  stopWaiting!(Object.assign(new Error('Cancelled.'), { code: 'cancelled' }))
  await enhancing
  assert.equal(inputs.length, 1)
  assert.equal(read(run)?.status, 'cancelled')
  assert.equal(read(result), '')
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test('a slow model: the only one may use the rest of the run; one with another after it gets the per-model timeout', async () => {
  const saved = main.RUN_LIMITS.budgetMs
  main.RUN_LIMITS.budgetMs = 1200
  // Each model answers after its own delay, unless it is stopped first.
  const delays: Record<string, number> = { slow: 500, hung: 5000, quick: 20 }
  const stopped: string[] = []
  const rewrite = ({ model }: { model: string }, options?: { signal?: AbortSignal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ text: `answer of ${model}` }), delays[model])
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        stopped.push(model)
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
  const profile = (id: string) => ({ id, name: id, preset: 'copilot', provider: 'copilot', model: id, enabled: true })
  const hostWith = (ids: string[]) =>
    mockHost({
      storage: { models: { profiles: ids.map(profile) } },
      // 0.2 s per model: far less than the slow model needs.
      settings: { timeoutSeconds: 0.2, fallbackEnabled: true },
      results: { 'workspace.readContext': null, 'copilot.rewrite': rewrite }
    })
  try {
    // The only model: it is not cut at 0.2 s, since nothing comes after it. It answers at 0.5 s.
    const alone = await mountWorker(main, { host: hostWith(['slow']) })
    const answer = await alone.request('prompt.enhance', { prompt: 'x', level: 'off' })
    assert.equal(answer.enhanced, 'answer of slow')
    assert.deepEqual(stopped, [])
    await alone.deactivate()

    // With another model after it, the slow one is stopped at 0.2 s so the next has time; the run
    // says which model was too slow, and the next one answers.
    const chain = await mountWorker(main, { host: hostWith(['slow', 'quick']) })
    const fallback = await chain.request('prompt.enhance', { prompt: 'x', level: 'off' })
    assert.equal(fallback.enhanced, 'answer of quick')
    assert.deepEqual(stopped, ['slow'])
    assert.deepEqual(fallback.attempts.map((attempt) => [attempt.name, attempt.ok, attempt.errorText?.code ?? null]), [['slow', false, 'error.model_timeout'], ['quick', true, null]])
    assert.equal(fallback.attempts[0].error, 'slow did not answer within 1 s.')
    await chain.deactivate()

    // The only model never answers: the run ends at its own limit and says so, with what helps.
    stopped.length = 0
    const hung = await mountWorker(main, { host: hostWith(['hung']) })
    const started = Date.now()
    const failure = await hung.request('prompt.enhance', { prompt: 'x', level: 'off', runId: 'r' }).then(
      () => null,
      (error: Error) => error
    )
    assert.ok(failure && Date.now() - started < 3000 && Date.now() - started >= 1000, `took ${Date.now() - started} ms`)
    assert.deepEqual(stopped, ['hung'])
    assert.match(plainText(failure.message), /^hung did not answer within 1 s\. A lower context level or a faster model answers sooner\.$/)
    assert.equal(messageIn(failure.message)?.code, 'error.too_slow')
    const steps = (hung.posts.filter((post) => post.event === 'enhance.progress').at(-1)!.payload as ProgressSnapshot).steps
    assert.deepEqual([steps.at(-1)!.status, steps.at(-1)!.detail], ['failed', 'hung · hung'])
    await hung.deactivate()
  } finally {
    main.RUN_LIMITS.budgetMs = saved
  }
})

test('the run card shows the total and every step in percent, ≈ for an estimate, – for skipped; a cancel freezes the bar', async () => {
  const host = mockHost({
    requests: {
      'models.get': models,
      'targets.list': { targets: [] },
      'rules.get': { rules: [], structures: [] }
    }
  })
  const view = await mountPanel(host)
  beginRun('r2')
  const started = Date.now()
  applyProgress({
    runId: 'r2',
    startedAt: started,
    steps: [
      { key: 'workspace', status: 'done', detail: 'demo' },
      { key: 'project', status: 'done', detail: '42' },
      { key: 'git', status: 'skipped' },
      { key: 'search', status: 'running', fraction: 0.5 },
      { key: 'model', status: 'pending' }
    ]
  })
  let steps = read(run)!.steps
  // (100 × 0.5 + 100 × 1 + 50 × 1 + 0 × 5) / (0.5 + 1 + 1 + 5) = 26.7 → 27%
  assert.equal(totalPercent(steps, started), 27)
  assert.deepEqual(steps.map((step) => stepShare(step, started)), ['100%', '100%', '–', '50%', '0%'])

  // The model call runs for a while: its share is an estimate, marked ≈.
  const now = Date.now()
  applyProgress({
    runId: 'r2',
    startedAt: started,
    steps: [
      { key: 'workspace', status: 'done' },
      { key: 'project', status: 'done' },
      { key: 'git', status: 'skipped' },
      { key: 'search', status: 'done', detail: '3' },
      { key: 'model', status: 'running', detail: 'GitHub Copilot · gpt', startedAt: now - 8000 }
    ]
  })
  steps = read(run)!.steps
  const model = stepShare(steps[4], now)
  assert.match(model, /^≈\d+%$/)
  const estimate = Number(model.slice(1, -1))
  assert.ok(estimate > 35 && estimate < 95, String(estimate))

  // Cancel: the bar stays where it was, never 100%, and the card ends.
  set(tick, now)
  const before = totalPercent(steps, now)
  finishRun('r2', 'cancelled')
  const ended = read(run)!
  assert.equal(ended.status, 'cancelled')
  assert.ok(ended.endPercent !== undefined && ended.endPercent >= before - 1 && ended.endPercent < 100, `${before} → ${ended.endPercent}`)
  // The stopped model step still shows what it had reached, so the total stays the mean of what is shown.
  assert.equal(ended.steps[4].status, 'skipped')
  assert.match(stepShare(ended.steps[4], ended.finishedAt ?? now), /^\d+%$/)
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

test("the run card never shows a negative time: its clock starts with the run, and the worker's later clock counts as zero", async () => {
  const host = mockHost({ requests: { 'models.get': models, 'targets.list': { targets: [] } } })
  const view = await mountPanel(host)
  // The card's clock only moves while a run goes: here it still shows a moment long before this run.
  set(tick, Date.now() - 60_000)
  beginRun('r3')
  const current = read(run)!
  assert.ok(read(tick) >= current.startedAt, 'the clock was left behind the start of the run')
  assert.equal(runSeconds(current, read(tick)), '0.0 s')
  // The worker's clock starts a moment after the panel's.
  applyProgress({ runId: 'r3', startedAt: read(tick) + 40, steps: [{ key: 'model', status: 'running' }] })
  assert.equal(runSeconds(read(run)!, read(tick)), '0.0 s')
  assert.equal(runSeconds(read(run)!, read(tick) + 2540), '2.5 s')
  // After the end, the time is the run's own, whatever the clock says.
  finishRun('r3', 'cancelled')
  const ended = read(run)!
  assert.equal(runSeconds(ended, (ended.finishedAt ?? 0) + 9000), runSeconds(ended, ended.finishedAt ?? 0))
  await view.unmount()
})
