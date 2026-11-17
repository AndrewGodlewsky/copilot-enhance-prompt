# Choosing a style

Start with **General**, the default. Keep the other eight choices: each serves a different task or output preference, so you can select a more specific one when it helps.

The three controls have different jobs:

- **Style** sets the purpose and emphasis of the rewritten instructions.
- **Context** controls how much permitted project information is gathered for the rewriter. It does not control how much work the destination agent must do.
- **Structure** replaces the default headings while retaining the selected style's purpose and task boundary.

## All nine styles

These styles are available in both prompt sets. **Settings → Prompt preferences → Use enhanced prompts** selects the separate revised instructions by default; uncheck it to use the original 0.11.2 instructions. [Prompt sets and their differences](enhanced-prompts.md).

| Style | Use it for | What it asks the rewriter to produce |
| --- | --- | --- |
| **General** | Everyday tasks, mixed requests, or when no other style fits | A clear goal and short sections only where useful. Small tasks stay small; explanations and investigations stay within their requested scope. |
| **Concise** | Short, direct instructions | Roughly four short sentences without headings by default. This is a target, not a limit that can discard details, reasons, errors, paths or constraints. Verification commands must come from the request or context; otherwise the agent is asked to find the right check. |
| **Detailed spec** | Changes with several requirements or acceptance conditions | A specification grounded in known requirements, with acceptance criteria and genuine unknowns. Empty sections are omitted rather than filled with invented features or edge cases. |
| **Bug fix** | A failure or behavior that differs from expectations | Observed versus expected behavior, reproduction when known, investigation before changes, a focused fix and appropriate regression coverage. Suspected causes remain hypotheses until verified. |
| **New feature** | A new capability or user-visible behavior | The requested behavior and user value, relevant UI/API surfaces, constraints, appropriate tests and completion criteria. Unspecified product decisions remain open. |
| **Refactor** | Improving existing code without changing its behavior | Target and motivation, scope, behavior to preserve, small steps and verification. Explicitly requested behavior changes remain explicit exceptions. |
| **Code review** | Assessing a diff, branch or files | Evidence-based findings grouped by severity, file/line references, suggested fixes and remaining uncertainty. Unsupported concerns are not reported as facts, and no findings is a valid result. Code changes require an explicit request in the current task. |
| **Plan first** | Working out an approach before implementation | Exploration, ordered steps, risks, blocking questions and a verification plan. The agent stops after the plan and waits for approval unless the current task explicitly requests implementation. A low-risk assessment alone does not authorize proceeding. |
| **Custom only** | Using your own instructions and format | Your custom instructions, without another built-in style or implementation-workflow template. Shared accuracy, intent preservation and English-output rules remain. With blank custom instructions, it falls back to General. |

General, Concise and Detailed spec differ mainly in presentation and depth. Bug fix, New feature, Refactor, Code review and Plan first express a task-specific workflow. Custom only supplies your own format. They all rewrite a prompt; none directly implements, reviews or plans the project on your behalf.

## Rules, structures and defaults

Custom instructions are shared across styles, even though the Enhance panel shows their editor under Custom only. Enabled rules from the Rules tab also apply, with project rules limited to their project. Saved instructions and context cannot silently authorize implementation in Plan first or Code review. An explicit implementation request in the current task is retained.

A selected structure changes headings, not the purpose of Bug fix, Refactor, Code review or Plan first. It can also replace Concise's default heading-free format. User rules can override formatting. The English-output policy still takes precedence over conflicting output-language requests while preserving supplied code, paths, quoted text and other data.

The canvas uses the selected style, or the default from Settings.

General was called Balanced before version 0.3.2. The stored identifier remains `balanced`, so existing defaults, selections and history continue to work. Their display label is now General; saved prompt text is not rewritten. Other saved default styles are preserved.

## Historical style review and current verification

The 0.3.2 review traced the selector, saved defaults, prompt builder, structure overrides, manual model chain, Copilot rewriting and AI hook. It corrected these conflicts:

- Structure selection previously discarded all style-specific instructions, including review and planning boundaries.
- Concise prioritized its length cap over user details and requested a verification command even without evidence for one.
- Agent-specific formatting hints could conflict with the chosen style or structure.
- Plan first allowed either waiting or proceeding on a low-risk judgment.
- Shared implementation boilerplate appeared in review, planning and custom prompts.
- Custom only referred to instructions even when none were supplied.

Automated coverage checks all nine styles, structure combinations, saved Balanced compatibility, custom data preservation, task boundaries and captured requests through Copilot. These checks verify the instructions and transport. They do not establish that every model obeys them on every request. Live prompt quality should be reviewed separately with representative tasks and the Copilot model you use. These account-backed requests can incur usage.
