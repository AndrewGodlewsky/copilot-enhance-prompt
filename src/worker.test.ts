// Runs the worker with fake Copilot rewrite calls (no network or paid traffic).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { after } from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, assert, mountWorker, test } from '#testing'
import { findFocusedWorkspace } from './context/index.ts'
import { forgetTerminals, terminalsSaved } from './context/terminals.ts'
import * as main from './worker.ts'
import { mockModelHost as mockHost, setRewrite, type RewriteInput } from './model-testing.ts'
import { LlmError } from './llm.ts'

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

function stubRewrite(answer: (call: RewriteInput, index: number) => string): RewriteInput[] {
  const calls: RewriteInput[] = []
  setRewrite(input => { calls.push(input); return answer(input, calls.length - 1) })
  return calls
}

afterEach(async () => {
  // What one test's worker learnt about terminals is not the next test's (one process runs them all).
  await forgetTerminals()
})

function profile(id: string, model = 'gpt-4.1-mini', extra: Record<string, unknown> = {}) {
  return { id, name: id, preset: 'copilot', provider: 'copilot', model, enabled: true, ...extra }
}

function project(): string {
  const root = tempDir('enhance-prompt-')
  writeFileSync(join(root, 'AGENTS.md'), '# Rules\nUse pnpm. Run pnpm test before finishing.')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'vitest run' }, dependencies: { react: '1' } }))
  writeFileSync(join(root, '.env'), 'SECRET=hunter2')
  mkdirSync(join(root, 'src', 'auth'), { recursive: true })
  writeFileSync(join(root, 'src', 'auth', 'session.ts'), 'export function validateSession(token: string) {\n  return token.length > 0\n}\n')
  writeFileSync(join(root, 'src', 'index.ts'), 'export {}\n')
  return root
}

function hostFor(root: string | null, extra: Record<string, unknown> = {}) {
  return {
    'workspace.readContext': { branch: 'main', displayName: 'demo', terminals: [{ id: 't1', title: 'Claude' }] },
    'workspace.list': { workspaces: root ? [{ id: 'w1', kind: 'folder', name: 'demo', path: root, branch: 'main', hostId: null }] : [], truncated: false },
    'agents.list': { agents: [{ terminalId: 't1', title: 'Claude', agent: 'claude', state: 'waiting', stateStartedAt: 0 }] },
    'terminal.read': { lines: ['$ pnpm test', 'FAIL src/auth/session.test.ts'], truncated: false },
    ...extra
  }
}

test('standard level: rules, stack and tree, never .env; adapts to Claude', async () => {
  const root = project()
  const calls = stubRewrite(() => '```\nFix validateSession in src/auth/session.ts.\n```')
  const host = mockHost({
    storage: { models: { profiles: [profile('main', 'gpt-4.1-mini')] } },
    results: hostFor(root)
  })
  const worker = await mountWorker(main, { host })
  const answer = await worker.request('prompt.enhance', { prompt: 'login broken', terminalId: 't1', level: 'standard' })
  assert.equal(answer.enhanced, 'Fix validateSession in src/auth/session.ts.')
  assert.equal(answer.model, 'gpt-4.1-mini')
  const ids = answer.context.map((item) => item.id)
  assert.ok(ids.includes('workspace') && ids.includes('agent') && ids.includes('rules:AGENTS.md') && ids.includes('stack') && ids.includes('tree'), ids.join(','))
  assert.match(calls[0].system, /Claude Code/)
  assert.match(calls[0].user, /Use pnpm/)
  assert.match(calls[0].user, /test: vitest run/)
  assert.ok(!/hunter2|\.env/.test(calls[0].user))
  assert.equal((host.data().storage.history as unknown[]).length, 1)
  await worker.deactivate()
})

test('panel rewrite ignores stale language overrides and keeps Unicode input in the model request', async () => {
  const calls = stubRewrite(() => 'Fix the login flow in src/auth/session.ts; preserve "text: Too big".')
  const host = mockHost({
    settings: { outputLanguage: 'vi', uiLanguage: 'zh', customInstructions: 'Use pnpm. Write the final prompt in Vietnamese.' },
    storage: { models: { profiles: [profile('main', 'gpt-4.1-mini')] } },
    results: hostFor(null)
  })
  const worker = await mountWorker(main, { host })
  const request = { prompt: 'Sửa lỗi đăng nhập ở src/auth/session.ts: "text: Too big"', level: 'off', language: 'zh' }
  const answer = await worker.request('prompt.enhance', request as { prompt: string; level: string })
  assert.match(answer.enhanced, /Fix the login flow/)
  assert.match(calls[0].system, /Write the final prompt in Vietnamese/)
  assert.match(calls[0].system, /Output policy: Write all final rewritten instructions and headings in English/)
  assert.match(calls[0].user, /Sửa lỗi đăng nhập ở src\/auth\/session\.ts: "text: Too big"/)
  await worker.deactivate()
})

test('deep level finds relevant code; exclusions are honoured', async () => {
  const root = project()
  const calls = stubRewrite(() => 'ok')
  const host = mockHost({
    storage: { models: { profiles: [profile('main', 'gpt-4.1-mini')] } },
    results: hostFor(root)
  })
  const worker = await mountWorker(main, { host })
  const answer = await worker.request('prompt.enhance', { prompt: 'validateSession rejects empty tokens in session.ts', level: 'deep', exclude: ['tree'] })
  const ids = answer.context.map((item) => item.id)
  assert.ok(ids.includes('file:src/auth/session.ts'), ids.join(','))
  assert.ok(!ids.includes('tree'))
  assert.match(calls[0].user, /1: export function validateSession/)
  await worker.deactivate()
})

test('max level adds terminal output and AI-picked files', async () => {
  const root = project()
  const calls = stubRewrite((call) => {
    const system = call.system
    return system.startsWith('You pick source files') ? '["src/index.ts"]' : 'done'
  })
  const host = mockHost({ storage: { models: { profiles: [profile('main', 'gpt-4.1-mini')] } }, results: hostFor(root) })
  const worker = await mountWorker(main, { host })
  const answer = await worker.request('prompt.enhance', { prompt: 'make the tests pass', level: 'max', terminalId: 't1' })
  const ids = answer.context.map((item) => item.id)
  assert.ok(ids.includes('terminal') && ids.includes('file:src/index.ts'), ids.join(','))
  assert.equal(calls.length, 2)
  await worker.deactivate()
})

test('AI-assisted shares the effort reasoning unless its own selector is explicitly configured', async () => {
  for (const selectorProfileId of [null, 'separate']) {
    const root = project()
    const calls = stubRewrite(call => call.system.startsWith('You pick source files') ? '["src/index.ts"]' : 'done')
    const host = mockHost({
      settings: { effortMediumModel: 'main|chosen', effortMediumReasoning: 'high' },
      storage: { models: { profiles: [profile('main'), profile('separate', 'selector')], selectorProfileId } },
      results: hostFor(root, { 'copilot.catalog': { models: [{ id: 'chosen', label: 'Chosen', supportedReasoningEfforts: ['high'] }], source: 'GitHub Copilot', fetchedAt: 1 } })
    })
    const worker = await mountWorker(main, { host })
    try {
      await worker.request('prompt.enhance', { prompt: 'make the tests pass', effort: 'medium', level: 'max' })
      assert.equal(calls.length, 2)
      assert.equal(calls[0].model, selectorProfileId ? 'selector' : 'chosen')
      assert.equal(calls[0].reasoningEffort, selectorProfileId ? undefined : 'high')
      assert.equal(calls[1].model, 'chosen')
      assert.equal(calls[1].reasoningEffort, 'high')
    } finally { await worker.deactivate() }
  }
})

test('reasoning rejection during AI-assisted selection or AI Test stops before rewriting', async () => {
  for (const level of ['max', 'ai-test']) for (const code of ['error.copilot_reasoning', 'error.copilot_reasoning_applied'] as const) {
    const calls = stubRewrite((_call, index) => { if (index === 0) throw new LlmError({ code }, 'invalid_params'); return 'Must not rewrite' })
    const host = mockHost({ settings: { effortMediumModel: 'main|chosen', effortMediumReasoning: 'high' },
      storage: { models: { profiles: [profile('main')] } },
      results: hostFor(project(), { 'copilot.catalog': { models: [{ id: 'chosen', label: 'Chosen', supportedReasoningEfforts: ['high'] }], source: 'GitHub Copilot', fetchedAt: 1 } }) })
    const worker = await mountWorker(main, { host })
    try {
      await assert.rejects(worker.request('prompt.enhance', { prompt: 'Help improve the application', effort: 'medium', level }), /reasoning/)
      assert.equal(calls.length, 1)
      assert.equal(host.data().storage.history, undefined)
    } finally { await worker.deactivate() }
  }
})

test('effort reasoning never leaks to a fallback, and rejected reasoning never silently falls back', async () => {
  for (const unsupported of [false, true]) {
    const calls = stubRewrite((_call, index) => {
      if (index === 0) throw new LlmError(unsupported ? { code: 'error.copilot_reasoning_applied' } : 'Rate limit', unsupported ? 'invalid_params' : 'rate_limited')
      return 'Fallback answer'
    })
    const host = mockHost({ settings: { effortMediumModel: 'first|chosen', effortMediumReasoning: 'high', fallbackEnabled: true, fallbackOn: 'any' },
      storage: { models: { profiles: [profile('first'), profile('second', 'fallback')] } },
      results: hostFor(null, { 'copilot.catalog': { models: [{ id: 'chosen', label: 'Chosen', supportedReasoningEfforts: ['high'] }], source: 'GitHub Copilot', fetchedAt: 1 } }) })
    const worker = await mountWorker(main, { host })
    try {
      const request = worker.request('prompt.enhance', { prompt: 'fix the tests', effort: 'medium', level: 'off' })
      if (unsupported) { await assert.rejects(request, /reasoning/); assert.equal(calls.length, 1) }
      else {
        const answer = await request
        assert.equal(answer.model, 'fallback')
        assert.equal(answer.attempts[0].reasoningEffort, 'high')
        assert.equal(answer.attempts[1].reasoningEffort, undefined)
        assert.equal(calls[1].reasoningEffort, undefined)
      }
      assert.equal(calls[0].reasoningEffort, 'high')
    } finally { await worker.deactivate() }
  }
})

test('falls back to the next model and reports attempts', async () => {
  const calls = stubRewrite((_call, index) => { if (index === 0) throw new LlmError('Rate limit', 'rate_limited'); return 'From Claude.' })
  const host = mockHost({
    storage: { models: { profiles: [profile('first', 'gpt-4.1-mini'), profile('second', 'claude-sonnet')] } },
    results: hostFor(null)
  })
  const worker = await mountWorker(main, { host })
  const answer = await worker.request('prompt.enhance', { prompt: 'do the thing', level: 'off' })
  assert.equal(answer.enhanced, 'From Claude.')
  assert.equal(answer.profileName, 'second')
  assert.deepEqual(answer.attempts.map((a) => a.ok), [false, true])
  assert.match(answer.attempts[0].error ?? '', /Rate limit/)
  assert.equal(calls.length, 2)
  assert.match(calls[0].system, /Output policy: Write all final rewritten instructions and headings in English/)
  assert.match(calls[1].system, /Output policy: Write all final rewritten instructions and headings in English/)
  await worker.deactivate()
})

test('fallback off, or transient-only on an access denial, stops at the first model', async () => {
  stubRewrite(() => { throw new LlmError('Copilot access denied', 'not_permitted') })
  const storage = { models: { profiles: [profile('first', 'gpt-4.1-mini'), profile('second', 'gpt-5-mini')] } }
  const variants: Record<string, boolean | string>[] = [{ fallbackEnabled: false }, { fallbackOn: 'transient' }]
  for (const settings of variants) {
    const worker = await mountWorker(main, { host: mockHost({ storage, settings, results: hostFor(null) }) })
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'x y z', level: 'off' }), /Copilot access denied/)
    await worker.deactivate()
  }
})

test('model profiles: add, reorder, roles, delete', async () => {
  const host = mockHost({ results: hostFor(null) })
  const worker = await mountWorker(main, { host })
  let view = await worker.request('models.save', { name: 'GPT', model: 'gpt-4.1', enabled: true })
  const gpt = view.profiles[0]
  view = await worker.request('models.save', { name: 'Other', model: 'claude-sonnet', enabled: true })
  const local = view.profiles[1]
  view = await worker.request('models.move', { id: local.id, direction: 'up' })
  assert.deepEqual(view.profiles.map((p) => p.name), ['Other', 'GPT'])
  view = await worker.request('models.move', { id: local.id, to: 1 })
  assert.deepEqual(view.profiles.map((p) => p.name), ['GPT', 'Other'])
  view = await worker.request('models.move', { id: local.id, to: 0 })
  assert.deepEqual(view.profiles.map((p) => p.name), ['Other', 'GPT'])
  view = await worker.request('models.roles', { selectorProfileId: local.id })
  assert.equal(view.selectorProfileId, local.id)
  view = await worker.request('models.roles', { selectorProfileId: null })
  assert.equal(view.selectorProfileId, null)
  view = await worker.request('models.delete', { id: gpt.id })
  assert.equal(view.profiles.length, 1)
  await worker.deactivate()
})

test('sends to a terminal with bracketed paste and lists targets', async () => {
  const host = mockHost({ results: { ...hostFor(null), 'terminal.sendText': { accepted: true } } })
  const worker = await mountWorker(main, { host })
  const { targets } = await worker.request('targets.list')
  assert.deepEqual(targets.map((target) => target.terminalId), ['t1'])
  await worker.request('prompt.send', { terminalId: 't1', text: 'line one\nline two', enter: true })
  const sent = host.callsOf('terminal.sendText') as { text: string }[]
  assert.equal(sent[0].text, '\x1b[200~line one\nline two\x1b[201~')
  assert.equal(sent[1].text, '\r')
  await worker.deactivate()
})

test('legacy language settings and locale storage do not change English worker text', async () => {
  const host = mockHost({
    settings: { uiLanguage: 'vi', outputLanguage: 'zh' },
    storage: { uiLocale: 'zh-CN' },
    results: {}
  })
  const worker = await mountWorker(main, { host })
  await new Promise((resolve) => setTimeout(resolve, 30))
  await assert.rejects(worker.request('prompt.enhance', { prompt: 'test', level: 'off' }), /Select a Copilot model/)
  await worker.deactivate()
})
test('a long send closes its bracketed paste when a later piece is refused or fails', async () => {
  for (const failure of ['refuse', 'throw'] as const) {
    let calls = 0
    const host = mockHost({
      results: {
        'terminal.sendText': () => {
          calls++
          if (calls === 2) {
            if (failure === 'throw') throw Object.assign(new Error('terminal gone'), { code: 'action_failed' })
            return { accepted: false }
          }
          return { accepted: true }
        }
      }
    })
    const worker = await mountWorker(main, { host })
    const run = worker.request('prompt.send', { terminalId: 't1', text: 'line\n'.repeat(2000) })
    if (failure === 'throw') await assert.rejects(run, /terminal gone/)
    else assert.deepEqual(await run, { accepted: false })
    const texts = (host.callsOf('terminal.sendText') as { text: string }[]).map((call) => call.text)
    assert.ok(texts[0].startsWith('\x1b[200~'))
    assert.equal(texts.at(-1), '\x1b[201~', `${failure}: the paste is closed`)
    await worker.deactivate()
  }
})

test('a long send that succeeds writes every piece once and no extra paste end', async () => {
  const host = mockHost({ results: { 'terminal.sendText': { accepted: true } } })
  const worker = await mountWorker(main, { host })
  const text = 'line\n'.repeat(2000)
  assert.deepEqual(await worker.request('prompt.send', { terminalId: 't1', text }), { accepted: true })
  const texts = (host.callsOf('terminal.sendText') as { text: string }[]).map((call) => call.text)
  assert.ok(texts.length >= 3)
  assert.equal(texts.join(''), '\x1b[200~' + text.trim() + '\x1b[201~')
  await worker.deactivate()
})

test('a panel run answers within its budget even when every model of the chain hangs', async () => {
  const saved = main.RUN_LIMITS.budgetMs
  main.RUN_LIMITS.budgetMs = 400
  setRewrite((_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
  const host = mockHost({
    storage: { models: { profiles: [profile('one', 'gpt-4.1-mini'), profile('two', 'gpt-5-mini')] } },
    settings: { timeoutSeconds: 60, fallbackEnabled: true }
  })
  const worker = await mountWorker(main, { host })
  const started = Date.now()
  try {
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'fix it', level: 'off' }))
    assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`)
    assert.equal(host.data().storage.history, undefined)
  } finally {
    main.RUN_LIMITS.budgetMs = saved
    await worker.deactivate()
  }
})

test('when the panel stops waiting, a late answer is dropped and not saved to history', async () => {
  setRewrite(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60))
    return 'late answer'
  })
  const host = mockHost({ storage: { models: { profiles: [profile('one', 'gpt-4.1-mini')] } }, })
  let capturedHost: Parameters<typeof main.default>[0] | null = null
  const worker = await mountWorker({ default: (api: Parameters<typeof main.default>[0]) => { capturedHost = api; main.default(api) } }, { host })
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 10)
  await assert.rejects(main.enhanceRequest(capturedHost!, { prompt: 'fix it', level: 'off' }, controller.signal, 'enhance'), /Cancelled/)
  assert.equal(host.data().storage.history, undefined)
  await worker.deactivate()
})

// A run is not tied to one request: Copilot ends a panel's request after 120 s, and a slow model on a
// large context can take longer. The limits are shortened here; the model answers after `delay`.
async function longRuns(delay: number, body: (ctx: { ask: (input: Record<string, unknown>, signal?: AbortSignal) => Promise<Awaited<ReturnType<typeof main.enhanceRequest>>>; calls: () => number; stopped: () => number; host: ReturnType<typeof mockHost> }) => Promise<void>) {
  const saved = { ...main.RUN_LIMITS }
  Object.assign(main.RUN_LIMITS, { sliceMs: 150, totalMs: 1200, orphanMs: 200 })
  let calls = 0
  let stopped = 0
  setRewrite((_input, init) =>
    new Promise<string>((resolve, reject) => {
      calls += 1
      const timer = setTimeout(() => resolve('the enhanced prompt'), delay)
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        stopped += 1
        reject(new DOMException('aborted', 'AbortError'))
      })
    }))
  const host = mockHost({ storage: { models: { profiles: [profile('one', 'gpt-4.1-mini')] } }, results: { 'workspace.readContext': null } })
  let capturedHost: Parameters<typeof main.default>[0] | null = null
  const worker = await mountWorker({ default: (api: Parameters<typeof main.default>[0]) => { capturedHost = api; main.default(api) } }, { host })
  try {
    await body({ ask: (input, signal) => main.enhanceRequest(capturedHost!, input as never, signal ?? new AbortController().signal, 'enhance'), calls: () => calls, stopped: () => stopped, host })
  } finally {
    Object.assign(main.RUN_LIMITS, saved)
    await worker.deactivate()
  }
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('a run slower than one request is answered "pending", goes on, and gives its prompt when the panel asks again', () =>
  longRuns(400, async ({ ask, calls, stopped, host }) => {
    const first = await ask({ prompt: 'fix it', level: 'off', runId: 'r1', resumable: true })
    // 150 ms in: the model needs 400. Still going, and nothing is saved yet.
    assert.deepEqual([first.pending, first.enhanced], [true, ''])
    assert.equal(host.data().storage.history, undefined)
    const second = await ask({ prompt: 'fix it', runId: 'r1', resume: true })
    assert.equal(second.pending, true)
    const third = await ask({ prompt: 'fix it', runId: 'r1', resume: true })
    assert.deepEqual([third.pending, third.enhanced], [undefined, 'the enhanced prompt'])
    // One run, one model call, the time of the whole run, one history entry.
    assert.equal(calls(), 1)
    assert.equal(stopped(), 0)
    assert.ok(third.ms >= 380, `ms ${third.ms}`)
    assert.equal((host.data().storage.history as unknown[]).length, 1)
    // The run was fetched: asking for it again finds nothing (the same after a restart of the worker).
    await assert.rejects(ask({ prompt: 'fix it', runId: 'r1', resume: true }), /no longer going/)
    await assert.rejects(ask({ prompt: 'fix it', runId: 'never-started', resume: true }), /no longer going/)
  }))

test('a caller that does not say it keeps waiting gets its answer in one request, as before', () =>
  longRuns(400, async ({ ask, calls }) => {
    // No `resumable` (an older panel, the command line): the request waits for the run itself.
    const answer = await ask({ prompt: 'fix it', level: 'off', runId: 'old-panel' })
    assert.deepEqual([answer.pending, answer.enhanced], [undefined, 'the enhanced prompt'])
    // Without a run id there is nothing to ask again for, so it is not resumable either.
    const unnamed = await ask({ prompt: 'fix it', level: 'off', resumable: true })
    assert.equal(unnamed.enhanced, 'the enhanced prompt')
    assert.equal(calls(), 2)
  }))

test('a long run has its own limit, and says which model was too slow', () =>
  longRuns(60_000, async ({ ask, stopped }) => {
    const started = Date.now()
    let answer = await ask({ prompt: 'fix it', level: 'off', runId: 'r2', resumable: true })
    let failure: Error | null = null
    while (answer.pending && !failure) {
      answer = await ask({ prompt: 'fix it', runId: 'r2', resume: true }).catch((error: Error) => {
        failure = error
        return answer
      })
    }
    // The model never answers: the run ends at its limit (1.2 s here, 5 minutes for real), not at
    // the end of one request, and the model is stopped.
    assert.ok(failure && Date.now() - started >= 1100 && Date.now() - started < 4000, `took ${Date.now() - started} ms`)
    assert.match((failure as Error).message, /did not answer within 1 s\. A lower context level or a faster model answers sooner\./)
    assert.equal(stopped(), 1)
  }))

test('a run lives only while the panel waits for it: cancelled, or nobody asking again, it stops and nothing is saved', () =>
  longRuns(60_000, async ({ ask, stopped, host }) => {
    // Cancelled while the panel waits (the first request, or a later one): stopped at once.
    const cancel = new AbortController()
    setTimeout(() => cancel.abort(), 40)
    await assert.rejects(ask({ prompt: 'fix it', level: 'off', runId: 'c1', resumable: true }, cancel.signal), /Cancelled/)
    assert.equal(stopped(), 1)
    const later = new AbortController()
    assert.equal((await ask({ prompt: 'fix it', level: 'off', runId: 'c2', resumable: true })).pending, true)
    setTimeout(() => later.abort(), 40)
    await assert.rejects(ask({ prompt: 'fix it', runId: 'c2', resume: true }, later.signal), /Cancelled/)
    assert.equal(stopped(), 2)
    await assert.rejects(ask({ prompt: 'fix it', runId: 'c2', resume: true }), /no longer going/)
    // The panel is gone (closed between two requests): the run is not left running for nobody.
    assert.equal((await ask({ prompt: 'fix it', level: 'off', runId: 'c3', resumable: true })).pending, true)
    assert.equal(stopped(), 2)
    await pause(320)
    assert.equal(stopped(), 3)
    await assert.rejects(ask({ prompt: 'fix it', runId: 'c3', resume: true }), /no longer going/)
    // A panel that asks again in time keeps it going.
    assert.equal((await ask({ prompt: 'fix it', level: 'off', runId: 'c4', resumable: true })).pending, true)
    await pause(100)
    assert.equal((await ask({ prompt: 'fix it', runId: 'c4', resume: true })).pending, true)
    assert.equal(stopped(), 3)
    assert.equal(host.data().storage.history, undefined)
  }))

test("a workspace on this machine is read even when Copilot names its host 'local' (Copilot 1.4.25x)", async () => {
  const root = project()
  stubRewrite(() => 'ok')
  const host = mockHost({
    storage: { models: { profiles: [profile('one', 'gpt-4.1-mini')] } },
    results: {
      'workspace.readContext': { branch: 'feat/publish-unify-ui', displayName: 'feat/publish-unify-ui', terminals: [] },
      'workspace.list': {
        workspaces: [
          { id: 'w-local', kind: 'worktree', name: 'feat/publish-unify-ui', path: root, branch: 'feat/publish-unify-ui', hostId: 'local' },
          { id: 'w-ssh', kind: 'worktree', name: 'remote', path: '/srv/app', branch: 'main', hostId: 'ssh-1' }
        ],
        truncated: false
      },
      'agents.list': { agents: [] }
    }
  })
  const worker = await mountWorker(main, { host })
  const answer = await worker.request('prompt.enhance', { prompt: 'fix validateSession', level: 'deep' })
  const ids = answer.context.map((item) => item.id)
  assert.ok(ids.includes('rules:AGENTS.md'), ids.join(','))
  assert.ok(ids.some((id) => id.startsWith('file:')), ids.join(','))
  assert.ok(!answer.notes.some((note) => note.code === 'note.remote'))
  await worker.deactivate()

  // A workspace on another host (SSH/WSL) is still skipped.
  host.respond('workspace.readContext', { branch: 'main', displayName: 'remote', terminals: [] })
  const remote = await mountWorker(main, { host })
  const far = await remote.request('prompt.enhance', { prompt: 'fix it', level: 'standard' })
  assert.ok(far.notes.some((note) => note.code === 'note.remote'))
  await remote.deactivate()
})

test('several workspaces named "main" on branch main: the panel\'s hint or the person\'s pick says which folder', async () => {
  const one = project()
  const two = project()
  writeFileSync(join(two, 'AGENTS.md'), '# Rules\nThis is the second checkout.')
  stubRewrite(() => 'ok')
  const host = mockHost({
    storage: { models: { profiles: [profile('one', 'gpt-4.1-mini')] } },
    results: {
      'workspace.readContext': { branch: 'main', displayName: 'main', terminals: [{ id: 'term-2', title: 'Claude' }] },
      'workspace.list': {
        workspaces: [
          { id: 'ws-1', kind: 'worktree', name: 'main', path: one, branch: 'main', hostId: 'local' },
          { id: 'ws-2', kind: 'worktree', name: 'main', path: two, branch: 'main', hostId: 'local' }
        ],
        truncated: false
      },
      'agents.list': { agents: [] }
    }
  })
  const worker = await mountWorker(main, { host })
  // Nothing known: Copilot cannot tell, so the panel gets the folders to pick from.
  const unknown = await worker.request('targets.list', {})
  assert.equal(unknown.workspaceId, null)
  assert.deepEqual(unknown.choices?.map((choice) => choice.id), ['ws-1', 'ws-2'])
  // The panel knows term-2 is in ws-2 (from Copilot's agent events, or the pick).
  const known = await worker.request('targets.list', { known: { 'term-2': 'ws-2' } })
  assert.equal(known.workspaceId, 'ws-2')
  assert.equal(known.choices, undefined)
  // A run in that workspace reads that folder.
  const bodies: string[] = []
  setRewrite(input => {
    bodies.push(JSON.stringify(input))
    return 'ok'
  })
  const answer = await worker.request('prompt.enhance', { prompt: 'fix it', level: 'standard', workspaceId: 'ws-2' })
  assert.ok(answer.context.some((item) => item.id === 'rules:AGENTS.md'))
  assert.match(bodies[0], /second checkout/)
  // A hint that no longer fits the focused workspace is not trusted.
  const stale = await worker.request('context.preview', { prompt: 'x', level: 'standard', workspaceId: 'ws-gone' })
  assert.ok(stale.notes.some((note) => note.code === 'note.workspace_unknown'))
  await worker.deactivate()
})

// What the real Copilot answers (host API 1.5, seen on Windows): workspace.list names a Git worktree
// "identity:…" and writes its path with forward slashes; agent events and tool hooks carry the
// worktree's own id, "<repository id>::<path>", with the platform's slashes. Every project's first
// checkout is named after its branch, so seven projects were "main" on "main".
const listedPath = (path: string) => path.replace(/\\/g, '/')
function twoMains(one: string, two: string, terminals: { id: string; title: string }[]) {
  return mockHost({
    storage: { models: { profiles: [profile('one', 'gpt-4.1-mini')] } },
    results: {
      'workspace.readContext': { branch: 'main', displayName: 'main', terminals },
      'workspace.list': {
        workspaces: [
          { id: 'identity:wt2:local:1111', kind: 'worktree', name: 'main', project: 'Shop', path: listedPath(one), branch: 'main', hostId: 'local' },
          { id: 'identity:wt2:local:2222', kind: 'worktree', name: 'main', project: 'Reup', path: listedPath(two), branch: 'main', hostId: 'local' }
        ],
        truncated: false
      },
      'agents.list': { agents: [] }
    }
  })
}

test('several projects named "main": Copilot\'s agent event tells which one is open, with nothing to pick', async () => {
  const one = project()
  const two = project()
  writeFileSync(join(two, 'AGENTS.md'), '# Rules\nThis is the second checkout.')
  const calls = stubRewrite(() => 'ok')
  const host = twoMains(one, two, [
    { id: 'term_agent', title: 'Claude' },
    { id: 'term_shell', title: 'pwsh' }
  ])
  const worker = await mountWorker(main, { host })
  // Copilot has said nothing yet: the folders to pick from, each with its project's name.
  const before = await worker.request('targets.list', {})
  assert.equal(before.workspaceId, null)
  // Which project this is cannot be said yet: its rules are kept under its own name, not under "main".
  assert.equal(before.project, null)
  assert.deepEqual(before.choices, [
    { id: 'identity:wt2:local:1111', path: listedPath(one), project: 'Shop' },
    { id: 'identity:wt2:local:2222', path: listedPath(two), project: 'Reup' }
  ])
  // The agent of the second project changes state. Its workspace comes as the worktree's own id.
  await worker.emit('agent.status.changed', { workspaceId: `repo-two::${two}`, paneKey: 'p', terminalId: 'term_agent', state: 'done', receivedAt: Date.now() })
  const after = await worker.request('targets.list', {})
  assert.equal(after.workspaceId, 'identity:wt2:local:2222')
  assert.equal(after.workspacePath, listedPath(two))
  assert.equal(after.project, 'Reup')
  assert.equal(after.choices, undefined)
  // A run reads that project, and the rewriter is told its name: "main" alone names nothing.
  const answer = await worker.request('prompt.enhance', { prompt: 'fix it', level: 'standard' })
  assert.match(JSON.stringify(calls.at(-1)), /second checkout/)
  assert.match(JSON.stringify(calls.at(-1)), /Reup: main \(branch main\)/)
  assert.ok(!answer.notes.some((note) => note.code === 'note.workspace_unknown'))
  // The folder the person once picked by mistake does not win over what Copilot said.
  const mistaken = await worker.request('targets.list', { known: { term_agent: 'identity:wt2:local:1111', term_shell: 'identity:wt2:local:1111' } })
  assert.equal(mistaken.workspaceId, 'identity:wt2:local:2222')
  // The pairing is kept (two ids per terminal, nothing else), the plain shell of that project too.
  await terminalsSaved()
  assert.deepEqual(host.data().storage.terminalWorkspaces, { term_agent: `repo-two::${two}`, term_shell: `repo-two::${two}` })
  await worker.deactivate()

  // A new worker (Copilot restarted, or the plugin was updated) with only the shell left open: known.
  await forgetTerminals()
  host.respond('workspace.readContext', { branch: 'main', displayName: 'main', terminals: [{ id: 'term_shell', title: 'pwsh' }] })
  const restarted = await mountWorker(main, { host })
  assert.equal((await restarted.request('targets.list', {})).workspaceId, 'identity:wt2:local:2222')
  // "Delete everything" forgets it, here and in storage.
  await restarted.request('data.clear', { what: 'all' })
  assert.equal(host.data().storage.terminalWorkspaces, undefined)
  assert.equal((await restarted.request('targets.list', {})).workspaceId, null)
  await restarted.deactivate()
})

test('several projects named "main": a newer Copilot names the focused workspace itself, in either shape of id', async () => {
  const one = project()
  const two = project()
  // The test host answers as the installed Copilot does and refuses a field that Copilot does not know,
  // so the Copilot of tomorrow is a stand-in here: the two calls the lookup makes, and a storage.
  const kept = new Map<string, unknown>()
  const host = {
    host: {
      has: () => true,
      call: async (name: string) =>
        name === 'workspace.list'
          ? {
              workspaces: [
                { id: 'identity:wt2:local:1111', kind: 'worktree', name: 'main', project: 'Shop', path: listedPath(one), branch: 'main', hostId: 'local' },
                { id: 'identity:wt2:local:2222', kind: 'worktree', name: 'main', project: 'Reup', path: listedPath(two), branch: 'main', hostId: 'local' }
              ],
              truncated: false
            }
          : null
    },
    storage: { get: async (key: string) => kept.get(key) ?? null, set: async (key: string, value: unknown) => void kept.set(key, value), delete: async (key: string) => void kept.delete(key) },
    log: () => undefined
  } as never
  const focus = (workspaceId?: string) => ({ branch: 'main', displayName: 'main', terminals: [{ id: 'term_shell' }], ...(workspaceId ? { workspaceId } : {}) })
  await forgetTerminals(host)
  // The Copilot of today: no id with the focus, and nothing else says which of the two it is.
  assert.equal(await findFocusedWorkspace(host, focus()), null)
  // As workspace.list names it.
  assert.equal((await findFocusedWorkspace(host, focus('identity:wt2:local:2222')))?.project, 'Reup')
  // Its terminals are known from then on: the next lookup needs no id.
  assert.equal((await findFocusedWorkspace(host, focus()))?.project, 'Reup')
  await terminalsSaved()
  await forgetTerminals(host)
  // As events name it: the worktree's own id, with the platform's slashes.
  assert.equal((await findFocusedWorkspace(host, focus(`repo-one::${one}`)))?.project, 'Shop')
  await terminalsSaved()
  await forgetTerminals(host)
  // An id that names no listed workspace decides nothing.
  assert.equal(await findFocusedWorkspace(host, focus('identity:wt2:local:9999')), null)
  await terminalsSaved()
  await forgetTerminals(host)
})

test('several projects named "main": a tool hook says it too, and the panel\'s own note of an event is understood', async () => {
  const one = project()
  const two = project()
  stubRewrite(() => 'ok')
  const host = twoMains(one, two, [{ id: 'term_agent', title: 'Claude' }])
  const worker = await mountWorker(main, { host })
  // The panel heard the event itself and kept the id as it came (not the list's id): understood.
  const fromPanel = await worker.request('targets.list', { known: { term_agent: `repo-one::${one}` } })
  assert.equal(fromPanel.workspaceId, 'identity:wt2:local:1111')
  // An agent runs a tool in this terminal: the hook names the workspace. The switch for what agents
  // do is off, so nothing of the call is kept: only which workspace the terminal is in.
  await worker.hooks.fire('agent.tool.after', { agent: 'claude', workspaceId: `repo-two::${two}`, terminalId: 'term_agent', tool: 'Bash', input: { command: 'pnpm test' }, output: 'SECRET OUTPUT' })
  assert.equal((await worker.request('targets.list', {})).workspaceId, 'identity:wt2:local:2222')
  await terminalsSaved()
  assert.deepEqual(host.data().storage.terminalWorkspaces, { term_agent: `repo-two::${two}` })
  assert.ok(!JSON.stringify(host.data().storage).includes('pnpm test') && !JSON.stringify(host.data().storage).includes('SECRET OUTPUT'))
  const deep = await worker.request('context.preview', { prompt: 'fix it', level: 'deep' })
  assert.ok(!deep.context.some((item) => item.id === 'activity'))
  // An event for a folder that is not listed (or without a terminal) changes nothing.
  await worker.emit('agent.status.changed', { workspaceId: 'repo-x::/nowhere/else', paneKey: 'p', terminalId: 'term_other', state: 'working', receivedAt: Date.now() })
  await worker.emit('agent.status.changed', { workspaceId: null, paneKey: 'p', state: 'working', receivedAt: Date.now() })
  assert.equal((await worker.request('targets.list', {})).workspaceId, 'identity:wt2:local:2222')
  await worker.deactivate()
})
