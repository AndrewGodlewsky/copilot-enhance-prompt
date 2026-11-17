// History: size limits, and edits from the panel going through the worker's queue.
import { read, set } from '#panel'
import { assert, mockHost, mountWorker, test, type MockRequests } from '#testing'
import { capHistory, HISTORY_ENTRY_CHARS, HISTORY_TOTAL_CHARS, historyProjectPath, parseHistory, trimForHistory, type HistoryEntry } from './history.ts'
import { clearData, clearHistory, clearRequest, removeEntry, reuse } from './panel/actions.ts'
import { busy, confirmClearHistory, confirmWipe, contextShown, draft, excluded, files, filteredHistory, history, historyFilter, historyWindow, lastRun, notice, put, result, resultFor, tab } from './panel/state.ts'
import { attachmentItemId } from './image-limits.ts'
import { mountPanel } from './panel/testing.ts'
import * as main from './worker.ts'
import { historyProjects, filterHistory } from './panel/history.ts'

const entry = (id: string, size = 10): HistoryEntry => ({ id, at: 1, original: 'o'.repeat(size), enhanced: 'e'.repeat(size), style: 'balanced', model: 'm', source: 'panel' })
const gpt = { id: 'gpt', name: 'gpt', preset: 'copilot', provider: 'copilot', model: 'gpt-5-mini', enabled: true }

test('full common-prefix project paths survive history normalization and group separately', () => {
  const prefix = 'C:/Projects/' + '日本語-worktrees/'.repeat(22)
  const paths = [prefix + 'a/main', prefix + 'b/main']
  const parsed = parseHistory(paths.map((project, index) => ({ ...entry(`long-${index}`), project })))
  assert.deepEqual(parsed.map(item => item.project), paths)
  const choices = historyProjects(parsed, paths[0])
  assert.equal(choices.length, 2)
  assert.ok(choices.every(choice => choice.count === 1 && choice.label.startsWith('main (')))
  assert.deepEqual(filterHistory(parsed, '', paths[0], 'newest').map(item => item.id), ['long-0'])
})

test('legacy clipped history paths stay visible but never match a guessed project', async () => {
  const path = 'C:/Projects/' + 'x'.repeat(188)
  assert.equal(path.length, 200)
  const original = 'Keep 日本語 and "quoted text" verbatim.'
  const parsed = parseHistory([
    { ...entry('old'), project: path, original },
    { ...entry('new'), project: path, projectIdentity: 'full' },
    { ...entry('oversized'), project: path.repeat(170), projectIdentity: 'full' }
  ])
  assert.equal(parsed[0].project, path)
  assert.equal(parsed[0].original, original)
  assert.deepEqual(parsed.map(historyProjectPath), ['', path, ''])
  assert.deepEqual(filterHistory(parsed, '', path, 'newest').map(item => item.id), ['new'])
  assert.equal(historyProjects(parsed, path).find(choice => choice.value === 'unassigned')?.count, 2)
  const view = await mountPanel(mockHost())
  reuse(parsed[0])
  assert.equal(read(draft), original)
  assert.equal(read(resultFor), null)
  assert.match(read(notice)?.text ?? '', /incomplete project identity/)
  await view.unmount()
})

test('history cutoff on whitespace cannot become a shorter valid project after normalization', () => {
  const shorter = 'C:/Projects/' + 'x'.repeat(187)
  const project = shorter + ' '
  assert.equal(project.length, 200)
  const parsed = parseHistory(parseHistory([{ ...entry('space'), project }]))
  assert.equal(parsed[0].project, project)
  assert.equal(historyProjectPath(parsed[0]), '')
  assert.deepEqual(filterHistory(parsed, '', shorter, 'newest'), [])
})

test('new complete history identities preserve Unicode whitespace in folder names', () => {
  const plain = 'C:/Projects/worktree', spaced = plain + '\u00a0'
  const parsed = parseHistory([
    { ...entry('plain'), project: plain, projectIdentity: 'full' },
    { ...entry('space'), project: spaced, projectIdentity: 'full' }
  ])
  assert.deepEqual(parsed.map(historyProjectPath), [plain, spaced])
  assert.equal(historyProjects(parsed, null).length, 2)
  assert.deepEqual(filterHistory(parsed, '', spaced, 'newest').map(item => item.id), ['space'])
})

test('history keeps at most the limit (500) and stays under its total size; one huge entry is trimmed', () => {
  const many = Array.from({ length: 600 }, (_, index) => entry(`e${index}`))
  assert.equal(capHistory(many, 500).length, 500)
  assert.equal(capHistory(many, 500)[0].id, 'e0')
  // 100 entries of 2 × 9000 chars: only what fits in HISTORY_TOTAL_CHARS, newest first.
  const big = Array.from({ length: 100 }, (_, index) => entry(`b${index}`, 9000))
  const kept = capHistory(big, 500)
  assert.equal(kept.length, Math.floor(HISTORY_TOTAL_CHARS / 18_000))
  assert.equal(kept[0].id, 'b0')
  const trimmed = trimForHistory('x'.repeat(HISTORY_ENTRY_CHARS * 3))
  assert.ok(trimmed.length <= HISTORY_ENTRY_CHARS)
  assert.match(trimmed, /trimmed in history\)$/)
  assert.equal(trimForHistory('short'), 'short')
})

test('a very long prompt is saved trimmed, and older entries make room', async () => {
  const old = Array.from({ length: 499 }, (_, index) => entry(`old${index}`, 1500))
  const host = mockHost({ storage: { models: { profiles: [gpt] }, history: old }, results: { 'copilot.rewrite': { text: 'r'.repeat(HISTORY_ENTRY_CHARS * 2) } }, settings: { historyLimit: 500 } })
  const worker = await mountWorker(main, { host })
  await worker.request('prompt.enhance', { prompt: 'p'.repeat(HISTORY_ENTRY_CHARS * 2), level: 'off' })
  const saved = parseHistory(host.data().storage.history as never)
  assert.ok(saved[0].original.length <= HISTORY_ENTRY_CHARS && saved[0].enhanced.length <= HISTORY_ENTRY_CHARS)
  const total = saved.reduce((sum, item) => sum + item.original.length + item.enhanced.length, 0)
  assert.ok(total <= HISTORY_TOTAL_CHARS, String(total))
  assert.ok(saved.length < 500)
  await worker.deactivate()
})

test('history.remove and history.clear run in order with a new entry being saved', async () => {
  const host = mockHost({ storage: { models: { profiles: [gpt] }, history: [entry('a'), entry('b')] }, results: { 'copilot.rewrite': async () => { await new Promise(resolve => setTimeout(resolve, 5)); return { text: 'ok' } } } })
  const worker = await mountWorker(main, { host })
  await Promise.all([worker.request('prompt.enhance', { prompt: 'new one', level: 'off' }), worker.request('history.remove', { id: 'a' })])
  const afterRemove = parseHistory(host.data().storage.history as never)
  assert.deepEqual(afterRemove.map((item) => item.original).sort(), ['new one', 'oooooooooo'])
  assert.ok(!afterRemove.some((item) => item.id === 'a'))

  // Clear while a run is finishing: the clear is not undone by the run's write, nor the reverse.
  const run = worker.request('prompt.enhance', { prompt: 'during clear', level: 'off' })
  await worker.request('history.clear')
  await run
  const afterClear = parseHistory((host.data().storage.history ?? null) as never)
  assert.ok(afterClear.length <= 1)
  assert.ok(afterClear.every((item) => item.original === 'during clear'))
  await worker.deactivate()
})

test('the History tab: edits go through the worker, the search filters, and long lists show a page at a time', async () => {
  const requests: string[] = []
  const host = mockHost({
    storage: { history: Array.from({ length: 120 }, (_, index) => ({ ...entry(`h${index}`), original: `prompt ${index}` })) },
    requests: {
      'models.get': { profiles: [], selectorProfileId: null },
      'targets.list': { targets: [] },
      'history.remove': (input: unknown) => {
        requests.push(`remove:${(input as { id: string }).id}`)
        return { ok: true }
      },
      'history.clear': () => {
        requests.push('clear')
        return { ok: true }
      }
    }
  })
  const view = await mountPanel(host)
  // The list comes from storage; the library draws a bounded page.
  assert.equal(read(history).length, 120)
  assert.equal(read(historyWindow).entries.length, 12)
  assert.equal(read(historyWindow).pages, 10)
  set(historyFilter, 'PROMPT 11')
  assert.deepEqual(read(filteredHistory).map((item) => item.original), ['prompt 11', ...Array.from({ length: 10 }, (_, index) => `prompt 11${index}`)])
  set(historyFilter, '')
  // Opening an entry again puts it in the composer.
  reuse(read(history)[3])
  assert.equal(read(draft), 'prompt 3')
  assert.equal(read(tab), 'enhance')
  // Delete and Clear are requests to the worker (in order with the entries it is saving), never a
  // write from the panel; the second press of Clear ends the "press again" state.
  await removeEntry('h7')
  assert.deepEqual(requests, ['remove:h7'])
  set(confirmClearHistory, true)
  await clearHistory()
  assert.deepEqual(requests, ['remove:h7', 'clear'])
  assert.equal(read(confirmClearHistory), false)
  assert.deepEqual(view.errors, [])
  await view.unmount()
})

const panelRequests: MockRequests = {
  'models.get': { profiles: [], selectorProfileId: null },
  'targets.list': { targets: [] },
  'data.clear': { ok: true as const },
  'data.summary': { history: 0, profiles: 0, catalogs: 0 }
}
const persistedRun = { draft: 'my secret draft', result: 'the rewritten secret', lastRun: { model: 'm', profileName: 'p', ms: 1, attempts: [] }, contextShown: [{ id: 'workspace', kind: 'workspace', label: 'Workspace', chars: 4 }], contextNotes: ['No focused workspace.'] }

test('the draft and last result are kept across panel runs while history is saved', async () => {
  const view = await mountPanel(mockHost({ requests: panelRequests }), { persisted: { plugin: persistedRun } })
  assert.equal(read(draft), 'my secret draft')
  assert.equal(read(result), 'the rewritten secret')
  put(draft, 'next idea')
  await view.settled()
  assert.equal(view.persisted.plugin.draft, 'next idea')
  await view.unmount()
})

test('clearing the request also clears the saved result and its metadata, preserving history and project exclusions', async () => {
  const attachments = [
    { path: '/attachments/image.png', name: 'image.png', type: 'image/png', bytes: 20 },
    { path: '/attachments/notes.txt', name: 'notes.txt', type: 'text/plain', bytes: 12 }
  ]
  const host = mockHost({ requests: panelRequests, storage: { history: [entry('saved')] } })
  const view = await mountPanel(host, { persisted: { plugin: { ...persistedRun, files: attachments } } })
  const projectContext = read(contextShown)
  put(contextShown, [...projectContext, ...attachments.map(file => ({ id: attachmentItemId(file.path), kind: 'file' as const, label: file.name, chars: 10 }))])
  set(excluded, ['file:src/private.ts', ...attachments.map(file => attachmentItemId(file.path))])
  set(resultFor, read(draft))
  assert.equal(clearRequest(), true)
  await view.settled()
  assert.equal(read(draft), '')
  assert.deepEqual(read(files), [])
  assert.deepEqual(read(contextShown), projectContext)
  assert.deepEqual(read(excluded), ['file:src/private.ts'])
  assert.equal(read(resultFor), null)
  assert.equal(read(result), '')
  assert.equal(read(lastRun), null)
  assert.deepEqual(read(history).map(item => item.id), ['saved'])
  assert.equal(view.persisted.plugin.draft, '')
  assert.equal(view.persisted.plugin.result, '')
  assert.equal(view.persisted.plugin.lastRun, null)
  assert.deepEqual(view.persisted.plugin.files, [])
  const persisted = structuredClone(view.persisted)
  assert.deepEqual(view.errors, [])
  await view.unmount()
  const reopened = await mountPanel(host, { persisted })
  assert.equal(read(draft), '')
  assert.deepEqual(read(files), [])
  assert.equal(read(result), '')
  assert.equal(read(lastRun), null)
  assert.deepEqual(reopened.errors, [])
  await reopened.unmount()
})

test('clearing a request is blocked while the composer is busy', async () => {
  const view = await mountPanel(mockHost({ requests: panelRequests }), { persisted: { plugin: persistedRun } })
  for (const operation of ['enhance', 'send'] as const) {
    set(busy, operation)
    assert.equal(clearRequest(), false)
    assert.equal(read(draft), persistedRun.draft)
    assert.equal(read(result), persistedRun.result)
  }
  set(busy, null)
  await view.unmount()
})

test('"Save history" off: the draft and last result are not kept on disk, but still usable now', async () => {
  const view = await mountPanel(mockHost({ requests: panelRequests, settings: { saveHistory: false } }), { persisted: { plugin: persistedRun } })
  for (const key of ['draft', 'result']) assert.equal(view.persisted.plugin[key], '', key)
  assert.equal(view.persisted.plugin.lastRun, null)
  assert.deepEqual(view.persisted.plugin.contextShown, [])
  // What was on screen stays for this run; new typing is not written either.
  assert.equal(read(draft), 'my secret draft')
  put(draft, 'typed now')
  await view.settled()
  assert.equal(view.persisted.plugin.draft, '')
  assert.equal(read(draft), 'typed now')
  await view.unmount()
})

test('"Delete everything" also clears the saved draft and last result', async () => {
  const view = await mountPanel(mockHost({ requests: panelRequests }), { persisted: { plugin: { ...persistedRun, tab: 'privacy' } } })
  // The second press of the button.
  set(confirmWipe, true)
  await clearData('all')
  await view.settled()
  for (const key of ['draft', 'result']) assert.equal(view.persisted.plugin[key], '', key)
  assert.equal(view.persisted.plugin.lastRun, null)
  assert.deepEqual(view.persisted.plugin.contextNotes, [])
  assert.equal(read(draft), '')
  assert.equal(read(result), '')
  assert.equal(read(confirmWipe), false)
  assert.deepEqual(read(notice), { tone: 'success', text: 'All plugin data deleted.' })
  assert.deepEqual(view.errors, [])
  await view.unmount()
})
