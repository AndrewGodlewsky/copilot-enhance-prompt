import { read, set } from '#panel'
import { assert, mockHost, test } from '#testing'
import { msg, english } from '../messages.ts'
import { mountPanel } from './testing.ts'
import { copilotStatus, effortConfiguration, reasoningOptions } from './copilot-status.ts'
import { retryCopilot, enhanceNow, applyRecommendedEfforts } from './actions.ts'
import { catalogLoading, catalogs, copilotRunFailure, draft, effort, effortModels, effortReasoning, privacy, result } from './state.ts'
import { collectDiagnostics } from './diagnostics.ts'
import type { Catalog } from '../catalog.ts'
import type { ModelsView } from '../protocol.ts'
import { effortModelOptions, modelWarning } from './view.ts'

const ready: Catalog = { models: [{ id: 'sol', label: 'GPT-6.1 Sol', supportedReasoningEfforts: ['low', 'high'] }], source: 'GitHub Copilot', fetchedAt: 1 }

test('Enhance exposes sign-in failure, Retry checks metadata only, and logs omit private text', async () => {
  let connected = false
  let enhancements = 0
  const host = mockHost({ requests: {
    'models.get': { profiles: [], selectorProfileId: null },
    'models.catalog': () => connected ? ready : { ...ready, models: [], error: english(msg('error.copilot_sign_in')), errorText: msg('error.copilot_sign_in') },
    'prompt.enhance': () => { enhancements++; throw Object.assign(new Error('safe failure'), { text: msg('error.copilot_account') }) }
  } })
  const panel = await mountPanel(host)
  try {
    assert.equal(copilotStatus().code, 'error.copilot_sign_in')
    set(draft, 'PRIVATE user request')
    set(result, 'PRIVATE previous output')
    connected = true
    await retryCopilot()
    assert.equal(copilotStatus().kind, 'ready')
    assert.equal(copilotStatus().actionLabel, 'Check connection')
    const checked = JSON.parse((await collectDiagnostics()).text).copilotModelDiscovery.enhance.connectionCheck
    assert.equal(checked.outcome, 'ok')
    assert.equal(checked.attempt, 2)
    assert.ok(checked.completedAt >= checked.startedAt)
    assert.equal(enhancements, 0)
    assert.equal(read(draft), 'PRIVATE user request')
    assert.equal(read(result), 'PRIVATE previous output')
    await enhanceNow()
    assert.equal(copilotStatus().code, 'error.copilot_account')
    await retryCopilot()
    assert.equal(copilotStatus().code, 'error.copilot_account', 'catalog refresh cannot certify a failed helper')
    assert.equal(enhancements, 1)
    const report = await collectDiagnostics()
    assert.doesNotMatch(report.text, /PRIVATE|user request|previous output/)
    assert.match(report.discovery, /copilot_account/)
    assert.equal(read(copilotRunFailure)?.configuration, effortConfiguration())
  } finally { await panel.unmount() }
})

test('failures wrapped by multiple fallback attempts remain visible after Retry', async () => {
  const text = msg('error.all_failed', { list: ['first', 'second'].map(name => msg('error.attempt', { name, reason: msg('error.copilot_account') })) })
  const panel = await mountPanel(mockHost({ requests: {
    'models.get': { profiles: [], selectorProfileId: null }, 'models.catalog': ready,
    'prompt.enhance': () => { throw Object.assign(new Error('multiple failures'), { text }) }
  } }))
  try {
    set(draft, 'Fix tests')
    await enhanceNow()
    assert.equal(copilotStatus().kind, 'error')
    assert.equal(copilotStatus().code, 'error.copilot_account')
    await retryCopilot()
    assert.equal(copilotStatus().kind, 'error')
  } finally { await panel.unmount() }
})

test('catalog retry ignores late responses and responses after the canvas closes', async () => {
  const waiting: ((catalog: Catalog) => void)[] = []
  let delay = false
  const panel = await mountPanel(mockHost({ requests: {
    'models.get': { profiles: [], selectorProfileId: null },
    'models.catalog': () => delay ? new Promise(resolve => waiting.push(resolve)) : ready
  } }))
  delay = true
  const first = retryCopilot(), second = retryCopilot()
  while (waiting.length < 2) await new Promise(resolve => setTimeout(resolve, 0))
  waiting[1]({ ...ready, fetchedAt: 2 })
  await second
  waiting[0]({ ...ready, error: 'Stale failure', fetchedAt: 1 })
  await first
  assert.equal(read(catalogs).copilot.fetchedAt, 2)
  assert.equal(copilotStatus().kind, 'ready')
  const closing = retryCopilot()
  while (waiting.length < 3) await new Promise(resolve => setTimeout(resolve, 0))
  await panel.unmount()
  waiting[2]({ ...ready, fetchedAt: 3 })
  await closing
  assert.equal(read(catalogs).copilot.fetchedAt, 2)
  assert.equal(read(catalogLoading).copilot, undefined)
  assert.equal(JSON.parse((await collectDiagnostics()).text).copilotModelDiscovery.enhance.connectionCheck, null)
})

test('closing during initial model loading cannot start a connection check afterward', async () => {
  let finish!: (value: ModelsView) => void
  let checks = 0
  const panel = await mountPanel(mockHost({ requests: {
    'models.get': () => new Promise(resolve => { finish = resolve }),
    'models.catalog': () => { checks++; return ready }
  } }))
  await panel.unmount()
  finish({ profiles: [], selectorProfileId: null })
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(checks, 0)
  assert.equal(JSON.parse((await collectDiagnostics()).text).copilotModelDiscovery.enhance.connectionCheck, null)
})

test('closing during recommended preset writes completes saved choices without restarting discovery', async () => {
  let checks = 0
  const host = mockHost({ requests: {
    'models.get': { profiles: [], selectorProfileId: null },
    'models.catalog': () => { checks++; return ready }
  } })
  const panel = await mountPanel(host)
  const save = host.settings.set.bind(host.settings)
  let finish!: () => void
  let first = true
  host.settings.set = async (key, value) => {
    if (first) { first = false; await new Promise<void>(resolve => { finish = resolve }) }
    return save(key, value)
  }
  const pending = applyRecommendedEfforts()
  await panel.unmount()
  finish()
  await pending
  assert.equal(checks, 1, 'only the original startup check should have run')
  assert.equal(await host.settings.get('effortHighModel'), 'recommended', 'intentional shared preference writes still complete')
  assert.equal(JSON.parse((await collectDiagnostics()).text).copilotModelDiscovery.enhance.connectionCheck, null)
})

test('effort dropdown lists the account catalog once without requiring model profiles', async () => {
  const panel = await mountPanel(mockHost({ settings: { effortMediumModel: 'catalog:sol', effortMediumReasoning: 'high' }, requests: {
    'models.get': { profiles: [], selectorProfileId: null }, 'models.catalog': ready
  } }))
  try {
    assert.equal(copilotStatus().kind, 'ready')
    assert.equal(modelWarning(), null)
    const choices = effortModelOptions('medium')
    assert.equal(choices.filter(choice => choice.value === 'catalog:sol').length, 1)
    assert.equal(choices.some(choice => choice.value === 'auto'), false)
    assert.deepEqual(reasoningOptions('medium').map(option => option.value), ['default', 'low', 'high'])
    set(effortModels, { ...read(effortModels), medium: 'retired|sol' })
    assert.equal(effortModelOptions('medium').at(-1)?.value, 'retired|sol')
    assert.equal(copilotStatus().kind, 'error')
  } finally { await panel.unmount() }
})

test('recommended presets require an explicit action for existing users and reasoning options follow the catalog', async () => {
  const host = mockHost({ settings: { effortLowModel: 'custom|sol', effortMediumModel: 'auto', effortHighModel: 'missing|retired', effortMediumReasoning: 'max' }, requests: {
    'models.get': { profiles: [], selectorProfileId: null }, 'models.catalog': ready
  } })
  const panel = await mountPanel(host)
  try {
    assert.equal(read(effortModels).high, 'missing|retired')
    await applyRecommendedEfforts()
    assert.deepEqual(read(effortModels), { low: 'recommended', medium: 'recommended', high: 'recommended' })
    assert.deepEqual(read(effortReasoning), { low: 'default', medium: 'default', high: 'default' })
    assert.equal(copilotStatus().kind, 'ready')
    assert.deepEqual(reasoningOptions('medium').map(option => option.value), ['default', 'low', 'high'])
    set(privacy, { ...read(privacy), allowOnlineModelLists: false })
    assert.equal(copilotStatus().code, 'error.lists_off', 'cached metadata must not conceal disabled access')
    set(privacy, { ...read(privacy), allowOnlineModelLists: true })
    set(effort, 'low')
    assert.equal(copilotStatus().code, 'error.copilot_recommended')
    assert.match(copilotStatus().detail, /Haiku 5.5/)
  } finally { await panel.unmount() }
})
