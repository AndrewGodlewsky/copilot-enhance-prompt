# Background rewriting through GitHub Copilot

All model work uses GitHub Copilot. The integration imports the desktop-supplied `@github/copilot-sdk` and launches the same executable that is already running the extension. Users install the normal plugin package; they do not run npm, install an SDK, or download a second runtime. The SDK is external to our bundle and is loaded when model access is needed.

## Data and account flow

```mermaid
sequenceDiagram
    participant Panel as Enhance Prompt canvas
    participant Worker as Prompt builder
    participant Host as Attached Copilot session
    participant Helper as Disposable Copilot helper
    participant API as GitHub Copilot model service
    participant Usage as Local accounting records
    participant Insights as Usage Insights
    Panel->>Worker: Request, selected Copilot model, privacy choices
    Worker->>Worker: Build rewrite instructions and permitted context
    Worker->>Helper: Start with desktop SDK/runtime in empty directory
    Worker->>Host: Read account and current Copilot catalog
    Worker->>Helper: Check same account, eligible model, empty tools, isolated directory
    alt Checks fail or user cancels
        Worker->>Worker: Record failure; no model request
    else Checks pass
        Worker->>Helper: Prepared prompt and explicit attachment bytes
        Helper->>API: Rewrite using existing Copilot authentication
        API-->>Helper: Rewritten text
        Helper-->>Worker: Rewritten text
    end
    Worker->>Helper: Stop owned process
    Worker->>Usage: Save filtered usage events and reconcile durable receipts
    Note over Worker,Usage: Deduplicate by accounting ID; exclude prompts and responses
    Usage-->>Insights: Enhanced Prompt project, separate helper sessions
    Worker->>Worker: Remove temporary home only after accounting is saved
    Worker-->>Panel: Result for review, or failure explanation
    opt User sends a successful reviewed result
        Panel->>Host: Send only after normal send checks
    end
```

The background session does not inherit the chat history or discover the project. The plugin's existing context pipeline controls what it receives. With AI-assisted context, a separate helper request can select files from the allowed candidate list. Fallback can try other saved Copilot profiles. Retired external profiles are removed from active configuration; all rewriting, selection and research use Copilot.

Models come from the attached session's live catalog, filtered to entries explicitly attributed to Copilot and allowed by their published policy. Before sending, the plugin verifies the selected entry in both catalogs, matching authenticated GitHub login and host, and the helper's actual model, directory and empty tool list. Account identifiers remain in memory; credentials are not requested from desktop storage or copied into profile settings. The SDK resolves existing authentication through its own supported mechanisms.

Version 0.9.0 also forwards an explicit `reasoningEffort` in the helper's session configuration. It must be advertised in both model catalogs and match `session.rpc.model.getCurrent().reasoningEffort` after initialization. A rejected or ignored level stops rewriting, research and selection before inference, including their normal best-effort recovery paths. A separately configured selector and fallback profiles retain their own model defaults. The Enhance status checks the desktop account/catalog without inference; the actual background connection is verified during enhancement. Retry does not erase the last helper failure or submit the draft.

Validation on this machine found the same account via an existing GitHub CLI login inside a disposable extension. This is not proof that every desktop-only sign-in is available to a helper. If the identity cannot be established, the plugin refuses the rewrite. It does not install another authentication tool or silently use a different account. Copilot model use and the Models tab's Test action count toward Copilot usage. See [GitHub's authentication guidance](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate) and [SDK usage and billing](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing).

## Usage visibility

Enhance Prompt **0.2.4** retains each helper's reported usage in a durable local source. **Usage Insights 0.1.64** automatically discovers it and groups the sessions in the **Enhanced Prompt** project. This label is a Usage Insights grouping, not a new project or chat in the desktop application. Each helper gets a unique session with a timestamped name. AI-assisted context's file selector, each fallback attempt and the Models tab's Test action are separate helpers, so one enhancement can produce multiple sessions.

Update both plugins in Copilot's **Customize → Installed → Update**, restart the desktop and reopen their canvases. Run an enhancement with a GitHub Copilot model, then refresh Usage Insights and choose a date range containing the run. If you disabled its source in Usage Insights settings, enable it again.

The source lives at `%LOCALAPPDATA%/copilot-enhance-prompt/usage` on Windows, or `~/.local/share/copilot-enhance-prompt/usage` when `LOCALAPPDATA` is absent. `ENHANCE_PROMPT_DATA_DIR` overrides the plugin data directory; the source is its `usage` child. Usage Insights honors the same override. If the two extensions receive different environment values, add that usage folder as an extra Copilot home in Usage Insights settings.

The plugin prepares a per-session journal before inference. It saves selected fields from `assistant.usage`, then checks the stopped helper's durable `session.usage_record` receipts through the same allowlist before removing temporary files. Shared accounting IDs prevent live and durable copies from counting twice. Retained fields include model, timestamp, tokens, reported AI credits, availability and accounting IDs. They exclude prompt text, model responses, files, endpoint URLs and account credentials. It does not export human prompt events, so Usage Insights' human-prompt metrics and prompt previews are unavailable for this source; use its session/request totals instead.

Reported partial or missing charges stay partial or unavailable, not free. Failed or cancelled requests retain any usage reported before shutdown; a crash before the runtime reports accounting can still leave gaps. A storage or receipt-reading failure is shown as `error.copilot_usage` in Show Logs, stops model fallback and keeps remaining temporary helper files for recovery. Those recovery files can contain the helper transcript. The permanent usage source has no automatic expiration and is independent of Save history and the history/data-clearing controls. To remove it deliberately, close Enhance Prompt and delete only its `usage` folder; this does not alter GitHub billing.

Usage Insights reads these local records, not account-wide billing records from GitHub. Receipts deleted by older Enhance Prompt versions cannot be recovered. The installed-runtime fixture proves retention with a local external model, and a synthetic Copilot fixture verifies exact totals through the real Usage Insights reader. Real account charges and any billing delay still need user validation. See the [original investigation and current validation](research/copilot-sdk-usage-records.md).

## AI Test research

AI Test uses the same background request and usage-recording route as rewriting. It adds at most two research requests on the selected effort model, without research fallback. The model receives project evidence and returns structured read/search requests; the plugin validates and performs permitted reads before the next request. The helper itself still has no file or command tools. Each Copilot research call can create a separate usage session under Enhanced Prompt. See [the limits and failure behavior](context-levels.md#ai-test-experimental-follow-up-research).

## Security and lifecycle

- Runtime discovery accepts only the currently executing Copilot binary in the recognized extension bootstrap environment with the expected parent PID. It never searches PATH for a runtime, takes an executable from a project/profile, uses `COPILOT_CLI_PATH`, or falls back to npm packages.
- The helper uses stdio, an empty temporary workspace and a separate temporary Copilot home. Its inherited environment is restricted to OS, existing GitHub authentication and normal proxy/certificate settings. Code-injection variables, endpoint overrides, host connection variables and ambient tracing settings are excluded.
- `mode: 'empty'` plus explicit session options disable tools, extension/canvas discovery, plugins, MCP servers, skills, hooks, instruction/config discovery, shared session storage, memory, embeddings on disk and session telemetry. Permission requests are denied. Managed policy fetching and model enforcement are enabled. No user consent is inferred from the model.
- The helper cannot read project files as a tool. Explicit image bytes already validated by the plugin are passed as blob attachments, and the selected model must report image support. Original attachment paths remain in the returned prompt for the destination agent.
- Cancel, closing the canvas and extension shutdown abort owned work. A successful shutdown saves accounting and removes the owned temporary home/workspace. If the app crashes, shutdown fails or accounting cannot be saved, temporary session data may remain. No existing session is stopped or deleted.
- SDK errors are replaced with plugin messages instead of exposing raw errors that might contain prompt text or credentials. No paid calls run in automated tests.

This is a constrained helper, not an OS security sandbox. It relies on the installed Copilot SDK/runtime honoring their documented options. Privacy switches and selective secret masking still apply to context gathered by the plugin; they do not sanitize everything a user types or attaches.

## Updates and compatibility

The running desktop host supplies the pair. There is no pinned SDK/runtime dependency in the plugin, and no runtime auto-update from the helper. Restarting the desktop after its update makes the plugin use the new host components.

The extension bootstrap and several session APIs are experimental. Feature presence, runtime state and identity are checked, but not every privacy option has a negotiated capability flag. Protocol compatibility alone cannot prove identical behavior after an update. The installed-runtime fixture tests therefore verify actual outgoing prompts and isolation. Future host changes can require a plugin update; the plugin reports incompatibility instead of downloading another runtime or changing providers.

Verified with the desktop SDK and runtime `1.0.106-8.unstable.r43566476370.g869eef3` on Windows. Other platforms and sandbox launch layouts that do not expose the expected bootstrap markers are unavailable until verified.

## If it is unavailable

Restart or update GitHub Copilot, open the installed canvas in a session, and refresh the model list. Confirm that the Copilot profile is selected. For an account error, check the existing sign-in; the plugin cannot bridge a desktop-only credential into the helper. If it still fails, report the plugin version and the displayed error. Do not share tokens or private prompts.

Since v0.2.2, **Show Logs → Copilot model discovery** distinguishes failed runtime checks, SDK import or API availability, model-list RPC errors, invalid responses and empty/filtered catalogs. Press Refresh first, then reopen logs and use Copy logs. Reports contain booleans, counts and recognized codes, not paths, model IDs or account data.

Version 0.2.3 fixes a reproduced `runtime_identity` failure where `bootstrapPresent` was false: the desktop starts the runtime's embedded `extension_bootstrap.mjs` entry by name, whereas the original check required an absolute preload path. Both launch forms now pass an installed-runtime regression test, including repeated catalog refreshes and a same-named working-directory file that must not execute. The other runtime and provider checks remain in place. `bootstrapEmbedded` records which launch form was recognized without exposing arguments or paths. Verification uses a synthetic model catalog; model availability and rewriting with the user's account still need desktop validation.

Keep **Settings → Fetch model lists online** enabled for Copilot rewriting: each rewrite needs current account/model access checks. Turning it off blocks the Copilot route before a helper starts.

Use manual **Enhance** or the opt-in **Enhance and send** action. Prompts typed directly into Copilot chat are unchanged by this plugin; see the [chat auto-enhance retirement note](chat-auto-enhance-retirement.md).
