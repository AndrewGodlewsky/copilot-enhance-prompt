// Offline audit harness: synthetic data only, no desktop, account or model calls.
import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { historyProjects, filterHistory, pageHistory } from '../../src/panel/history.ts'
import { capHistory, parseHistory } from '../../src/history.ts'
import { persistentStore } from '../../src/copilot/storage.ts'
import { createUsageRecorder } from '../../src/copilot/usage.ts'
import { gatherContext, staticParts } from '../../src/context/index.ts'
import { gitGrepCount, SAFE_PATHSPECS } from '../../src/context/git.ts'
import { mockHost } from '../../src/testing.ts'
import { makeCrew, sampleCrew } from '../../src/panel/word-crew.ts'

export function syntheticHistory(count, projects = 100) {
  return Array.from({ length: count }, (_, index) => ({ id: `audit-${index}`, at: 1_790_000_000_000 - index * 60_000,
    original: `Investigate validateSession in module ${index % 20}. ${'Synthetic request. '.repeat(20)}`,
    enhanced: `Inspect module ${index % 20} and preserve scope. ${'Synthetic evidence. '.repeat(60)}`,
    model: 'fixture', style: 'balanced', source: 'panel', project: `/synthetic/team-${index % projects}/project-${index % 30}` }))
}

// Isolated optimization experiment. Production is unchanged. Preserve exact public output.
export function groupedProjects(entries, current, query = '') {
  const label = path => {
    if (!path) return { name: 'No project recorded', parent: '' }
    const trimmed = path.replace(/[\\/]+$/, '')
    const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
    return { name: trimmed.slice(slash + 1) || path, parent: trimmed.slice(0, Math.max(0, slash)) || (path.startsWith('/') ? '/' : '') }
  }
  const paths = [...new Set([...entries.map(entry => entry.project || ''), ...(current ? [current] : [])])]
  const labels = new Map(paths.map(path => [path, label(path)]))
  const names = new Map(), counts = new Map(), search = query.trim().toLowerCase()
  for (const { name } of labels.values()) names.set(name, (names.get(name) || 0) + 1)
  for (const entry of entries) if (entry.original.toLowerCase().includes(search) || entry.enhanced.toLowerCase().includes(search)) {
    const path = entry.project || ''; counts.set(path, (counts.get(path) || 0) + 1)
  }
  return paths.map(path => {
    const { name, parent } = labels.get(path), duplicate = names.get(name) > 1
    return { value: path ? `path:${path}` : 'unassigned', path, name, label: duplicate ? `${name} (${parent})` : name,
      detail: duplicate ? parent : '', current: path === current, count: counts.get(path) || 0 }
  }).sort((a, b) => Number(b.current) - Number(a.current) || Number(!a.path) - Number(!b.path) || a.label.localeCompare(b.label, 'en'))
}

export function summarize(samples) {
  assert.ok(samples.length && samples.every(value => Number.isFinite(value) && value >= 0))
  const sorted = [...samples].sort((a, b) => a - b)
  return { samples: samples.map(value => +value.toFixed(3)), medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(3),
    maxMs: +sorted.at(-1).toFixed(3), minMs: +sorted[0].toFixed(3) }
}

async function run(mode) {
  const base = resolve('.artifacts/v1-audit')
  const directory = join(base, `${mode}-${randomUUID()}`)
  assert.ok(!relative(base, directory).startsWith('..'))
  await mkdir(directory, { recursive: true })
  const results = { schema: 1, mode, version: '0.12.0', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version, platform: process.platform, architecture: process.arch, capturedAt: new Date().toISOString(),
    syntheticOnly: true, modelCalls: 0, measurements: [] }
  async function measure(name, fn, metadata = {}, repetitions = 3) {
    const samples = []
    let value
    for (let repeat = 0; repeat < repetitions; repeat++) {
      const start = performance.now(); value = await fn(); samples.push(performance.now() - start)
    }
    results.measurements.push({ name, ...metadata, ...summarize(samples) })
    process.stderr.write(`${name}: ${results.measurements.at(-1).medianMs} ms\n`)
    return value
  }
  if (mode === 'history') {
    for (const count of [50, 500, 10_000, 50_000]) {
      const data = syntheticHistory(count, count <= 500 ? 20 : 500)
      const projects = new Set(data.map(entry => entry.project)).size
      const meta = { records: count, projects, jsonBytes: Buffer.byteLength(JSON.stringify(data)), beyondSupportedHistoryLimit: count > 500 }
      await measure('history.parse', () => parseHistory(data), meta)
      const current = await measure('history.projects.current', () => historyProjects(data, null, 'module 2'), meta)
      const proposed = await measure('history.projects.singlePassPrototype', () => groupedProjects(data, null, 'module 2'), meta)
      assert.deepEqual(proposed, current)
      const filtered = await measure('history.searchAndSort', () => filterHistory(data, 'module 2', null, 'newest'), meta)
      const page = pageHistory(filtered, 1, null); assert.ok(page.entries.length <= 12)
      results.measurements.push({ name: 'history.retention', records: count, keptAtDefault: capHistory(data, 50).length, keptAtMaximum: capHistory(data, 500).length })
    }
  } else if (mode === 'storage') {
    for (const count of [100, 1000, 10_000, 30_000]) {
      const root = join(directory, String(count)); await mkdir(root)
      const data = {}
      for (let index = 0; index < count; index++) {
        const scope = `session:${index.toString(16).padStart(24, '0')}:panel:`
        data[scope + 'draft'] = 'd'.repeat(1024); data[scope + 'lastEnhanced'] = 'r'.repeat(1024)
      }
      const content = JSON.stringify(data); await writeFile(join(root, 'state.json'), content)
      const store = persistentStore(root), key = 'session:000000000000000000000000:panel:draft'
      const meta = { sessions: count, records: count * 2, jsonBytes: Buffer.byteLength(content) }
      assert.equal((await measure('storage.readOneDraft', () => store.get(key), meta)).length, 1024)
      await measure('storage.writeOneSmallPreference', () => store.set('audit-small', true), meta)
      await measure('storage.fourConcurrentWrites', () => Promise.all([0, 1, 2, 3].map(i => store.set(`audit-concurrent-${i}`, i))), meta)
      const hydrated = await measure('storage.hydrate20Keys.current', () => Promise.all(Array.from({ length: 20 }, () => store.get(key))), meta, 1)
      const snapshot = await measure('storage.hydrate20Keys.snapshotPrototype', async () => {
        const snapshot = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))
        return Array.from({ length: 20 }, () => snapshot[key])
      }, meta, 1)
      assert.deepEqual(hydrated, snapshot)
    }
  } else if (mode === 'usage') {
    const root = join(directory, 'usage')
    const receipt = (index, sessionId) => ({ type: 'assistant.usage', id: `event-${index}`, timestamp: '2026-11-16T12:00:00Z', data: {
      model: 'fixture', inputTokens: 1000, outputTokens: 200, accounting: { sourceSessionId: sessionId, usageId: `usage-${index}`, sequence: index }
    } })
    const count = 10_000
    await measure('usage.create10000Sessions20000Receipts', async () => {
      for (let index = 0; index < count; index++) {
        const id = randomUUID(), recorder = await createUsageRecorder(id, root)
        recorder.record(receipt(0, id)); recorder.record(receipt(1, id)); await recorder.flush()
        if (index % 1000 === 999) process.stderr.write(`usage: ${index + 1} sessions persisted\n`)
      }
    }, { sessions: count, receipts: count * 2 }, 1)
    const folders = await readdir(join(root, 'session-state')); assert.equal(folders.length, count)
    let bytes = 0, receipts = 0
    await measure('usage.readAll20000Receipts', async () => {
      bytes = 0; receipts = 0
      for (const folder of folders) {
        const content = await readFile(join(root, 'session-state', folder, 'events.jsonl'), 'utf8')
        bytes += Buffer.byteLength(content); receipts += content.trim().split('\n').map(line => JSON.parse(line)).filter(event => event.type === 'session.usage_record').length
      }
    }, { consumerSimulation: true, sessions: count, receipts: count * 2 }, 1)
    assert.equal(receipts, count * 2)
    results.measurements.push({ name: 'usage.retained', sessions: count, receipts, eventFileBytes: bytes, files: count * 2 })
    for (const count of [10, 100, 1000]) await measure('usage.burstSingleSession', async () => {
      const id = randomUUID(), recorder = await createUsageRecorder(id, root)
      for (let index = 0; index < count; index++) recorder.record(receipt(index, id))
      await recorder.flush()
    }, { receiptsPerSession: count, abnormalBurst: count > 10 }, 1)
  } else if (mode === 'context') {
    const root = join(directory, 'project'); await mkdir(root)
    const count = 30_000
    for (let group = 0; group < 100; group++) {
      const folder = join(root, `module-${group}`); await mkdir(folder)
      for (let first = 0; first < 300; first += 50) await Promise.all(Array.from({ length: 50 }, (_, offset) => {
        const i = group * 300 + first + offset
        return writeFile(join(folder, `source-${i}.ts`), `export function validateSession${i}() { return ${i} }\n// Synthetic context fixture\n`)
      }))
    }
    await writeFile(join(root, 'README.md'), '# Synthetic project\n\n## Test\nUse the project test runner.\n')
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' })
    const workspace = { id: 'audit', name: 'audit', path: root, branch: null, hostId: null }
    const host = mockHost({ results: { 'workspace.readContext': { displayName: 'audit', branch: '', workspaceId: 'audit' }, 'workspace.list': { workspaces: [workspace] } } })
    const parts = await measure('context.enumerateAndReadRules.git', () => staticParts(root, [], true, true), { filesOnDisk: count + 1 })
    assert.equal(parts.files.length, count + 1)
    await measure('context.staticCacheHit', () => staticParts(root, [], false, true), { filesOnDisk: count + 1 })
    for (const level of ['off', 'standard', 'deep', 'max', 'ai-test']) {
      const result = await measure(`context.gather.${level}`, () => gatherContext(host, { level, prompt: 'Investigate validateSession14999 source-14999.ts',
        terminalLines: 0, exclude: new Set(), extraFiles: [], excludePatterns: '', allowTerminal: false,
        pickFiles: async () => ['module-49/source-14999.ts'] }), { filesOnDisk: count + 1, selectorIsStub: level === 'max', researchModelNotIncluded: level === 'ai-test' })
      results.measurements.push({ name: `context.payload.${level}`, items: result.items.length, chars: result.items.reduce((n, item) => n + item.content.length, 0) })
    }
    const walked = await measure('context.enumerate.noGit', () => staticParts(root, [], true, false), { filesOnDisk: count + 1 }, 1)
    results.measurements.push({ name: 'context.noGitCoverage', filesOnDisk: count + 1, filesEnumerated: walked.files.length, targetFound: walked.files.includes('module-49/source-14999.ts') })
  } else if (mode === 'search') {
    const existing = (await readdir(base, { withFileTypes: true })).filter(entry => entry.isDirectory() && entry.name.startsWith('context-'))
    assert.ok(existing.length, 'Run the context workload first to create its synthetic project.')
    const root = join(base, existing[0].name, 'project')
    const words = ['validateSession14999', 'session14999', 'synthetic', 'source', 'investigate']
    const current = await measure('context.search.separateGitProcesses', () => Promise.all(words.map(word => gitGrepCount(root, word))), { filesOnDisk: 30001, keywords: words.length })
    const proposed = await measure('context.search.singlePassPrototype', async () => {
      const { stdout } = await promisify(execFile)('git', ['-c', 'core.fsmonitor=false', '-c', 'color.ui=never', 'grep', '-n', '-I', '-i', '-F', '--untracked', '--exclude-standard',
        ...words.flatMap(word => ['-e', word]), '--', ...SAFE_PATHSPECS], { cwd: root, windowsHide: true, maxBuffer: 16_000_000, timeout: 30_000, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' } })
      const counts = words.map(() => new Map())
      for (const line of stdout.split('\n')) {
        const match = /^(.+?):\d+:(.*)$/.exec(line)
        if (!match) continue
        const lower = match[2].toLowerCase()
        words.forEach((word, index) => { if (lower.includes(word.toLowerCase())) counts[index].set(match[1], (counts[index].get(match[1]) || 0) + 1) })
      }
      return counts
    }, { filesOnDisk: 30001, keywords: words.length, fixtureOnly: true })
    assert.deepEqual(proposed, current, 'The prototype must preserve every per-keyword file count on the fixture.')
  } else if (mode === 'animation') {
    for (const count of [50, 200, 1000]) await measure('animation.sample600Frames', () => {
      const words = Array.from({ length: count }, (_, index) => ({ text: `word${index}`, x: index % 20 * 50, y: Math.floor(index / 20) * 20, width: 40 }))
      const crew = makeCrew(words, 1000, 42)
      for (let frame = 0; frame < 600; frame++) sampleCrew(crew, frame / 60)
      return crew
    }, { visibleWords: count, frames: 600, browserPaintingExcluded: true })
  } else throw new Error('Use history, storage, usage, context, search or animation.')
  results.processMaxRssKiB = process.resourceUsage().maxRSS
  await writeFile(join(base, `${mode}-results.json`), JSON.stringify(results, null, 2) + '\n')
  process.stdout.write(JSON.stringify(results, null, 2) + '\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run(process.argv[2])
