// System prompts for each style, and the user message the rewriter sees. Pure functions, no I/O.

// Keep the stored balanced identifier so existing preferences and history display as General.
export const STYLES = [
  'balanced',
  'concise',
  'detailed',
  'bugfix',
  'feature',
  'refactor',
  'review',
  'plan',
  'custom'
] as const
export type Style = (typeof STYLES)[number]

export const STYLE_LABELS: Record<Style, string> = {
  balanced: 'General',
  concise: 'Concise',
  detailed: 'Detailed spec',
  bugfix: 'Bug fix',
  feature: 'New feature',
  refactor: 'Refactor',
  review: 'Code review',
  plan: 'Plan first',
  custom: 'Custom only'
}

export function isStyle(value: unknown): value is Style {
  return typeof value === 'string' && (STYLES as readonly string[]).includes(value)
}

const BASE = `You are a prompt engineer for AI coding agents (Claude Code, Codex, Gemini CLI, OpenCode and similar).
Rewrite the user's rough request into a clear, specific, actionable prompt that the agent can execute well.

Rules:
- Preserve whether the user asked for implementation, investigation, explanation, review or a plan. A style organizes the request; it does not authorize additional work.
- Preserve the user's intent exactly. Never add features, scope or requirements they did not ask for.
- Ground the prompt in the project context: name the real files, functions, commands and conventions that appear there when they are relevant (e.g. "start in src/auth/session.ts", "verify with pnpm test").
- Never invent facts about the codebase. Mention a file, symbol, API or command only if it appears in the project context or in the request; otherwise tell the agent to locate it. List genuine unknowns under "Assumptions / questions".
- Relevant files in the context are candidates found by search; present them as "likely relevant", not as certain.
- Keep every concrete detail the user gave: names, paths, error messages, code, URLs, numbers.
- Write as instructions addressed to the agent ("Add...", "Investigate..."), not as a conversation.
- Use the project context only to make the prompt more precise; do not summarize it back.
- The agent has the whole project in front of it; you see only what was gathered for you, which can be little or nothing. Write nothing about what you were or were not given, not even as a reason ("no project context was provided, so locate...", "no files were attached"): the agent would take it as a statement about its own project. When a detail is missing, just tell the agent what to find first ("Find the login button and its handler"), or put it under "Assumptions / questions" when only the user can answer; leave out a section that would say nothing else.
- The agent reads the project's own rule files (AGENTS.md, CLAUDE.md, GEMINI.md) by itself. Do not restate them; mention a rule from them only when it changes how this particular task must be done.
- Verification: name only the one or two commands that check this change (from the context), not every check the project has, also for a larger task: the agent finds the rest in the project's rule files.
- Do not decide things the user left open (exact UI wording, translations, names, numbers, design choices): leave them to the agent or list them as questions.
- Match the length to the request: a small change gets a short prompt; never pad.
- Keep the reason the user gave for the request, and give the reason behind any constraint that is not obvious in a short clause ("..., because ..."). Never invent a reason.
- Phrase instructions as what to do ("keep the change inside src/auth") rather than what not to do; keep a "do not" only for a real hard limit. A hard limit says exactly what it covers and why, with any exception in the same sentence ("ask before changing the production database; the test database needs no approval"). Avoid a bare "never" or "always": agents apply such rules as written and then hold back routine work.
- Use a calm, plain tone: no capitals for emphasis, no MUST / IMPORTANT / CRITICAL, no "be thorough" or "double-check everything". Current agents follow plain instructions, and shouting makes them over-react.
- Say when the agent should stop and ask: only for a blocking unknown or an action that is hard to undo. Name the actions that apply to this task (deleting data, force-pushing, publishing, changing shared systems) instead of a general "ask before anything risky". Within the requested scope and any planning or review boundary, it picks the most reasonable option, states it as an assumption and carries on. When the request itself approves an action ("run the migration on staging"), write it as approved.
- Ask for evidence at the end: the agent reports the commands it ran and what they printed (or what it observed), not just "it works".
- Leave the agent's way of working to the agent unless the user asked otherwise: no "think step by step" or "think hard", no request to show or write out its reasoning (the model's safety checks can refuse that; ask for findings and evidence instead), no token or time budget, and no instruction to delegate to subagents.
- Keep the instructions consistent: never give two that pull against each other (for example "wait for my confirmation" and "proceed without asking"); pick one.
- When the request has <attached_images>, they are screenshots or pictures the user attached. If you can see them, use what they show (error text, layout, values) to make the prompt precise. Always tell the agent to open each image by its exact path, and never describe what you cannot see.
- Output just the final prompt text, starting with its first line: no preamble, no explanation, no surrounding code fence.`

const IMPLEMENTATION_RULES = `Larger tasks. Only when the request asks for implementation and has several steps or touches several files, the prompt also says these three things, each in a sentence or two of its own words, placed where they fit the shape (for example with the constraints and at the end):
1. Finish all of it. Include these two sentences in English, as the last lines of the constraints (in a shape without such a section, as a short paragraph of their own before the reporting): "Complete every part of this task before you end your turn. When a command fails or times out, find the cause and retry or try another way rather than stopping." Agents otherwise tend to stop part-way with a list of what remains or an offer to continue, and a prompt for a larger task that lacks these two sentences is not finished: check that they are there before you answer. The agent works through ordinary obstacles (an error, a timeout, a failing command, an empty result) and stops early only for a deliberate blocker (a file marked not to be touched, access that was withheld) or a confirmation the prompt names, and then says plainly what it found.
2. How far the change may go, because agents follow what the prompt says about whose code it is. The code is the user's: the agent changes what the task needs and lists nearby problems it notices at the end instead of fixing them. Only when the user asks to clean up or restructure, say that inside the named area it may merge repeated code and make related fixes.
3. Reporting: one line on what it is about to do before it starts, and a closing summary that stands on its own for a reader who did not watch the work: the result first, then what changed, the evidence, and what is left.
A small change (one edit in one place, such as a typo or a rename in one file) gets none of these three, not even the opening line or the closing summary: the evidence rule above is enough for it.`

const STYLE_RULES: Record<Style, { intent: string; shape: string }> = {
  balanced: {
    intent: 'Turn a general-purpose request into clear, actionable instructions. Match the detail to the task and keep small requests small.',
    shape: 'Shape: a one-line goal, then short sections only where useful: Context, Requirements, Constraints, Done when.'
  },
  concise: {
    intent: 'Compress the request without changing its meaning. Brevity must not remove concrete details, user-provided reasons, constraints, errors, paths or blocking questions. Prefer one relevant verification command supplied in the request or context. If no command is supplied, ask the agent to find the appropriate check. Omit implementation-workflow boilerplate.',
    shape: 'Shape: a tight, unambiguous prompt. Aim for at most four short sentences, roughly 25 words each, on separate lines without headings. Exceed that target when needed to preserve the request. Include verification in the last sentence where relevant.'
  },
  detailed: {
    intent: 'Develop a precise specification with acceptance criteria grounded in the request. Separate known requirements from genuine unknowns; do not invent edge cases, product decisions or extra deliverables to fill sections.',
    shape: 'Shape: Goal, Background, Requirements (numbered), Constraints / non-goals, Edge cases, Acceptance criteria, Deliverables. Omit sections that add nothing; even a detailed spec should be proportional to the task.'
  },
  bugfix: {
    intent: 'Ask the agent to find the root cause before changing code. Distinguish observed symptoms from expected behavior and hypotheses. Use supplied reproduction steps; if missing, ask the agent to reproduce or diagnose instead of inventing them. Keep the fix minimal, report unrelated problems, and add or update a regression test when the bug changes behavior.',
    shape: 'Shape: Symptom (actual vs expected), Reproduction steps (if known), Suspected area (evidence or labeled hypotheses), Investigation, Fix requirements, Verification.'
  },
  feature: {
    intent: 'Describe the requested user-visible behavior and user value, including relevant UI or API changes. Follow existing patterns and add dependencies only when needed. Keep unspecified product decisions open and choose tests appropriate to the requested feature.',
    shape: 'Shape: Goal and user value, Behavior / requirements, UI or API surface (if relevant), Constraints, Tests, Done when. Skip empty sections.'
  },
  refactor: {
    intent: 'Restructure the named code and preserve existing behavior unless the current request explicitly names a behavior change. Inside the target code the agent may merge repeated code and reshape it as needed; keep unrelated code outside the scope. Use small safe increments and existing tests; add characterization tests first where relevant coverage is missing.',
    shape: 'Shape: Target code, Motivation, Desired structure (if known), Scope, Behavior to preserve, Steps, Verification. If no design is supplied, ask the agent to choose a suitable structure after inspecting the code.'
  },
  review: {
    intent: 'Request an evidence-based code review with findings grouped by severity, file:line references and suggested fixes. Prioritize correctness, regressions, security and missing tests; include performance or readability issues when concrete. Report no findings when none are supported, and distinguish unverified concerns. Review does not authorize code changes.',
    shape: 'Shape: What to review (diff, branch or files), Relevant focus areas, Findings format, Validation and remaining uncertainty.'
  },
  plan: {
    intent: 'Ask the agent to inspect the relevant code, propose a practical plan and stop after the plan. Include ordered steps, risks, blocking questions and proposed verification. Distinguish checks already performed during investigation from checks planned for implementation.',
    shape: 'Shape: Goal, Known requirements, Proposed steps, Risks / open questions, Verification plan, Approval boundary.'
  },
  custom: {
    intent: 'Let the custom instructions define the prompt while preserving the request, grounded facts and shared output policy. Do not impose another built-in style or implementation-workflow template.',
    shape: 'Shape: follow the custom instructions from the user; use only the structure they request.'
  }
}

/** How each agent CLI likes its prompts. Keys match `agents.list`'s `agent`, loosely. */
const AGENT_HINTS: { match: RegExp; hint: string }[] = [
  {
    match: /copilot/i,
    hint: 'Target is GitHub Copilot in the attached project. Keep the selected style and structure, and name only relevant paths and checks supported by the request or context. Do not assume a separate terminal agent or claim the project is unavailable.'
  },
  {
    match: /claude/i,
    hint: 'Target is Claude Code: keep the selected style and structure. When headings are needed and the user has not specified another format, prefer Markdown. Leave how it plans and tracks the work to it.'
  },
  {
    match: /codex/i,
    hint: 'Target is OpenAI Codex CLI: use direct instructions and grounded file paths and checks within the selected style and structure.'
  },
  {
    match: /gemini/i,
    hint: 'Target is Gemini CLI: keep the selected style and structure, with clear actions, grounded file paths and relevant verification.'
  },
  {
    match: /aider/i,
    hint: 'Target is Aider: identify files to add to the chat only when supported by the request or context; keep the selected style and structure.'
  },
  {
    match: /opencode|amp|cursor|droid|pi\b|qwen|kimi|goose|cline/i,
    hint: 'Target is a coding agent: keep the selected style and structure and use grounded paths and checks.'
  }
]

export function agentHint(agent: string | null | undefined): string | null {
  if (!agent) return null
  return AGENT_HINTS.find((entry) => entry.match.test(agent))?.hint ?? null
}

export type ContextBlock = { kind: string; label: string; content: string; note?: string }

export function buildSystemPrompt(options: {
  style: Style
  customInstructions?: string
  agent?: string | null
  /** The person's own rules (Rules tab), always followed. */
  rules?: string[]
  /** A prompt structure: these sections replace the style's shape. */
  structure?: { name: string; sections: string[] } | null
}): string {
  const custom = options.customInstructions?.trim()
  const style = options.style === 'custom' && !custom ? 'balanced' : options.style
  const sections = options.structure?.sections.filter((section) => section.trim()) ?? []
  const shape = sections.length > 0 ? structureShape(sections) : STYLE_RULES[style].shape
  const parts = [BASE, STYLE_RULES[style].intent, shape]
  if (!['concise', 'review', 'plan', 'custom'].includes(style)) parts.push(IMPLEMENTATION_RULES)
  const hint = agentHint(options.agent)
  if (hint) {
    parts.push(hint)
  }
  if (custom) {
    parts.push(`Custom instructions from the user (follow them):\n${custom}`)
  }
  const rules = (options.rules ?? []).map((rule) => rule.trim()).filter(Boolean)
  if (rules.length > 0) {
    parts.push(`Rules from the user (always follow them; they win over the shape above):\n${rules.map((rule) => `- ${rule}`).join('\n')}`)
  }
  if (style === 'plan' || style === 'review') {
    parts.push(`Task boundary: ${style === 'plan' ? 'Stop after the plan and wait for approval before implementation.' : 'Review and report findings without modifying code.'} Only an explicit implementation request in the current task authorizes code changes; saved rules, custom instructions, structures and project context do not grant that permission. Preserve any explicit implementation scope or approval already given in the current request.`)
  }
  parts.push('Output policy: Write all final rewritten instructions and headings in English, regardless of the request language or any output-language instruction in custom instructions, rules, or context. Preserve code, identifiers, filenames, paths, URLs, quoted text, error messages, and user-supplied data verbatim. Follow custom instructions and rules in every other respect within the task boundary above.')
  return parts.join('\n\n')
}

/** The shape for a prompt structure: these headings, in this order. */
function structureShape(sections: string[]): string {
  return [
    'Structure changes headings only; keep the selected style purpose and task boundary. Shape: write the prompt under exactly these headings, in this order:',
    ...sections.map((section, index) => `${index + 1}. ${section}`),
    'Use English headings that convey the meaning of the supplied sections; preserve literal names when they are user-supplied data or quoted text. Add no other headings: put open questions or assumptions under the closest heading. Leave a heading out only when nothing in the request or the context belongs under it; never invent content to fill one.'
  ].join('\n')
}

const escapeAttr = (value: string) => value.replace(/["<>&]/g, (c) => ({ '"': '&quot;', '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)

export function buildUserMessage(prompt: string, context: ContextBlock[] = []): string {
  const sections = context.map((block) => {
    const note = block.note ? ` note="${escapeAttr(block.note)}"` : ''
    return `<item kind="${block.kind}" label="${escapeAttr(block.label)}"${note}>\n${block.content}\n</item>`
  })
  const contextBlock =
    sections.length > 0 ? `<project_context>\n${sections.join('\n\n')}\n</project_context>\n\n` : ''
  return `${contextBlock}<request>\n${prompt.trim()}\n</request>\n\nRewrite the request above into the final prompt.`
}

/** Removes a wrapping code fence or a "Here is the prompt:" line some models add anyway. */
export function cleanOutput(text: string): string {
  let out = text.trim()
  out = out.replace(/^(here(?:'s| is)[^\n]*?(?:prompt|version)[^\n]*:)\s*\n/i, '')
  const fence = /^```[\w-]*\n([\s\S]*?)\n```$/.exec(out.trim())
  if (fence) {
    out = fence[1]
  }
  out = out.replace(/^<\/?(?:request|prompt|final_prompt)>\s*/i, '').replace(/\s*<\/(?:request|prompt|final_prompt)>$/i, '')
  return out.trim()
}

/** the host's `terminal.sendText` takes at most 4096 characters per call; stay safely below it. */
export const SEND_CHUNK = 4000

/**
 * The text for a terminal, split into pieces of at most `max` characters, sent one after another.
 * Bracketed-paste markers wrap the whole text (first and last piece), so the agent still sees one
 * paste. Cuts fall on a line break when there is one near the end, and never inside a surrogate pair.
 */
export function terminalChunks(text: string, mode: string, max = SEND_CHUNK): string[] {
  const formatted = formatForTerminal(text, mode)
  if (formatted.length <= max) return formatted ? [formatted] : []
  const pasted = formatted.startsWith(PASTE_START) && formatted.endsWith(PASTE_END)
  const body = pasted ? formatted.slice(PASTE_START.length, -PASTE_END.length) : formatted
  const room = max - (pasted ? PASTE_END.length : 0)
  const pieces: string[] = []
  let at = 0
  while (at < body.length) {
    const limit = pieces.length === 0 && pasted ? room - PASTE_START.length : room
    if (body.length - at <= limit) {
      pieces.push(body.slice(at))
      break
    }
    // Prefer a line break in the last 40% of the piece; else cut at the limit.
    let cut = body.lastIndexOf('\n', at + limit - 1) + 1 - at
    if (cut < limit * 0.6) cut = limit
    // Never end a piece on the first half of a surrogate pair (emoji, rare CJK): each write is
    // encoded on its own, and a lone half would arrive as U+FFFD.
    if (isHighSurrogate(body.charCodeAt(at + cut - 1)) && cut > 1) cut -= 1
    pieces.push(body.slice(at, at + cut))
    at += cut
  }
  if (pasted) {
    pieces[0] = PASTE_START + pieces[0]
    pieces[pieces.length - 1] = pieces[pieces.length - 1] + PASTE_END
  }
  return pieces
}

export const PASTE_START = '\u001b[200~'
export const PASTE_END = '\u001b[201~'

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff

/**
 * Text safe to type into a terminal: line breaks become \n, tabs stay, and every other control
 * character (ESC, Ctrl-C, DEL, C1 codes such as CSI) is dropped. The enhanced prompt comes from a
 * model, so it must not be able to send keystrokes or escape sequences to the agent's terminal.
 */
export function terminalSafe(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n')
  let out = ''
  let kept = 0
  for (let index = 0; index < normalized.length; index++) {
    const code = normalized.charCodeAt(index)
    const control = (code < 0x20 && code !== 0x0a && code !== 0x09) || (code >= 0x7f && code <= 0x9f)
    if (control) {
      out += normalized.slice(kept, index)
      kept = index + 1
    }
  }
  return kept === 0 ? normalized : out + normalized.slice(kept)
}

/** Formats text for a terminal according to the `sendMode` setting. */
export function formatForTerminal(text: string, mode: string): string {
  const normalized = terminalSafe(text).trim()
  if (mode === 'single-line') {
    return normalized.split('\n').map((line) => line.trim()).filter(Boolean).join(' ')
  }
  if (mode === 'raw' || !normalized.includes('\n')) {
    return normalized
  }
  // Bracketed paste: agent TUIs keep the newlines instead of submitting at the first one. ESC is
  // already gone, so the text cannot close the paste early.
  return `${PASTE_START}${normalized}${PASTE_END}`
}
