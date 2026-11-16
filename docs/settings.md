# Settings

All preferences live inside the canvas. Prompt preferences include default style and context, custom instructions, extra context files, exclusions, model timeout and history limit. Model fallback is configured in Models. Rewritten instructions and headings use English; language instructions in custom rules cannot override this policy, while the rules' other guidance still applies.

Privacy switches are checked by the worker on every preview and enhancement, including AI-assisted selection and AI Test research. Unsupported controls are disabled in both the UI and backend.

**Send right after enhancing** is off by default and needs its explanation dialog. Once enabled, the **Enhance and send** button may send an unread result. The panel checks the original session, project and input, cancellation, and whether Copilot is idle. Closing the panel, editing the prompt or changing the destination prevents automatic sending. Request-box Enter keys never enhance or send. The result editor retains Ctrl/Cmd+Enter to send the reviewed text.

## Effort models

The Enhance composer has **Context Level**, **Style**, and **Effort**. Effort offers **Low**, **Medium**, and **High**; Medium is initially selected and the selection is remembered for the session. In **Settings > Effort models**, choose a model and a separate reasoning level for each tier. **Manage models** opens the profile editor; **Refresh models and reasoning** checks account access and the current catalog without generating text.

New installations use the recommended presets below. Existing assignments, including Auto, are preserved with model-default reasoning. Select **Use recommended presets** to replace all three pairs explicitly. Assignments are shared across sessions; drafts remain session-specific. Auto follows the first enabled profile and its current model; named selections stay pinned to their model ID.

| Effort | Recommended model | Reasoning |
| --- | --- | --- |
| Low | Claude Haiku 5.5 | Highest supported |
| Medium | GPT-6.1 Sol | High |
| High | Claude Opus 5.5 | Medium |

Recommendations require a unique exact model name or ID match in Copilot's eligible catalog. A missing model is an actionable error, not an invitation to substitute another model. Highest uses the highest advertised value among minimal, low, medium, high, xhigh and max; an unfamiliar vocabulary requires an explicit selection. Copilot determines which levels are supported. Unsupported saved levels remain visible so you can replace them.

A deleted or disabled assigned profile produces an error directing you to Settings. Upgrade retains existing Copilot assignments, but a reference to a retired external profile needs an explicit Copilot replacement. Fallback uses other enabled Copilot profiles at their own model-default reasoning; the result identifies the model and requested reasoning used. Unsupported or unapplied reasoning stops fallback. Delete everything resets the pairs to recommended presets and removes saved profiles.

The chosen reasoning reaches rewriting, AI Test research and AI-assisted file selection when it follows the selected effort. A separately configured selector uses its own model defaults. Context size is independent. Before inference, the helper checks both catalogs and reads back the applied model and reasoning; if Copilot changes or ignores an explicit level, that model receives no prompt.

The Enhance connection status reports account/catalog readiness, missing models or reasoning, and the last background failure. **Retry** checks metadata only and preserves your draft and result. Background authentication is verified when you actually enhance, so a successful refresh does not erase a previous helper failure. Sign in through Copilot's own account menu; this plugin never collects credentials. **Show Logs** includes status and safe error codes without account names or prompt content.

Normal Send submits a new message to the attached Copilot session. The plugin checks immediately before sending, then uses Copilot's queue; if activity starts during that small gap, the message waits instead of becoming an immediate interjection.

## Retired settings

Chat auto-enhance, API-key settings, completion notifications and periodic feedback requests have been removed. The **Feedback** issue link and **Show Logs** remain available when you choose to use them. Inactive saved chat-hook settings are retained for recovery, but no current hook or runtime feature reads them. See the [chat auto-enhance retirement note](chat-auto-enhance-retirement.md).
