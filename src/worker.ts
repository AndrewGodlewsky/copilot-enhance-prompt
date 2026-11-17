// The plugin's worker: gathers project context at the chosen level, runs the model chain with
// fallback, sends prompts to the attached session, keeps history, and manages Copilot model profiles.
import type { PluginRequests } from '#panel'
import type { JsonValue, EnhanceWorker } from '#host'
import { copyToClipboard } from './clipboard.ts'
import { forgetActivity, recordSave, recordStatus, recordTool } from './context/activity.ts'
import { researchContext, RESEARCH_LIMITS } from './context/research.ts'
import { isSensitive } from './context/files.ts'
import { EFFORT_SETTINGS, REASONING_SETTINGS, isEffort, resolveEffort, parseCatalogAssignment } from './effort.ts'
import { atLeast, contextItem, findFocusedWorkspace, focusedCandidates, focusedProject, gatherContext, projectNameOf, type ContextItem } from './context/index.ts'
import { forgetTerminals, learnTerminal, loadTerminals } from './context/terminals.ts'
import { imagesBlock, withImagePaths } from './images.ts'
import { cleanAttachments, clearAttachments, loadFiles, putChunk, restoreAttachments } from './attachments.ts'
import { attachmentItemId } from './image-limits.ts'
import { parseRulesConfig, RULES_KEY, rulesFor, rulesToJson, structureById, type RulesConfig, type RuleWhere } from './rules.ts'
import { capHistory, HISTORY_KEY, parseHistory, toJson, trimForHistory, type HistoryEntry } from './history.ts'
import {
  candidates,
  ChainError,
  loadModels,
  runChain,
  saveModels,
  viewProfiles,
  type ChainOptions
} from './models.ts'
import { isContextLevel, newProfileId, normalizeProfile, type ContextLevel, type ModelProfile, type ModelsConfig } from './presets.ts'
import { buildUserMessage, cleanOutput, isStyle, PASTE_END, PASTE_START, terminalChunks, terminalSafe, type Style } from './prompts.ts'
import { buildRewriteSystemPrompt } from './prompt-sets.ts'
import { PANEL_REQUEST_LIMIT_MS, type ModelsView } from './protocol.ts'
import { CONSENTS_KEY, NEEDS_CONSENT, parseConsents, parseOtherAgentsLimits, parsePrivacy, type OtherAgentsLimits, type Privacy, type PrivacyKey } from './privacy.ts'
import { createProgress, planSteps, type StepReporter } from './progress.ts'
import { MODELS_KEY } from './presets.ts'
import { LlmError, messageOf } from './llm.ts'
import { english, msg, raw, withMessage, type Message } from './messages.ts'

/**
 * How long a panel run may take. the host ends a panel's request after 120 s, so:
 * - `budgetMs`: a run that must answer within one request (a caller that does not say it keeps
 *   waiting): the whole run, AI file picker and every model of the chain, a few seconds under the
 *   panel's limit;
 * - `sliceMs`: how long one request waits for a run the panel keeps waiting for, before it answers
 *   "still going" and the panel asks again. Well under the 120 s: starting a large CLI program can
 *   hold the worker for seconds (13.5 s was seen for a 5 s wait on Windows), and an answer that
 *   comes after the host ended the request is lost;
 * - `totalMs`: how long such a run may take in all;
 * - `orphanMs`: how long it goes on with nobody waiting (the moment between two requests), before
 *   it is stopped: a run lives only while a panel waits for it.
 * Mutable for tests only.
 */
export const RUN_LIMITS = { budgetMs: PANEL_REQUEST_LIMIT_MS - 5_000, pickerMs: 25_000, sliceMs: 90_000, totalMs: 300_000, orphanMs: 10_000 }

export type Settings = {
  defaultStyle: Style
  useEnhancedPrompts: boolean
  customInstructions: string
  contextLevel: ContextLevel
  terminalLines: number
  extraContextFiles: string[]
  excludePatterns: string
  adaptToAgent: boolean
  fallbackEnabled: boolean
  fallbackOn: 'any' | 'transient'
  timeoutSeconds: number
  sendMode: string
  sendPressEnter: boolean
  historyLimit: number
  /** Read other agents' sessions: how many agents and lines (within OTHER_AGENTS_LIMITS). */
  otherAgentsLimits: OtherAgentsLimits
  /** The switches as the worker may use them (confirmed where they need it). */
  privacy: Privacy
}

const str = (value: JsonValue | undefined, fallback = '') => (typeof value === 'string' ? value : fallback)
const num = (value: JsonValue | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const bool = (value: JsonValue | undefined, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
const attachmentRestores = new WeakMap<EnhanceWorker, Promise<void>>()
function restoreSavedAttachments(host: EnhanceWorker): Promise<void> {
  let pending = attachmentRestores.get(host)
  if (!pending) {
    pending = (async () => {
      const saved = await host.storage.get('panel:files')
      const parked = await host.storage.get('panel:parked')
      const lists: JsonValue[] = [saved]
      if (parked && typeof parked === 'object' && !Array.isArray(parked)) {
        for (const slot of Object.values(parked)) if (slot && typeof slot === 'object' && !Array.isArray(slot)) lists.push(slot.files)
      }
      const paths = lists.flatMap(list => Array.isArray(list) ? list.flatMap(file => file && typeof file === 'object' && !Array.isArray(file) && typeof file.path === 'string' ? [file.path] : []) : [])
      await restoreAttachments(paths, host.attachmentOwner)
    })()
    attachmentRestores.set(host, pending)
  }
  return pending
}
const extraFiles = (value: JsonValue | undefined) => str(value).split('\n')
  .map(line => line.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
  .filter(line => line && !line.startsWith('/') && !line.includes('..')).slice(0, 10)

export async function readSettings(host: EnhanceWorker): Promise<Settings> {
  const [all, consents] = await Promise.all([host.settings.get(), host.storage.get(CONSENTS_KEY).catch(() => null)])
  const style = str(all.defaultStyle, 'balanced')
  const level = str(all.contextLevel, 'standard')
  return {
    defaultStyle: isStyle(style) ? style : 'balanced',
    useEnhancedPrompts: bool(all.useEnhancedPrompts, true),
    customInstructions: str(all.customInstructions),
    contextLevel: isContextLevel(level) ? level : 'standard',
    terminalLines: num(all.terminalLines, 100),
    extraContextFiles: extraFiles(all.extraContextFiles),
    excludePatterns: str(all.excludePatterns),
    adaptToAgent: bool(all.adaptToAgent, true),
    fallbackEnabled: bool(all.fallbackEnabled, true),
    fallbackOn: str(all.fallbackOn) === 'transient' ? 'transient' : 'any',
    timeoutSeconds: num(all.timeoutSeconds, 60),
    sendMode: str(all.sendMode, 'paste'),
    sendPressEnter: bool(all.sendPressEnter, false),
    historyLimit: num(all.historyLimit, 50),
    otherAgentsLimits: parseOtherAgentsLimits(all),
    privacy: parsePrivacy(all, parseConsents(consents))
  }
}

/**
 * An error for the panel: a code, and the message as a code and parameters, which the panel shows
 * in English. the host passes on an error's code and text only, so the message travels inside
 * the text, after the English sentence (messages.ts); `text` is there for callers in this process.
 */
function hostError(text: Message, code: string): Error {
  return Object.assign(new Error(withMessage(text)), { code, text })
}

function chainOptions(settings: Settings, signal?: AbortSignal, extra: Partial<ChainOptions> = {}): ChainOptions {
  return {
    signal,
    timeoutMs: settings.timeoutSeconds * 1000,
    fallback: settings.fallbackEnabled,
    fallbackOn: settings.fallbackOn,
    ...extra
  }
}

/**
 * History is read, changed and written back, so two writers at once (two panel runs, or
 * Clear history) would lose one change. Every history change runs after the previous one.
 */
let historyQueue: Promise<unknown> = Promise.resolve()
export function withHistory<T>(change: () => Promise<T>): Promise<T> {
  const next = historyQueue.then(change, change)
  historyQueue = next.catch(() => undefined)
  return next
}

function historyChange<T>(host: EnhanceWorker, change: () => Promise<T>): Promise<T> {
  return withHistory(() => host.storage.transaction ? host.storage.transaction(change) : change())
}

/** The name of the agent in this terminal when the host says it is blocked (waiting for the person), else null. */
async function blockedAgent(host: EnhanceWorker, terminalId: string): Promise<string | null> {
  const list = await host.host.call('agents.list', {}).catch(() => null)
  const agent = (list?.agents ?? []).find((entry) => entry.terminalId === terminalId)
  return agent?.state === 'blocked' ? (agent.title ?? agent.agent ?? 'agent') : null
}

/** Entries removed a moment ago, for Undo: in memory only, a few of them, for a short while. */
const UNDO_MS = 60_000
const UNDO_KEPT = 10
const removedEntries = new Map<string, { entry: HistoryEntry; until: number }>()

async function addHistory(host: EnhanceWorker, settings: Settings, entry: Omit<HistoryEntry, 'id' | 'at'>): Promise<void> {
  if (settings.historyLimit <= 0 || !settings.privacy.saveHistory) return
  await historyChange(host, async () => {
    const list = parseHistory(await host.storage.get(HISTORY_KEY))
    // The run's starting preference cannot authorize retention after a later opt-out.
    // Recheck after waiting for the transaction and its read, immediately before writing.
    const historyLimit = num(await host.settings.get('historyLimit'), 50)
    if (historyLimit <= 0 || await host.settings.get('saveHistory') === false) return
    const at = Date.now()
    const added: HistoryEntry = {
      id: `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at,
      ...entry,
      original: trimForHistory(entry.original),
      enhanced: trimForHistory(entry.enhanced)
    }
    const next = capHistory([added, ...list], historyLimit)
    await host.storage.set(HISTORY_KEY, next.map(toJson))
  })
}

/** Asks a model to choose relevant files from a list; answers a JSON array of paths. */
async function pickFilesWithModel(
  host: EnhanceWorker,
  config: ModelsConfig,
  settings: Settings,
  tree: string[],
  prompt: string,
  signal?: AbortSignal,
  totalMs: number = RUN_LIMITS.pickerMs,
  reasoningEffort?: string,
  ensureAccess?: () => Promise<void>
): Promise<string[]> {
  const system =
    'You pick source files relevant to a coding task. Answer ONLY a JSON array of up to 8 file paths copied exactly from the list, most relevant first. No prose.'
  const user = `<task>\n${prompt}\n</task>\n<files>\n${tree.join('\n')}\n</files>`
  const list = candidates(config.profiles, config.selectorProfileId, settings.fallbackEnabled)
  const { text } = await runChain(host, list, system, user, chainOptions(settings, signal, { timeoutMs: RUN_LIMITS.pickerMs, totalMs, reasoningEffort, ensureAccess }))
  const match = /\[[\s\S]*\]/.exec(text)
  if (!match) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return []
  }
  return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string').slice(0, 8) : []
}

/**
 * The Rules tab: the saved rules and structures, and the rules that are followed in the focused
 * project. `hint` is what the panel knows this workspace as (several can share a name).
 */
async function ownRules(host: EnhanceWorker, hint?: string | null): Promise<{ config: RulesConfig; rules: string[]; where: RuleWhere }> {
  const config = parseRulesConfig(await host.storage.get(RULES_KEY).catch(() => null))
  // Which project this is: for a rule kept for one project, and for the run's entry in the history.
  const where = await focusedProject(host, hint)
  return { config, rules: rulesFor(config, where), where }
}

/** Makes sure the prompt names every attached file the rewriter left out. */
function withAttachedPaths(prompt: string, paths: readonly string[]): string {
  const missing = paths.filter((path) => !prompt.includes(path))
  return missing.length === 0 ? prompt : `${prompt.trimEnd()}\n\nAttached files (open them):\n${missing.map((path) => `- ${path}`).join('\n')}`
}

/**
 * The Privacy switches a context gather obeys, the same for a run and for Preview: git, the target
 * terminal, and the other agents' sessions (which are terminal output too, so they need both).
 */
export function gatherPrivacy(settings: Settings): {
  allowGit: boolean
  allowTerminal: boolean
  allowOtherAgents: boolean
  otherAgentsLimits?: OtherAgentsLimits
  allowAgentActivity: boolean
  allowEditorSaves: boolean
} {
  const otherAgents = settings.privacy.allowTerminalRead && settings.privacy.allowOtherAgents
  return {
    allowGit: settings.privacy.allowGit,
    allowTerminal: settings.privacy.allowTerminalRead,
    allowOtherAgents: otherAgents,
    // The amounts matter only while the switch is on (and confirmed).
    ...(otherAgents ? { otherAgentsLimits: settings.otherAgentsLimits } : {}),
    allowAgentActivity: settings.privacy.allowAgentActivity,
    allowEditorSaves: settings.privacy.allowEditorSaves
  }
}

/** Privacy: without project files, nothing beyond workspace and agent names. */
export function allowedLevel(requested: ContextLevel, settings: Settings): ContextLevel {
  return !settings.privacy.allowProjectFiles && atLeast(requested, 'standard') ? 'basic' : requested
}

const PROJECT_FILES_OFF = msg('note.project_files_off')

function contextAccess(host: EnhanceWorker, settings: Settings, signal?: AbortSignal): () => Promise<void> {
  return async () => {
    signal?.throwIfAborted()
    const current = await host.settings.get()
    const consents = settings.privacy.allowOtherAgents || settings.privacy.allowAgentActivity
      ? parseConsents(await host.storage.get(CONSENTS_KEY)) : undefined
    const privacy = parsePrivacy(current, consents)
    const keys = ['allowProjectFiles', 'allowGit', 'allowTerminalRead', 'allowOtherAgents', 'allowAgentActivity', 'allowEditorSaves'] as const
    if (keys.some(key => settings.privacy[key] && !privacy[key]) || str(current.excludePatterns) !== settings.excludePatterns ||
        extraFiles(current.extraContextFiles).join('\n') !== settings.extraContextFiles.join('\n')) {
      throw new LlmError(msg('error.research_privacy_changed'), 'cancelled')
    }
    signal?.throwIfAborted()
  }
}

export async function enhance(
  host: EnhanceWorker,
  input: {
    prompt: string
    style?: string
    terminalId?: string | null
    level?: string
    profileId?: string | null
    model?: string
    effort?: string
    exclude?: string[]
    structureId?: string
    /** Attached files of any kind (the panel's paste, drop and picker), by the path attachments.put answered. */
    files?: string[]
    /** the host's id of the workspace the panel is in (several can share a name and branch). */
    workspaceId?: string
  },
  signal?: AbortSignal,
  progress?: (level: ContextLevel, allowProjectFiles: boolean, readsOtherAgents: boolean) => StepReporter,
  budgetMs?: number
) {
  const deadline = budgetMs === undefined ? undefined : Date.now() + budgetMs
  /** What is left of the run's budget; undefined without one. */
  const left = () => (deadline === undefined ? undefined : Math.max(0, deadline - Date.now()))
  const prompt = input.prompt.trim()
  if (!prompt) throw hostError(msg('error.no_prompt'), 'invalid_params')
  const settings = await readSettings(host)
  const ensureAccess = contextAccess(host, settings, signal)
  const config = await loadModels(host)
  let list: ModelProfile[]
  let reasoningEffort: string | undefined
  if (input.effort !== undefined) {
    if (!isEffort(input.effort)) throw hostError(msg('error.effort'), 'invalid_params')
    const assignment = String(await host.settings.get(EFFORT_SETTINGS[input.effort]) ?? 'recommended')
    const reasoning = String(await host.settings.get(REASONING_SETTINGS[input.effort]) ?? 'default')
    const needsCatalog = assignment === 'recommended' || parseCatalogAssignment(assignment) !== null || reasoning !== 'default'
    if (needsCatalog && !settings.privacy.allowOnlineModelLists) throw hostError(msg('error.lists_off'), 'unavailable')
    const catalog = needsCatalog ? await host.host.call('copilot.catalog', {}) : undefined
    const resolved = resolveEffort(input.effort, assignment, reasoning, config.profiles, catalog)
    reasoningEffort = resolved.reasoningEffort
    list = [resolved.profile, ...candidates(config.profiles, null, true).filter(profile => profile.id !== resolved.profile.id && profile.model !== resolved.profile.model)]
    if (!settings.fallbackEnabled) list = list.slice(0, 1)
  } else {
    const profileId = input.profileId ?? null
    const chosenModel = input.model?.trim().slice(0, 200)
    list = candidates(config.profiles, profileId, settings.fallbackEnabled).map(profile =>
      chosenModel && profile.id === profileId ? { ...profile, model: chosenModel } : profile)
  }
  if (list.length === 0) throw hostError(msg('error.no_model'), 'invalid_params')
  // A separately configured selector keeps its own model defaults; otherwise it shares the effort pair.
  const pickerConfig = config.selectorProfileId ? config : { profiles: list, selectorProfileId: list[0].id }
  const pickerReasoning = config.selectorProfileId ? undefined : reasoningEffort
  const style: Style = isStyle(input.style) ? input.style : settings.defaultStyle
  const requested: ContextLevel = isContextLevel(input.level) ? input.level : settings.contextLevel
  const level = allowedLevel(requested, settings)
  if (level === 'max' && config.selectorProfileId && !config.profiles.some(profile => profile.id === config.selectorProfileId && profile.enabled)) {
    throw hostError(msg('error.selector_model'), 'invalid_params')
  }
  const privacy = gatherPrivacy(settings)
  const step = progress?.(level, settings.privacy.allowProjectFiles, privacy.allowOtherAgents) ?? (() => undefined)
  // Which project this run is for, settled before anything slow: the person may look at another
  // project while the context is gathered, and the rules and the history entry are this one's.
  const own = await ownRules(host, typeof input.workspaceId === 'string' ? input.workspaceId : null)

  const gathered = await gatherContext(host, {
    level,
    prompt,
    terminalId: input.terminalId ?? null,
    terminalLines: settings.terminalLines,
    exclude: new Set(input.exclude ?? []),
    extraFiles: settings.extraContextFiles,
    excludePatterns: settings.excludePatterns,
    // The picker gets its own share, so the rewrite itself always has time left.
    pickFiles: (tree, task) => pickFilesWithModel(host, pickerConfig, settings, tree, task, signal, Math.min(RUN_LIMITS.pickerMs, (left() ?? Infinity) / 2), pickerReasoning, ensureAccess),
    ensureAccess,
    ...privacy,
    onStep: step,
    signal,
    workspaceId: typeof input.workspaceId === 'string' ? input.workspaceId : null
  })
  if (level !== requested) gathered.notes.push(PROJECT_FILES_OFF)
  if (level === 'ai-test') {
    const researched = await researchContext({
      root: gathered.root, files: gathered.files ?? [], items: gathered.items, prompt, signal,
      exclude: new Set(input.exclude ?? []), excludePatterns: settings.excludePatterns,
      budgetMs: Math.min(RESEARCH_LIMITS.ms, (left() ?? RUN_LIMITS.totalMs) / 2),
      ensureAccess, onStep: step, diagnostics: host.diagnostics,
      ask: async (system, user, researchSignal, remainingMs) => (await runChain(host, list.slice(0, 1), system, user,
        chainOptions(settings, researchSignal, { fallback: false, totalMs: remainingMs, timeoutMs: remainingMs, reasoningEffort, ensureAccess }))).text
    })
    gathered.items = researched.items
    gathered.notes.push(researched.note)
  }
  const agentItem = gathered.items.find((entry) => entry.kind === 'agent')
  const system = buildRewriteSystemPrompt({
    style,
    customInstructions: settings.customInstructions,
    agent: settings.adaptToAgent ? (agentItem?.content.split(' ')[0] ?? null) : null,
    rules: own.rules,
    structure: structureById(own.config, input.structureId)
  }, settings.useEnhancedPrompts)
  // Attached files, read before any model is called: images are shown to models that read images,
  // text goes in the context, and the user message lists every file by its path.
  await restoreSavedAttachments(host)
  const files = await loadFiles((input.files ?? []).filter((path) => typeof path === 'string' && path.trim()), host.attachmentOwner).catch((error: unknown) => {
    if (error instanceof LlmError) throw hostError(error.text, error.code)
    throw error
  })
  const images = files.images
  // An attached text is a context item like the others: unticked in the panel, its text is left out
  // (the file stays listed by its path); a long one is an excerpt, marked as trimmed.
  const excluded = new Set(input.exclude ?? [])
  const attachedTexts = files.texts
    .map((file) => contextItem(attachmentItemId(file.path), 'file', raw(file.name), file.content, file.cut > 0 ? msg('why.trimmed') : undefined))
    .filter((entry) => !excluded.has(entry.id))
  if (attachedTexts.length > 0) gathered.items = [...attachedTexts, ...gathered.items]
  const otherFiles = files.paths.filter((path) => !images.some((image) => image.path === path))
  const user = [buildUserMessage(prompt, gathered.items), imagesBlock(images), otherFiles.length > 0 ? `<attached_files>\n${otherFiles.map((path, index) => `${index + 1}. ${path}`).join('\n')}\n</attached_files>` : '']
    .filter(Boolean)
    .join('\n\n')
  /** The model being tried, as the progress card names it. */
  let tried = ''
  try {
    await ensureAccess()
    const result = await runChain(
      host,
      list,
      system,
      user,
      chainOptions(settings, signal, {
        ...(deadline === undefined ? {} : { totalMs: left() }),
        images,
        reasoningEffort,
        ensureAccess,
        onAttempt: (profile, model, attempt, total) => {
          tried = `${profile.name} · ${model || 'default'}${attempt > 1 ? ` · ${attempt}/${total}` : ''}`
          step('model', 'running', tried)
        }
      })
    )
    step('model', 'done', `${result.profile.name} · ${result.attempts.find((attempt) => attempt.ok)?.model ?? ''}`)
    return {
      enhanced: withAttachedPaths(withImagePaths(cleanOutput(result.text), images), otherFiles),
      profile: result.profile,
      attempts: result.attempts,
      items: gathered.items,
      notes: gathered.notes,
      settings,
      style,
      project: own.where.project
    }
  } catch (error) {
    // The step names the model that was tried. Why it failed is the run's error, which the panel
    // shows in English (a step's detail is plain text).
    step('model', 'failed', tried || undefined)
    if (error instanceof ChainError) {
      // Every model that was tried ran out of time: say what makes a run faster.
      const slow = error.attempts.length > 0 && error.attempts.every((attempt) => attempt.errorText?.code === 'error.model_timeout')
      throw hostError(slow ? msg('error.too_slow', { reason: error.text }) : error.text, error.code)
    }
    throw error
  }
}

const view = (items: ContextItem[]) => items.map(({ content: _content, ...rest }) => rest)

async function modelsView(host: EnhanceWorker): Promise<ModelsView> {
  const config = await loadModels(host)
  return { profiles: viewProfiles(config.profiles), selectorProfileId: config.selectorProfileId }
}

/**
 * Writes the pieces in order. If a piece is refused or fails after a bracketed paste has started,
 * the paste is closed, so the agent's input is not left waiting for the end of a paste.
 */
export async function sendPieces(host: EnhanceWorker, terminalId: string, pieces: string[]): Promise<{ accepted: boolean }> {
  const pasting = pieces.length > 1 && pieces[0].startsWith(PASTE_START) && pieces[pieces.length - 1].endsWith(PASTE_END)
  let sent = 0
  try {
    for (const piece of pieces) {
      const result = await host.host.call('terminal.sendText', { terminalId, text: piece })
      if (!result.accepted) break
      sent++
    }
  } finally {
    if (pasting && sent > 0 && sent < pieces.length) {
      await host.host.call('terminal.sendText', { terminalId, text: PASTE_END }).catch(() => undefined)
    }
  }
  return { accepted: sent === pieces.length }
}

/** Recent progress is scoped to the requesting panel, just like live events and resumable runs. */
type ProgressSnapshot = Parameters<Parameters<typeof createProgress>[2]>[0]
const latestProgress = new Map<string, ProgressSnapshot>()
const MAX_TRACKED_RUNS = 20

export function progressOf(runId: string, panelId: string): ProgressSnapshot | null {
  return latestProgress.get(JSON.stringify([panelId, runId])) ?? null
}

type EnhanceInput = Parameters<typeof enhance>[1] & { runId?: string; resumable?: boolean; resume?: boolean }
type Outcome = { ok: true; result: Awaited<ReturnType<typeof enhance>> } | { ok: false; error: unknown }
/** What a request for a run answers: the enhanced prompt, or `pending` with every other field empty. */
type EnhanceAnswer = PluginRequests['prompt.enhance']['output']
/** A run that is going, or done and not fetched yet. `outcome` never rejects. */
type LiveRun = {
  id: string
  key: string
  panelId: string
  input: EnhanceInput
  started: number
  stop: AbortController
  outcome: Promise<Outcome>
  /** Requests waiting for it now. */
  waiting: number
  /** Stops the run when nobody has asked about it for RUN_LIMITS.orphanMs. */
  orphan: ReturnType<typeof setTimeout> | null
}
const liveRuns = new Map<string, LiveRun>()
export function hasActiveRuns(): boolean { return liveRuns.size > 0 }
let unnamedRuns = 0

function startRun(host: EnhanceWorker, input: EnhanceInput, panelId: string, budgetMs: number): LiveRun {
  const runId = typeof input.runId === 'string' ? input.runId.slice(0, 64) : ''
  // Progress goes only to the panel that asked, and only when it asked for it.
  const progress = runId
    ? (level: ContextLevel, allowProjectFiles: boolean, readsOtherAgents: boolean) =>
        createProgress(runId, planSteps(level, allowProjectFiles, readsOtherAgents), (snapshot) => {
          const key = JSON.stringify([panelId, runId])
          latestProgress.delete(key)
          latestProgress.set(key, snapshot)
          for (const old of [...latestProgress.keys()].slice(0, Math.max(0, latestProgress.size - MAX_TRACKED_RUNS))) latestProgress.delete(old)
          host.panels.post('enhance.progress', snapshot, { panel: panelId })
        })
    : undefined
  const stop = new AbortController()
  const run: LiveRun = {
    id: runId || `unnamed-${++unnamedRuns}`,
    key: JSON.stringify([panelId, runId || `unnamed-${unnamedRuns}`]),
    panelId,
    input,
    started: Date.now(),
    stop,
    waiting: 0,
    orphan: null,
    outcome: enhance(host, input, stop.signal, progress, budgetMs).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error })
    )
  }
  // An id belongs to one run (the panel makes a new one for each): one still going under it stops.
  liveRuns.get(run.key)?.stop.abort()
  liveRuns.set(run.key, run)
  return run
}

function endRun(run: LiveRun): void {
  if (run.orphan) clearTimeout(run.orphan)
  run.orphan = null
  if (liveRuns.get(run.key) === run) liveRuns.delete(run.key)
}

export function cancelPanelRuns(panelId?: string): void {
  for (const run of liveRuns.values()) if (panelId === undefined || run.panelId === panelId) {
    run.stop.abort()
    endRun(run)
  }
}

/**
 * Waits for a run: until it ends, or (with `sliceMs`) at most that long, then answers null: it is
 * still going. The answer is handed out, and saved to history, only to a request that is still
 * waiting: when the panel has given up (cancelled, closed) the run is stopped and leaves no trace.
 */
async function waitForRun(host: EnhanceWorker, run: LiveRun, signal: AbortSignal, sliceMs: number | null): Promise<EnhanceAnswer | null> {
  if (run.orphan) clearTimeout(run.orphan)
  run.orphan = null
  run.waiting += 1
  let slice: ReturnType<typeof setTimeout> | null = null
  let onAbort: (() => void) | null = null
  try {
    const first = await Promise.race<Outcome | 'pending' | 'gone'>([
      run.outcome,
      ...(sliceMs === null ? [] : [new Promise<'pending'>((resolve) => (slice = setTimeout(() => resolve('pending'), sliceMs)))]),
      new Promise<'gone'>((resolve) => {
        if (signal.aborted) resolve('gone')
        else signal.addEventListener('abort', (onAbort = () => resolve('gone')))
      })
    ])
    if (first === 'pending') return null
    if (first === 'gone' || signal.aborted) {
      run.stop.abort()
      endRun(run)
      throw hostError(msg('error.cancelled'), 'cancelled')
    }
    endRun(run)
    if (!first.ok) throw first.error
    const { result } = first
    const model = result.attempts.find((attempt) => attempt.ok)?.model ?? result.profile.model
    await addHistory(host, result.settings, {
      original: run.input.prompt.trim(),
      enhanced: result.enhanced,
      style: result.style,
      model,
      source: 'panel',
      ...(result.project ? { project: result.project } : {})
    }).catch((error) => host.log(`history: ${(error as Error).message}`))
    return {
      enhanced: result.enhanced,
      model,
      profileName: result.profile.name,
      ms: Date.now() - run.started,
      attempts: result.attempts,
      context: view(result.items),
      notes: result.notes
    }
  } finally {
    if (slice) clearTimeout(slice)
    if (onAbort) signal.removeEventListener('abort', onAbort)
    run.waiting -= 1
    // Nobody waits for it now: the panel asks again at once, or it is gone and the run goes with it.
    if (run.waiting === 0 && liveRuns.get(run.key) === run) {
      run.orphan = setTimeout(() => {
        run.stop.abort()
        endRun(run)
      }, RUN_LIMITS.orphanMs)
    }
  }
}

/**
 * One Enhance from the panel is a run, and a run is not tied to one request: the host ends a panel's
 * request after 120 s, and a slow model on a large context can take longer. A panel that says it
 * keeps waiting (`resumable`) is answered `pending` when the run outlasts a request, and asks again
 * (`resume`) until the run is done, RUN_LIMITS.totalMs at most. A caller that does not say so (an
 * older panel, the command line) gets its answer within one request (RUN_LIMITS.budgetMs).
 */
export async function enhanceRequest(host: EnhanceWorker, input: EnhanceInput, signal: AbortSignal, panelId: string): Promise<EnhanceAnswer> {
  const id = typeof input.runId === 'string' ? input.runId.slice(0, 64) : ''
  const keepsWaiting = id !== '' && (input.resumable === true || input.resume === true)
  let run: LiveRun | undefined
  if (input.resume === true) {
    run = liveRuns.get(JSON.stringify([panelId, id]))
    // The worker was restarted meanwhile, or the run was given up: there is nothing to wait for.
    if (!run || run.panelId !== panelId) throw hostError(msg('error.run_gone'), 'unavailable')
  } else {
    run = startRun(host, input, panelId, keepsWaiting ? RUN_LIMITS.totalMs : RUN_LIMITS.budgetMs)
  }
  const answer = await waitForRun(host, run, signal, keepsWaiting ? RUN_LIMITS.sliceMs : null)
  // Still going: the same fields, empty, so a caller reads one shape.
  return answer ?? { pending: true, enhanced: '', model: '', profileName: '', ms: Date.now() - run.started, attempts: [], context: [], notes: [] }
}

/** Enhance, Preview context, Send, Copy and the list of terminals to send to. */
function registerRunHandlers(host: EnhanceWorker): void {
  host.panels.handle('prompt.enhance', async (input, { signal, panel }) => enhanceRequest(host, input, signal, panel.id))
  host.panels.handle('enhance.progress.get', async ({ runId }, { panel }) => progressOf(runId, panel.id))

  host.panels.handle('context.preview', async ({ prompt, terminalId, level, exclude, workspaceId }, { signal }) => {
    const settings = await readSettings(host)
    const ensureAccess = contextAccess(host, settings, signal)
    const requested: ContextLevel = isContextLevel(level) ? level : settings.contextLevel
    // Preview reads exactly what a run would: the same Privacy switches apply.
    const allowed = allowedLevel(requested, settings)
    const gathered = await gatherContext(host, {
      level: allowed,
      prompt,
      terminalId: terminalId ?? null,
      terminalLines: settings.terminalLines,
      exclude: new Set(exclude ?? []),
      extraFiles: settings.extraContextFiles,
      excludePatterns: settings.excludePatterns,
      ...gatherPrivacy(settings),
      signal,
      ensureAccess,
      workspaceId: workspaceId ?? null
    })
    const notes = [...gathered.notes]
    await ensureAccess()
    if (allowed !== requested) notes.push(PROJECT_FILES_OFF)
    if (allowed === 'max') notes.push(msg('note.preview_no_picker'))
    if (allowed === 'ai-test') notes.push(msg('note.preview_no_research'))
    return { context: view(gathered.items), notes, chars: gathered.items.reduce((sum, entry) => sum + entry.chars, 0) }
  })

  host.panels.handle('prompt.send', async ({ terminalId, text, enter, force }, { signal }) => {
    const settings = await readSettings(host)
    if (!settings.privacy.allowTerminalSend) throw hostError(msg('error.send_off'), 'not_permitted')
    if (host.host.has('session.send')) {
      const prompt = terminalSafe(text).trim()
      if (!prompt) throw hostError(msg('error.nothing_to_send'), 'invalid_params')
      return host.host.call('session.send', { sessionId: terminalId, text: prompt }, { signal })
    }
    const pieces = terminalChunks(text, settings.sendMode)
    if (pieces.length === 0) throw hostError(msg('error.nothing_to_send'), 'invalid_params')
    // An agent that is waiting for an answer (a permission, a question) takes what is typed as that
    // answer, and Enter could approve what it asked. So the person is told first, and when they
    // send anyway the text is typed without Enter.
    const blocked = await blockedAgent(host, terminalId)
    if (blocked && force !== true) throw hostError(msg('error.agent_blocked', { name: blocked }), 'conflict')
    // `force` is the press of "Type it without Enter": no Enter then, whatever the agent's state is
    // by now (the person may have answered it in the meantime).
    const pressEnter = force !== true && !blocked && (enter ?? settings.sendPressEnter)
    // Long prompts go in pieces: the host accepts at most 4096 characters per call, and keeps writes to
    // one terminal in order.
    const result = await sendPieces(host, terminalId, pieces)
    if (pressEnter && result.accepted) {
      // Give the agent's TUI a beat to take the paste before submitting it.
      await new Promise((resolve) => setTimeout(resolve, 150))
      await host.host.call('terminal.sendText', { terminalId, text: '\r' })
    }
    return { accepted: result.accepted }
  })

  host.panels.handle('prompt.copy', async ({ text }) => copyToClipboard(text))

  // The web panel's pasted, dropped or picked files arrive in chunks (no path on disk in a frame).
  void restoreSavedAttachments(host).then(() => cleanAttachments()).catch(() => {})
  host.panels.handle('attachments.put', async (input) => {
    // A new file: the ones kept for more than a day go now (this worker may have started days ago).
    if (input.index === 0) void cleanAttachments()
    try {
      await restoreSavedAttachments(host)
      return await putChunk(input, host.attachmentOwner)
    } catch (error) {
      if (error instanceof LlmError) throw hostError(error.text, error.code)
      throw error
    }
  })

  host.panels.handle('targets.list', async (input) => {
    const targets: { terminalId: string; label: string; agent: string | null; title?: string; state?: string }[] = []
    const seen = new Set<string>()
    const agents = await host.host.call('agents.list', {}).catch(() => null)
    for (const agent of agents?.agents ?? []) {
      if (agent.terminalId && !seen.has(agent.terminalId)) {
        seen.add(agent.terminalId)
        const title = agent.title ?? agent.agent ?? 'Agent'
        targets.push({ terminalId: agent.terminalId, label: `${title} · ${agent.state}`, agent: agent.agent, title, state: agent.state })
      }
    }
    const context = await host.host.call('workspace.readContext', {}).catch(() => null)
    for (const terminal of context?.terminals ?? []) {
      if (!seen.has(terminal.id)) {
        seen.add(terminal.id)
        targets.push({ terminalId: terminal.id, label: terminal.title ?? terminal.id, agent: null })
      }
    }
    // Which workspace this is: several can share a name and branch. the host said which workspace each
    // agent's terminal is in (the worker keeps that, see terminals.ts); the panel adds what it noted
    // itself and the folder the person picked.
    const raw = (input ?? {}) as { known?: unknown }
    const known: Record<string, unknown> = raw.known && typeof raw.known === 'object' ? (raw.known as Record<string, unknown>) : {}
    const hints = [...new Set(targets.map((target) => known[target.terminalId]).filter((id): id is string => typeof id === 'string' && id.length > 0))]
    const workspace = context ? await findFocusedWorkspace(host, context, hints) : null
    const choices = context && !workspace ? await focusedCandidates(host, context) : []
    return {
      targets,
      workspace: context?.displayName ?? null,
      // The name this project's rules are kept under; null while the host cannot tell which project it is.
      project: context ? await projectNameOf(host, context, workspace) : null,
      workspaceId: workspace?.id ?? null,
      // Its folder, so the panel can tell which project the host removed (that event names it another way).
      ...(workspace ? { workspacePath: workspace.path } : {}),
      ...(choices.length > 0 ? { choices } : {})
    }
  })
}

/** Copilot profiles and the attached account's model list. */
function registerModelHandlers(host: EnhanceWorker): void {
  const rejectExternalOptions = (input: object) => {
    const raw = input as Record<string, unknown>
    if (['baseUrl', 'command', 'args', 'apiKey'].some(key => raw[key] !== undefined && raw[key] !== '')) {
      throw hostError(msg('error.invalid_profile'), 'invalid_params')
    }
  }
  host.panels.handle('models.get', async () => modelsView(host))

  host.panels.handle('models.save', async (input) => {
    rejectExternalOptions(input)
    const config = await loadModels(host)
    const existing = input.id ? config.profiles.findIndex((profile) => profile.id === input.id) : -1
    if (input.id !== undefined && existing < 0) throw hostError(msg('error.invalid_profile'), 'invalid_params')
    const id = existing >= 0 ? config.profiles[existing].id : newProfileId(input.name || 'copilot')
    const profile = normalizeProfile({ preset: 'copilot', provider: 'copilot', ...input, id })
    if (!profile) throw hostError(msg('error.invalid_profile'), 'invalid_params')
    if (existing >= 0) config.profiles[existing] = profile
    else config.profiles.push(profile)
    await saveModels(host, config)
    return modelsView(host)
  })

  host.panels.handle('models.delete', async ({ id }) => {
    const config = await loadModels(host)
    config.profiles = config.profiles.filter((profile) => profile.id !== id)
    if (config.selectorProfileId === id) config.selectorProfileId = null
    await saveModels(host, config)
    return modelsView(host)
  })

  host.panels.handle('models.move', async ({ id, direction, to }) => {
    const config = await loadModels(host)
    const index = config.profiles.findIndex((profile) => profile.id === id)
    const step = direction === 'up' ? -1 : 1
    const target = typeof to === 'number' ? Math.round(to) : index + step
    if (index >= 0 && target >= 0 && target < config.profiles.length) {
      const [moved] = config.profiles.splice(index, 1)
      config.profiles.splice(target, 0, moved)
      await saveModels(host, config)
    }
    return modelsView(host)
  })

  host.panels.handle('models.roles', async ({ selectorProfileId }) => {
    const config = await loadModels(host)
    if (selectorProfileId !== null && !config.profiles.some(profile => profile.id === selectorProfileId && profile.enabled)) {
      throw hostError(msg('error.selector_model'), 'invalid_params')
    }
    config.selectorProfileId = selectorProfileId
    await saveModels(host, config)
    return modelsView(host)
  })

  host.panels.handle('models.test', async ({ id }, { signal }) => {
    const config = await loadModels(host)
    const profile = config.profiles.find((entry) => entry.id === id)
    if (!profile) return { ok: false, message: english(msg('error.unknown_profile')), text: msg('error.unknown_profile'), ms: 0 }
    const settings = await readSettings(host)
    const started = Date.now()
    try {
      const { attempts } = await runChain(
        host,
        [profile],
        'Reply with exactly: OK',
        'ping',
        chainOptions(settings, signal, { timeoutMs: 30_000, fallback: false })
      )
      const text = msg('result.test_ok', { name: profile.name, model: attempts[0]?.model || 'default' })
      return { ok: true, message: english(text), text, ms: Date.now() - started }
    } catch (error) {
      const text = messageOf(error)
      return { ok: false, message: english(text), text, ms: Date.now() - started }
    }
  })

  host.panels.handle('models.catalog', async (input) => {
    rejectExternalOptions(input)
    const raw = input as Record<string, unknown>
    if ((raw.preset !== undefined && raw.preset !== 'copilot') || (raw.provider !== undefined && raw.provider !== 'copilot')) {
      throw hostError(msg('error.invalid_profile'), 'invalid_params')
    }
    const config = await loadModels(host)
    if (input.profileId !== undefined && !config.profiles.some(profile => profile.id === input.profileId)) {
      throw hostError(msg('error.invalid_profile'), 'invalid_params')
    }
    if (!(await readSettings(host)).privacy.allowOnlineModelLists) return { models: [], source: 'GitHub Copilot', fetchedAt: Date.now(), error: english(msg('error.lists_off')), errorText: msg('error.lists_off') }
    // Account and policy dependent: never persist or reuse a cross-session catalog.
    try { return await host.host.call('copilot.catalog', {}) }
    catch (error) { return { models: [], source: 'GitHub Copilot', fetchedAt: Date.now(), error: english(messageOf(error)), errorText: messageOf(error) } }
  })
}

/** The panel's Settings section: what is stored, and wiping it. Also the Rules tab's rules and structures. */
function registerDataHandlers(host: EnhanceWorker): void {
  // Saves land in the order they were asked for; the panel sends the whole list each time.
  let rulesQueue: Promise<unknown> = Promise.resolve()
  host.panels.handle('rules.get', async () => parseRulesConfig(await host.storage.get(RULES_KEY)))
  host.panels.handle('rules.save', async ({ config }) => {
    const clean = parseRulesConfig(rulesToJson(config))
    const write = rulesQueue.then(() => host.storage.set(RULES_KEY, rulesToJson(clean)))
    rulesQueue = write.catch(() => undefined)
    await write
    return clean
  })

  // History edits from the panel go through the same queue as new entries, so none is lost.
  host.panels.handle('history.remove', async ({ id }) => {
    await historyChange(host, async () => {
      const list = parseHistory(await host.storage.get(HISTORY_KEY))
      const gone = list.find((entry) => entry.id === id)
      if (!gone) return
      await host.storage.set(HISTORY_KEY, list.filter((entry) => entry.id !== id).map(toJson))
      // Kept in memory for a while, so that Undo can bring it back (history.restore).
      removedEntries.set(id, { entry: gone, until: Date.now() + UNDO_MS })
      for (const [key, kept] of removedEntries) if (kept.until < Date.now() || removedEntries.size > UNDO_KEPT) removedEntries.delete(key)
    })
    return { ok: true as const }
  })

  // Undo of a removal: only an entry this worker removed a moment ago, by its id. The panel sends no
  // entry, so nothing but what was in the history can come back into it.
  host.panels.handle('history.restore', async ({ id }) => {
    const kept = removedEntries.get(typeof id === 'string' ? id : '')
    removedEntries.delete(typeof id === 'string' ? id : '')
    const settings = await readSettings(host)
    if (!kept || kept.until < Date.now() || settings.historyLimit <= 0 || !settings.privacy.saveHistory) return { restored: false }
    let restored = false
    await historyChange(host, async () => {
      const list = parseHistory(await host.storage.get(HISTORY_KEY))
      if (list.some((entry) => entry.id === kept.entry.id)) {
        restored = true
        return
      }
      const next = capHistory([...list, kept.entry].sort((a, b) => b.at - a.at), settings.historyLimit)
      // A history that filled up meanwhile has no room for an older entry: say so, do not claim it is back.
      restored = next.some((entry) => entry.id === kept.entry.id)
      if (restored) await host.storage.set(HISTORY_KEY, next.map(toJson))
    })
    return { restored }
  })

  host.panels.handle('history.clear', async () => {
    removedEntries.clear()
    await historyChange(host, () => host.storage.delete(HISTORY_KEY))
    return { ok: true as const }
  })

  host.panels.handle('data.summary', async () => {
    const keys = await host.storage.keys()
    const config = await loadModels(host)
    const history = parseHistory(await host.storage.get(HISTORY_KEY))
    return {
      history: history.length,
      profiles: config.profiles.length,
      catalogs: keys.filter((key) => key.startsWith('catalog:')).length
    }
  })

  host.panels.handle('data.clear', async ({ what }) => {
    const keys = await host.storage.keys()
    if (what === 'history' || what === 'all') {
      removedEntries.clear()
      await historyChange(host, () => host.storage.delete(HISTORY_KEY))
    }
    if (what === 'catalogs' || what === 'all') {
      for (const key of keys.filter((entry) => entry.startsWith('catalog:'))) await host.storage.delete(key)
    }
    if (what === 'all') {
      await host.storage.delete(MODELS_KEY)
      for (const key of Object.values(EFFORT_SETTINGS)) await host.settings.set(key, 'recommended')
      for (const key of Object.values(REASONING_SETTINGS)) await host.settings.set(key, 'default')
      await host.storage.delete(RULES_KEY)
      // Confirmations go too: a switch that needs one asks again; what the host reported is forgotten.
      await host.storage.delete(CONSENTS_KEY)
      await host.storage.delete('colorTheme')
      forgetActivity()
      await forgetTerminals(host)
      // The copies of attached files (the panel forgets its list of them as well).
      await clearAttachments().catch((error) => host.log(`attachments: ${(error as Error).message}`))
    }
    return { ok: true as const }
  })
}

// ---- the host integrations: what agents do, files saved in the editor, new agents, opening files

/**
 * The switches as the worker may use them now, for the hooks and events that fire often (they must
 * not read settings each time). Refreshed when a setting or a confirmation changes.
 */
let live: Privacy = parsePrivacy({}, {})

async function refreshLive(host: EnhanceWorker): Promise<void> {
  const before = live
  live = (await readSettings(host).catch(() => null))?.privacy ?? live
  // A switch turned off forgets what it had kept.
  if (before.allowAgentActivity && !live.allowAgentActivity) forgetActivity('agents')
  if (before.allowEditorSaves && !live.allowEditorSaves) forgetActivity('saves')
}

/** A relative path inside a workspace, or null (absolute, parent folders, a secret file). */
function workspacePath(path: unknown): string | null {
  if (typeof path !== 'string') return null
  const clean = path.trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!clean || clean.length > 500 || clean.startsWith('/') || /^[a-zA-Z]:/.test(clean) || clean.split('/').includes('..') || isSensitive(clean)) return null
  return clean
}

/** the host's id of the focused workspace: the panel's, when it knows it, else matched by name and branch. */
async function focusedWorkspaceId(host: EnhanceWorker, hint: unknown): Promise<string | null> {
  const focused = await host.host.call('workspace.readContext', {}).catch(() => null)
  if (!focused) return null
  return (await findFocusedWorkspace(host, focused, typeof hint === 'string' ? hint : null))?.id ?? null
}

function registerIntegrations(host: EnhanceWorker): void {
  void refreshLive(host)
  host.settings.onDidChange(() => void refreshLive(host))
  host.storage.onDidChange(({ key }) => {
    if (key === CONSENTS_KEY) void refreshLive(host)
  })

  // Observe only: the host does not wait for agent.tool.after; editor.save.before passes at once.
  // Both say which workspace the agent's terminal is in. That pairing of two ids is always kept: it
  // is how the focused workspace is told from others of its name. What the agent did is kept only
  // while its Privacy switch is on.
  void loadTerminals(host)
  host.hooks.on('agent.tool.after', (event) => {
    learnTerminal(host, event.terminalId, event.workspaceId)
    if (live.allowAgentActivity) recordTool(event)
  })
  host.events.on('agent.status.changed', (event) => {
    learnTerminal(host, event.terminalId, event.workspaceId)
    if (live.allowAgentActivity) recordStatus(event)
  })
  host.hooks.on('editor.save.before', (event) => {
    if (live.allowEditorSaves) recordSave(event)
  })

  /** Which confirmations were given, and which switches need one. */
  host.panels.handle('consents.get', async () => {
    const consents = parseConsents(await host.storage.get(CONSENTS_KEY).catch(() => null))
    return { granted: [...NEEDS_CONSENT].filter((key) => consents[key] === true), needed: [...NEEDS_CONSENT] }
  })

  /** The person confirmed (or withdrew) a switch after reading what it allows, in the panel. */
  host.panels.handle('consent.set', async ({ key, granted }) => {
    if (!NEEDS_CONSENT.has(key as PrivacyKey)) throw hostError(msg('error.invalid_request'), 'invalid_params')
    const consents = parseConsents(await host.storage.get(CONSENTS_KEY).catch(() => null))
    if (granted) consents[key as PrivacyKey] = true
    else delete consents[key as PrivacyKey]
    await host.storage.set(CONSENTS_KEY, consents as JsonValue)
    await refreshLive(host)
    return { granted: [...NEEDS_CONSENT].filter((entry) => consents[entry] === true) }
  })

  /** Opens a file of the focused workspace in the host's editor (a context item the person clicked). */
  host.panels.handle('editor.open', async ({ path, workspaceId }) => {
    const settings = await readSettings(host)
    if (!settings.privacy.allowOpenFiles) throw hostError(msg('error.open_off'), 'not_permitted')
    if (!host.host.has('editor.open')) throw hostError(msg('error.unsupported'), 'unavailable')
    const clean = workspacePath(path)
    if (!clean) throw hostError(msg('error.invalid_request'), 'invalid_params')
    const id = await focusedWorkspaceId(host, workspaceId)
    if (!id) throw hostError(msg('note.no_workspace'), 'invalid_params')
    return host.host.call('editor.open', { workspaceId: id, path: clean })
  })
}

export default function activate(host: EnhanceWorker): void {
  registerIntegrations(host)
  registerRunHandlers(host)
  registerModelHandlers(host)
  registerDataHandlers(host)
}
