# Settings

All preferences live inside the canvas. Prompt preferences include default style and context, custom instructions, extra context files, exclusions, model timeout, history limit and the text appended by Rules auto-enhance. Model fallback is configured in Models. Rewritten instructions and headings use English; language instructions in custom rules cannot override this policy, while the rules' other guidance still applies.

Privacy switches are checked by the worker on every preview, enhancement and prompt hook. Unsupported controls are disabled in both the UI and backend.

“Send right after enhancing” is off by default and needs its explanation dialog. Once enabled, the **Enhance and send** button may send an unread result. The panel checks the original session, project and input, cancellation, and whether Copilot is idle. Closing the panel, editing the prompt or changing the destination prevents automatic sending. Request-box Enter keys never enhance or send. The result editor retains Ctrl/Cmd+Enter to send the reviewed text.

## Effort models

The Enhance composer has **Context Level**, **Style**, and **Effort**. Effort offers **Low**, **Medium**, and **High**; Medium is initially selected and the selection is remembered for the session. In **Settings → Effort models**, assign each tier to an enabled profile and model. **Manage models** opens the existing profile editor and live catalog refresh controls.

On upgrade, all three assignments initially use the current model: the first upgrading canvas session's saved selection, including its model override, or the first enabled profile when Auto was selected. Environment profiles are included only when environment keys are permitted. Initialization is protected by the preferences transaction and never overwrites existing assignments; chat hooks do not initialize them. If no profile exists yet, the assignments use Auto, which follows the model order when a profile is added. Assignments are shared across sessions; drafts remain session-specific. Existing models, credentials, rules and history are preserved.

Named model selections are pinned to their model ID. Auto follows the first enabled profile and its current model. A deleted or disabled assigned profile produces an error directing you to Settings. A saved model absent from the latest catalog remains visible; its provider decides whether it is still available. Existing fallback settings apply within the same Copilot or external-provider route, and the result records actual attempts. Delete everything clears assignments back to Auto with the model profiles.

Effort only chooses the rewriting model. It does not change context size, the separately configured AI-assisted file selector, chat auto-enhance, or a provider's internal reasoning setting. No Haiku, GPT, Sonnet or Opus default is prescribed yet. Assigning the same model to multiple tiers produces the same model behavior.

Normal Send always submits a new Copilot message. There is no paste-without-Enter mode. The plugin checks immediately before sending, then uses Copilot's queue; if activity starts during that small gap, the message waits instead of becoming an immediate interjection.

The optional [auto-enhance hook](auto-enhance.md) can affect prompts entered directly into Copilot. Keep it off to preserve exact wording.
