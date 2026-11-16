import { read, set } from '#panel'
import { assert, mockHost, test } from '#testing'
import type { HistoryEntry } from './history.ts'
import { filterHistory, historyExcerpt, historyMatchParts, historyProjects, historyTitle, pageHistory, resolveHistoryProject } from './panel/history.ts'
import { draft, filteredHistory, historyFilter, historyOpen, historyOrder, historyPageNumber, historyRaw, historyScope, historyWindow, result, tab } from './panel/state.ts'
import { mountPanel } from './panel/testing.ts'

const entry = (id: string, project?: string, at = 1): HistoryEntry => ({ id, project, at, original: 'Same request\nKeep résumé.ts unchanged.', enhanced: 'Review café/notes.md and retry safely.', model: 'model', style: 'balanced', source: 'panel' })
const projects = ['C:\\Projects\\comments', 'D:\\Experiments\\comments', '/work/enhance-prompt']
const entries = [entry('one', projects[0], 4), entry('two', projects[1], 3), entry('three', projects[2], 2), entry('old', undefined, 1)]

test('history project navigation keeps full identities, distinguishes matching folder names and includes unassigned history', () => {
  const choices = historyProjects(entries, projects[2], 'retry')
  assert.equal(choices[0].path, projects[2])
  assert.equal(choices[0].current, true)
  assert.equal(choices.length, 4)
  assert.equal(choices.find(item => item.path === projects[0])?.label, 'comments (C:\\Projects)')
  assert.equal(choices.find(item => item.path === projects[1])?.label, 'comments (D:\\Experiments)')
  assert.equal(choices.at(-1)?.name, 'No project recorded')
  assert.ok(choices.every(item => item.count === 1))
  assert.equal(historyProjects(entries, '/new/project', 'missing')[0].count, 0)
  assert.equal(historyProjects(entries, '/new/project', 'missing')[0].current, true)
})

test('legacy scopes, selected paths and removed projects resolve without merging or losing history', () => {
  assert.equal(resolveHistoryProject('project', entries, projects[0]), projects[0])
  assert.equal(resolveHistoryProject('project', entries, null), null)
  assert.equal(resolveHistoryProject('project', [entry('old')], projects[0]), null)
  assert.equal(resolveHistoryProject(`path:${projects[1]}`, entries, projects[0]), projects[1])
  assert.equal(resolveHistoryProject('unassigned', entries, null), '')
  assert.equal(resolveHistoryProject('path:/removed', entries, null), null)
  assert.equal(resolveHistoryProject('path:all', [entry('a', 'all')], null), 'all')
  assert.equal(resolveHistoryProject('unexpected', entries, null), null)
  assert.equal(resolveHistoryProject(42 as never, entries, null), null)
})

test('history search examines both saved texts, preserves duplicates, and sorts a copy', () => {
  assert.deepEqual(filterHistory(entries, ' CAFÉ ', null, 'oldest').map(item => item.id), ['old', 'three', 'two', 'one'])
  assert.deepEqual(filterHistory(entries, 'same request', projects[1], 'newest').map(item => item.id), ['two'])
  assert.deepEqual(filterHistory(entries, '', '', 'newest').map(item => item.id), ['old'])
  assert.equal(filterHistory(entries, 'absent', null, 'newest').length, 0)
  assert.deepEqual(entries.map(item => item.id), ['one', 'two', 'three', 'old'])
})

test('history pagination clamps after deletion, chooses a visible entry and handles empty results', () => {
  const list = Array.from({ length: 25 }, (_, i) => entry(String(i)))
  const second = pageHistory(list, 2, '14')
  assert.equal(second.entries.length, 12)
  assert.equal(second.selected?.id, '14')
  assert.equal(second.start, 13)
  assert.equal(second.end, 24)
  assert.equal(pageHistory(list, 2, '0').selected?.id, '12')
  const removedLast = pageHistory(list.slice(0, 24), 3, '24')
  assert.equal(removedLast.page, 2)
  assert.equal(removedLast.selected?.id, '12')
  assert.equal(pageHistory([], 8, 'missing').selected, null)
  assert.equal(pageHistory([], 8, null).start, 0)
  assert.equal(pageHistory(list, NaN, null).page, 1)
})

test('history excerpts and literal match parts preserve the original strings and Unicode', () => {
  const text = '<script>résumé.ts</script> [a+b] [A+B]'
  assert.deepEqual(historyMatchParts(text, '[a+b]').filter(part => part.match).map(part => part.text), ['[a+b]', '[A+B]'])
  assert.equal(historyMatchParts(text, 'résumé').map(part => part.text).join(''), text)
  assert.equal(historyTitle(entry('a')), 'Same request')
  assert.equal(historyExcerpt(entry('a')), 'Keep résumé.ts unchanged.')
  assert.equal(historyTitle({ ...entry('a'), original: '\n' }), 'Untitled request')
  const long = { ...entry('a'), original: 'x'.repeat(20_000) }
  assert.ok(historyTitle(long).length <= 161, 'the reader heading stays bounded')
  assert.equal(long.original.length, 20_000, 'the original text remains intact')
  const longExcerpt = { ...entry('a'), original: `Title\n${'x '.repeat(9997)}` }
  assert.ok(historyExcerpt(longExcerpt).length <= 241, 'clipped row excerpts also stay short for screen readers')
  assert.ok(historyMatchParts(historyExcerpt(longExcerpt), 'x').length <= 241, 'highlight only the short display excerpt')
  assert.ok(historyExcerpt({ ...longExcerpt, original: 'Title', enhanced: 'x'.repeat(20_000) }).length <= 241)
  assert.equal(entry('a').original, 'Same request\nKeep résumé.ts unchanged.')
})

test('browsing every saved project and selecting a reader never alters the composer', async () => {
  const host = mockHost({ storage: { history: entries }, requests: { 'models.get': { profiles: [], selectorProfileId: null }, 'targets.list': { targets: [], project: projects[0] } } })
  const panel = await mountPanel(host, { persisted: { plugin: { historyScope: 'project', draft: 'Keep my current request', result: 'Keep my current result' } } })
  assert.deepEqual(read(filteredHistory).map(item => item.id), ['one'])
  set(historyScope, `path:${projects[1]}`)
  set(historyFilter, 'RETRY')
  set(historyOrder, 'oldest')
  set(historyPageNumber, 8)
  set(historyOpen, 'one')
  assert.equal(read(historyWindow).selected?.id, 'two')
  assert.equal(read(historyWindow).page, 1)
  assert.equal(read(draft), 'Keep my current request')
  assert.equal(read(result), 'Keep my current result')
  assert.equal(read(tab), 'enhance')
  set(historyRaw, entries.filter(item => item.id !== 'two') as never)
  assert.equal(read(filteredHistory).length, 3, 'removed project falls back to all projects')
  assert.equal(read(historyScope), `path:${projects[1]}`, 'reading does not write preferences')
  assert.deepEqual(panel.errors, [])
  await panel.unmount()
})
