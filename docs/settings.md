# Settings

All preferences live inside the canvas. Prompt preferences include default style and context, custom instructions, extra context files, exclusions, model timeout and history limit. Model fallback is configured in Models. Rewritten instructions and headings use English; language instructions in custom rules cannot override this policy, while the rules' other guidance still applies.

Privacy switches are checked by the worker on every preview and enhancement, including AI-assisted selection and AI Test research. Unsupported controls are disabled in both the UI and backend.

**Send right after enhancing** is off by default and needs its explanation dialog. Once enabled, the **Enhance and send** button may send an unread result. The panel checks the original session, project and input, cancellation, and whether Copilot is idle. Closing the panel, editing the prompt or changing the destination prevents automatic sending. Request-box Enter keys never enhance or send. The result editor retains Ctrl/Cmd+Enter to send the reviewed text.

## Effort models

The Enhance composer has **Context Level**, **Style**, and **Effort**. Effort offers **Low**, **Medium**, and **High**; Medium is initially selected and the selection is remembered for the session. In **Settings > Effort models**, assign each tier to an enabled Copilot profile and model. **Manage models** opens the profile editor and live catalog refresh controls.

Assignments are shared across sessions; drafts remain session-specific. Initial assignments use the current Copilot selection, or Auto when no profile exists. Initialization uses the preferences transaction and preserves existing assignments. Auto follows the first enabled profile and its current model; named selections stay pinned to their model ID.

A deleted or disabled assigned profile produces an error directing you to Settings. Upgrade retains existing Copilot assignments, but a reference to a retired external profile needs an explicit Copilot replacement. A saved model absent from the latest catalog remains visible; Copilot's current access checks determine whether it can run. Fallback uses other enabled Copilot profiles, and the result records actual attempts. Delete everything clears assignments back to Auto with the model profiles.

Effort only chooses the rewriting model. It does not change context size, the separately configured AI-assisted file selector, or a model's internal reasoning setting. No Haiku, GPT, Sonnet or Opus default is prescribed. Assigning the same model to multiple tiers produces the same model behavior.

Normal Send submits a new message to the attached Copilot session. The plugin checks immediately before sending, then uses Copilot's queue; if activity starts during that small gap, the message waits instead of becoming an immediate interjection.

## Retired settings

Chat auto-enhance, API-key settings, completion notifications and periodic feedback requests have been removed. The **Feedback** issue link and **Show Logs** remain available when you choose to use them. Inactive saved chat-hook settings are retained for recovery, but no current hook or runtime feature reads them. See the [chat auto-enhance retirement note](chat-auto-enhance-retirement.md).
