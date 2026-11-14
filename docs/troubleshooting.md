# Troubleshooting

**Canvas missing:** check Customize for both the plugin and extension. Restart the session after installing or updating. The desktop runtime must support canvas extensions; ordinary editor Copilot integrations do not host this package.

**Canvas fails to load:** rebuild with `npm run build`, then update the local plugin. Inspect the extension's logs through Copilot. A stale canvas should reconnect after extension reload; close and reopen if needed. The SDK is experimental, so report the installed app/runtime version with an issue.

**No rewriting model:** add one in Models. The plugin does not automatically consume Copilot's selected chat model. A subscription CLI must already be installed and signed in.

**API key unavailable:** Windows DPAPI protects saved keys for the current Windows account. Moving encrypted files to another account will not decrypt them. On other platforms use a subscription CLI or an environment key the host makes available.

**Send refused:** finish the current turn or answer Copilot's pending question in Copilot itself. Then try Send again. The plugin cannot override a blocked session. A canvas stays bound to the session that opened it.

**No project context:** confirm the session has a local working directory and that project/Git reads are enabled. Remote workspaces and inaccessible paths are omitted. Context level Off intentionally sends only your prompt and chosen instructions.

**Feature unavailable:** the current adapter does not read terminal scrollback, inspect other agents, launch separate CLI agents, observe editor saves, open editor tabs or show native notifications. Their controls are disabled. Copy and download remain available.
