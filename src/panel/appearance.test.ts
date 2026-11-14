import { test, assert, mockHost, mount } from '#testing'
import { read, set } from '#panel'
import { colorTheme, currentTheme, deskState, deskTime, systemDark, toggleTheme } from './appearance.ts'
import { draft, result, resultFor, run, workspaceKey } from './state.ts'
import { beginRun, clearData, finishRun, reuse, stopTicking } from './actions.ts'

test('desk time changes only at the local morning, afternoon, and night boundaries', () => {
  for (const [hour, expected] of [[0, 'night'], [4, 'night'], [5, 'morning'], [11, 'morning'], [12, 'afternoon'], [17, 'afternoon'], [18, 'night'], [23, 'night']] as const) {
    assert.equal(deskTime(new Date(2026, 10, 14, hour, 59)), expected)
  }
})

test('the desk follows its current draft and project, not an old result or run', async () => {
  const panel = await mount({ setup: () => {} }, { host: mockHost() })
  try {
    set(workspaceKey, 'project-a')
    assert.equal(read(deskState), 'idle')
    set(draft, '  Add search  ')
    assert.equal(read(deskState), 'draft')
    beginRun('one', { key: 'project-a', name: 'A' })
    assert.equal(read(deskState), 'running')
    set(result, 'Search the settings by name.')
    set(resultFor, 'Add search')
    finishRun('one', 'done')
    assert.equal(read(deskState), 'ready')
    set(draft, 'Add keyboard shortcuts')
    assert.equal(read(deskState), 'draft')
    beginRun('two', { key: 'project-a', name: 'A' })
    finishRun('two', 'error', 'Unavailable')
    assert.equal(read(deskState), 'error')
    set(workspaceKey, 'project-b')
    assert.equal(read(deskState), 'draft')
    set(workspaceKey, 'project-a')
    beginRun('three', { key: 'project-a', name: 'A' })
    finishRun('three', 'cancelled')
    assert.equal(read(deskState), 'cancelled')
    set(draft, '')
    assert.equal(read(deskState), 'idle')
    set(run, null)
    set(draft, 'Add search')
    assert.equal(read(deskState), 'ready', 'a reused result can be ready without a live run')
    set(resultFor, null)
    assert.equal(read(deskState), 'draft', 'uncorrelated restored output is not asserted ready')
  } finally { stopTicking(); await panel.unmount() }
})

test('theme follows the system until toggled and the choice survives a fresh canvas', async () => {
  const host = mockHost()
  let panel = await mount({ setup: () => {} }, { host })
  set(systemDark, true)
  assert.equal(read(currentTheme), 'dark')
  toggleTheme()
  assert.equal(read(currentTheme), 'light')
  assert.equal(host.data().storage.colorTheme, 'light')
  set(systemDark, false)
  set(systemDark, true)
  assert.equal(read(currentTheme), 'light', 'system changes cannot override an explicit choice')
  await panel.unmount()
  panel = await mount({ setup: () => {} }, { host })
  assert.equal(read(colorTheme), 'light')
  toggleTheme()
  assert.equal(read(currentTheme), 'dark')
  await panel.unmount()
})

test('unknown saved theme values safely fall back to the system', async () => {
  const panel = await mount({ setup: () => {} }, { host: mockHost({ storage: { colorTheme: { invalid: true } } }) })
  set(systemDark, false)
  assert.equal(read(currentTheme), 'light')
  set(systemDark, true)
  assert.equal(read(currentTheme), 'dark')
  await panel.unmount()
})

test('reusing history replaces a stale failure for the same text but never clears an active run', async () => {
  const panel = await mount({ setup: () => {} }, { host: mockHost() })
  const entry = { id: 'saved', at: 1, original: 'Add search', enhanced: 'Implement a searchable settings page.', style: 'balanced', model: 'test', source: 'panel' as const }
  try {
    set(workspaceKey, 'project-a')
    set(draft, entry.original)
    for (const status of ['error', 'cancelled'] as const) {
      beginRun(status, { key: 'project-a', name: 'A' })
      finishRun(status, status)
      assert.equal(read(deskState), status, 'a failed rerun must not look ready because it retained an earlier result')
      reuse(entry)
      assert.equal(read(deskState), 'ready')
    }
    beginRun('active', { key: 'project-a', name: 'A' })
    reuse(entry)
    assert.equal(read(run)?.runId, 'active')
    assert.equal(read(deskState), 'running')
  } finally { stopTicking(); await panel.unmount() }
})

test('Delete everything forgets terminal run identity before the same request is typed again', async () => {
  const panel = await mount({ setup: () => {} }, { host: mockHost({ requests: { 'data.clear': { ok: true } } }) })
  try {
    set(workspaceKey, 'project-a')
    set(draft, 'Add search')
    beginRun('failed', { key: 'project-a', name: 'A' })
    finishRun('failed', 'error')
    await clearData('all')
    assert.equal(read(run), null)
    set(workspaceKey, 'project-a')
    set(draft, 'Add search')
    assert.equal(read(deskState), 'draft')
  } finally { stopTicking(); await panel.unmount() }
})
