import { EFFORTS, EFFORT_SETTINGS, REASONING_SETTINGS } from '../effort.ts'
import { formatText } from '../format.ts'
// actions.ts: what the panel does (what its buttons call): requests to the worker, and the changes
// to the state (state.ts) that follow. No UI here; the web panel (web/src) and the tests call these.
import { files as panelFiles, plugin, read, set, settings, shell, update, type JsonValue } from '#panel'
import { MAX_RULE_CHARS, MAX_RULES, MAX_SECTIONS, MAX_STRUCTURES, newId, projectScope, type RulesConfig } from '../rules.ts'
import { exportName, historyMarkdown, ISSUES_URL, targetLabel } from './view.ts'
import { type HistoryEntry } from '../history.ts'
import { attachmentItemId } from '../image-limits.ts'
import { type Message } from '../messages.ts'
import { isContextLevel, type ContextItemView, type ProfileView } from '../presets.ts'
import { isStyle } from '../prompts.ts'
import { NEEDS_CONSENT, parseOtherAgentsLimits, parsePrivacy } from '../privacy.ts'
import { stepPercent, totalPercent, type Step } from '../progress.ts'
import { PANEL_REQUEST_LIMIT_MS } from '../protocol.ts'
import { pathInWorkspaceId, pathKey } from '../workspaces.ts'
import { consents, files, ruleDraft, ruleScope, structureDraft, type Form, terminalWorkspaces, workspaceChoices, tick, workspaceKey, projectName, parked, MAX_PARKED, type Slot, rulesState, structureChoice, workspaceName, tab, draft, result, style, effectiveEffort, effortModels, excluded, target, historyRaw, confirmClearHistory, form, catalogs, catalogLoading, type Run, run, dataSummary, privacy, confirmWipe, busy, notice, lastRun, contextShown, contextNotes, KEPT, mayKeep, put, forgetSaved, targets, models, defaults, effectiveStyle, effectiveLevel, effectiveEnter, say, message, errorMessage, historyOpen, resultFor, sendAfterEnhance, filteredHistory, type NoticeAction } from './state.ts'
import { effortReasoning, copilotRunFailure, copilotCheck, contextPreferences } from './state.ts'
import { cancelContextPreview, contextKey, knownWorkspaceId, showContext } from './context-preview.ts'
export { knownWorkspaceId, showContext, previewContext } from './context-preview.ts'
import { connectionFailure, effortConfiguration } from './copilot-status.ts'
import { panelDiagnostics } from './diagnostics.ts'
import { diagnosticError } from '../diagnostics.ts'

let inFlight: AbortController | null = null
/** The enhance-and-send in flight (enhanceAndSend), so that Cancel and a closing panel stop its send too. */
let oneStep: { cancelled: boolean } | null = null
/** The project of the run in flight; filled in if the panel learns its key only after the run started. */
let runOrigin: { key: string | null; name: string | null } | null = null
/** Projects the host has removed: an answer for one of them is dropped, never shown elsewhere. */
const removedWorkspaces = new Set<string>()
/** The key each project was shown under, by its folder (see workspaceRemoved). */
const keyByFolder = new Map<string, string>()

// ---------------------------------------------------------------- projects

/** What the focused project is called in the panel's messages: its own name, else the workspace's. */
const projectTitle = () => read(projectName) ?? read(workspaceName)

/** The composer as it is now, to park under its project. */
function snapshot(): Slot {
  return {
    name: projectTitle(),
    draft: read(draft),
    result: read(result),
    lastRun: read(lastRun),
    contextShown: read(contextShown),
    contextNotes: read(contextNotes),
    excluded: read(excluded),
    files: read(files),
    at: Date.now()
  }
}

const isEmpty = (slot: Slot) => !slot.draft.trim() && !slot.result.trim() && slot.contextShown.length === 0 && (slot.files ?? []).length === 0

/** Keeps a project's composer, newest first, at most MAX_PARKED projects. */
function park(key: string, slot: Slot): void {
  const next = { ...read(parked) }
  delete next[key]
  if (!isEmpty(slot)) next[key] = slot
  const keys = Object.keys(next).sort((a, b) => next[b].at - next[a].at)
  for (const old of keys.slice(MAX_PARKED)) delete next[old]
  put(parked, next)
}

/**
 * The focused project changed: what the composer holds goes back to the project it was written in, and
 * the new project's own draft and result (or an empty composer) come in. A prompt is never shown, and
 * so never sent, in a project other than its own.
 */
function switchWorkspace(key: string, name: string | null, sameTerminals = false): void {
  const old = read(workspaceKey)
  if (old === key) {
    set(workspaceName, name)
    return
  }
  if (old === null) {
    // First answer since the panel opened: the composer already belongs to this project.
    put(workspaceKey, key)
    set(workspaceName, name)
    if (runOrigin && runOrigin.key === null) runOrigin.key = key
    return
  }
  // the host could not tell which workspace this was (several share its name and branch), so the panel
  // knew the project by its name; now the host knows. It is still the project the composer belongs to
  // when it has the terminals that were shown (a terminal is in one workspace only): what the
  // person wrote stays where it is, and a run in flight answers here. Parking it under the name
  // would lose it, since this project is never known by its name again.
  const running = runOrigin !== null && runOrigin.key === old
  if (sameTerminals && name !== null && old === `name:${name}` && !key.startsWith('name:') && (running || !isEmpty(snapshot()))) {
    put(workspaceKey, key)
    set(workspaceName, name)
    if (runOrigin && running) runOrigin.key = key
    return
  }
  park(old, snapshot())
  const incoming = read(parked)[key]
  put(draft, incoming?.draft ?? '')
  put(result, incoming?.result ?? '')
  put(lastRun, incoming?.lastRun ?? null)
  put(contextShown, incoming?.contextShown ?? [])
  put(contextNotes, incoming?.contextNotes ?? [])
  set(excluded, incoming?.excluded ?? [])
  put(files, incoming?.files ?? [])
  if (incoming) park(key, { ...incoming, draft: '', result: '', contextShown: [], files: [] })
  // Which request the result on screen was made from is known for the composer that was just
  // put away, not for this one: its freshness must be established by a new run.
  set(resultFor, null)
  beforeReuse = null
  put(workspaceKey, key)
  set(workspaceName, name)
  set(notice, null)
}

/** Remembers the workspace of these terminals (newest 300). */
export function learnTerminals(terminalIds: string[], workspaceId: string): void {
  const known = read(terminalWorkspaces)
  if (terminalIds.every((id) => known[id] === workspaceId)) return
  const next = { ...known }
  for (const id of terminalIds) {
    delete next[id]
    next[id] = workspaceId
  }
  const ids = Object.keys(next)
  for (const id of ids.slice(0, Math.max(0, ids.length - 300))) delete next[id]
  set(terminalWorkspaces, next)
}

/** The person says which folder the focused workspace is: its terminals are remembered as being there. */
export async function pickWorkspace(workspaceId: string): Promise<void> {
  learnTerminals(read(targets).map((item) => item.terminalId), workspaceId)
  set(workspaceChoices, [])
  await refreshTargets()
}

/**
 * the host removed a project: forget what was parked for it. The event names it by another id than the
 * one the panel knows it by (workspaces.ts), so the project is also looked up by its folder.
 */
export function workspaceRemoved(workspaceId: string, path?: string): void {
  const folder = path ?? pathInWorkspaceId(workspaceId)
  const shownAs = folder ? keyByFolder.get(pathKey(folder)) : undefined
  let next = read(parked)
  for (const key of new Set([workspaceId, ...(shownAs ? [shownAs] : [])])) {
    removedWorkspaces.add(key)
    if (next[key]) {
      next = { ...next }
      delete next[key]
    }
  }
  if (next !== read(parked)) put(parked, next)
}

// ---------------------------------------------------------------- data

export function openSection(value: string): void {
  set(tab, value)
  if (value === 'privacy') {
    void refreshDataSummary()
  }
}

export async function refreshDefaults(): Promise<void> {
  const all = await settings.get().catch(() => ({}) as Record<string, JsonValue>)
  set(defaults, {
    style: typeof all.defaultStyle === 'string' && isStyle(all.defaultStyle) ? all.defaultStyle : 'balanced',
    level: typeof all.contextLevel === 'string' && isContextLevel(all.contextLevel) ? all.contextLevel : 'standard',
    pressEnter: all.sendPressEnter === true,
    fallbackEnabled: all.fallbackEnabled !== false,
    fallbackOn: all.fallbackOn === 'transient' ? 'transient' : 'any',
    otherAgents: parseOtherAgentsLimits(all)
  })
  set(effortModels, { low: String(all[EFFORT_SETTINGS.low] ?? 'recommended') || '__invalid__', medium: String(all[EFFORT_SETTINGS.medium] ?? 'recommended') || '__invalid__', high: String(all[EFFORT_SETTINGS.high] ?? 'recommended') || '__invalid__' })
  set(effortReasoning, { low: String(all[REASONING_SETTINGS.low] ?? 'default'), medium: String(all[REASONING_SETTINGS.medium] ?? 'default'), high: String(all[REASONING_SETTINGS.high] ?? 'default') })
  set(contextPreferences, JSON.stringify([all.extraContextFiles, all.excludePatterns, all.terminalLines, parsePrivacy(all), parseOtherAgentsLimits(all)]))
  set(privacy, parsePrivacy(all))
  // Saving history is off: nothing typed or produced stays on disk after the panel closes.
  if (!mayKeep()) forgetSaved()
}

export async function refreshModels(): Promise<void> {
  if (!catalogOpen) return
  const generation = catalogGeneration
  try {
    const view = await plugin.request('models.get')
    if (!catalogOpen || generation !== catalogGeneration) return
    set(models, view)
    // All profiles use this attached account's catalog.
    if (!read(catalogs).copilot) void retryCopilot()
  } catch (error) {
    if (catalogOpen && generation === catalogGeneration) set(notice, { tone: 'danger', text: message(error) })
  }
}

const catalogRequests = new Map<string, number>()
let catalogSequence = 0
let catalogGeneration = 0
let catalogOpen = false
export function startCatalogLoads() { catalogGeneration++; catalogOpen = true }
export function cancelCatalogLoads() {
  catalogGeneration++
  catalogOpen = false
  catalogRequests.clear()
  set(catalogLoading, {})
  set(copilotCheck, null)
}
export const retryCopilot = () => loadCatalog('copilot', { preset: 'copilot' }, true)

export async function applyRecommendedEfforts() {
  if (!catalogOpen || read(busy)) return
  const generation = catalogGeneration
  const current = () => catalogOpen && generation === catalogGeneration
  set(busy, 'save')
  try {
    for (const effort of EFFORTS) {
      await settings.set(REASONING_SETTINGS[effort], 'default')
      await settings.set(EFFORT_SETTINGS[effort], 'recommended')
    }
    if (!current()) return
    await refreshDefaults()
    if (current()) await retryCopilot()
  } catch (error) { if (current()) set(notice, { tone: 'danger', text: message(error) }) }
  finally { if (current()) set(busy, null) }
}

export async function loadCatalog(
  key: string,
  input: { preset?: 'copilot'; profileId?: string },
  refresh = false
): Promise<void> {
  if (!catalogOpen) return
  const generation = catalogGeneration
  const request = ++catalogSequence
  catalogRequests.set(key, request)
  const current = () => catalogOpen && generation === catalogGeneration && catalogRequests.get(key) === request
  update(catalogLoading, (map) => ({ ...map, [key]: true }))
  const operation = refresh ? 'copilot.refresh' : 'copilot.catalog'
  const started = Date.now()
  const attempt = (read(copilotCheck)?.attempt ?? 0) + 1
  if (key === 'copilot') set(copilotCheck, { attempt, startedAt: started, outcome: 'checking' })
  const completeCheck = (outcome: 'ok' | 'failed') => {
    if (key === 'copilot' && current()) set(copilotCheck, { attempt, startedAt: started, completedAt: Date.now(), outcome })
  }
  panelDiagnostics.record(operation, 'started')
  try {
    const clean = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== ''))
    const catalog = await plugin.request('models.catalog', { preset: input.preset, ...clean, refresh }, { timeoutMs: 60_000 })
    panelDiagnostics.record(operation, catalog.error ? 'failed' : 'ok', { ms: Date.now() - started, ...(catalog.error ? diagnosticError({ text: catalog.errorText }) : {}) })
    if (current()) update(catalogs, (map) => ({ ...map, [key]: catalog }))
    completeCheck(catalog.error ? 'failed' : 'ok')
  } catch (error) {
    if (current()) update(catalogs, (map) => ({ ...map, [key]: { models: [], source: '', fetchedAt: Date.now(), error: message(error), ...(errorMessage(error) ? { errorText: errorMessage(error)! } : {}) } }))
    panelDiagnostics.record(operation, 'failed', { ms: Date.now() - started, ...diagnosticError(error) })
    completeCheck('failed')
  } finally {
    if (current()) update(catalogLoading, (map) => ({ ...map, [key]: false }))
  }
}

export function formCatalogInput(current: Form) {
  return { preset: 'copilot' as const, ...(current.id ? { profileId: current.id } : {}) }
}

export async function refreshTargets(): Promise<void> {
  try {
    const { targets: list, workspace, project, workspaceId, workspacePath, choices } = await plugin.request('targets.list', { known: read(terminalWorkspaces) })
    set(workspaceChoices, choices ?? [])
    // Once known, the workspace of these terminals stays known (the next lookup needs no guess).
    if (workspaceId) learnTerminals(list.map((item) => item.terminalId), workspaceId)
    if (workspaceId && workspacePath) keyByFolder.set(pathKey(workspacePath), workspaceId)
    // A project that is open again is not a removed one (a folder added back keeps its id).
    if (workspaceId) removedWorkspaces.delete(workspaceId)
    // Before the terminals: the composer must follow the project first, so that a target of the new
    // project is never shown next to a prompt of the old one.
    const shown = new Set(read(targets).map((item) => item.terminalId))
    switchWorkspace(workspaceId ?? (workspace ? `name:${workspace}` : ''), workspace ?? null, list.some((item) => shown.has(item.terminalId)))
    // After the switch: what was parked just now carries the name of the project it was written in.
    set(projectName, project ?? null)
    set(targets, list)
    const current = read(target)
    if (!current || !list.some((item) => item.terminalId === current)) {
      set(target, list.find((item) => item.agent)?.terminalId ?? list[0]?.terminalId ?? null)
    }
  } catch {
    set(targets, [])
  }
}

// ---------------------------------------------------------------- actions

export async function enhanceNow(): Promise<void> {
  await runEnhance()
}

/** What a run left in this composer: the request it was made from, and the prompt it wrote. */
type Enhanced = { prompt: string; enhanced: string }

/**
 * One enhance run. Answers with what it put into the composer on screen, or null when nothing is
 * there to act on: it failed or was cancelled, or its project is no longer the one in focus.
 */
async function runEnhance(): Promise<Enhanced | null> {
  const configuration = effortConfiguration()
  const prompt = read(draft).trim()
  if (!prompt || read(busy)) return null
  cancelContextPreview()
  const contextAtStart = contextKey()
  let shown: Enhanced | null = null
  const controller = new AbortController()
  inFlight = controller
  const origin = { key: read(workspaceKey), name: projectTitle() }
  runOrigin = origin
  const runId = beginRun(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, origin)
  set(busy, 'enhance')
  set(notice, null)
  try {
    const input = {
      prompt,
      runId,
      // the host ends a request after 120 s; a slower run goes on in the worker and is asked about again.
      resumable: true,
      style: read(effectiveStyle),
      ...(read(structureChoice) ? { structureId: read(structureChoice) } : {}),
      ...(read(files).length > 0 ? { files: read(files).map((file) => file.path) } : {}),
      ...knownWorkspaceId(),
      level: read(effectiveLevel),
      terminalId: read(target),
      effort: read(effectiveEffort),
      // Leave the key out (not undefined): request inputs must be plain JSON.
      exclude: read(excluded)
    }
    const waiting = { timeoutMs: PANEL_REQUEST_LIMIT_MS, signal: controller.signal }
    let answer = await plugin.request('prompt.enhance', input, waiting)
    // Still going when the request had to answer: wait for it again, until it is done or cancelled.
    while (answer.pending) answer = await plugin.request('prompt.enhance', { prompt, runId, resume: true }, waiting)
    const ran = { model: answer.model, profileName: answer.profileName, ms: answer.ms, attempts: answer.attempts }
    if (origin.key === read(workspaceKey)) {
      put(result, answer.enhanced)
      // Remember which request produced the result for the banner state.
      set(resultFor, prompt)
      put(lastRun, ran)
      showContext(answer.context, answer.notes, contextAtStart)
      shown = { prompt, enhanced: answer.enhanced }
    } else if (origin.key !== null && !removedWorkspaces.has(origin.key)) {
      // The person moved to another project meanwhile: the prompt waits in its own project.
      const slot = read(parked)[origin.key]
      park(origin.key, { ...(slot ?? snapshotFor(origin.name)), result: answer.enhanced, lastRun: ran, contextShown: answer.context, contextNotes: answer.notes, at: Date.now() })
      set(notice, { tone: 'neutral', text: formatText('The enhanced prompt is kept for {name}: go back to that project to send it.', { name: origin.name ?? '?' }) })
    } else {
      // Its project is gone (or unknown): showing it here could send it to the wrong agent.
      set(notice, { tone: 'warning', text: 'The project this prompt was written for is closed, so its enhanced prompt was dropped.' })
    }
    set(copilotRunFailure, null)
    finishRun(runId, 'done')
  } catch (error) {
    if (controller.signal.aborted) finishRun(runId, 'cancelled')
    else {
      const text = connectionFailure(errorMessage(error))
      if (text) set(copilotRunFailure, { configuration, text })
      finishRun(runId, 'error', message(error))
    }
  } finally {
    if (inFlight === controller) inFlight = null
    if (runOrigin === origin) runOrigin = null
    set(busy, null)
  }
  return shown
}

/** An empty composer of a project that has nothing parked. */
function snapshotFor(name: string | null): Slot {
  return { name, draft: '', result: '', lastRun: null, contextShown: [], contextNotes: [], excluded: [], at: Date.now() }
}

/** Starts a fresh run; progress from an older run is ignored by its id. Exported for tests. */
export function beginRun(runId: string, workspace?: { key: string | null; name: string | null }): string {
  const now = Date.now()
  // The card's clock only moves while a run goes: start it with the run, or the time since the last
  // run would show as a negative duration until the first tick.
  set(tick, now)
  set(run, { runId, startedAt: now, prompt: read(draft).trim(), steps: [], status: 'running', ...(workspace ? { workspace } : {}) })
  startTicking()
  return runId
}

let ticker: ReturnType<typeof setInterval> | null = null
/** Moves the run card's clock while a run goes, so time-estimated shares grow; stops on its own. */
function startTicking(): void {
  if (ticker) return
  ticker = setInterval(() => {
    if (read(run)?.status !== 'running') stopTicking()
    else set(tick, Date.now())
  }, 500)
}
export function stopTicking(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
}

/** Takes a worker snapshot when it belongs to the running run. Exported for tests. */
export function applyProgress(snapshot: { runId: string; startedAt: number; steps: { key: string; status: Step['status']; detail?: string; fraction?: number; startedAt?: number }[] }): void {
  const current = read(run)
  if (current && current.runId === snapshot.runId && current.status === 'running') {
    set(run, { ...current, startedAt: snapshot.startedAt, steps: snapshot.steps.map((entry) => ({ ...entry, key: entry.key as Step['key'] })) })
  }
}

/** What a step still running becomes when the run ends this way. */
export const OPEN_STEP_ENDS: Record<Run['status'], Step['status']> = { running: 'running', done: 'done', error: 'failed', cancelled: 'skipped' }

/** Ends a run: a step still running is done, failed or (when cancelled) skipped. */
export function finishRun(runId: string, status: Run['status'], error?: string): void {
  const current = read(run)
  if (!current || current.runId !== runId || current.status !== 'running') return
  const now = Date.now()
  // A step still running keeps the share it had reached (its estimate included), so the card shows
  // where the run stopped; the bar keeps the run's share at that moment and never jumps to 100.
  const steps: Step[] = current.steps.map((entry) => {
    if (entry.status !== 'running') return entry
    const reached = (stepPercent(entry, now) ?? 0) / 100
    return { ...entry, status: OPEN_STEP_ENDS[status], ...(status === 'done' ? {} : { fraction: reached }) }
  })
  const endPercent = status === 'done' ? 100 : totalPercent(current.steps, now)
  set(run, { ...current, steps, status, finishedAt: now, endPercent, ...(error ? { error } : {}) })
  set(tick, now)
  stopTicking()
}

export function removeFile(path: string): void {
  put(files, read(files).filter((file) => file.path !== path))
  // Its text leaves the context list with it, ticked or not.
  const id = attachmentItemId(path)
  put(contextShown, read(contextShown).filter((item) => item.id !== id))
  update(excluded, (list) => list.filter((entry) => entry !== id))
}

export function cancel(): void {
  // The request's signal stops the worker; enhanceNow then records the run as cancelled.
  inFlight?.abort()
  // A one-step send whose model has already answered has no request left to stop: it is told so.
  if (oneStep) oneStep.cancelled = true
}

export function toggleItem(id: string, include: boolean): void {
  update(excluded, (list) => (include ? list.filter((entry) => entry !== id) : [...new Set([...list, id])]))
}

export async function send(text: string): Promise<void> {
  const terminalId = read(target)
  if (!terminalId || !text.trim()) return
  await sendTo(terminalId, text, false)
}

/**
 * Types the text into one terminal. An agent that is waiting for an answer from the person is not
 * typed into unasked (the worker refuses): the notice offers to type it without Enter (`force`).
 */
async function sendTo(terminalId: string, text: string, force: boolean): Promise<void> {
  if (read(busy)) return
  set(busy, 'send')
  try {
    await typeInto(terminalId, text, force)
  } finally {
    set(busy, null)
  }
}

/** The request behind sendTo, and the notice that says how it went. The caller holds `busy`. */
async function typeInto(terminalId: string, text: string, force: boolean): Promise<void> {
  const item = read(targets).find((entry) => entry.terminalId === terminalId)
  if (!item) {
    set(notice, { tone: 'warning', text: 'That terminal is no longer open.' })
    return
  }
  const label = targetLabel(item)
  try {
    const { accepted } = await plugin.request('prompt.send', { terminalId, text, enter: read(effectiveEnter), ...(force ? { force: true } : {}) })
    const done = force ? formatText('Typed into {label}, without Enter.', { label }) : formatText('Sent to {label}.', { label })
    set(notice, accepted ? { tone: 'success', text: done } : { tone: 'warning', text: formatText('{label} did not accept the text.', { label }) })
  } catch (error) {
    if (!force && errorMessage(error)?.code === 'error.agent_blocked') {
      set(notice, { tone: 'warning', text: message(error), action: { label: 'Type it without Enter', run: { kind: 'send.anyway', terminalId, text } } })
    } else set(notice, { tone: 'danger', text: message(error) })
  }
}

/** Whether a one-step send is on: its own switch, and "Send to the host", which it needs. */
export const sendsAfterEnhance = () => read(sendAfterEnhance) && allowed('allowTerminalSend')

/** The agent states in which nothing is going on in the terminal: it sits at its prompt. */
const IDLE_STATES = new Set(['waiting', 'done'])

/**
 * Why a prompt that was just enhanced is not sent by itself, as a sentence for the person, or null
 * when every condition holds. `start` is what was fixed when the run began.
 */
function heldBack(start: { terminalId: string | null; key: string | null }, done: Enhanced): string | null {
  const key = read(workspaceKey)
  // the host tells several same-named projects apart only by their terminals; while it could not (when
  // the run began, or now), this could be a terminal of another project.
  // An empty key is no project at all (the terminals were listed but the host named no workspace).
  const unknown = (value: string | null) => !value || value.startsWith('name:')
  if (unknown(key) || unknown(start.key)) return 'Copilot could not tell which project this is.'
  if (key !== start.key) return 'The project in focus changed while it ran; the prompt waits in the project it was written in.'
  const item = read(targets).find((entry) => entry.terminalId === start.terminalId)
  if (!start.terminalId || !item || read(target) !== start.terminalId) return 'The terminal picked when you started is closed or no longer the one picked.'
  // A plain terminal would run the prompt's first line as a command. the host lists an agent with a
  // state, sometimes without saying which kind it is; a row with neither is a terminal with no agent.
  if (!item.agent && !item.state) return formatText('{label} is a plain terminal, not an agent.', { label: targetLabel(item) })
  // A working agent can ask for an answer at any moment, and what is typed then could be taken as it.
  const name = item.title ?? item.agent ?? item.label
  if (item.state === 'working') return formatText('{name} is still working.', { name })
  if (item.state === 'blocked') return formatText('{name} is waiting for an answer from you.', { name })
  if (!item.state || !IDLE_STATES.has(item.state)) return formatText('Copilot does not say whether {name} is idle.', { name })
  if (read(draft).trim() !== done.prompt || read(result) !== done.enhanced) return 'The text changed while it ran.'
  return null
}

/**
 * Enhances, then types the result into the picked terminal with no read in between. Only while
 * "Send right after enhancing" is on (Settings: off until the person has read what it does);
 * otherwise this is a plain enhance. Nothing is sent on a doubt, and the result then waits in the
 * composer like any other:
 * - the terminal is fixed when the run starts, and must still be open and still be the one picked;
 * - the project must be one the host can tell from the others, and the one the run started in;
 * - the agent there must be idle, as the host reports it once the run is over;
 * - the text sent is the run's own answer, and only while the composer still holds its request.
 * Enter follows the Enter switch, and the worker's own checks (the Send switch, an agent that is
 * waiting for an answer) apply as for any send.
 */
export async function enhanceAndSend(): Promise<void> {
  if (!sendsAfterEnhance()) return enhanceNow()
  const start = { terminalId: read(target), key: read(workspaceKey) }
  const step = { cancelled: false }
  oneStep = step
  const done = await runEnhance()
  // The switch was turned off while the model wrote: this is a plain enhance after all.
  if (!done || !sendsAfterEnhance()) {
    if (oneStep === step) oneStep = null
    return
  }
  set(busy, 'send')
  try {
    // The states as they are now, not as they were when the run began.
    await refreshTargets()
    // Cancelled, or the panel is closing, after the model had answered: nothing goes out.
    if (step.cancelled) return
    const why = heldBack(start, done)
    if (why) {
      set(notice, { tone: 'warning', text: `${'Not sent by itself.'} ${why} ${'Read the prompt and send it yourself.'}` })
      return
    }
    await typeInto(start.terminalId!, done.enhanced, false)
  } finally {
    if (oneStep === step) oneStep = null
    set(busy, null)
  }
}

/**
 * The switch itself. Turning it on is a confirmation: the Settings section calls this from the
 * dialog that says what it does and what can go wrong.
 */
export function setSendAfterEnhance(on: boolean): void {
  set(sendAfterEnhance, on)
}

/** Runs what a notice's button stands for (state.ts: NoticeAction). */
export async function runNoticeAction(action: NoticeAction): Promise<void> {
  // The composer is in use (a run, a send): what the button would do waits, and says so.
  if (action.kind !== 'history.restore' && read(busy) !== null) {
    set(notice, { tone: 'warning', text: 'Something is still running here. Try again when it has finished.' })
    return
  }
  if (action.kind === 'composer.restore') restoreComposer()
  else if (action.kind === 'send.anyway') await sendTo(action.terminalId, action.text, true)
  else {
    const answer = await plugin.request('history.restore', { id: action.id }).catch(() => ({ restored: false }))
    set(notice, answer.restored ? { tone: 'success', text: 'Back in the history.' } : { tone: 'warning', text: 'It could not be brought back.' })
  }
}

export async function copy(text: string): Promise<void> {
  if (!text.trim()) return
  const answer = await plugin.request('prompt.copy', { text }).catch((error) => ({ copied: false, error: message(error) }))
  set(notice, answer.copied ? { tone: 'success', text: 'Copied to clipboard.' } : { tone: 'danger', text: formatText('Copy failed: {error}', { error: answer.error ?? 'unknown error' }) })
}

/** Starts a file export from the user's click; the renderer controls its destination. */
async function saveFile(name: string, data: string): Promise<void> {
  try {
    const { status } = await panelFiles.saveAs({ suggestedName: name, mimeType: 'text/markdown', data })
    if (status === 'saved') set(notice, { tone: 'success', text: 'Saved as a file.' })
    if (status === 'downloaded') set(notice, { tone: 'success', text: 'Download started.' })
  } catch {
    set(notice, { tone: 'danger', text: 'The file could not be saved.' })
  }
}

/** The enhanced prompt as a file, as it reads in the box (edits included). */
export async function savePrompt(text: string): Promise<void> {
  if (!text.trim()) return
  await saveFile(exportName('prompt'), text.endsWith('\n') ? text : `${text}\n`)
}

/** The history entries the list shows (the search and the project filter apply), as one file. */
export async function exportHistory(): Promise<void> {
  const entries = read(filteredHistory)
  if (entries.length === 0) return
  await saveFile(exportName('history'), historyMarkdown(entries))
}

/** What the composer held before a history entry was opened in it, and in which project: for Undo. */
let beforeReuse: { slot: Slot; key: string | null } | null = null

function restoreComposer(): void {
  const kept = beforeReuse
  beforeReuse = null
  // Only in the project it was taken in: a composer never moves to another project.
  if (!kept || kept.key !== read(workspaceKey)) return
  put(draft, kept.slot.draft)
  put(result, kept.slot.result)
  put(lastRun, kept.slot.lastRun)
  put(contextShown, kept.slot.contextShown)
  put(contextNotes, kept.slot.contextNotes)
  set(excluded, kept.slot.excluded)
  put(files, kept.slot.files ?? [])
  set(resultFor, null)
}

/**
 * Opens a history entry in the composer. What the composer held is replaced, so the notice offers
 * Undo; an entry written in another project says so, since it is about to be sent in this one.
 */
export function reuse(entry: HistoryEntry): void {
  const had = snapshot()
  const replaced = !isEmpty(had) && (had.draft !== entry.original || had.result !== entry.enhanced)
  beforeReuse = replaced ? { slot: had, key: read(workspaceKey) } : null
  put(draft, entry.original)
  put(result, entry.enhanced)
  // What the composer showed about its last run was about another prompt.
  put(lastRun, null)
  if (read(run)?.status !== 'running') set(run, null)
  put(contextShown, [])
  put(contextNotes, [])
  if (isStyle(entry.style)) set(style, entry.style)
  set(tab, 'enhance')
  // Written in another project, or (where the host cannot tell which project is open) in one that may
  // be another: it says where it is from, and is not marked fresh for this project.
  const here = read(projectName)
  const elsewhere = entry.project && entry.project !== here ? entry.project : null
  set(resultFor, elsewhere ? null : entry.original.trim())
  if (!elsewhere && !replaced) return
  set(notice, {
    tone: elsewhere ? 'warning' : 'neutral',
    text: elsewhere ? formatText('This prompt was written in {name}: read it before you send it here.', { name: elsewhere }) : 'Opened from the history. What the composer held was replaced.',
    ...(replaced ? { action: { label: 'Undo', run: { kind: 'composer.restore' as const } } } : {})
  })
}

/** History changes go through the worker, in order with the entries it is saving. */
export async function removeEntry(id: string): Promise<void> {
  try {
    await plugin.request('history.remove', { id })
    if (read(historyOpen) === id) set(historyOpen, null)
    // Delete sits next to Copy: one press too many is put right with Undo (the worker keeps the entry for a minute).
    set(notice, { tone: 'neutral', text: 'Removed from the history.', action: { label: 'Undo', run: { kind: 'history.restore', id } } })
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

export async function clearHistory(): Promise<void> {
  set(confirmClearHistory, false)
  try {
    await plugin.request('history.clear')
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

export async function setSetting(key: string, value: JsonValue): Promise<void> {
  try {
    await settings.set(key, value)
    await refreshDefaults()
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

// ---- model profiles

export function openForm(profile?: ProfileView): void {
  set(form, profile
    ? { id: profile.id, name: profile.name, preset: 'copilot', provider: 'copilot', model: profile.model, enabled: profile.enabled }
    : { name: 'GitHub Copilot', preset: 'copilot', provider: 'copilot', model: '', enabled: true })
  const current = read(form)
  if (current) void loadCatalog('form', formCatalogInput(current))
}

export const patchForm = (patch: Partial<Form>) => update(form, (current) => (current ? { ...current, ...patch } : current))

export async function saveForm(): Promise<void> {
  const current = read(form)
  if (!current) return
  set(busy, 'save')
  try {
    set(models, await plugin.request('models.save', current))
    set(form, null)
    set(notice, { tone: 'success', text: formatText('Saved {name}.', { name: current.name }) })
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  } finally {
    set(busy, null)
  }
}

export async function modelAction(action: { remove: string } | { move: string; to: number }): Promise<void> {
  try {
    const next =
      'remove' in action
        ? await plugin.request('models.delete', { id: action.remove })
        : await plugin.request('models.move', { id: action.move, to: action.to })
    set(models, next)
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

export async function toggleProfile(profile: ProfileView, enabled: boolean): Promise<void> {
  try {
    set(models, await plugin.request('models.save', { ...profile, enabled }))
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

export async function testProfile(id: string): Promise<void> {
  set(busy, 'test')
  try {
    const answer = await plugin.request('models.test', { id }, { timeoutMs: 40_000 })
    set(notice, { tone: answer.ok ? 'success' : 'danger', text: answer.ok ? `${say(answer.text ?? answer.message)} (${answer.ms} ms)` : say(answer.text ?? answer.message) })
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  } finally {
    set(busy, null)
  }
}

export async function setRoles(patch: { selectorProfileId?: string | null }): Promise<void> {
  const current = read(models)
  try {
    set(
      models,
      await plugin.request('models.roles', {
        selectorProfileId: patch.selectorProfileId !== undefined ? patch.selectorProfileId : (current?.selectorProfileId ?? null)
      })
    )
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

export async function switchModel(profile: ProfileView, model: string): Promise<void> {
  try {
    set(models, await plugin.request('models.save', { ...profile, model }))
    set(notice, { tone: 'success', text: formatText('{name} now uses {model}.', { name: profile.name, model }) })
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

// ---- the host integrations

export async function refreshConsents(): Promise<void> {
  const answer = await plugin.request('consents.get').catch(() => null)
  if (answer) set(consents, answer.granted)
}

/** A switch that needs confirmation: the person read what it allows and pressed Turn on. */
export async function confirmSwitch(key: string): Promise<void> {
  try {
    set(consents, (await plugin.request('consent.set', { key, granted: true })).granted)
    await setSetting(key, true)
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

/** Turning a switch off also withdraws its confirmation: on again asks again. */
export async function turnSwitchOff(key: string): Promise<void> {
  await setSetting(key, false)
  if (read(consents).includes(key)) {
    const answer = await plugin.request('consent.set', { key, granted: false }).catch(() => null)
    if (answer) set(consents, answer.granted)
  }
}

/** What the worker may really do: the switch, and its confirmation when it needs one. */
export function allowed(key: string): boolean {
  const on = read(privacy)[key] === true
  return NEEDS_CONSENT.has(key as never) ? on && read(consents).includes(key) : on
}

/** Opens a file of the project in the host's editor. */
export async function openFile(path: string): Promise<void> {
  try {
    await plugin.request('editor.open', { path, ...knownWorkspaceId() })
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

export async function refreshDataSummary(): Promise<void> {
  set(dataSummary, await plugin.request('data.summary').catch(() => null))
}

export async function clearData(what: 'history' | 'catalogs' | 'all'): Promise<void> {
  try {
    await plugin.request('data.clear', { what })
    if (what === 'history' || what === 'all') set(historyRaw, [])
    if (what === 'catalogs' || what === 'all') set(catalogs, {})
    if (what === 'all') {
      set(consents, [])
      if (read(run)?.status !== 'running') set(run, null)
      for (const [now, , empty] of KEPT) set(now, empty as never)
      set(rulesState, { rules: [], structures: [] })
      set(resultFor, null)
      // A confirmation like the others: gone with everything else, and asked for again.
      set(sendAfterEnhance, false)
      beforeReuse = null
      forgetSaved()
    }
    set(confirmWipe, false)
    const done: Record<typeof what, () => string> = {
      all: () => 'All plugin data deleted.',
      history: () => 'History cleared.',
      catalogs: () => 'Model lists cleared.'
    }
    set(notice, { tone: 'success', text: done[what]() })
    await refreshModels()
    await refreshDataSummary()
  } catch (error) {
    set(notice, { tone: 'danger', text: message(error) })
  }
}

// ---- rules and structures

export async function refreshRules(): Promise<void> {
  set(rulesState, await plugin.request('rules.get').catch(() => read(rulesState)))
}

/** Shown at once; the worker saves it and answers with what it kept. */
export function saveRules(change: (config: RulesConfig) => RulesConfig): void {
  const next = change(read(rulesState))
  set(rulesState, next)
  plugin.request('rules.save', { config: next }).catch((error: unknown) => set(notice, { tone: 'danger', text: message(error) }))
}

export function addRule(): void {
  const text = read(ruleDraft).trim().slice(0, MAX_RULE_CHARS)
  if (!text) return
  // For this project when the panel knows which project this is, else for every project (the
  // workspace's own name is shared by projects: a rule kept under it was followed in all of them).
  const project = read(projectName)
  const scope = read(ruleScope) === 'workspace' && project ? projectScope(project) : ''
  saveRules((config) => ({ ...config, rules: [...config.rules, { id: newId('rule'), text, enabled: true, scope }].slice(0, MAX_RULES) }))
  set(ruleDraft, '')
}

/** Saves the structure form: a new structure, or (with an id) an edit of one, built-in ones included. */
export function addStructure(id?: string): void {
  const { name, sections } = read(structureDraft)
  const list = sections
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_SECTIONS)
  if (!name.trim() || list.length === 0) return
  const structure = { id: id ?? newId('structure'), name: name.trim().slice(0, 40), sections: list }
  saveRules((config) => {
    const exists = config.structures.some((entry) => entry.id === structure.id)
    const structures = exists ? config.structures.map((entry) => (entry.id === structure.id ? structure : entry)) : [...config.structures, structure]
    return { ...config, structures: structures.slice(0, MAX_STRUCTURES) }
  })
  set(structureDraft, { name: '', sections: '' })
}

export function removeStructure(id: string): void {
  saveRules((config) => ({ ...config, structures: config.structures.filter((structure) => structure.id !== id) }))
  if (read(structureChoice) === id) set(structureChoice, '')
}

/** The plugin's issue page, in the browser (the host asks before opening a site the first time). */
export async function openIssues(): Promise<void> {
  const opened = await shell.openExternal(ISSUES_URL).catch(() => ({ opened: false }))
  if (!opened.opened) set(notice, { tone: 'neutral', text: formatText('Open {url} in your browser.', { url: ISSUES_URL }) })
}
