import { formatText } from '../format.ts'
// view.ts: what the panel shows, as plain data (labels, options, progress text, the small decisions
// about what to offer). The web panel (web/src) draws it; the tests check it.
import { read } from '#panel'
import { parseModelAssignment, parseCatalogAssignment, catalogAssignment, RECOMMENDED, resolveEffort, type Effort } from '../effort.ts'
import { CONTEXT_LEVEL_LABELS, CONTEXT_LEVELS, isContextLevel, type ContextItemView } from '../presets.ts'
import { isStyle, STYLE_LABELS, STYLES } from '../prompts.ts'
import { BRAND } from '../brand.ts'
import type { HistoryEntry } from '../history.ts'
import { allStructures, ruleApplies, scopeName, scopeNeedsReview, structureById, type Rule, type RulesConfig } from '../rules.ts'
import { ESTIMATED_STEPS, stepPercent, type Step } from '../progress.ts'
import type { PrivacyKey } from '../privacy.ts'
import { effectiveEffort, effortReasoning } from './state.ts'
import { type Catalog, type Run, type Target, catalogs, defaults, enabledProfiles, effectiveLevel, effectiveStyle, effortModels, models, projectName, rulesState, structureChoice, say, workspaceName } from './state.ts'

/**
 * The names of the panel's sections, on its header icons (the Enhance section shows the brand instead).
 * The gear's section is still `privacy` inside (people's panels remember the open section by that id),
 * but it is named Settings: besides the access switches it holds prompt preferences, stored data and
 * feedback. A message that sends the person there says "in Settings" (src/messages.ts).
 */
export const SECTION_LABELS: Record<string, string> = { history: 'History', models: 'Models', rules: 'Rules', privacy: 'Settings' }

export function modelOptions(catalog: Catalog | undefined, current: string) {
  const options = (catalog?.models ?? []).map((model) => ({
    value: model.id,
    label: model.isDefault ? `${modelName(model.id, model.label, model.description)} · ${'your default'}` : modelName(model.id, model.label, model.description)
  }))
  if (current && !options.some((option) => option.value === current)) options.unshift({ value: current, label: current })
  return options
}

export const styleOptions = () => STYLES.map((value) => ({ value, label: STYLE_LABELS[value] }))
export const levelOptions = (current?: string) => CONTEXT_LEVELS.filter(value => value !== 'basic' || current === 'basic').map((value) => ({ value, label: CONTEXT_LEVEL_LABELS[value] }))
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

/**
 * How long a run has taken, for its card: up to `now` while it runs, then up to its end. Never below
 * zero: the worker's clock starts a moment after the panel's, and "-0.0 s" must not show.
 */
export function runSeconds(current: Pick<Run, 'status' | 'startedAt' | 'finishedAt'>, now: number): string {
  const end = current.status === 'running' ? now : (current.finishedAt ?? now)
  return seconds(Math.max(0, end - current.startedAt))
}

/** No enabled Copilot model has been configured yet. */
export function modelWarning(): 'no-model' | null {
  if (read(models) === null) return null
  const assignment = read(effortModels)[read(effectiveEffort)]
  return assignment !== 'recommended' && !parseCatalogAssignment(assignment) && read(enabledProfiles).length === 0 ? 'no-model' : null
}

/** "sonnet: Sonnet, newest" -> "Sonnet, newest"; display names stay as they are. */
export const modelDisplay = (label: string) => (label.includes(': ') ? label.slice(label.indexOf(': ') + 2) : label)

/** Aliases ("sonnet: Sonnet, newest") read "sonnet — Sonnet, newest"; named models read "Fable 5.1 — For…". */
export function modelName(id: string, label: string, description?: string): string {
  if (label.includes(': ')) return `${id} — ${modelDisplay(label)}`
  const short = description ? (description.length > 42 ? `${description.slice(0, 40)}…` : description) : ''
  return short ? `${label} — ${short}` : label
}

/** Composer names: "Fable 5.1", "GPT-6.1-Sol", or for an alias "sonnet (latest)". */
export function shortModelName(id: string, label: string): string {
  if (label.includes(': ')) return `${id} (${'latest'})`
  return label || id
}

/** Context item names and kinds come from the worker in English; show them in English. */
export function contextKind(kind: string): string {
  const kinds: Record<string, () => string> = {
    workspace: () => 'workspace',
    agent: () => 'agent',
    rules: () => 'rules',
    stack: () => 'stack',
    tree: () => 'tree',
    git: () => 'git',
    file: () => 'file',
    terminal: () => 'terminal',
    agents: () => 'agents',
    session: () => 'agent session',
    activity: () => 'activity',
    saved: () => 'saved files'
  }
  return kinds[kind]?.() ?? kind
}

/** Why an item is in the context (keyword match, picked by AI, trimmed), after a separator. */
export function itemWhy(item: ContextItemView): string {
  if (item.why) return ` · ${say(item.why)}`
  return item.note ? ` · ${item.note}` : ''
}

export const STEP_LABELS: Record<Step['key'], string> = {
  workspace: 'Reading workspace',
  project: 'Reading project rules and stack',
  git: 'Reading git changes',
  search: 'Finding relevant code',
  pick: 'AI picking files',
  research: 'AI Test researching context',
  terminal: 'Reading terminal output',
  agents: "Reading other agents' sessions",
  model: 'Writing the prompt'
}
export const STEP_GLYPH: Record<Step['status'], string> = { pending: '○', running: '●', done: '✓', skipped: '–', failed: '✕' }

export function stepText(entry: Step): string {
  const label = STEP_LABELS[entry.key]
  if (!entry.detail) return label
  const count = Number(entry.detail)
  if (entry.key === 'workspace' || entry.key === 'model' || !Number.isFinite(count)) return `${label} · ${entry.detail}`
  if (entry.key === 'terminal') return `${label} · ${formatText('{count} lines', { count })}`
  if (entry.key === 'git') return `${label} · ${formatText('{count} changed', { count })}`
  if (entry.key === 'agents') return `${label} · ${formatText('{count} agents', { count })}`
  return `${label} · ${formatText('{count} files', { count })}`
}

/** A step's share as shown: "≈" when estimated from time, "–" when skipped. */
export function stepShare(entry: Step, now: number): string {
  const share = stepPercent(entry, now)
  if (share === null) return '–'
  const estimated = entry.status === 'running' && entry.fraction === undefined && ESTIMATED_STEPS.has(entry.key)
  return `${estimated ? '≈' : ''}${share}%`
}

/** The word before ":" in a level label: "Deep: + git…" → "Deep". */
export const shortLabel = (label: string) => label.split(/[:：]/)[0].trim()

/** An agent's state as the host reports it, in words for the terminal picker. */
export const AGENT_STATE_LABELS: Record<string, string> = { working: 'working', blocked: 'needs you', waiting: 'waiting', done: 'done' }

/** A terminal as the picker and the notices name it: an agent by its title and its state, in English. */
export function targetLabel(item: Target): string {
  if (!item.title || !item.state) return item.label
  const state = AGENT_STATE_LABELS[item.state]
  return `${item.title} · ${state ? state : item.state}`
}

const two = (value: number) => String(value).padStart(2, '0')
/** A moment as `2026-11-13 14:05`, in the machine's own time: locale independent, and it sorts. */
export function stamp(at: number): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

/** The name offered for a saved file: what it is and when, so that two saves do not collide. */
export function exportName(kind: 'prompt' | 'history', now = Date.now()): string {
  return `${kind === 'history' ? 'enhance-prompt-history' : 'prompt'}-${stamp(now).replace(' ', '-').replace(':', '')}.md`
}

/** A text as a Markdown code block, whatever it holds: the fence is longer than any run of backticks in it. */
export function fenced(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}text\n${text}\n${fence}`
}

/**
 * History entries as one Markdown document, in the order given: each with when, where and how it
 * was made, the request, and the enhanced prompt. The texts are in code blocks, so a prompt's own
 * headings do not become headings of the document.
 */
export function historyMarkdown(entries: readonly HistoryEntry[], now = Date.now()): string {
  const parts = [`# ${BRAND}: ${'History'}`, formatText('Saved {when} · {count} prompts', { when: stamp(now), count: entries.length })]
  for (const entry of entries) {
    const facts = [stamp(entry.at), entry.project ?? '', STYLE_LABELS[isStyle(entry.style) ? entry.style : 'balanced'], entry.model, entry.source === 'hook' ? 'auto' : '']
    parts.push(`## ${facts.filter(Boolean).join(' · ')}`, `### ${'Your prompt'}`, fenced(entry.original), `### ${'Enhanced prompt'}`, fenced(entry.enhanced))
  }
  return `${parts.join('\n\n')}\n`
}

/** One line naming the current options, used as the options button's tooltip. */
export function optionsSummary(): string {
  const styleValue = read(effectiveStyle)
  const levelValue = read(effectiveLevel)
  return [
    STYLE_LABELS[isStyle(styleValue) ? styleValue : 'balanced'],
    shortLabel(CONTEXT_LEVEL_LABELS[isContextLevel(levelValue) ? levelValue : 'standard'])
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The saved rules and structures, as the panel edits them. */
export const rulesConfig = (): RulesConfig => read(rulesState)

/**
 * The rules followed in the focused project, in their saved order: its own, the ones for every
 * project, and older ones kept under the workspace's name. Other projects' rules stay hidden.
 */
export function rulesHere(): Rule[] {
  const where = { workspace: read(workspaceName), project: read(projectName) }
  // Ambiguous legacy rules stay visible for recovery, but rulesFor never applies them.
  return rulesConfig().rules.filter((rule) => ruleApplies(rule, where) || scopeNeedsReview(rule.scope))
}

/** Where a rule is followed, as its row says it. */
export const ruleScopeLabel = (rule: Pick<Rule, 'scope'>): string => scopeNeedsReview(rule.scope)
  ? 'Not applied: the saved project path may be incomplete. Re-add this rule for the intended project, then remove the old rule.'
  : rule.scope ? formatText('Only {name}', { name: scopeName(rule.scope) }) : 'everywhere'

/**
 * Where a rule added now would go, as the composer says it: this project, or every project while
 * it is not known which project this is.
 */
export function newRuleLabel(): string {
  const project = read(projectName)
  return project ? formatText('Only {name}', { name: project }) : 'Every project'
}

/** "By style" plus every built-in and saved structure. */
export function structureOptions() {
  const config = rulesConfig()
  return [
    { value: 'style', label: 'By style' },
    ...allStructures(config).map(({ structure }) => ({ value: structure.id, label: structure.name }))
  ]
}

/** The picked structure, or "By style" when it was deleted. */
export function structureValue(): string {
  const id = read(structureChoice)
  return id && structureById(rulesConfig(), id) ? id : 'style'
}

/** Keep an assignment visible even when its catalog is stale or its profile was removed. */
export function effortModelOptions(effort: Effort) {
  const options = [{ value: 'recommended', label: `Recommended: ${RECOMMENDED[effort].name}` }]
  const catalog = read(catalogs).copilot
  if (!catalog?.error) for (const model of catalog?.models ?? []) {
    const value = catalogAssignment(model.id)
    if (parseCatalogAssignment(value) && !options.some(option => option.value === value)) options.push({ value, label: model.label })
  }
  const value = read(effortModels)[effort]
  if (read(enabledProfiles).length || value === 'auto') options.push({ value: 'auto', label: 'First enabled advanced profile' })
  if (!options.some(option => option.value === value)) {
    const assignment = parseModelAssignment(value)
    const profile = read(enabledProfiles).find(profile => profile.id === assignment?.profileId)
    options.push({ value, label: profile
      ? `${profile.name} · ${assignment?.model || 'Profile default'} (saved)`
      : 'Unavailable assignment — choose a model' })
  }
  return options
}

export function effortModelLabel(effort: Effort): string {
  const value = read(effortModels)[effort]
  try {
    const resolved = resolveEffort(effort, value, read(effortReasoning)[effort], read(enabledProfiles), read(catalogs).copilot)
    const label = read(catalogs).copilot?.models.find(model => model.id === resolved.profile.model)?.label ?? resolved.profile.model
    return `${label} / ${resolved.reasoningEffort ? `${resolved.reasoningEffort} reasoning` : 'model default reasoning'}`
  } catch { /* The status below explains missing access or unsupported settings. */ }
  const option = effortModelOptions(effort).find(option => option.value === value)!
  if (value !== 'auto') return option.label
  const first = read(enabledProfiles)[0]
  return first ? `${first.name} · ${first.effectiveModel} (${option.label})` : 'Select a Copilot model in Models'
}

/** The switches in three groups, as the Settings section shows them: what is read, what is done, what is kept or fetched. */
export type PrivacyGroup = 'reads' | 'acts' | 'keeps'
export const PRIVACY_GROUPS: { id: PrivacyGroup; title: string }[] = [
  { id: 'reads', title: 'What it may read' },
  { id: 'acts', title: 'What it may do' },
  { id: 'keeps', title: 'What it may keep and fetch' }
]

/**
 * One row per switch. `hint` says what it does and is always shown; `risk` and `when` (what can go
 * wrong, and when turning it on is worth it) are in the row's Details, and in the dialog of a
 * switch that asks to confirm.
 */
export type SwitchRow<Key extends string = string> = { key: Key; group: PrivacyGroup; label: string; hint: string; risk: string; when: string }
export const PRIVACY_ROWS: SwitchRow<PrivacyKey>[] = [
  {
    key: 'allowProjectFiles',
    group: 'reads',
    label: 'Read project files',
    hint: 'Agent rules, README, manifest files and the file list of the focused workspace (Standard level and above). Off: only workspace and agent names are used.',
    risk: 'File and folder names, your agent rules, the README and manifest files go to the model you run. Files that look like secrets (.env, keys, certificates) are never read.',
    when: 'Keep it on for prompts that name real files and commands. Turn it off in a project whose contents must not reach Copilot.'
  },
  {
    key: 'allowGit',
    group: 'reads',
    label: 'Run git',
    hint: 'Read-only git status, log, diff, ls-files and grep in the focused workspace (Deep and Max levels).',
    risk: 'Branch names, commit subjects, the list of changed files and the diff of your uncommitted changes go to the model. Nothing in the repository is changed.',
    when: 'On when a prompt should know what you are working on right now. Off when uncommitted changes may hold something you would not share.'
  },
  {
    key: 'allowTerminalRead',
    group: 'reads',
    label: 'Read terminal output',
    hint: 'The last lines of the terminal you picked, at the Max level only.',
    risk: 'A terminal shows whatever was printed: paths, logs, data. Values that look like keys, tokens or passwords are masked first, which cannot catch everything.',
    when: 'On to fix an error that is on screen in the terminal. Off when your terminals show secrets or customer data.'
  },
  {
    key: 'allowOtherAgents',
    group: 'reads',
    label: "Read other agents' sessions",
    hint: "At the Max level: the other agents running in this workspace (kind, title, state) and the last lines of their terminals, with keys and passwords masked. Needs Read terminal output too. Off until you turn it on.",
    risk: 'Terminals you did not pick are read too, and their text goes to the model: code, file contents and command output of other work.',
    when: 'On when several agents share a task and a new prompt must not repeat or undo their work. Otherwise leave it off.'
  },
  {
    key: 'allowAgentActivity',
    group: 'reads',
    label: 'Watch what agents do',
    hint: 'Deep and Max levels: each tool an agent runs in Copilot (its name and its target: a file path or a command, never its output) and how sessions end. Kept in memory for 45 minutes, never saved to disk.',
    risk: 'Tool names, file paths and command lines of every agent in Copilot are kept in memory and sent with Deep and Max prompts. A command line can carry more than you expect.',
    when: 'On when prompts should follow on from what the agents just did. Off when command lines may hold secrets.'
  },
  {
    key: 'allowEditorSaves',
    group: 'reads',
    label: 'Notice files you save',
    hint: "Deep and Max levels: the paths of files you save in Copilot's editor (never their text), kept in memory for 45 minutes; they rank first in the code search.",
    risk: 'Only paths are noted, never the text of a file. A path can still say what you are working on.',
    when: 'On when you edit in Copilot and want those files found first. It changes nothing if you edit elsewhere.'
  },
  {
    key: 'allowTerminalSend',
    group: 'acts',
    label: 'Send to Copilot',
    hint: 'Send a new message to the attached Copilot session when you click Send. Off: use Copy instead.',
    risk: 'Send starts a new Copilot turn. Busy, blocked, disconnected and unknown sessions refuse the message.',
    when: 'On for the normal flow. Off to be sure nothing is ever typed for you: Copy still works.'
  },
  {
    key: 'allowOpenFiles',
    group: 'acts',
    label: 'Open files in Copilot',
    hint: 'Clicking a file in the context list opens it in an editor tab.',
    risk: "An editor tab opens in Copilot's window. Nothing is read or changed by it.",
    when: 'On to look at what was read before you send. Off if the panel should never change what Copilot shows.'
  },
  {
    key: 'saveHistory',
    group: 'keeps',
    label: 'Save history',
    hint: 'Keep your prompts and enhanced prompts in the History tab, on this machine only.',
    risk: "Prompts, results and context are saved as plain text in the plugin data folder. Drafts are separated by Copilot session.",
    when: 'On to reuse earlier prompts and to find your draft again after a restart. Off on a shared machine, or when prompts hold things that must not be kept.'
  },
  {
    key: 'allowOnlineModelLists',
    group: 'keeps',
    label: 'Fetch model lists online',
    hint: 'Refresh the Copilot model list and verify model access before rewriting.',
    risk: 'Model-list requests use your Copilot account. List refreshes send no prompt or project context.',
    when: 'On to see new models without updating the plugin. Off for no network traffic besides the model calls.'
  }
]

/**
 * "Send right after enhancing": drawn like the switches above, under "What it may do", and it always
 * asks to confirm. The panel keeps it itself (state.ts: sendAfterEnhance): a new setting in the
 * manifest would make the host ask every user to approve the update again.
 */
export const SEND_AFTER_ROW: SwitchRow<'sendAfterEnhance'> = {
  key: 'sendAfterEnhance',
  group: 'acts',
  label: 'Send right after enhancing',
  hint: 'Adds an Enhance and send button that sends a new Copilot message without review. The Enhance button stops at the result. Off until you turn it on.',
  risk: 'Copilot acts on a prompt you have not read. A model can misunderstand your request or add an unwanted step.',
  when: 'On for small, low-risk requests, with an agent that asks before it does anything hard to undo. Leave it off when the agent runs with wide permissions, or when a wrong instruction would be costly.'
}

/** Every switch the Settings section draws, by its key. */
export const switchRow = (key: string | null): SwitchRow | null => [...PRIVACY_ROWS, SEND_AFTER_ROW].find((row) => row.key === key) ?? null

/**
 * What the person reads before turning on a switch that needs confirmation: what it reads or does,
 * where that goes, what stays, and how to stop it. Nothing is left out.
 */
export const DISCLOSURES: Partial<Record<PrivacyKey | 'sendAfterEnhance', string[]>> = {
  sendAfterEnhance: [
    'Adds an Enhance and send button next to Enhance. Clicking it enhances the prompt and sends the result as a new Copilot message. Enhance stops at the result.',
    'Automatic sending requires the same attached session and project, an idle session, and unchanged input. Closing or cancelling the run prevents sending.',
    'Whenever one of these does not hold, nothing is sent: the result stays in the composer with a note that says why, and you send it yourself.',
    'It needs "Send to Copilot" to be on, and the checks of that switch still apply.'
  ],
  allowOtherAgents: [
    'Reads which other agents run in this workspace (kind, title, state) and the last lines of each one\'s terminal, every time you enhance at the Max level: as many agents and lines as you set below the switch (4 agents and 80 lines by default, at most 8 and 300).',
    'That text is sent with your prompt to the Copilot model you run. It can contain code, file contents, command output and anything the agents printed.',
    'Values that look like keys, tokens or passwords are masked first, but masking cannot catch everything.',
    'Nothing of it is saved by the plugin. You can untick it in the context list for one run, or turn this switch off at any time.'
  ],
  allowAgentActivity: [
    'Copilot tells the plugin each tool an agent runs in its terminals: the tool name and what it acted on (a file path, a command line, a search pattern or a URL), never the tool\'s output. Copilot also tells it when a session finishes and how.',
    'This is kept in the plugin\'s memory only, for 45 minutes and 60 entries per workspace, and forgotten when you turn this off, delete everything, or Copilot restarts.',
    'At the Deep and Max levels, the recent entries of the focused workspace are sent with your prompt to the model you run. Command lines are masked for obvious keys and passwords.',
    'The plugin only watches: it never changes or blocks what an agent does.'
  ]
}

/** The plugin's issue page, in the browser (the host asks before opening a site the first time). */
export const REPOSITORY_URL = 'https://github.com/AndrewGodlewsky/copilot-enhance-prompt'
export const ISSUES_URL = `${REPOSITORY_URL}/issues/new`
