import { mkdtemp, mkdir, writeFile, rm, symlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { test, assert, mockHost, mountWorker } from '#testing'
import * as workerModule from '../worker.ts'
import { normalizeProfile } from '../presets.ts'
import { english, msg } from '../messages.ts'
import { LlmError } from '../llm.ts'
import { researchContext, RESEARCH_LIMITS } from './research.ts'
import { planSteps } from '../progress.ts'

type Call = { system: string; user: string; model: string }
const research = (call: Call) => call.system.startsWith('You research project context')
const cp = normalizeProfile({ id: 'cp', preset: 'copilot', model: 'saved-model' })!
const external = normalizeProfile({ id: 'external', preset: 'ollama', model: 'external-model' })!

async function fixture(check: (f: {
  root: string; host: ReturnType<typeof mockHost>; worker: Awaited<ReturnType<typeof mountWorker>>;
  calls: Call[]; answer: (fn: (call: Call) => string | Promise<string>) => void
}) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'enhance-research-test-'))
  const calls: Call[] = []
  let reply: (call: Call) => string | Promise<string> = call => research(call) ? '{"done":true}' : 'Enhanced prompt'
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'README.md'), '# Fixture\nA login application.')
  await writeFile(join(root, 'src/auth.ts'), Array.from({ length: 150 }, (_, i) => i === 90 ? 'export const validateSession = "EVIDENCE_ONE"' : '// padding').join('\n'))
  await writeFile(join(root, 'src/storage.ts'), Array.from({ length: 150 }, (_, i) => i === 100 ? 'export const persistSession = "EVIDENCE_TWO"' : '// padding').join('\n'))
  const host = mockHost({ settings: { allowGit: false }, storage: { models: { profiles: [external, cp], selectorProfileId: external.id } }, results: {
    'workspace.readContext': { displayName: 'Fixture', branch: '', terminals: [], workspaceId: 'project' },
    'workspace.list': { workspaces: [{ id: 'project', name: 'Fixture', path: root, branch: null, hostId: null }] },
    'agents.list': { agents: [] },
    'copilot.rewrite': async (call: Call) => { calls.push(call); return { text: await reply(call) } }
  } })
  const worker = await mountWorker(workerModule, { host })
  try { await check({ root, host, worker, calls, answer: fn => { reply = fn } }) }
  finally {
    await worker.deactivate()
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep) && root.includes('enhance-research-test-'))
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

test('AI Test feeds requested evidence into the next round and the final English rewrite on the effort model', async () => {
  await fixture(async ({ host, worker, calls, answer }) => {
    await host.settings.set('effortHighModel', 'cp|effort-model')
    let rounds = 0
    answer(call => {
      if (!research(call)) return 'Enhanced prompt'
      if (++rounds === 1) {
        assert.doesNotMatch(call.user, /EVIDENCE_ONE|EVIDENCE_TWO/)
        return JSON.stringify({ done: false, reads: [{ path: 'src/auth.ts', startLine: 88, endLine: 94 }] })
      }
      assert.match(call.user, /EVIDENCE_ONE/)
      return JSON.stringify({ done: false, reads: [{ path: 'src/storage.ts', startLine: 99, endLine: 103 }] })
    })
    const result = await worker.request('prompt.enhance', { prompt: 'Help improve the application', effort: 'high', level: 'ai-test' })
    assert.equal(rounds, 2)
    assert.equal(calls.length, 3)
    assert.ok(calls.every(call => call.model === 'effort-model'))
    assert.match(calls.at(-1)!.system, /English/)
    assert.match(calls.at(-1)!.user, /EVIDENCE_ONE/)
    assert.match(calls.at(-1)!.user, /EVIDENCE_TWO/)
    assert.equal(result.enhanced, 'Enhanced prompt')
    assert.ok(result.notes.some(note => note.code === 'note.research_summary'))
  })
})

test('AI Test preview makes no model calls; disabling project files disables research', async () => {
  await fixture(async ({ host, worker, calls }) => {
    const preview = await worker.request('context.preview', { prompt: 'Improve login', level: 'ai-test' })
    assert.equal(calls.length, 0)
    assert.ok(preview.notes.some(note => note.code === 'note.preview_no_research'))
    await host.settings.set('allowProjectFiles', false)
    const result = await worker.request('prompt.enhance', { prompt: 'Improve login', profileId: 'cp', level: 'ai-test' })
    assert.equal(calls.length, 1)
    assert.ok(!research(calls[0]))
    assert.ok(result.context.every(item => item.kind === 'workspace' || item.kind === 'agent'))
  })
})

test('AI Test stops early and ordinary research errors still permit rewriting', async () => {
  await fixture(async ({ worker, calls, answer }) => {
    for (const response of ['{"done":true}', 'not JSON', 'throw']) {
      calls.length = 0
      answer(call => {
        if (!research(call)) return 'Enhanced prompt'
        if (response === 'throw') throw new Error('private provider message')
        return response
      })
      const result = await worker.request('prompt.enhance', { prompt: 'Improve login', profileId: 'cp', level: 'ai-test' })
      assert.equal(calls.length, 2)
      assert.equal(result.enhanced, 'Enhanced prompt')
      assert.doesNotMatch(result.notes.map(english).join('\n'), /private provider message/)
    }
  })
})

test('AI Test does not hide usage-accounting failures or rewrite after privacy is revoked', async () => {
  await fixture(async ({ host, worker, calls, answer }) => {
    answer(call => {
      if (research(call)) throw new LlmError(msg('error.copilot_usage'), 'action_failed')
      return 'Enhanced prompt'
    })
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Improve login', profileId: 'cp', level: 'ai-test' }))
    assert.equal(calls.length, 1)
    calls.length = 0
    answer(async call => {
      if (research(call)) {
        await host.settings.set('allowProjectFiles', false)
        return '{"done":true}'
      }
      return 'Enhanced prompt'
    })
    await assert.rejects(worker.request('prompt.enhance', { prompt: 'Improve login', profileId: 'cp', level: 'ai-test' }))
    assert.equal(calls.length, 1)
  })
})

test('AI Test searches actual code, preserves Unicode, masks secrets, and refuses excluded files and aliases', async () => {
  await fixture(async ({ root, host, worker, calls, answer }) => {
    const token = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_')
    await mkdir(join(root, 'private'))
    await writeFile(join(root, '.env'), 'SENSITIVE_MARKER')
    await writeFile(join(root, 'private/hidden.ts'), 'EXCLUDED_MARKER')
    await writeFile(join(root, 'src/unchecked.ts'), 'UNCHECKED_MARKER')
    await writeFile(join(root, 'src/target.ts'), `export const symbolToFind = "こんにちは 😀"\nconst apiKey = "${token}"`)
    await symlink(join(root, 'private'), join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir')
    await host.settings.set('excludePatterns', 'private/')
    let rounds = 0
    answer(call => {
      assert.doesNotMatch(call.user, /SENSITIVE_MARKER|EXCLUDED_MARKER|UNCHECKED_MARKER/)
      assert.ok(!call.user.includes(token))
      if (!research(call)) return 'Enhanced prompt'
      if (++rounds === 1) return JSON.stringify({ done: false, searches: ['symbolToFind'], reads: [
        { path: '.env' }, { path: 'alias/hidden.ts' }, { path: 'src/unchecked.ts' }
      ] })
      assert.match(call.user, /こんにちは 😀/)
      assert.match(call.user, /redacted/)
      return '{"done":true}'
    })
    try {
      const result = await worker.request('prompt.enhance', { prompt: 'Improve behavior', profileId: 'cp', level: 'ai-test', exclude: ['file:src/unchecked.ts'] })
      assert.equal(calls.length, 3)
      assert.ok(result.context.some(item => item.id === 'file:src/target.ts' && item.why?.code === 'why.research'))
      const logs = await worker.request('logs.get')
      assert.ok(logs.entries.some(entry => entry.operation === 'context.research.search'))
      assert.doesNotMatch(JSON.stringify(logs), /symbolToFind|target\.ts|こんにちは|ghp_|MARKER/)
    } finally { await rmdir(join(root, 'alias')) }
  })
})

test('AI Test rejects traversal, absolute paths, invalid ranges and non-JSON plans without retrying', async () => {
  await fixture(async ({ root }) => {
    for (const response of [
      '{"done":false,"reads":[{"path":"../README.md"},{"path":"C:/secret.txt"},{"path":"/etc/passwd"}]}',
      '{"done":false,"reads":[{"path":"src/auth.ts","startLine":-1},{"path":"src/auth.ts","startLine":2.5}]}',
      '{"done":false,"searches":["","x"],"reads":[]}',
      '{"done":"false"}', '{"done":false,"reads":{}}', 'x'.repeat(12_001)
    ]) {
      let calls = 0
      const result = await researchContext({ root, files: ['src/auth.ts'], items: [], prompt: 'Help', budgetMs: 1000,
        ensureAccess: async () => {}, ask: async () => { calls++; return response } })
      assert.equal(calls, 1)
      assert.equal(result.items.length, 0)
    }
  })
})

test('AI Test bounds file excerpts and stops repeated requests without losing gathered evidence', async () => {
  await fixture(async ({ root }) => {
    const files = Array.from({ length: 8 }, (_, i) => `src/big${i}.ts`)
    for (const file of files) await writeFile(join(root, file), Array.from({ length: 150 }, () => '// ' + 'evidence '.repeat(50)).join('\n'))
    let calls = 0
    const result = await researchContext({ root, files, items: [], prompt: 'Help', budgetMs: 2000,
      ensureAccess: async () => {}, ask: async () => JSON.stringify({ done: false, reads: files.slice(3 * calls++, 3 * calls).map(path => ({ path, startLine: 1, endLine: 99999 })) }) })
    assert.equal(calls, 2)
    assert.ok(result.items.reduce((sum, item) => sum + item.chars, 0) <= RESEARCH_LIMITS.addedChars)
    assert.ok(result.items.every(item => item.chars <= RESEARCH_LIMITS.excerptChars))
    assert.ok(result.items.every(item => !item.content.includes('81:')))
    let repeats = 0
    const repeated = await researchContext({ root, files, items: [], prompt: 'Help', budgetMs: 1000,
      ensureAccess: async () => {}, ask: async () => { repeats++; return '{"done":false,"reads":[{"path":"src/big0.ts","startLine":1,"endLine":2}]}' } })
    assert.equal(repeats, 2)
    assert.equal(repeated.items.length, 1)
    assert.match(english(repeated.note), /no new readable evidence/)
    let ranges = 0
    const sameFile = await researchContext({ root, files, items: [], prompt: 'Help', budgetMs: 1000,
      ensureAccess: async () => {}, ask: async () => JSON.stringify({ done: false, reads: [1, 21, 41].map(start => ({ path: files[0], startLine: start + 60 * ranges, endLine: start + 60 * ranges + 19 })) , round: ranges++ }) })
    assert.ok(sameFile.items.reduce((sum, item) => sum + item.chars, 0) <= RESEARCH_LIMITS.addedChars)
  })
})

test('AI Test times out research, preserves initial evidence, and propagates user cancellation', async () => {
  await fixture(async ({ root }) => {
    const initial = { id: 'workspace', kind: 'workspace', label: 'Workspace', content: 'Original project', chars: 16 }
    const wait = async (_system: string, _user: string, signal: AbortSignal) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      if (signal.aborted) reject(signal.reason)
    })
    const options = { root, files: ['src/auth.ts'], items: [initial], prompt: 'Help', budgetMs: 25, ensureAccess: async () => {}, ask: wait }
    const timed = await researchContext(options)
    assert.deepEqual(timed.items, [initial])
    assert.match(english(timed.note), /time limit/)
    const controller = new AbortController()
    const cancelled = researchContext({ ...options, budgetMs: 1000, signal: controller.signal,
      ask: async (system, user, signal) => { const pending = wait(system, user, signal); controller.abort(); return pending } })
    await assert.rejects(cancelled, (error: unknown) => error instanceof LlmError && error.code === 'cancelled')
  })
})

test('AI Test skips unknown roots and has its own progress step without Max terminal or picker steps', async () => {
  let calls = 0
  const result = await researchContext({ root: null, files: [], items: [], prompt: 'Help', budgetMs: 1000,
    ensureAccess: async () => {}, ask: async () => { calls++; return '{"done":true}' } })
  assert.equal(calls, 0)
  assert.match(english(result.note), /no readable project files/)
  assert.deepEqual(planSteps('ai-test', true), ['workspace', 'project', 'git', 'search', 'research', 'model'])
  assert.deepEqual(planSteps('ai-test', false), ['workspace', 'model'])
})

test('AI Test saved as the default does not add research to AI auto-enhance', async () => {
  await fixture(async ({ host, worker, calls }) => {
    await host.settings.set('contextLevel', 'ai-test')
    await host.settings.set('autoEnhanceMode', 'ai')
    const realFetch = globalThis.fetch
    let apiCalls = 0
    globalThis.fetch = async () => { apiCalls++; return new Response(JSON.stringify({ choices: [{ message: { content: 'API rewritten prompt' } }] })) }
    try {
      const result = await worker.hooks.fire('agent.prompt.before', { prompt: 'Improve the login screen', agent: 'copilot', terminalId: 'one', inputKind: 'launch' })
      assert.equal(result.kind === 'continue' && result.event.prompt, 'API rewritten prompt')
      assert.equal(apiCalls, 1)
      assert.equal(calls.length, 0)
    } finally { globalThis.fetch = realFetch }
  })
})
