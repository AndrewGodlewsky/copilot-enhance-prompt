// The plugin's worker: gathers project context at the chosen level, runs the model chain with
// fallback, sends prompts to agent terminals, keeps history, manages model profiles, and runs the
// optional agent.prompt.before auto-enhance hook.
import type { PluginRequests } from '#panel'
import type { JsonValue, EnhanceWorker } from '#host'
import { apiCatalog, claudeCatalog, claudeProgramSignature, codexCatalog, geminiCatalog, parseCatalog, type Catalog } from './catalog.ts'
import { CLI_BINARIES, detectClis } from './cli.ts'
import { copyToClipboard } from './clipboard.ts'
import { forgetActivity, recordSave, recordStatus, recordTool } from './context/activity.ts'
import { researchContext, RESEARCH_LIMITS } from './context/research.ts'
import { isSensitive } from './context/files.ts'
import { formatText } from './format.ts'
import { EFFORT_LABELS, EFFORT_SETTINGS, isEffort, parseModelAssignment } from './effort.ts'
import { atLeast, cachedStatic, contextItem, findFocusedWorkspace, focusedCandidates, focusedProject, gatherContext, isLocalWorkspace, projectNameOf, staticParts, workspaceOfTerminal, type ContextItem, type Workspace } from './context/index.ts'
import { forgetTerminals, learnTerminal, loadTerminals } from './context/terminals.ts'
import { workspaceTitle } from './workspaces.ts'
import { imagesBlock, imageSupport, withImagePaths } from './images.ts'
import { cleanAttachments, clearAttachments, loadFiles, putChunk } from './attachments.ts'
import { attachmentItemId } from './image-limits.ts'
import { parseRulesConfig, RULES_KEY, rulesFor, rulesToJson, structureById, type RulesConfig, type RuleWhere } from './rules.ts'
import { capHistory, HISTORY_KEY, parseHistory, toJson, trimForHistory, type HistoryEntry } from './history.ts'
import {
  candidates,
  ChainError,
  loadModels,
  resolveKey,
  runChain,
  saveModels,
  secretName,
  viewProfiles,
  type ChainOptions
} from './models.ts'
import { isContextLevel, newProfileId, normalizeProfile, presetById, PRESETS, type ContextLevel, type ModelProfile, type ModelsConfig } from './presets.ts'
import { buildSystemPrompt, buildUserMessage, cleanOutput, isStyle, PASTE_END, PASTE_START, terminalChunks, terminalSafe, type Style } from './prompts.ts'
import { PANEL_REQUEST_LIMIT_MS, type HookRecord, type ModelsView } from './protocol.ts'
import { CONSENTS_KEY, NEEDS_CONSENT, parseConsents, parseOtherAgentsLimits, parsePrivacy, type OtherAgentsLimits, type Privacy, type PrivacyKey } from './privacy.ts'
import { createProgress, planSteps, type StepReporter } from './progress.ts'
import { MODELS_KEY } from './presets.ts'
import { BRAND, BRAND_SHORT } from './brand.ts'
import { LlmError, messageOf } from './llm.ts'
import { english, msg, raw, withMessage, type Message } from './messages.ts'

const AUTO_MODES = ['off', 'rules', 'ai'] as const
type AutoMode = (typeof AUTO_MODES)[number]
/** the host waits 2 s for a hook; leave room to answer. */
const HOOK_BUDGET_MS = 1700
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

/** Model lists are fetched again after a day, or on Refresh. */
const CATALOG_TTL_MS = 24 * 3600_000

export type Settings = {
  defaultStyle: Style
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
  autoEnhanceMode: AutoMode
  autoEnhanceAppend: string
  autoEnhanceMinLength: number
  autoEnhanceContext: boolean
  /** A desktop notification when a long run finishes. */
  notifyWhenDone: boolean
  /** Read other agents' sessions: how many agents and lines (within OTHER_AGENTS_LIMITS). */
  otherAgentsLimits: OtherAgentsLimits
  /** The switches as the worker may use them (confirmed where they need it). */
  privacy: Privacy
}

const str = (value: JsonValue | undefined, fallback = '') => (typeof value === 'string' ? value : fallback)
const num = (value: JsonValue | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
const bool = (value: JsonValue | undefined, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

export async function readSettings(host: EnhanceWorker): Promise<Settings> {
  const [all, consents] = await Promise.all([host.settings.get(), host.storage.get(CONSENTS_KEY).catch(() => null)])
  const mode = str(all.autoEnhanceMode, 'off')
  const style = str(all.defaultStyle, 'balanced')
  const level = str(all.contextLevel, 'standard')
  return {
    defaultStyle: isStyle(style) ? style : 'balanced',
    customInstructions: str(all.customInstructions),
    contextLevel: isContextLevel(level) ? level : 'standard',
    terminalLines: num(all.terminalLines, 100),
    extraContextFiles: str(all.extraContextFiles)
      .split('\n')
      .map((line) => line.trim().replace(/\\/g, '/').replace(/^\.\//, ''))
      .filter((line) => line && !line.startsWith('/') && !line.includes('..'))
      .slice(0, 10),
    excludePatterns: str(all.excludePatterns),
    adaptToAgent: bool(all.adaptToAgent, true),
    fallbackEnabled: bool(all.fallbackEnabled, true),
    fallbackOn: str(all.fallbackOn) === 'transient' ? 'transient' : 'any',
    timeoutSeconds: num(all.timeoutSeconds, 60),
    sendMode: str(all.sendMode, 'paste'),
    sendPressEnter: bool(all.sendPressEnter, false),
    historyLimit: num(all.historyLimit, 50),
    autoEnhanceMode: (AUTO_MODES as readonly string[]).includes(mode) ? (mode as AutoMode) : 'off',
    autoEnhanceAppend: str(all.autoEnhanceAppend),
    autoEnhanceMinLength: num(all.autoEnhanceMinLength, 8),
    autoEnhanceContext: bool(all.autoEnhanceContext, true),
    notifyWhenDone: bool(all.notifyWhenDone, false),
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
 * History is read, changed and written back, so two writers at once (a panel run and the hook, or
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
    const at = Date.now()
    const added: HistoryEntry = {
      id: `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      at,
      ...entry,
      original: trimForHistory(entry.original),
      enhanced: trimForHistory(entry.enhanced)
    }
    const next = capHistory([added, ...list], settings.historyLimit)
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
  totalMs: number = RUN_LIMITS.pickerMs
): Promise<string[]> {
  const system =
    'You pick source files relevant to a coding task. Answer ONLY a JSON array of up to 8 file paths copied exactly from the list, most relevant first. No prose.'
  const user = `<task>\n${prompt}\n</task>\n<files>\n${tree.join('\n')}\n</files>`
  const list = candidates(config.profiles, config.selectorProfileId, settings.fallbackEnabled)
  const { text } = await runChain(host, list, system, user, chainOptions(settings, signal, { timeoutMs: RUN_LIMITS.pickerMs, totalMs }))
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
  const config = await loadModels(host)
  let profileId = input.profileId ?? null
  let chosenModel = input.model?.trim().slice(0, 200)
  if (input.effort !== undefined) {
    if (!isEffort(input.effort)) throw hostError(msg('error.effort'), 'invalid_params')
    const assignment = parseModelAssignment(await host.settings.get(EFFORT_SETTINGS[input.effort]) ?? 'auto')
    if (!assignment || (assignment.profileId && !config.profiles.some(profile => profile.id === assignment.profileId && profile.enabled))) {
      throw hostError(msg('error.effort_model', { effort: EFFORT_LABELS[input.effort] }), 'invalid_params')
    }
    profileId = assignment.profileId
    chosenModel = assignment.model
  }
  const list = candidates(config.profiles, profileId, settings.fallbackEnabled).map((profile) =>
    chosenModel && profile.id === profileId ? { ...profile, model: chosenModel } : profile
  )
  if (list.length === 0) throw hostError(msg('error.no_model'), 'invalid_params')
  // File selection is part of the same data/billing route as rewriting.
  const pickerProfiles = config.profiles.filter(profile => (profile.provider === 'copilot') === (list[0]?.provider === 'copilot'))
  const pickerConfig = { ...config, profiles: pickerProfiles.map(profile => profile.id === config.selectorProfileId ? profile : list.find(candidate => candidate.id === profile.id) ?? profile),
    selectorProfileId: pickerProfiles.some(profile => profile.id === config.selectorProfileId) ? config.selectorProfileId : list[0]?.id ?? null }
  const style: Style = isStyle(input.style) ? input.style : settings.defaultStyle
  const requested: ContextLevel = isContextLevel(input.level) ? input.level : settings.contextLevel
  const level = allowedLevel(requested, settings)
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
    pickFiles: (tree, task) => pickFilesWithModel(host, pickerConfig, settings, tree, task, signal, Math.min(RUN_LIMITS.pickerMs, (left() ?? Infinity) / 2)),
    ...privacy,
    onStep: step,
    signal,
    workspaceId: typeof input.workspaceId === 'string' ? input.workspaceId : null
  })
  if (level !== requested) gathered.notes.push(PROJECT_FILES_OFF)
  let checkResearchAccess: (() => Promise<void>) | undefined
  if (level === 'ai-test') {
    checkResearchAccess = async () => {
      const current = await readSettings(host)
      if (JSON.stringify(current.privacy) !== JSON.stringify(settings.privacy) || current.excludePatterns !== settings.excludePatterns ||
          JSON.stringify(current.extraContextFiles) !== JSON.stringify(settings.extraContextFiles)) {
        throw new LlmError(msg('error.research_privacy_changed'), 'cancelled')
      }
    }
    const researched = await researchContext({
      root: gathered.root, files: gathered.files ?? [], items: gathered.items, prompt, signal,
      exclude: new Set(input.exclude ?? []), excludePatterns: settings.excludePatterns,
      budgetMs: Math.min(RESEARCH_LIMITS.ms, (left() ?? RUN_LIMITS.totalMs) / 2),
      ensureAccess: checkResearchAccess, onStep: step, diagnostics: host.diagnostics,
      ask: async (system, user, researchSignal, remainingMs) => (await runChain(host, list.slice(0, 1), system, user,
        chainOptions(settings, researchSignal, { fallback: false, totalMs: remainingMs, timeoutMs: remainingMs }))).text
    })
    gathered.items = researched.items
    gathered.notes.push(researched.note)
  }
  const agentItem = gathered.items.find((entry) => entry.kind === 'agent')
  const system = buildSystemPrompt({
    style,
    customInstructions: settings.customInstructions,
    agent: settings.adaptToAgent ? (agentItem?.content.split(' ')[0] ?? null) : null,
    rules: own.rules,
    structure: structureById(own.config, input.structureId)
  })
  // Attached files, read before any model is called: images are shown to models that read images,
  // text goes in the context, and the user message lists every file by its path.
  const files = await loadFiles((input.files ?? []).filter((path) => typeof path === 'string' && path.trim())).catch((error: unknown) => {
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
    await checkResearchAccess?.()
    const result = await runChain(
      host,
      list,
      system,
      user,
      chainOptions(settings, signal, {
        ...(deadline === undefined ? {} : { totalMs: left() }),
        images,
        onAttempt: (profile, model, attempt, total) => {
          tried = `${profile.name} · ${model || 'default'}${attempt > 1 ? ` · ${attempt}/${total}` : ''}`
          step('model', 'running', tried)
        }
      })
    )
    step('model', 'done', `${result.profile.name} · ${result.attempts.find((attempt) => attempt.ok)?.model ?? ''}`)
    // A model that cannot see images still got their paths; say so, and keep every path in the prompt.
    if (images.length > 0 && imageSupport(result.profile) === 'none') gathered.notes.push(msg('note.images_paths_only'))
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
  // Without an OS key store the host cannot keep an API key: the Models tab says so before one is typed.
  const keys = host.host.has('secrets.protection') ? await host.host.call('secrets.protection', {}).catch(() => null) : null
  return {
    profiles: await viewProfiles(host, config.profiles),
    hookProfileId: config.hookProfileId,
    selectorProfileId: config.selectorProfileId,
    fromEnv: config.fromEnv,
    presets: PRESETS,
    ...(keys?.status === 'unavailable' ? { keysUnavailable: true } : {})
  }
}

/** Stored profiles only; env-derived ones become real profiles once the person edits anything. */
async function editableModels(host: EnhanceWorker): Promise<ModelsConfig> {
  const { fromEnv: _fromEnv, ...config } = await loadModels(host)
  return config
}

/** Prompt-independent context for the hook: whatever the cache holds for the focused workspace. */
type HookPlace = { workspace: Workspace | null; label: string; where: RuleWhere }

/**
 * Where a prompt the host is sending belongs: the workspace of the terminal it goes to, when the host's
 * agent events said which one that is (context/terminals.ts); else the focused workspace, but only
 * when the terminal is one of its own. Null when neither holds: the project is not known then, and
 * nothing of one project is used in another. The hook used to take the focused workspace always,
 * so an agent in another project got the rules and the context of the project the person happened
 * to be looking at.
 */
export async function hookPlace(host: EnhanceWorker, terminalId: string): Promise<HookPlace | null> {
  // The focus is read first: it is what a kept pairing of this terminal is checked against.
  const focused = await host.host.call('workspace.readContext', {}).catch(() => null)
  const own = await workspaceOfTerminal(host, terminalId, focused)
  if (own) {
    return {
      workspace: own,
      label: `${workspaceTitle(own.name, own.project)}${own.branch ? ` (branch ${own.branch})` : ''}`,
      where: { workspace: own.name, project: own.project?.trim() || own.name }
    }
  }
  if (!focused || !focused.terminals.some((terminal) => terminal.id === terminalId)) return null
  const workspace = await findFocusedWorkspace(host, focused)
  return {
    workspace,
    label: `${workspaceTitle(focused.displayName, workspace?.project)}${focused.branch ? ` (branch ${focused.branch})` : ''}`,
    where: { workspace: focused.displayName, project: await projectNameOf(host, focused, workspace) }
  }
}

function hookContext(place: HookPlace | null, settings: Settings): ContextItem[] {
  if (!place) return []
  const items: ContextItem[] = [{ id: 'workspace', kind: 'workspace', label: 'Workspace', content: place.label, chars: place.label.length }]
  if (!settings.privacy.allowProjectFiles) return items
  const cached = place.workspace && isLocalWorkspace(place.workspace) ? cachedStatic(place.workspace.path, settings) : null
  if (cached) items.push(...cached.items.filter((entry) => entry.kind !== 'tree'))
  return items
}

/** the host's default shortcut for the right sidebar (`sidebar.right.toggle`, Mod+L). */
const SIDEBAR_KEY = process.platform === 'darwin' ? '⌘L' : 'Ctrl+L'

/**
 * The status bar item says whether auto-enhance is at work: "Enhance: On" or "Enhance: Off", the
 * English text. Which kind is on (rules or AI) is in the
 * tooltip. Its icon is the plugin's own lightbulb, the one on the panel's tab. While on, the item
 * has the accent tone, which the host draws bright; off, the neutral one, which it draws dimmed.
 *
 * All of this is set here, at run time. The manifest's entry stays exactly as it was approved:
 * the host tells one status bar item from another by its whole declaration, so a new text or icon
 * there would make every user approve the update again (src/manifest.test.ts).
 */
export const statusBarText = (mode: AutoMode): string => `${BRAND_SHORT}: ${mode === 'off' ? 'Off' : 'On'}`

/**
 * The English words shown in the status bar's tooltip and command answers.
 */
const WORKER_WORDS = {
  modes: { off: 'off', rules: 'on (rules)', ai: 'on (AI)' },
  tooltip: (mode: string) =>
    `Click: open the right sidebar (${SIDEBAR_KEY}), then the lightbulb tab "${BRAND}".\nAuto-enhance is ${mode}. Change it under the panel's gear icon or in the command palette.\nSettings and updates: Settings → Plugins → Enhance Prompt.`,
  answer: (mode: string) => `Auto-enhance is ${mode}.`,
  bar: { hidden: 'Status bar item hidden.', shown: 'Status bar item shown.' }
}

function modeAnswer(mode: AutoMode): string {
  return WORKER_WORDS.answer(WORKER_WORDS.modes[mode])
}

async function refreshStatusBar(host: EnhanceWorker): Promise<void> {
  if (!host.host.has('statusBar.update')) return
  const all = await host.settings.get()
  const { autoEnhanceMode } = await readSettings(host)
  const display = typeof all.statusBarItem === 'string' ? all.statusBarItem : 'full'
  const words = WORKER_WORDS
  await host.host
    .call('statusBar.update', {
      id: 'auto-enhance',
      visible: display !== 'hidden',
      text: display === 'icon' ? '' : statusBarText(autoEnhanceMode),
      icon: 'lightbulb',
      tone: autoEnhanceMode === 'off' ? 'neutral' : 'accent',
      tooltip: words.tooltip(words.modes[autoEnhanceMode])
    })
    .catch(() => undefined)
}

async function setMode(host: EnhanceWorker, mode: AutoMode): Promise<string> {
  await host.settings.set('autoEnhanceMode', mode)
  await refreshStatusBar(host)
  return modeAnswer(mode)
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

/** Fetches one model list from its source: the CLI itself, or the provider's API. */
async function fetchCatalog(
  host: EnhanceWorker,
  source: { presetId: string; env: string; provider: string; baseUrl: string; command: string; profile?: ModelProfile; typedKey?: string }
): Promise<Catalog> {
  const { privacy } = await readSettings(host)
  const online = privacy.allowOnlineModelLists
  if (source.presetId === 'claude-code') return claudeCatalog(source.command, online)
  if (source.presetId === 'codex') return codexCatalog(source.command)
  if (source.presetId === 'gemini-cli') return geminiCatalog(source.command, online)
  if (source.provider === 'cli') return { models: [], source: 'custom CLI', fetchedAt: Date.now() }
  if (!online) return { models: [], source: 'GET /models', fetchedAt: Date.now(), error: english(msg('error.lists_off')), errorText: msg('error.lists_off') }
  // Privacy: an environment key is used only while "Use API keys from environment variables" is on.
  const envKey = privacy.allowEnvKeys && source.env ? (process.env[source.env] ?? null) : null
  const savedKey = source.profile ? (await resolveKey(host, source.profile)).key : null
  return apiCatalog(source.provider === 'anthropic' ? 'anthropic' : 'openai', source.baseUrl, source.typedKey || savedKey || envKey)
}

/** The latest progress of recent runs, by run id, for callers that cannot hear panel events (the web panel's dev server). */
type ProgressSnapshot = Parameters<Parameters<typeof createProgress>[2]>[0]
const latestProgress = new Map<string, ProgressSnapshot>()
const MAX_TRACKED_RUNS = 20

export function progressOf(runId: string): ProgressSnapshot | null {
  return latestProgress.get(runId) ?? null
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
let unnamedRuns = 0

function startRun(host: EnhanceWorker, input: EnhanceInput, panelId: string, budgetMs: number): LiveRun {
  const runId = typeof input.runId === 'string' ? input.runId.slice(0, 64) : ''
  // Progress goes only to the panel that asked, and only when it asked for it.
  const progress = runId
    ? (level: ContextLevel, allowProjectFiles: boolean, readsOtherAgents: boolean) =>
        createProgress(runId, planSteps(level, allowProjectFiles, readsOtherAgents), (snapshot) => {
          latestProgress.delete(runId)
          latestProgress.set(runId, snapshot)
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
    void notifyDone(host, result.settings, model, Date.now() - run.started)
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
  host.panels.handle('enhance.progress.get', async ({ runId }) => progressOf(runId))

  host.panels.handle('context.preview', async ({ prompt, terminalId, level, exclude, workspaceId }, { signal }) => {
    const settings = await readSettings(host)
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
      workspaceId: workspaceId ?? null
    })
    const notes = [...gathered.notes]
    if (allowed !== requested) notes.push(PROJECT_FILES_OFF)
    if (allowed === 'max') notes.push(msg('note.preview_no_picker'))
    if (allowed === 'ai-test') notes.push(msg('note.preview_no_research'))
    return { context: view(gathered.items), notes, chars: gathered.items.reduce((sum, entry) => sum + entry.chars, 0) }
  })

  host.panels.handle('prompt.send', async ({ terminalId, text, enter, force }) => {
    const settings = await readSettings(host)
    if (!settings.privacy.allowTerminalSend) throw hostError(msg('error.send_off'), 'not_permitted')
    if (host.host.has('session.send')) {
      const prompt = terminalSafe(text).trim()
      if (!prompt) throw hostError(msg('error.nothing_to_send'), 'invalid_params')
      return host.host.call('session.send', { sessionId: terminalId, text: prompt })
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
  void cleanAttachments()
  host.panels.handle('attachments.put', async (input) => {
    // A new file: the ones kept for more than a day go now (this worker may have started days ago).
    if (input.index === 0) void cleanAttachments()
    try {
      return await putChunk(input)
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

/** Model profiles, their live model lists and the subscription CLIs found on this machine. */
function registerModelHandlers(host: EnhanceWorker): void {
  const catalogsInFlight = new Map<string, Promise<Catalog>>()

  host.panels.handle('models.get', async () => modelsView(host))

  host.panels.handle('models.save', async (input) => {
    const config = await editableModels(host)
    const existing = input.id ? config.profiles.findIndex((profile) => profile.id === input.id) : -1
    const id = existing >= 0 ? config.profiles[existing].id : newProfileId(input.name || input.preset)
    const profile = normalizeProfile({ ...input, id })
    if (!profile) throw hostError(msg('error.invalid_profile'), 'invalid_params')
    // The key first: where this machine has no OS key store the host refuses it, and a model saved
    // without its key would look ready and fail on its first run.
    if (profile.provider === 'copilot' && input.apiKey?.trim()) throw hostError(msg('error.invalid_profile'), 'invalid_params')
    if (input.apiKey?.trim()) {
      try {
        await host.secrets.set(secretName(id), input.apiKey.trim())
      } catch (error) {
        host.log(`models.save: the key was not stored: ${(error as Error).message}`)
        throw hostError(msg('error.key_not_saved'), 'action_failed')
      }
    }
    if (existing >= 0) config.profiles[existing] = profile
    else config.profiles.push(profile)
    await saveModels(host, config)
    if (input.apiKey !== undefined && !input.apiKey.trim()) await host.secrets.delete(secretName(id)).catch(() => undefined)
    return modelsView(host)
  })

  host.panels.handle('models.delete', async ({ id }) => {
    const config = await editableModels(host)
    config.profiles = config.profiles.filter((profile) => profile.id !== id)
    if (config.hookProfileId === id) config.hookProfileId = null
    if (config.selectorProfileId === id) config.selectorProfileId = null
    await saveModels(host, config)
    await host.secrets.delete(secretName(id)).catch(() => undefined)
    return modelsView(host)
  })

  host.panels.handle('models.move', async ({ id, direction, to }) => {
    const config = await editableModels(host)
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

  host.panels.handle('models.roles', async ({ hookProfileId, selectorProfileId }) => {
    const config = await editableModels(host)
    const valid = (id: string | null) => (id && config.profiles.some((profile) => profile.id === id) ? id : null)
    // The hook cannot use a CLI model (too slow for its 2 s), so it is never stored as the hook's.
    const hook = valid(hookProfileId)
    config.hookProfileId = hook && ['openai', 'anthropic'].includes(config.profiles.find((profile) => profile.id === hook)?.provider ?? '') ? hook : null
    config.selectorProfileId = valid(selectorProfileId)
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
      const keySource = (await resolveKey(host, profile)).source
      const text = msg('result.test_ok', { name: profile.name, model: attempts[0]?.model || 'default', key: keySource })
      return { ok: true, message: english(text), text, ms: Date.now() - started }
    } catch (error) {
      const text = messageOf(error)
      return { ok: false, message: english(text), text, ms: Date.now() - started }
    }
  })

  host.panels.handle('models.catalog', async (input) => {
    const preset = presetById(input.preset)
    const config = await loadModels(host)
    const profile = input.profileId ? config.profiles.find((entry) => entry.id === input.profileId) : undefined
    const provider = preset.id === 'custom'
      ? (input.provider ?? profile?.provider) === 'anthropic' ? 'anthropic' : 'openai'
      : preset.provider
    if (provider === 'copilot') {
      if (!(await readSettings(host)).privacy.allowOnlineModelLists) return { models: [], source: 'GitHub Copilot', fetchedAt: Date.now(), error: english(msg('error.lists_off')), errorText: msg('error.lists_off') }
      // Account and policy dependent: never persist or reuse a cross-session catalog.
      try { return await host.host.call('copilot.catalog', {}) }
      catch (error) { return { models: [], source: 'GitHub Copilot', fetchedAt: Date.now(), error: english(messageOf(error)), errorText: messageOf(error) } }
    }
    const baseUrl = (input.baseUrl ?? profile?.baseUrl ?? '').trim() || preset.baseUrl
    const command = (input.command ?? profile?.command ?? '').trim()
    // CLIs share one catalog per preset; APIs one per endpoint (keys differ per profile, lists rarely do).
    const cliKey = `catalog:v3:${preset.id}`
    // Claude Code's list is read from its program: a new version (other size or date) is a new list.
    let cacheKey = provider === 'cli' ? cliKey : `catalog:v3:${provider}:${baseUrl}`
    if (preset.id === 'claude-code') cacheKey = `${cliKey}:${await claudeProgramSignature(command)}`
    if (!input.refresh) {
      const cached = parseCatalog(await host.storage.get(cacheKey))
      if (cached && cached.models.length > 0 && Date.now() - cached.fetchedAt < CATALOG_TTL_MS) {
        return cached
      }
    }
    // Opening the panel asks for every profile's list at once; requests for the same list share one
    // fetch (a Claude Code scan reads its whole program file). A key typed in the form is its own fetch.
    const flightKey = `${cacheKey}${input.apiKey?.trim() ? ':typed' : ''}`
    const running = catalogsInFlight.get(flightKey)
    if (running) return running
    const fetching = (async (): Promise<Catalog> => {
      const catalog = await fetchCatalog(host, { presetId: preset.id, env: preset.env, provider, baseUrl, command, profile, typedKey: input.apiKey?.trim() })
      if (catalog.models.length > 0) {
        await host.storage.set(cacheKey, { ...catalog, models: catalog.models.map((model) => ({ ...model })) })
        // Lists of earlier Claude Code versions are never read again.
        if (preset.id === 'claude-code') {
          for (const key of await host.storage.keys()) {
            if ((key === cliKey || key.startsWith(`${cliKey}:`)) && key !== cacheKey) await host.storage.delete(key)
          }
        }
      }
      return catalog
    })()
    catalogsInFlight.set(flightKey, fetching)
    try {
      return await fetching
    } finally {
      catalogsInFlight.delete(flightKey)
    }
  })

  host.panels.handle('models.detect', async () => {
    const config = await loadModels(host)
    const found = detectClis().map(({ kind, path }) => ({
      preset: kind,
      label: presetById(kind).label,
      path,
      added: config.profiles.some(
        (profile) => profile.preset === kind && (!profile.command || profile.command === path || profile.command === CLI_BINARIES[kind])
      )
    }))
    return { found }
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
    let secretsStored = 0
    for (const profile of config.profiles) if (await host.secrets.get(secretName(profile.id)).catch(() => null)) secretsStored++
    return {
      history: history.length,
      profiles: config.fromEnv ? 0 : config.profiles.length,
      keys: secretsStored,
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
      const config = await loadModels(host)
      for (const profile of config.profiles) await host.secrets.delete(secretName(profile.id)).catch(() => undefined)
      await host.storage.delete(MODELS_KEY)
      for (const key of Object.values(EFFORT_SETTINGS)) await host.settings.set(key, 'auto')
      await host.storage.delete(RULES_KEY)
      // Confirmations go too: a switch that needs one asks again; what the host reported is forgotten.
      await host.storage.delete(CONSENTS_KEY)
      await host.storage.delete('colorTheme')
      forgetActivity()
      launchedPrompts.clear()
      lastHook = null
      await forgetTerminals(host)
      // The copies of attached files (the panel forgets its list of them as well).
      await clearAttachments().catch((error) => host.log(`attachments: ${(error as Error).message}`))
    }
    return { ok: true as const }
  })
}

/**
 * Prompts the panel itself started an agent with, for a short while: they are enhanced already, so
 * the auto-enhance hook lets them through (the host may run it on a launch's prompt like on any other).
 */
const LAUNCH_MEMORY_MS = 120_000
const launchedPrompts = new Map<string, number>()
function wasLaunchedHere(prompt: string): boolean {
  const now = Date.now()
  for (const [text, until] of launchedPrompts) if (until < now) launchedPrompts.delete(text)
  return launchedPrompts.has(terminalSafe(prompt).trim())
}

/** Projects whose context the hook is reading for the next prompt that goes there. */
const warming = new Set<string>()

/** What auto-enhance did last, for the Settings section: a prompt it let through unchanged says why. */
let lastHook: HookRecord | null = null
function noteHook(host: EnhanceWorker, record: Omit<HookRecord, 'at'>): void {
  lastHook = { at: Date.now(), ...record }
  if (record.outcome === 'skipped' && record.reason) host.panels.post('hook.skipped', { agent: record.agent, reason: record.reason })
}

/** The agent.prompt.before hook, and keeping its project context warm. */
function registerAutoEnhance(host: EnhanceWorker): void {
  host.panels.handle('hook.last', async () => lastHook ?? await host.storage.get('panel:hookLast') as HookRecord | null)

  host.hooks.on('agent.prompt.before', async (event, next) => {
    const started = Date.now()
    const settings = await readSettings(host)
    const prompt = event.prompt
    if (settings.autoEnhanceMode === 'off' || prompt.trim().length < settings.autoEnhanceMinLength) return
    if (wasLaunchedHere(prompt)) return
    if (settings.autoEnhanceMode === 'rules') {
      const append = settings.autoEnhanceAppend.trim()
      if (!append || prompt.includes(append)) return
      host.panels.post('hook.enhanced', { agent: event.agent, mode: 'rules' })
      noteHook(host, { outcome: 'appended', agent: event.agent })
      return next({ ...event, prompt: `${prompt.trimEnd()}\n\n${append}` })
    }
    try {
      const config = await loadModels(host)
      // The project the prompt goes to, which need not be the one in focus.
      const place = await hookPlace(host, event.terminalId)
      const items = settings.autoEnhanceContext ? hookContext(place, settings) : []
      // A project that is not in focus has not been read yet: read it now, for the next prompt that
      // goes there (this one has 2 s and goes with the workspace's name alone).
      if (settings.autoEnhanceContext && settings.privacy.allowProjectFiles && place?.workspace && isLocalWorkspace(place.workspace) && !cachedStatic(place.workspace.path, settings)) {
        const root = place.workspace.path
        // Once per project at a time: several tasks sent to one project start one read, not one each.
        if (!warming.has(root)) {
          warming.add(root)
          void staticParts(root, settings.extraContextFiles, true, settings.privacy.allowGit, undefined, undefined, settings)
            .catch(() => undefined)
            .finally(() => warming.delete(root))
        }
      }
      const rules =rulesFor(parseRulesConfig(await host.storage.get(RULES_KEY).catch(() => null)), place?.where ?? { workspace: null, project: null })
      const system = buildSystemPrompt({
        style: settings.defaultStyle,
        customInstructions: settings.customInstructions,
        agent: settings.adaptToAgent ? event.agent : null,
        rules
      })
      // Copilot helpers and CLIs take too long for the hook's two-second budget.
      const apiProfiles = config.profiles.filter(profile => profile.enabled && ['openai', 'anthropic'].includes(profile.provider))
      const hookProfileId = apiProfiles.some(profile => profile.id === config.hookProfileId) ? config.hookProfileId : null
      const list = candidates(apiProfiles, hookProfileId, settings.fallbackEnabled)
      if (list.length === 0) {
        // The panel's Auto-enhance section warns about this; the prompt goes through unchanged.
        host.log('auto-enhance skipped: no enabled API model (subscription CLIs are too slow for the hook)')
        noteHook(host, { outcome: 'skipped', agent: event.agent, reason: msg('hook.no_model') })
        return
      }
      const result = await runChain(
        host,
        list,
        system,
        buildUserMessage(prompt, items),
        chainOptions(settings, undefined, { totalMs: HOOK_BUDGET_MS - (Date.now() - started) })
      )
      // the host types the rewrite into the agent's terminal: no control characters from a model, and
      // never nothing in place of the prompt that was going out.
      const enhanced = terminalSafe(cleanOutput(result.text)).trim()
      if (!enhanced) {
        host.log('auto-enhance skipped: the model returned no prompt')
        noteHook(host, { outcome: 'skipped', agent: event.agent, reason: msg('hook.empty') })
        return
      }
      const model = result.attempts.find((attempt) => attempt.ok)?.model ?? result.profile.model
      void addHistory(host, settings, {
        original: prompt,
        enhanced,
        style: settings.defaultStyle,
        model,
        source: 'hook',
        ...(place?.where.project ? { project: place.where.project } : {})
      }).catch(() => undefined)
      host.panels.post('hook.enhanced', { agent: event.agent, mode: 'ai', model })
      noteHook(host, { outcome: 'rewritten', agent: event.agent, model })
      return next({ ...event, prompt: enhanced })
    } catch (error) {
      host.log(`auto-enhance skipped: ${(error as Error).message}`)
      // Why a model was too slow or a chain failed, as an English structured message.
      const reason = error instanceof ChainError || error instanceof LlmError ? error.text : raw((error as Error).message)
      noteHook(host, { outcome: 'skipped', agent: event.agent, reason })
      return
    }
  })

  // Keep the prompt-independent context warm, so the hook has it within its 2 s.
  let warmTimer: ReturnType<typeof setTimeout> | null = null
  host.events.on('workspace.changed', ({ context }) => {
    if (!context) return
    if (warmTimer) clearTimeout(warmTimer)
    warmTimer = setTimeout(async () => {
      try {
        const settings = await readSettings(host)
        const wantsHook = settings.autoEnhanceMode === 'ai' && settings.autoEnhanceContext
        if (!wantsHook && !atLeast(settings.contextLevel, 'standard')) return
        const workspace = await findFocusedWorkspace(host, context)
        if (workspace && isLocalWorkspace(workspace) && settings.privacy.allowProjectFiles) {
          await staticParts(workspace.path, settings.extraContextFiles, true, settings.privacy.allowGit, undefined, undefined, settings)
        }
      } catch (error) {
        host.log(`context warm-up: ${(error as Error).message}`)
      }
    }, 1500)
  })
}

/** Commands and the status bar item. */
function registerCommands(host: EnhanceWorker): void {
  host.commands.register('auto-enhance.cycle', async () => {
    const { autoEnhanceMode } = await readSettings(host)
    const next = AUTO_MODES[(AUTO_MODES.indexOf(autoEnhanceMode) + 1) % AUTO_MODES.length]
    await host.settings.set('autoEnhanceMode', next)
    await refreshStatusBar(host)
    return modeAnswer(next)
  })

  host.commands.register('auto-enhance.off', async () => setMode(host, 'off'))
  host.commands.register('auto-enhance.rules', async () => setMode(host, 'rules'))
  host.commands.register('auto-enhance.ai', async () => setMode(host, 'ai'))

  host.commands.register('status-bar.toggle', async () => {
    const all = await host.settings.get()
    const next = all.statusBarItem === 'hidden' ? 'full' : 'hidden'
    await host.settings.set('statusBarItem', next)
    await refreshStatusBar(host)
    return WORKER_WORDS.bar[next === 'hidden' ? 'hidden' : 'shown']
  })

  host.settings.onDidChange(({ key }) => {
    if (key === 'autoEnhanceMode' || key === 'statusBarItem') void refreshStatusBar(host)
  })
  void refreshStatusBar(host)
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

/** The agent kinds a new agent can be started with: ids as the host names them (letters, digits, - _). */
const AGENT_KIND = /^[a-z][a-z0-9_-]{0,31}$/

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

  /** Starts a new agent in the focused workspace with the enhanced prompt (Privacy, confirmed). */
  host.panels.handle('agent.launch', async ({ agent, prompt, workspaceId }) => {
    const settings = await readSettings(host)
    if (!settings.privacy.allowAgentLaunch) throw hostError(msg('error.launch_off'), 'not_permitted')
    if (!host.host.has('agent.launch')) throw hostError(msg('error.unsupported'), 'unavailable')
    if (typeof agent !== 'string' || !AGENT_KIND.test(agent)) throw hostError(msg('error.invalid_request'), 'invalid_params')
    const text = terminalSafe(String(prompt ?? '')).trim().slice(0, 20_000)
    if (!text) throw hostError(msg('error.nothing_to_send'), 'invalid_params')
    const id = await focusedWorkspaceId(host, workspaceId)
    if (!id) throw hostError(msg('note.no_workspace'), 'invalid_params')
    // This prompt is already enhanced: if the host runs the auto-enhance hook on it, it goes through as it is.
    launchedPrompts.set(text, Date.now() + LAUNCH_MEMORY_MS)
    const started = await host.host.call('agent.launch', { workspaceId: id, agent, prompt: text })
    // The new terminal is in that workspace: known from now on, before the host's first event about it.
    learnTerminal(host, started.terminalId, id)
    return started
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

/** After a long panel run: a desktop notification that names the model and time, never the prompt. */
async function notifyDone(host: EnhanceWorker, settings: Settings, model: string, ms: number): Promise<void> {
  if (!settings.notifyWhenDone || ms < NOTIFY_AFTER_MS || !host.host.has('notifications.show')) return
  const body = formatText('Enhanced prompt ready ({model}, {seconds} s)', { model, seconds: (ms / 1000).toFixed(0) })
  await host.host.call('notifications.show', { title: BRAND, body }).catch(() => undefined)
}
/** Shorter runs end while the person is still looking at the panel. */
const NOTIFY_AFTER_MS = 8000

export default function activate(host: EnhanceWorker): void {
  registerIntegrations(host)
  registerRunHandlers(host)
  registerModelHandlers(host)
  registerDataHandlers(host)
  registerAutoEnhance(host)
  registerCommands(host)
}
