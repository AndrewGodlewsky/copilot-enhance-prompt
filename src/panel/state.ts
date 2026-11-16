// state.ts: what the panel knows (its atoms), with no UI in it. The web panel (web/src) draws it and
// the tests read it; actions.ts changes it, view.ts turns it into labels and options, setup.ts wires
// the host's events to it.
import { isEffort, type Effort } from '../effort.ts'
import { atom, derived, read, set, type Atom, type JsonValue } from '#panel'
import { HISTORY_KEY, parseHistory } from '../history.ts'
import { filterHistory, historyProjects, pageHistory, resolveHistoryProject, type HistoryOrder } from './history.ts'
import type { RulesConfig } from '../rules.ts'
import { isMessage, messageIn, plainText, render, type Message } from '../messages.ts'
import { type ContextItemView } from '../presets.ts'
import { type Step } from '../progress.ts'
import { type AttemptView, type ModelsView, type ProfileInput } from '../protocol.ts'

/** `title` and `state` are an agent's own (working, blocked, waiting, done): view.ts words the label from them. */
export type Target = { terminalId: string; label: string; agent: string | null; title?: string; state?: string }
/** What a notice's button does, as plain data: actions.ts runs it (`runNoticeAction`), the web UI only draws the button. */
export type NoticeAction = { kind: 'history.restore'; id: string } | { kind: 'composer.restore' } | { kind: 'send.anyway'; terminalId: string; text: string }
export type Notice = { tone: 'success' | 'danger' | 'warning' | 'neutral'; text: string; action?: { label: string; run: NoticeAction } } | null
export type Defaults = {
  style: string
  level: string
  pressEnter: boolean
  fallbackEnabled: boolean
  fallbackOn: string
  /** Read other agents' sessions: how many agents, how many lines each. */
  otherAgents: { agents: number; lines: number }
}
export type Form = ProfileInput

// Keyed atoms survive hot reloads; `persist: 'plugin'` ones survive panel runs.
export const tab = atom('tab', 'enhance', { persist: 'plugin' })
export const draft = atom('')
export const result = atom('')
export const style = atom<string | null>('style', null, { persist: 'plugin' })
export const level = atom<string | null>('level', null, { persist: 'plugin' })
export const effort = atom<string>('effort', 'medium', { persist: 'plugin' })
export const effectiveEffort = derived(() => isEffort(read(effort)) ? read(effort) as Effort : 'medium')
export const effortModels = atom<Record<Effort, string>>({ low: 'recommended', medium: 'recommended', high: 'recommended' })
export const effortReasoning = atom<Record<Effort, string>>({ low: 'default', medium: 'default', high: 'default' })
export const copilotRunFailure = atom<{ configuration: string; text: Message } | null>(null)
export const copilotCheck = atom<{ attempt: number; startedAt: number; completedAt?: number; outcome: 'checking' | 'ok' | 'failed' } | null>(null)
export const excluded = atom<string[]>('excluded', [])
export const target = atom<string | null>('target', null)
export const pressEnter = atom<boolean | null>('pressEnter', null)
export const historyRaw = atom<JsonValue>(HISTORY_KEY, [], { persist: 'storage' })
/**
 * Rules tab: rules and structures as the worker last saved them, and its two forms. Saved through the
 * worker (not a storage atom): quick edits in a row could otherwise be undone by a late echo.
 */
export const rulesState = atom<RulesConfig>({ rules: [], structures: [] })
export const ruleDraft = atom('')
export const ruleScope = atom('all')
export const structureDraft = atom({ name: '', sections: '' })
/** The structure picked in the composer's options; '' = the style's own shape. */
export const structureChoice = atom('structureChoice', '', { persist: 'plugin' })
/**
 * Which workspace a terminal belongs to, by the host's id: learnt from the host's agent events and from the
 * person's pick, since several workspaces can share a name and branch (all "main", say).
 */
export const terminalWorkspaces = atom<Record<string, string>>('terminalWorkspaces', {}, { persist: 'plugin' })
/** The folders the focused workspace could be, when the host cannot tell (the person picks one). */
export const workspaceChoices = atom<{ id: string; path: string; project?: string }[]>([])
/** The focused workspace's name as the host gives it; several projects can share it ("main"). */
export const workspaceName = atom<string | null>(null)
/**
 * The focused project's own name (its repository's name in the host): what its rules are kept under,
 * and what the panel calls it. Null while it is not known which of several same-named projects this is.
 */
export const projectName = atom<string | null>(null)
export const historyFilter = atom('historyFilter', '')
export const historyPageNumber = atom(1)
export const historyOrder = atom<HistoryOrder>('newest')
export const confirmClearHistory = atom(false)
export const form = atom<Form | null>('form', null)
export type Catalog = import('../catalog.ts').Catalog
/** Model lists by profile id, or 'form' for the add/edit form. */
export const catalogs = atom<Record<string, Catalog>>({})
export const catalogLoading = atom<Record<string, boolean>>({})
/** The current enhance run: its real steps from the worker, and how it ended. */
export type Run = {
  runId: string
  startedAt: number
  /** In-memory input identity for this canvas's artwork; never persisted. */
  prompt?: string
  /** The project the run was started in (its key and name): its answer belongs there. */
  workspace?: { key: string | null; name: string | null }
  steps: Step[]
  status: 'running' | 'done' | 'error' | 'cancelled'
  error?: string
  finishedAt?: number
  /** The run's share when it ended (failed or cancelled): the bar stops there instead of jumping. */
  endPercent?: number
}
/** The clock the run card reads, moved every half second while a run goes (model estimates grow). */
export const tick = atom(Date.now())
export const run = atom<Run | null>(null)

/** What the Settings tab shows: stored data counts and the switches. */
export const dataSummary = atom<{ history: number; profiles: number; catalogs: number } | null>(null)
export const privacy = atom<Record<string, boolean>>({})
/** "Delete everything" asks for a second press. */
export const confirmWipe = atom(false)
/** The Privacy switches the person confirmed in the panel (the worker keeps them); see NEEDS_CONSENT. */
export const consents = atom<string[]>([])
/** The composer's structure and context preview are shown. */
export const optionsOpen = atom('optionsOpen', false, { persist: 'plugin' })

export const busy = atom<'enhance' | 'preview' | 'send' | 'test' | 'save' | null>(null)
export const notice = atom<Notice>(null)
export type LastRun = { model: string; profileName: string; ms: number; attempts: AttemptView[] } | null
export const lastRun = atom<LastRun>(null)
/** Every context item seen for the current draft, so excluded ones stay listed (unchecked). */
export const contextShown = atom<ContextItemView[]>([])
/** Notes are Messages; an older version saved plain strings. */
export const contextNotes = atom<(Message | string)[]>([])
export const contextFor = atom<string | null>(null)
export const contextLoading = atom(false)
export const contextError = atom<string | null>(null)
export const contextPreferences = atom('')
/**
 * Files attached in the panel (pasted, dropped or picked): the worker keeps a copy on disk and
 * answers with its path. Images among them are shown to models that read images.
 */
export type AttachedFile = { path: string; name: string; bytes: number; type: string }
export const files = atom<AttachedFile[]>([])

/**
 * Which project (workspace) the composer below belongs to: its key (the host's workspace id, or its name
 * and branch when the host cannot tell the id) and name. The draft, the result and what the last run used
 * belong to that project; switching projects parks them under its key and brings back the new one's.
 */
export const workspaceKey = atom<string | null>(null)
/** What a project left in the composer, kept while you work in another one. */
export type Slot = {
  name: string | null
  draft: string
  result: string
  lastRun: LastRun
  contextShown: ContextItemView[]
  contextNotes: (Message | string)[]
  excluded: string[]
  files?: AttachedFile[]
  at: number
}
/** Parked composers by project key; the oldest go past MAX_PARKED. */
export const parked = atom<Record<string, Slot>>({})
export const MAX_PARKED = 20

/**
 * The draft, the last result and what the last run used are kept across panel runs (the host writes
 * `persist: 'plugin'` atoms to panel-state.json in the plugin's data folder) only while "Save history"
 * is on. The panel works on the in-memory atoms above; `put` mirrors them into these saved copies,
 * or empties the copies when saving is off. Same keys as before, so earlier saved values still load.
 */
export const KEPT: [Atom<never>, Atom<never>, unknown][] = [
  [draft, atom('draft', '', { persist: 'plugin' }), ''],
  [result, atom('result', '', { persist: 'plugin' }), ''],
  [lastRun, atom<LastRun>('lastRun', null, { persist: 'plugin' }), null],
  [contextShown, atom<ContextItemView[]>('contextShown', [], { persist: 'plugin' }), []],
  [contextNotes, atom<(Message | string)[]>('contextNotes', [], { persist: 'plugin' }), []],
  [files, atom<AttachedFile[]>('files', [], { persist: 'plugin' }), []],
  [workspaceKey, atom<string | null>('workspaceKey', null, { persist: 'plugin' }), null],
  [parked, atom<Record<string, Slot>>('parked', {}, { persist: 'plugin' }), {}]
] as never

export const mayKeep = () => read(privacy).saveHistory !== false

/** Sets an atom of KEPT, and its saved copy when saving is allowed. */
export function put<T>(target: Atom<T>, value: T): void {
  set(target, value)
  const pair = KEPT.find(([now]) => (now as unknown) === target)
  if (pair) set(pair[1], (mayKeep() ? value : pair[2]) as never)
}

/** Empties every saved copy (saving turned off, or Delete everything). */
export function forgetSaved(): void {
  for (const [, saved, empty] of KEPT) set(saved, empty as never)
}

/** On open: the saved copies become the working values. */
export function restoreSaved(): void {
  for (const [now, saved] of KEPT) set(now, read(saved))
}
export const targets = atom<Target[]>([])
/** The draft the shown result was made from, for freshness and banner state. */
export const resultFor = atom<string | null>(null)
/** The explicit Enhance and send button is off until confirmed in Settings. */
export const sendAfterEnhance = atom('sendAfterEnhance', false, { persist: 'plugin' })
export const models = atom<ModelsView | null>(null)
export const defaults = atom<Defaults>({
  style: 'balanced',
  level: 'standard',
  pressEnter: false,
  fallbackEnabled: true,
  fallbackOn: 'any',
  otherAgents: { agents: 4, lines: 80 }
})

export const history = derived(() => parseHistory(read(historyRaw)))
/** Existing all/project values remain valid; new selections use path:<saved project> or unassigned. */
export const historyScope = atom<string>('historyScope', 'all', { persist: 'plugin' })
/** The entry selected for reading, without changing the composer. */
export const historyOpen = atom<string | null>(null)
export const historyProject = derived(() => resolveHistoryProject(read(historyScope), read(history), read(projectName)))
export const historyProjectChoices = derived(() => historyProjects(read(history), read(projectName), read(historyFilter)))
export const filteredHistory = derived(() => filterHistory(read(history), read(historyFilter), read(historyProject), read(historyOrder)))
export const historyWindow = derived(() => pageHistory(read(filteredHistory), read(historyPageNumber), read(historyOpen)))
export const effectiveStyle = derived(() => read(style) ?? read(defaults).style)
export const effectiveLevel = derived(() => read(level) ?? read(defaults).level)
export const effectiveEnter = derived(() => read(pressEnter) ?? read(defaults).pressEnter)
export const enabledProfiles = derived(() => (read(models)?.profiles ?? []).filter((profile) => profile.enabled))

/** A worker Message in English; a plain string (saved by an older version) as is. */
export function say(text: Message | string): string {
  return typeof text === 'string' ? text : render(text)
}

/**
 * An error in English. The worker's message comes inside the error's text (the host passes
 * on a thrown error's code and text only; see messages.ts); without one, the text is shown as it is.
 */
export const message = (error: unknown) => {
  const carried = errorMessage(error)
  if (carried) return say(carried)
  return error instanceof Error ? plainText(error.message) : String(error)
}

/** The worker's message an error carries (as a field under the test host, inside its text in the host), or null. */
export function errorMessage(error: unknown): Message | null {
  const text = error && typeof error === 'object' && 'text' in error ? (error as { text: unknown }).text : null
  if (isMessage(text)) return text
  return error instanceof Error ? messageIn(error.message) : null
}
