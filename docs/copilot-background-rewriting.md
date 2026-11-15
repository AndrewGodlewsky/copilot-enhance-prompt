# Background rewriting through GitHub Copilot

Version 0.2.0 adds the GitHub Copilot preset. It imports the desktop-supplied `@github/copilot-sdk` and launches the same executable that is already running the extension. Users install the normal plugin package; they do not run npm, install an SDK, or download a second runtime. The SDK is external to our bundle and is loaded only when this provider is used.

## Data and account flow

```mermaid
sequenceDiagram
    participant Panel as Enhance Prompt canvas
    participant Worker as Prompt builder
    participant Host as Attached Copilot session
    participant Helper as Disposable Copilot helper
    participant API as GitHub Copilot model service
    Panel->>Worker: Request, selected Copilot model, privacy choices
    Worker->>Worker: Build rewrite instructions and permitted context
    Worker->>Helper: Start with desktop SDK/runtime in empty directory
    Worker->>Host: Read account and current Copilot catalog
    Worker->>Helper: Check same account, eligible model, empty tools, isolated directory
    alt Checks fail or user cancels
        Worker->>Worker: Record failure; no external-provider fallback
    else Checks pass
        Worker->>Helper: Prepared prompt and explicit attachment bytes
        Helper->>API: Rewrite using existing Copilot authentication
        API-->>Helper: Rewritten text
        Helper-->>Worker: Rewritten text
    end
    Worker->>Helper: Stop owned process and remove temporary home
    Worker-->>Panel: Result for review, or failure explanation
    opt User sends a successful reviewed result
        Panel->>Host: Send only after normal send checks
    end
```

The background session does not inherit the chat history or discover the project. The plugin's existing context pipeline controls what it receives. At Max, a separate helper request can select files from the allowed candidate list; this stays on the Copilot route even when an older external selector profile is saved. Fallback can try other saved Copilot profiles, but cannot cross to an external API or subscription CLI. External runs likewise do not automatically fall back into Copilot.

Models come from the attached session's live catalog, filtered to entries explicitly attributed to Copilot and allowed by their published policy. Before sending, the plugin verifies the selected entry in both catalogs, matching authenticated GitHub login and host, and the helper's actual model, directory and empty tool list. Account identifiers remain in memory; credentials are not requested from desktop storage or copied into profile settings. The SDK resolves existing authentication through its own supported mechanisms.

Validation on this machine found the same account via an existing GitHub CLI login inside a disposable extension. This is not proof that every desktop-only sign-in is available to a helper. If the identity cannot be established, the plugin refuses the rewrite. It does not install another authentication tool or silently use a different account. Copilot model use and the Models tab's Test action count toward Copilot usage. See [GitHub's authentication guidance](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate) and [SDK usage and billing](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing).

## Security and lifecycle

- Runtime discovery accepts only the currently executing Copilot binary in the recognized extension bootstrap environment with the expected parent PID. It never searches PATH for a runtime, takes an executable from a project/profile, uses `COPILOT_CLI_PATH`, or falls back to npm packages.
- The helper uses stdio, an empty temporary workspace and a separate temporary Copilot home. Its inherited environment is restricted to OS, existing GitHub authentication and normal proxy/certificate settings. Code-injection variables, endpoint overrides, host connection variables and ambient tracing settings are excluded.
- `mode: 'empty'` plus explicit session options disable tools, extension/canvas discovery, plugins, MCP servers, skills, hooks, instruction/config discovery, shared session storage, memory, embeddings on disk and session telemetry. Permission requests are denied. Managed policy fetching and model enforcement are enabled. No user consent is inferred from the model.
- The helper cannot read project files as a tool. Explicit image bytes already validated by the plugin are passed as blob attachments, and the selected model must report image support. Original attachment paths remain in the returned prompt for the destination agent.
- Cancel, closing the canvas and extension shutdown abort owned work. A successful shutdown removes the owned temporary home/workspace. If the app crashes or shutdown fails, temporary session data may remain for OS cleanup. No existing session is stopped or deleted.
- SDK errors are replaced with plugin messages instead of exposing raw errors that might contain prompt text or credentials. No paid calls run in automated tests.

This is a constrained helper, not an OS security sandbox. It relies on the installed Copilot SDK/runtime honoring their documented options. Privacy switches and selective secret masking still apply to context gathered by the plugin; they do not sanitize everything a user types or attaches.

## Updates and compatibility

The running desktop host supplies the pair. There is no pinned SDK/runtime dependency in the plugin, and no runtime auto-update from the helper. Restarting the desktop after its update makes the plugin use the new host components.

The extension bootstrap and several session APIs are experimental. Feature presence, runtime state and identity are checked, but not every privacy option has a negotiated capability flag. Protocol compatibility alone cannot prove identical behavior after an update. The installed-runtime fixture tests therefore verify actual outgoing prompts and isolation. Future host changes can require a plugin update; the plugin reports incompatibility instead of downloading another runtime or changing providers.

Verified with the desktop SDK and runtime `1.0.106-8.unstable.r43566476370.g869eef3` on Windows. Other platforms and sandbox launch layouts that do not expose the expected bootstrap markers are unavailable until verified.

## If it is unavailable

Restart or update GitHub Copilot, open the installed canvas in a session, and refresh the model list. Confirm that the Copilot profile is selected. For an account error, check the existing sign-in; the plugin cannot bridge a desktop-only credential into the helper. If it still fails, report the plugin version and the displayed error. Do not share tokens or private prompts.

Keep **Settings → Fetch model lists online** enabled for Copilot rewriting: each rewrite needs current account/model access checks. Turning it off blocks the Copilot route before a helper starts.

Chat auto-enhance remains separate: its two-second hook uses Rules or explicitly configured API models. Manual Enhance and optional Enhance and send support the new Copilot provider.
