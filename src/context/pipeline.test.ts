import { mkdtemp, mkdir, writeFile, rm, symlink, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { test, assert } from '#testing'
import { createServices } from '../copilot/services.ts'
import { runPromptHook } from '../copilot/hook.ts'
import { createWorkerHost } from '../worker-host.ts'
import { enhance } from '../worker.ts'
import { cachedStatic, gatherContext, staticParts } from './index.ts'
import { searchFiles } from './search.ts'
import { fileAllowed } from './files.ts'

const token = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_')
const options = { level: 'deep' as const, prompt: 'Fix validateSession', terminalId: 'fixture', terminalLines: 0, extraFiles: [], excludePatterns: '', exclude: new Set<string>(), allowTerminal: false }

async function fixture(files: Record<string, string>, check: (f: {
  root: string; services: ReturnType<typeof createServices>; host: ReturnType<typeof createWorkerHost>['api'];
  calls: { system: string; user: string }[]; git: (...args: string[]) => void
}) => Promise<void>, withGit = false) {
  const directory = await mkdtemp(join(tmpdir(), 'enhance-context-test-'))
  const root = join(directory, 'project')
  const calls: { system: string; user: string }[] = []
  try {
    await mkdir(root)
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true })
      await writeFile(join(root, path), text)
    }
    const git = (...args: string[]) => { execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, stdio: 'pipe' }) }
    if (withGit) { git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'fixture') }
    const services = createServices({ sessionId: 'fixture', rpc: {
      metadata: { snapshot: async () => ({ workingDirectory: root, isRemote: false }), activity: async () => ({ hasActiveWork: false }), isProcessing: async () => ({ processing: false }) },
      permissions: { pendingRequests: async () => ({ items: [] }) }, queue: { pendingItems: async () => ({ items: [], steeringMessages: [] }) }
    }, send: async () => { throw new Error('Tests never send') } }, join(directory, 'data'), {
      rewrite: async input => { calls.push(input); return input.system.startsWith('You pick source files') ? JSON.stringify(Array.from({ length: 8 }, (_, i) => `src/feature${i + 10}.ts`)) : 'Enhanced fixture prompt' }
    } as Parameters<typeof createServices>[2])
    await services.storage.set('models', { profiles: [{ id: 'cp', name: 'Fixture', preset: 'copilot', provider: 'copilot', baseUrl: '', model: 'fixture', enabled: true, maxTokens: 2000, command: '', args: '' }] })
    await check({ root, services, host: createWorkerHost(services).api, calls, git })
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('enhance-context-test-'))
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}

test('excluded paths and unchecked files stay out of every model context route', async () => {
  await fixture({ 'AGENTS.md': 'OMIT_RULE', 'README.md': '# Demo\nOMIT_README', 'package.json': '{"name":"OMIT_STACK"}', 'src/service.ts': 'export const validateSession = "before"', 'internal/extra.md': 'OMIT_EXTRA' }, async ({ root, services, host, calls }) => {
    await writeFile(join(root, 'src/service.ts'), 'export const validateSession = "OMIT_DIFF"')
    await services.settings.set('extraContextFiles', 'internal/extra.md')
    await services.settings.set('excludePatterns', 'AGENTS.md\nREADME.md\npackage.json\ninternal/')
    await enhance(host, { prompt: 'Fix validateSession', level: 'max', exclude: ['file:src/service.ts'] })
    for (const call of calls) {
      assert.doesNotMatch(call.user, /OMIT_|AGENTS\.md|README\.md|package\.json|internal\/|src\/service\.ts/)
    }
  }, true)
})

test('automatic rule, README, extra, stack and Git metadata context masks secrets before trimming', async () => {
  await fixture({ 'AGENTS.md': `Rules ${token}`, 'README.md': `# Demo\n## Setup\nToken ${token}`, 'guide.txt': `Guide ${token}`, 'package.json': JSON.stringify({ scripts: { start: `echo ${'x'.repeat(100)} ${token}` } }) }, async ({ services, host, calls, git }) => {
    git('commit', '--allow-empty', '-qm', `message ${token}`)
    await services.settings.set('extraContextFiles', 'guide.txt')
    await enhance(host, { prompt: 'Help with setup', level: 'deep' })
    assert.doesNotMatch(calls.at(-1)!.user, new RegExp(token.slice(0, 12)))
    assert.match(calls.at(-1)!.user, /\[redacted\]/)
  }, true)
})

test('manual collection immediately follows file edits and added or removed extra files', async () => {
  await fixture({ 'AGENTS.md': 'OLD_RULE', 'guide.txt': 'EXTRA_RULE' }, async ({ root, host }) => {
    await gatherContext(host, { ...options, level: 'standard' })
    await writeFile(join(root, 'AGENTS.md'), 'NEW_RULE')
    const added = await gatherContext(host, { ...options, level: 'standard', extraFiles: ['guide.txt'] })
    assert.equal(added.items.find(item => item.id === 'rules:AGENTS.md')?.content, 'NEW_RULE')
    assert.ok(added.items.some(item => item.id === 'rules:guide.txt'))
    const removed = await gatherContext(host, { ...options, level: 'standard' })
    assert.ok(!removed.items.some(item => item.id === 'rules:guide.txt'))
  })
})

test('without Git, Copilot instruction directories and content matches still supply numbered context', async () => {
  await fixture({ '.github/copilot-instructions.md': 'COPILOT_RULE', '.cursor/rules/style.mdc': 'CURSOR_RULE', 'src/service.ts': `${'// header\n'.repeat(55)}export function validateSession() { return true }`, 'src/other.ts': 'unrelated', '.env': 'DO_NOT_READ' }, async ({ host }) => {
    const result = await gatherContext(host, { ...options, allowGit: false })
    assert.ok(result.items.some(item => item.id === 'rules:.github/copilot-instructions.md'))
    assert.ok(result.items.some(item => item.id === 'rules:.cursor/rules/style.mdc'))
    assert.match(result.items.find(item => item.id === 'file:src/service.ts')?.content ?? '', /56: export function validateSession/)
    assert.ok(!result.items.some(item => item.id.startsWith('git:')))
    assert.doesNotMatch(JSON.stringify(result.items), /DO_NOT_READ/)
  })
})

test('AI-assisted context caps at ten files, prioritizes AI choices, and does not call external providers', async () => {
  await fixture(Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`src/feature${String(i).padStart(2, '0')}.ts`, 'export const feature = true'])), async ({ host, calls }) => {
    const result = await enhance(host, { prompt: 'Improve feature', level: 'max' })
    const files = result.items.filter(item => item.kind === 'file')
    assert.equal(files.length, 10)
    assert.equal(files[0].id, 'file:src/feature10.ts')
    assert.equal(calls.length, 2)
  })
})

test('unchecked aliases exclude the underlying file in both directions', async () => {
  await fixture({ 'docs/guide.md': 'PRIVATE_ALIAS_CONTENT' }, async ({ root, host }) => {
    await symlink(join(root, 'docs'), join(root, 'handbook'), 'junction')
    for (const path of ['handbook/guide.md', 'docs/guide.md']) {
      const result = await gatherContext(host, { ...options, extraFiles: ['handbook/guide.md', 'docs/guide.md'], exclude: new Set([`rules:${path}`]) })
      assert.doesNotMatch(JSON.stringify(result.items), /PRIVATE_ALIAS_CONTENT/)
    }
  })
})

test('hook cache matches extra files, exclusions and Git permission before reuse', async () => {
  await fixture({ 'AGENTS.md': 'RULE', 'guide.txt': 'EXTRA' }, async ({ root }) => {
    const settings = { extraContextFiles: ['guide.txt'], privacy: { allowGit: false }, excludePatterns: '' }
    await staticParts(root, settings.extraContextFiles, true, false, undefined, undefined, settings)
    assert.ok(cachedStatic(root, settings))
    assert.equal(cachedStatic(root, { ...settings, extraContextFiles: [] }), null)
    assert.equal(cachedStatic(root, { ...settings, excludePatterns: 'guide.txt' }), null)
    assert.equal(cachedStatic(root, { ...settings, privacy: { allowGit: true } }), null)
  })
})

test('AI hook context honors current exclusions, extra files and masking through the production adapter', async () => {
  await fixture({ 'AGENTS.md': 'OMIT_HOOK_RULE', 'guide.txt': `HOOK_GUIDE ${token}`, 'other.txt': 'NEXT_HOOK_GUIDE' }, async ({ root, services }) => {
    await services.settings.set('autoEnhanceMode', 'ai')
    await services.settings.set('autoEnhanceContext', true)
    await services.settings.set('extraContextFiles', 'guide.txt')
    await services.settings.set('excludePatterns', 'AGENTS.md')
    await services.storage.set('models', { profiles: [{ id: 'local', name: 'Local fixture', preset: 'ollama', provider: 'openai', baseUrl: 'http://127.0.0.1:1/v1', model: 'fixture', enabled: true, maxTokens: 2000 }] })
    const originalFetch = globalThis.fetch
    let captured = ''
    globalThis.fetch = async (_url, init) => {
      captured = String(init?.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Rewritten fixture request' } }] }), { headers: { 'content-type': 'application/json' } })
    }
    try {
      const input = { sessionId: 'hook-fixture', cwd: root, prompt: 'Improve this request', transformedPrompt: 'Host context\nImprove this request' }
      assert.deepEqual(await runPromptHook(input, join(root, '..', 'data')), { modifiedTransformedPrompt: 'Host context\nRewritten fixture request' })
      assert.match(captured, /HOOK_GUIDE/)
      assert.doesNotMatch(captured, new RegExp(`OMIT_HOOK_RULE|${token}`))
      await services.settings.set('extraContextFiles', 'other.txt')
      await runPromptHook(input, join(root, '..', 'data'))
      assert.match(captured, /NEXT_HOOK_GUIDE/)
      assert.doesNotMatch(captured, /guide\.txt|OMIT_HOOK_RULE/)
      await services.settings.set('allowProjectFiles', false)
      await runPromptHook(input, join(root, '..', 'data'))
      assert.doesNotMatch(captured, /NEXT_HOOK_GUIDE|HOOK_GUIDE|OMIT_HOOK_RULE/)
    } finally { globalThis.fetch = originalFetch }
  })
})

test('excluded lockfiles do not cause the stack summary to invent an npm preference', async () => {
  await fixture({ 'package.json': '{"scripts":{"test":"vitest"}}', 'pnpm-lock.yaml': 'EXCLUDED_LOCK' }, async ({ root, host }) => {
    const result = await gatherContext(host, { ...options, level: 'standard', excludePatterns: 'pnpm-lock.yaml' })
    assert.doesNotMatch(result.items.find(item => item.id === 'stack')!.content, /npm|pnpm/)
    await writeFile(join(root, 'package.json'), '{"packageManager":"pnpm@10.0.0","scripts":{"test":"vitest"}}')
    const explicit = await gatherContext(host, { ...options, level: 'standard', excludePatterns: 'pnpm-lock.yaml' })
    assert.match(explicit.items.find(item => item.id === 'stack')!.content, /package manager: pnpm/)
  })
})

test('tracked directory aliases cannot reintroduce unchecked code through diffs or selector paths', async () => {
  await fixture({ 'src/service.ts': 'export const validateSession = "before"' }, async ({ root, host, git }) => {
    await symlink(join(root, 'src'), join(root, 'alias'), 'junction')
    git('add', '-A'); git('commit', '-qm', 'add alias')
    await writeFile(join(root, 'src/service.ts'), 'export const validateSession = "PRIVATE_ALIAS_DIFF"')
    for (const path of ['src/service.ts', 'alias/service.ts']) {
      const result = await gatherContext(host, { ...options, level: 'max', exclude: new Set([`file:${path}`]), pickFiles: async files => {
        assert.ok(!files.includes('alias/service.ts') && !files.includes('src/service.ts'))
        return files
      } })
      assert.doesNotMatch(JSON.stringify(result.items), /PRIVATE_ALIAS_DIFF|service\.ts/)
    }
  }, true)
})

test('extra source files retain code while masking actual credential literals', async () => {
  const code = `export const token = getToken();\nexport type Login = { password: string };\nconst key = "${token}";`
  await fixture({ 'src/session.ts': code }, async ({ host }) => {
    const result = await gatherContext(host, { ...options, level: 'standard', extraFiles: ['src/session.ts'] })
    const content = result.items.find(item => item.id === 'rules:src/session.ts')!.content
    assert.match(content, /token = getToken\(\)/)
    assert.match(content, /password: string/)
    assert.doesNotMatch(content, new RegExp(token))
    assert.match(content, /\[redacted\]/)
  })
})

test('removed directory aliases fail closed without suppressing ordinary deleted-file diffs', async () => {
  await fixture({ 'src/service.ts': 'PRIVATE_DELETED_ALIAS', 'src/obsolete.ts': 'VISIBLE_DELETION' }, async ({ root, host, git }) => {
    await symlink(join(root, 'src'), join(root, 'alias'), 'junction')
    git('add', '-A'); git('commit', '-qm', 'add alias')
    if (process.platform === 'win32') await rmdir(join(root, 'alias'))
    else await unlink(join(root, 'alias'))
    await unlink(join(root, 'src/obsolete.ts'))
    const result = await gatherContext(host, { ...options, exclude: new Set(['file:src/service.ts']) })
    const diff = result.items.find(item => item.id === 'git:diff')!.content
    assert.doesNotMatch(diff, /PRIVATE_DELETED_ALIAS/)
    assert.match(diff, /VISIBLE_DELETION/)
  }, true)
})

test('fallback content search is bounded and respects cancellation and file policy', async () => {
  await fixture({ 'service.ts': 'validateSession', 'private.ts': 'validateSession PRIVATE' }, async ({ root }) => {
    const allowed = fileAllowed({ excludePatterns: 'private.ts' })
    const bounded = await searchFiles(root, [...Array.from({ length: 300 }, (_, i) => `absent${i}.ts`), 'service.ts'], ['validatesession'], allowed)
    assert.equal(bounded.limited, true)
    assert.equal(bounded.hits.size, 0)
    const blocked = await searchFiles(root, ['service.ts'], ['validatesession'], allowed, AbortSignal.abort())
    assert.equal(blocked.hits.size, 0)
    const searched = await searchFiles(root, ['private.ts', 'service.ts'], ['validatesession'], allowed)
    assert.deepEqual([...searched.hits.keys()], ['service.ts'])
  })
})

test('an unavailable project directory supplies no files instead of failing the rewrite', async () => {
  await fixture({}, async ({ root }) => {
    const parts = await staticParts(join(root, 'missing'), [], true, false)
    assert.deepEqual(parts.files, [])
    assert.deepEqual(parts.items, [])
  })
})
