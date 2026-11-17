import { mkdtemp, mkdir, writeFile, rm, symlink, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { test, assert } from '#testing'
import { createServices } from '../copilot/services.ts'
import { createWorkerHost } from '../worker-host.ts'
import { enhance } from '../worker.ts'
import { cachedStatic, gatherContext, staticParts } from './index.ts'
import { searchFiles } from './search.ts'
import { fileAllowed } from './files.ts'
import { LlmError } from '../llm.ts'
import { msg } from '../messages.ts'

const token = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_')
const options = { level: 'deep' as const, prompt: 'Fix validateSession', terminalId: 'fixture', terminalLines: 0, extraFiles: [], excludePatterns: '', exclude: new Set<string>(), allowTerminal: false }

test('completed discovery never caches project contents or hides edits from later ordinary gathers',async()=>{
  await fixture({'README.md':'Before content','src/old.ts':'old'},async({root,host})=>{
    const first=await gatherContext(host,{...options,level:'standard'})
    assert.ok(first.items.some(item=>item.content.includes('Before content')))
    assert.equal(Object.hasOwn(cachedStatic(first.root!)!,'items'),false)
    await writeFile(join(root,'README.md'),'After content')
    await unlink(join(root,'src/old.ts'));await writeFile(join(root,'src/new.ts'),'new')
    const next=await gatherContext(host,{...options,level:'standard'})
    assert.ok(next.items.some(item=>item.content.includes('After content')))
    assert.ok(!next.items.some(item=>item.content.includes('Before content')))
    assert.ok(cachedStatic(next.root!)!.files.includes('src/new.ts'))
    assert.ok(!cachedStatic(next.root!)!.files.includes('src/old.ts'))
  })
})

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
    await services.storage.set('models', { profiles: [{ id: 'cp', name: 'Fixture', preset: 'copilot', provider: 'copilot', model: 'fixture', enabled: true }] })
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

test('effort overrides only rewriting when an AI file selector is explicitly configured', async () => {
  await fixture({ 'src/auth.ts': 'export function validateSession() { return true }' }, async ({ services, host }) => {
    await services.storage.set('models', { profiles: [{ id: 'cp', name: 'Fixture', preset: 'copilot', provider: 'copilot', model: 'picker-model', enabled: true }], selectorProfileId: 'cp' })
    await services.settings.set('effortHighModel', 'cp|rewrite-model')
    const calls: { model: string; picker: boolean }[] = []
    const call = host.host.call
    host.host.call = (async (name: string, input: { model: string; system: string }) => {
      if (name === 'copilot.rewrite') {
        const picker = input.system.startsWith('You pick source files')
        calls.push({ model: input.model, picker })
        return { text: picker ? '["src/auth.ts"]' : 'Enhanced fixture' }
      }
      return call(name as never, input as never)
    }) as typeof host.host.call
    await enhance(host, { prompt: 'Fix validateSession', effort: 'high', level: 'max' })
    assert.deepEqual(calls, [{ model: 'picker-model', picker: true }, { model: 'rewrite-model', picker: false }])
  })
})

test('an unavailable AI selector never silently moves selection to the rewriting model', async () => {
  await fixture({ 'src/auth.ts': 'export function validateSession() { return true }' }, async ({ services, host, calls }) => {
    const profile = { id: 'cp', name: 'Fixture', preset: 'copilot', provider: 'copilot', model: 'fixture', enabled: true }
    for (const selectorProfileId of ['external', 'disabled']) {
      await services.storage.set('models', { profiles: [profile, { ...profile, id: 'disabled', enabled: false }, { ...profile, id: 'external', preset: 'openai', provider: 'openai' }], selectorProfileId })
      await assert.rejects(enhance(host, { prompt: 'Fix validateSession', level: 'max' }), /Select an enabled Copilot model for AI-assisted context/)
      assert.equal(calls.length, 0)
    }
    await services.settings.set('allowProjectFiles', false)
    await enhance(host, { prompt: 'Fix validateSession', level: 'max' })
    assert.equal(calls.length, 1)
    await services.settings.set('allowProjectFiles', true)
    await enhance(host, { prompt: 'Fix validateSession', level: 'deep' })
    assert.equal(calls.length, 2)
  })
})

test('a charged AI picker accounting failure stops the run before rewriting', async () => {
  await fixture({ 'src/auth.ts': 'export function validateSession() { return true }' }, async ({ host }) => {
    const models: string[] = []
    const call = host.host.call
    host.host.call = (async (name: string, input: { system: string }) => {
      if (name === 'copilot.rewrite') {
        models.push(input.system)
        throw new LlmError(msg('error.copilot_usage'), 'action_failed')
      }
      return call(name as never, input as never)
    }) as typeof host.host.call
    await assert.rejects(enhance(host, { prompt: 'Fix validateSession', level: 'max' }), /Copilot usage could not be saved/)
    assert.equal(models.length, 1)
    assert.ok(models[0].startsWith('You pick source files'))
  })
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

test('context cache matches extra files, exclusions and Git permission before reuse', async () => {
  await fixture({ 'AGENTS.md': 'RULE', 'guide.txt': 'EXTRA' }, async ({ root }) => {
    const settings = { extraContextFiles: ['guide.txt'], privacy: { allowGit: false }, excludePatterns: '' }
    await staticParts(root, settings.extraContextFiles, true, false, undefined, undefined, settings)
    assert.ok(cachedStatic(root, settings))
    assert.equal(cachedStatic(root, { ...settings, extraContextFiles: [] }), null)
    assert.equal(cachedStatic(root, { ...settings, excludePatterns: 'guide.txt' }), null)
    assert.equal(cachedStatic(root, { ...settings, privacy: { allowGit: true } }), null)
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
