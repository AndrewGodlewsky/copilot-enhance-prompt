# Troubleshooting

**Canvas missing:** check Customize for both the plugin and extension. Restart the session after installing or updating. The desktop runtime must support canvas extensions; ordinary editor Copilot integrations do not host this package.

**Canvas fails to load:** rebuild with `npm run build`, then update the local plugin. Inspect the extension's logs through Copilot. A stale canvas should reconnect after extension reload; close and reopen if needed. The SDK is experimental, so report the installed app/runtime version with an issue.

**No rewriting model:** select an available Copilot model in Models > Effort models. No profile setup is required. The plugin does not automatically consume Copilot's selected chat model. An assignment to a retired external profile needs an explicit replacement.

**Connection check seems unchanged:** a successful check keeps the connected status but updates the check number and completion time below it. The button reads Check connection when access is available, Retry connection after an access failure, or Refresh models for configuration problems. Checking never submits your request or verifies a full background rewrite. Show Logs includes check attempts and results. If Enhance is disabled, enter a request; empty or whitespace-only requests cannot be enhanced.

**Copilot account or model unavailable:** refresh the model list, check the existing sign-in and keep Fetch model lists online enabled. The helper must verify the same account and model access as the attached session. See [background rewriting](copilot-background-rewriting.md#if-it-is-unavailable).

**Send refused:** finish the current turn or answer Copilot's pending question in Copilot itself. Then try Send again. The plugin cannot override a blocked session. A canvas stays bound to the session that opened it.

**No project context:** confirm the session has a local working directory and that project/Git reads are enabled. Remote workspaces and inaccessible paths are omitted. Context level Off intentionally sends only your prompt and chosen instructions.

**Feature unavailable:** the current adapter does not read terminal scrollback, inspect other agents, observe editor saves or open editor tabs. Their controls are disabled. Copy and download remain available.
