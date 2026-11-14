# Copilot account model access for Enhance Prompt

Researched 2026-11-14 against official GitHub documentation and `github/copilot-sdk` source. Upstream source snapshot: [`cf045793958ce674259c557f7769788f94ee20c9`](https://github.com/github/copilot-sdk/commit/cf045793958ce674259c557f7769788f94ee20c9). These findings describe current public interfaces; the host-supplied experimental SDK and runtime must be checked separately before implementation.

## Finding

**Validation update:** the native workflow executes, but adds unselected project metadata. The headless SDK passed the local isolation and cancellation checks. See [the validation results and implementation recommendation](copilot-model-access-validation.md). The sections below preserve the initial investigation.

**Copilot can perform enhancement programmatically without opening a chat UI.** The supported SDK path creates a session and sends a prompt through the runtime; the CLI also accepts `-p` and exits after completion. Programmatic execution does not establish that a request leaves no session history or desktop activity. The CLI even prints a resume hint for programmatic sessions. [SDK/CLI compatibility](https://docs.github.com/en/copilot/how-tos/copilot-sdk/troubleshooting/compatibility), [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)

Owner clarification: **a history entry is acceptable; opening a new chat window is not.** The rewrite must return to the Enhance Prompt panel. This is a research note, not an approved implementation design.

## How version 0.1.7 routes models

The model's provider profile determines the authentication and billing route. A Claude model name alone does not identify the service being used.

| Profile | Rewrite transport | Account used |
| --- | --- | --- |
| Claude Code | Local `claude` process in print mode | Whatever credentials Claude Code resolves for that process |
| Anthropic | HTTPS `/v1/messages` | Configured Anthropic API key |
| OpenRouter or another compatible provider | HTTPS `/chat/completions` | Configured provider's key/account |
| Local model | Configured local endpoint | Local server configuration |
| GitHub Copilot | No built-in rewrite provider yet | Copilot currently receives the reviewed result for execution |

The source's `subscription` label is assigned to every CLI profile without checking its actual authentication. Claude Code supports subscription login, API credentials, and other routes; in print mode an inherited `ANTHROPIC_API_KEY` can override subscription credentials. The plugin does not itself verify the billing source. [Profile presets](../../src/presets.ts), [key resolution and model chain](../../src/models.ts), [Claude authentication precedence](https://code.claude.com/docs/en/authentication#authentication-precedence)

The existing flow is:

1. The worker gathers permitted project context and explicitly attached files, then builds rewrite instructions from style, language, custom instructions, rules, and the requested structure.
2. It sends those instructions and the user's request through the selected profile. A selected model overrides only that profile's model. If fallback is enabled, failures may try other enabled profiles, potentially using another service/account. Max context can make an additional model call to select files.
3. The Claude Code path starts a hidden child process in an empty temporary folder with `-p --output-format text --tools "" --no-session-persistence --setting-sources ""`, plus the selected `--model`. Input goes over stdin; it collects stdout and cleans up. It does not open a chat window.
4. The returned text is cleaned and displayed for review. The separate Send action submits the result to the attached Copilot session, which uses its own model to perform the task. The optional explicitly enabled enhance-and-send setting combines these steps.

These are two distinct model operations: rewriting the request, then doing the requested work. [Worker flow](../../src/worker.ts), [CLI adapter](../../src/cli.ts), [Copilot session adapter](../../src/copilot/session.ts), [Claude CLI flags](https://code.claude.com/docs/en/cli-reference)

The automatic chat hook is a separate integration: its current model budget is 1,700 ms and it excludes CLI profiles. Supporting background manual enhancement through Copilot does not automatically make Copilot-based chat auto-enhance viable; latency and recursion need a separate decision. [Hook implementation](../../src/worker.ts)

## Installed SDK and read-only checks

Inspected the SDK bundled with the installed desktop app and runtime `1.0.106-8.unstable.r43566476370.g869eef3` on 2026-11-14. Its `extension.d.ts`, `workflow.d.ts`, and `docs/workflows.md` expose Dynamic Workflows; `generated/rpc.d.ts` exposes `session.rpc.model.list()`. Its `completions.request` is composer autocomplete, not free-text inference. Its client implementation also disables keychain access in `mode: "empty"`; that mode is not an authentication or persistence shortcut.

A read-only headless SDK probe successfully started the installed runtime, reported authenticated access through the existing GitHub CLI sign-in, and returned a 15-model Copilot catalog including Claude models. It then stopped cleanly. **No session was created and no prompt was sent.** This confirms headless account/catalog access on this machine, not successful generation or equality with the desktop's selected account. No account identifiers, credentials, or personal model configuration are recorded here.

Next validation must use the actual extension context to establish account identity, workflow eligibility, text-only restrictions, cancellation, and whether the desktop opens or focuses anything. The owner performs desktop visual checks; do not automate the computer.

## Account, models, and billing

- The default SDK authentication uses credentials from an existing Copilot CLI login. GitHub explicitly lists desktop applications as a use case. Explicit tokens and environment credentials have higher precedence; therefore a separate runtime is not proof that it uses the desktop app's currently selected account. No credentials need to be extracted by the plugin. [SDK authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate)
- `client.listModels()` exposes available models and capability, policy, and billing metadata. For this attached canvas, **prefer `session.rpc.model.list()` if the installed SDK supports it**: its contract specifically uses the session's own authentication and integration context. The session result can include BYOK models, so do not label every returned row as a Copilot-account model merely from its model ID. [Compatibility](https://docs.github.com/en/copilot/how-tos/copilot-sdk/troubleshooting/compatibility), [generated model API](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/src/generated/rpc.ts)
- SDK usage follows Copilot CLI billing and counts toward the applicable allowance. Runtime model metadata and usage events expose cost information; prices and entitlement must be read dynamically. Do not promise free or unlimited enhancement, or a fixed charge per rewrite. [SDK billing FAQ](https://github.com/github/copilot-sdk#how-does-billing-work-for-sdk-usage), [usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing)

## Candidate A: a separate programmatic rewrite session

Create a dedicated session, choose a returned model, send the prepared enhancement input with `sendAndWait`, collect its final answer, and clean up only that session. This keeps rewrite instructions out of the user's active conversation; it does not by itself guarantee an invisible desktop session. [SDK/CLI compatibility](https://docs.github.com/en/copilot/how-tos/copilot-sdk/troubleshooting/compatibility)

The public SDK supports the controls needed for a text-only candidate:

- `availableTools: []`: the allowlist admits no tools; provide a deny-only permission handler as defense in depth.
- `systemMessage: { mode: "replace", content: ... }`: replaces the runtime system prompt. This also removes its built-in prompt guardrails, so tool restriction remains necessary.
- Disable ambient configuration discovery, repository file hooks, skills, custom instructions, memory, and cross-session retrieval using controls present in the installed version. Do not provide explicit plugin, instruction, skill, agent, or hook roots. Disabling tools alone does not disable startup discovery or hooks.

These are distinct controls: `enableFileHooks` concerns repository-origin hooks; explicit `hookDirectories` and SDK callbacks are separate. `enableSessionStore: false` disables the shared search/retrieval store, not necessarily the session transcript. [SDK types](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/src/types.ts), [system prompt replacement](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/README.md#replace-mode), [hooks guide](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/docs/features/hooks.md)

Use the project's existing empty temporary working-directory approach and preserve its privacy/redaction path. An isolated `configDirectory` may separate state, but authentication and cleanup behavior need runtime verification. Upstream `mode: "empty"` is not a no-persistence switch: it requires an explicit persistence location and disables system-keychain access for spawned runtimes. That makes it unsuitable as an untested shortcut to the user's existing stored login. [SDK client implementation](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/src/client.ts)

## Candidate B: an attached-session Dynamic Workflow

The experimental extension API supports `defineWorkflow`, registration through `joinSession`, and `session.workflow.run`. `ctx.agent(prompt, { model, agent, schema, ... })` runs a workflow-owned subagent and returns final text or parsed JSON. `notifyOnComplete: false` is explicitly intended for programmatic callers; `logPhaseNames: false` avoids requested phase-name transcript lines. This is a promising attached-account path, but not a stateless inference API. [Dynamic Workflows](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/docs/workflows.md)

Workflow runs and journals are durable. Agent options do not include a direct tool allowlist; a verified custom-agent configuration would be needed to constrain tools. Execution also requires eligible credentials, documented as token-based billing or trusted HMAC authentication; ineligible calls fail with `dynamic_workflows_unavailable`. Ordinary subagent failures can return `null`, and run envelopes require checking terminal status. Cancellation must stop the run, not merely stop waiting. None of the notification controls promises hidden desktop activity. [Dynamic Workflows](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/docs/workflows.md)

## Persistence and API limits

Do not infer ephemerality from an omitted `sessionId`, `infiniteSessions: { enabled: false }`, or `disconnect()`. The Node guide says infinite sessions default on and persist workspace state. `disconnect()` releases live resources while retaining stored data; `deleteSession()` removes session storage. Public persistence prose is inconsistent: its introduction describes random-ID sessions as memory-only, while its lifecycle section and upstream summary describe durable sessions. Treat the actual bundled implementation and a local fixture test as decisive. [Node guide](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/README.md#infinite-sessions), [persistence guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/session-persistence)

No general, sessionless free-text inference method was found in the reviewed public SDK. The newer experimental `decisions` API answers yes/no, selection, and rating questions; it is not a prompt-rewriting replacement. This is a research result, not proof that no private or future API exists. [Decision API source](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/src/decisions.ts)

## Recommended next step and unresolved desktop behavior

Start with attached-session model discovery. Compare the bundled workflow implementation with a dedicated SDK session using a local model fixture. Prefer the workflow only if it can enforce text-only execution, preserve canvas ownership/cancellation, and meet the desired desktop presentation. Otherwise use a separate programmatic rewrite session with explicit storage lifecycle and verified authentication.

Still unverified: whether a separately spawned runtime selects the same account as the desktop app; whether that app opens or focuses helper sessions or workflow activity; which restrictions and eligibility rules the installed runtime enforces; and whether auto-enhance hooks can recurse. A history entry is acceptable, so invisible persistence and deletion of all history views are not requirements. Public docs do not establish these desktop-specific properties. No desktop UI was used, credential values were not read or copied, and no paid model inference was performed.

Recommended product direction after that validation: add a clearly named **GitHub Copilot** rewrite provider, load its actual allowed model catalog, and make its account/cost route visible. Keep generation separate from sending to the user's active conversation. A Copilot-only selection must not silently fall back to Claude Code or an externally billed API. Preserve existing context, redaction, review, attachments, and cancellation behavior.
