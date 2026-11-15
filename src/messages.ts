// Structured notes, context labels and errors shared by the worker, panel and diagnostics.
import { formatText } from './format.ts'

export const MESSAGES = {
  // Text from outside the plugin (a provider's error, a file name) stays verbatim.
  raw: '{text}',

  // Context notes: why something was left out.
  'note.no_workspace': 'No focused workspace.',
  'note.workspace_unknown': 'Could not tell which folder the workspace is in; project files skipped.',
  'note.remote': 'Remote (SSH/WSL) workspace: project files are not readable from the plugin.',
  'note.terminal_off': 'Terminal output is off in Settings.',
  'note.not_git': 'Git context is unavailable for this project. Local file search still works.',
  'note.git_off': 'Git access is off. Local file search still works.',
  'note.no_files': 'No files matched the prompt; the agent will be told to locate them.',
  'note.search_limited': 'Local content search reached its file, size, or time limit. Name relevant files in your request to prioritize them.',
  'note.project_files_off': 'Project files are off in Settings: workspace and agent only.',
  'note.preview_no_picker': 'Preview skips the AI file picker.',
  'note.picker_skipped': 'AI file picker skipped: {reason}',

  // Context item titles and why an item is there.
  'label.workspace': 'Workspace',
  'label.agent': 'Target agent',
  'label.stack': 'Stack & commands',
  'label.log': 'Recent commits',
  'label.diff': 'Uncommitted changes',
  'label.tree': 'Repository tree ({count} files)',
  'label.status': 'Git status ({count} changed)',
  'label.terminal': 'Recent output: {name}',
  'label.agents': 'Other agents in this workspace',
  'label.session': 'Other agent session: {name}',
  'label.activity': 'Recent agent activity',
  'label.saved': 'Files you saved lately',
  'why.keyword': 'keyword match',
  'why.ai': 'picked by AI',
  'why.trimmed': 'trimmed',

  // Errors and results.
  'error.no_prompt': 'Write a prompt first.',
  'error.effort': 'Choose Low, Medium, or High effort.',
  'error.effort_model': 'The model assigned to {effort} effort is unavailable. Choose an enabled model in Settings → Effort models.',
  'error.attachment_bad': 'That attachment could not be received; try attaching it again.',
  'error.attachment_missing': 'The attached file {name} is no longer there (attachments are kept for a day). Attach it again.',
  'error.file_too_large': '{name} is {size}; an attachment can be at most {max}.',
  'note.images_paths_only': 'This model cannot see images: it got their paths only, and the prompt lists them for the agent.',
  'error.cancelled': 'Cancelled.',
  'error.copilot_unavailable': 'Copilot background rewriting is unavailable. Restart or update GitHub Copilot and reopen this plugin. No separate SDK or runtime is installed.',
  'error.copilot_runtime': 'The plugin could not verify the desktop runtime. Open Show Logs and share the Copilot model discovery section.',
  'error.copilot_sdk': 'The required desktop SDK could not be loaded. Open Show Logs and share the Copilot model discovery section.',
  'error.copilot_catalog': 'Copilot could not return its model list. Try Refresh, then open Show Logs and share the Copilot model discovery section if it still fails.',
  'error.copilot_no_models': 'No eligible Copilot models were returned for this session. Check your Copilot sign-in and model access, then refresh. Show Logs includes the model discovery results.',
  'error.copilot_account': 'The background runtime could not verify the same GitHub account as this Copilot session. Check your existing Copilot sign-in. No prompt was sent.',
  'error.copilot_model': 'This model is not available through GitHub Copilot in both sessions. Refresh the model list and choose a Copilot model.',
  'error.copilot_images': 'This Copilot model does not report image support. Choose a model with image support or remove the images.',
  'error.copilot_usage': 'Copilot usage could not be saved. Check free disk space and plugin data-folder permissions, then open Show Logs. Any remaining helper files have been kept for recovery.',
  'error.send_off': 'Sending to Copilot is off in Settings.',
  'error.session_not_idle': 'Copilot is busy, waiting for your answer, or disconnected. Wait until the session is idle before sending.',
  'error.send_pending': 'A prompt was just sent. Wait for Copilot before sending again.',
  'error.launch_off': 'Starting new agents is off in Settings, or not confirmed yet.',
  'error.open_off': 'Opening files in Copilot is off in Settings.',
  // Shown inside "Could not load the list (…)": no capital, no full stop.
  'error.lists_off': 'online model lists are off in Settings',
  'error.key_not_saved': 'Copilot could not store the API key: this machine has no key store for it. Use a key from an environment variable, or a subscription CLI.',
  'error.agent_blocked': '{name} is waiting for an answer from you, and what is typed now could be taken as that answer.',
  // Why auto-enhance let a prompt through unchanged (the Settings section shows the last one).
  'hook.no_model': 'No enabled API model: Copilot helpers and subscription CLIs are excluded from the two-second chat hook.',
  'hook.empty': 'The model returned no prompt.',
  'error.unsupported': 'This version of Copilot cannot do that yet.',
  'error.invalid_request': 'Invalid request.',
  'error.nothing_to_send': 'Nothing to send.',
  'error.invalid_profile': 'Invalid model profile.',
  'error.unknown_profile': 'Unknown profile.',
  'result.test_ok': '{name} · {model} answered (key: {key}).',
  'error.bad_url': 'Invalid API base URL: {url}',
  'error.https_only': 'The API base URL must use https (http is allowed only for localhost).',
  'error.key_in_url': 'Put the API key in the Models tab, not in the URL.',
  'error.timeout': 'The request was cancelled or timed out.',
  'error.model_timeout': '{model} did not answer within {seconds} s.',
  'error.too_slow': '{reason} A lower context level or a faster model answers sooner.',
  'error.run_gone': 'That run is no longer going (the plugin was restarted). Try again.',
  'error.stopped': '{url} stopped answering: {detail}',
  'error.not_json': '{url} did not answer with JSON ({what}). A proxy or sign-in page may be in the way.',
  'error.empty_body': 'an empty answer',
  'error.no_key': 'No API key. Add one in the Enhance Prompt panel (Models tab).',
  'error.no_key_env': 'No API key. Add one in the Enhance Prompt panel (Models tab) or set {env}.',
  'error.unreachable': 'Could not reach {url}: {detail}',
  'error.http': '{status}: {detail}',
  'error.empty_answer': 'The model returned an empty answer.',
  'error.cut_off': '{model} reached its limit of {max} tokens before it finished. Raise Max tokens for this model in the Models tab.',
  'error.refused': '{model} declined this request ({category}). Use another model, or rephrase the request.',
  'error.unsafe_argument': 'Unsafe argument for a .cmd launcher.',
  'error.cli_missing': '{name} was not found. Install it and sign in, or set its full path in the model.',
  'error.cli_start': 'Could not start {binary}: {detail}',
  'error.cli_exit': '{kind} exited with {code}',
  'error.cli_exit_detail': '{kind} exited with {code}: {detail}',
  'error.cli_sign_in': '{text} (run it once in a terminal to sign in)',
  'error.cli_empty': '{kind} returned an empty answer.',
  'error.no_model': 'No model configured. Add one in the Models tab.',
  'error.profile_no_key': '{name}: no API key',
  'error.all_failed': 'All models failed. {list}',
  'error.attempt': '{name}: {reason}',
  'error.out_of_time': 'Out of time.'
} as const

export type MessageCode = keyof typeof MESSAGES
export type MessageParam = string | number | Message | MessageParam[]
/** Plain JSON: it travels as it is in a request's output, and inside the text of a thrown error (below). */
export type Message = { code: MessageCode; params?: Record<string, MessageParam> }

/**
 * A thrown error reaches the panel as its code and its text only: the host passes no other field on.
 * So the message travels inside the text: the English sentence (for logs and the command line),
 * then the message itself between these marks, as percent-encoded JSON: it then holds no bracket
 * and no space, so whatever a provider's own text contains, the marks are found again. The panel
 * reads it back for structured error handling; where the marks did not survive, the sentence
 * alone is shown.
 */
const WIRE_OPEN = ' [[message:'
const WIRE_CLOSE = ']]'

/** The text of an error that carries `message` to the panel. */
export function withMessage(message: Message): string {
  return `${english(message)}${WIRE_OPEN}${encodeURIComponent(JSON.stringify(message))}${WIRE_CLOSE}`
}

/** The message an error's text carries, or null when it carries none. */
export function messageIn(text: string): Message | null {
  const at = text.lastIndexOf(WIRE_OPEN)
  if (at < 0 || !text.endsWith(WIRE_CLOSE)) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(text.slice(at + WIRE_OPEN.length, text.length - WIRE_CLOSE.length)))
    return isMessage(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** An error's text without what it carries: the sentence a person or a log reads. */
export function plainText(text: string): string {
  const at = text.lastIndexOf(WIRE_OPEN)
  return at < 0 ? text : text.slice(0, at)
}

export function msg(code: MessageCode, params?: Record<string, MessageParam>): Message {
  return params ? { code, params } : { code }
}

/** Text from outside the plugin, shown as is. */
export const raw = (text: string): Message => ({ code: 'raw', params: { text } })

export function isMessage(value: unknown): value is Message {
  return Boolean(value) && typeof value === 'object' && typeof (value as Message).code === 'string' && (value as Message).code in MESSAGES
}

/**
 * Renders an English message, including nested errors. Lists join with " · ".
 */
export function render(message: Message): string {
  const param = (value: MessageParam): string => {
    if (Array.isArray(value)) return value.map(param).join(' · ')
    if (isMessage(value)) return render(value)
    return String(value)
  }
  const params: Record<string, string> = Object.create(null)
  for (const [key, value] of Object.entries(message.params ?? {})) params[key] = param(value)
  return formatText(MESSAGES[message.code], params)
}

/** The English text: for logs, error messages and the model. */
export function english(message: Message): string {
  return render(message)
}
