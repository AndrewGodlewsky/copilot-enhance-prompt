# Reusing the desktop Copilot SDK in another plugin

Adapt Enhance Prompt's backend adapter to run a bounded model task in an isolated Copilot helper session. The desktop supplies the SDK and compatible executable. The plugin supplies its instructions, selected model, permitted input and cancellation. The answer returns to the plugin; the implementation does not open a chat window or submit the task to the user's attached conversation.

This handoff describes **Enhance Prompt 0.2.4**, commit [`38d1c70ad913f1d627a7c2a4fbe6c8bb6994be31`](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/tree/38d1c70ad913f1d627a7c2a4fbe6c8bb6994be31), and **Usage Insights 0.1.64**, commit [`e5bab658de6ab4aba520d439296314288d549175`](https://github.com/AndrewGodlewsky/copilot-usage-insights/tree/e5bab658de6ab4aba520d439296314288d549175). These commits are the reference baseline; newer desktop SDKs still need compatibility checks.

```text
Plugin UI → plugin backend → verify desktop SDK/runtime
                          → create isolated helper + prepare usage journal
                          → verify account, model, tools and workspace
                          → send prepared input → receive answer + usage
                          → stop helper → reconcile receipts → flush usage
                          → remove temporary helper files → return answer

Permanent usage journal → Usage Insights → your plugin's project/sessions
Attached conversation  → used for identity/model checks; task is not sent here
```

**Read these sources before implementing.**

The source repository is `https://github.com/AndrewGodlewsky/copilot-enhance-prompt`. On the owner's machine, its main checkout is `A:\Claude\copilot-enhance-prompt`; Usage Insights is `A:\Claude\copilot-usage-insights`. Local paths are conveniences for inspection, not paths to embed in another plugin. In another checkout, use the pinned commits above.

| Source in Enhance Prompt | What to adapt |
| --- | --- |
| [src/copilot/models.ts](../src/copilot/models.ts) | Runtime verification, SDK import, catalogs, helper creation, identity checks, generation, cancellation and cleanup. This is the main reference. |
| [src/copilot/usage.ts](../src/copilot/usage.ts) | Filtered accounting, atomic persistence, deduplication and recovery from the stopped helper's journal. |
| [src/copilot/extension.ts](../src/copilot/extension.ts) | Obtain the attached session with the extension SDK; connect backend and lifecycle. |
| [src/copilot/services.ts](../src/copilot/services.ts) | Map project-owned requests to the adapter. `copilot.rewrite` is our service name, not an SDK API. |
| [src/models.ts](../src/models.ts) | Keep fallback within the chosen provider route; stop fallback on accounting errors. |
| [src/diagnostics.ts](../src/diagnostics.ts) | Safe operation/stage/error diagnostics and catalog failure details. |
| [scripts/build.mjs](../scripts/build.mjs) | Leave both SDK imports external to the generated backend bundle. |
| [Background rewriting](copilot-background-rewriting.md) | Current behavior, privacy and compatibility limits. |

For the implementation history, read [native workflow versus SDK validation](research/copilot-model-access-validation.md) and [usage accounting investigation](research/copilot-sdk-usage-records.md). Those notes identify their historical baseline; current code takes precedence.

**The hosting requirement matters.**

This works inside a Copilot desktop extension backend. It imports `@github/copilot-sdk/extension`, joins the attached session, and imports `@github/copilot-sdk` when background generation is needed. The desktop extension loader supplies package resolution. A browser panel, arbitrary Node process, or independently launched MCP server does not automatically have that environment. If the destination plugin is MCP-only, first establish an extension backend with the appropriate host context; removing the runtime verification is not an equivalent port.

The shipped package contains compiled plugin code and panel assets. It does **not** bundle an SDK/runtime pair, install SDK dependencies for the user, or download a runtime. Development build dependencies are separate from what users install. Our bundler configuration includes:

```js
external: ['@github/copilot-sdk', '@github/copilot-sdk/extension']
```

Use the SDK already paired with the running desktop. Do not copy the installed SDK into the repository or substitute the latest npm SDK. This reduces the plugin's dependency/update burden, but does not guarantee that experimental host APIs remain compatible forever.

The verified Windows installation exposes declarations under `%LOCALAPPDATA%/Programs/GitHub Copilot/copilot-sdk/`. Its `cliVersion.d.ts` identifies runtime `1.0.106-8.unstable.r43566476370.g869eef3`. Inspect the destination installation's `types.d.ts`, `session.d.ts`, `extension.d.ts`, `generated/rpc.d.ts`, `generated/session-events.d.ts` and relevant runtime implementation before adapting this. Public SDK examples may describe a different release or installation model.

**Runtime discovery is part of the security boundary.**

`hostRuntime()` accepts the currently executing extension process only when all of these checks pass:

- `process.execPath` is absolute and its basename is one of the tested Copilot executable names.
- The arguments contain the exact embedded entry name `extension_bootstrap.mjs`, or an absolute path whose basename is that entry.
- `COPILOT_SDK_PATH` is present.
- `COPILOT_EXTENSION_PARENT_PID` matches the actual positive `process.ppid`.

Resolve that executable with `realpath`, import the host SDK, and verify `CopilotClient` and `RuntimeConnection.forStdio` exist. These checks recognize a tested host layout; they are not a cryptographic signature check or an OS sandbox. Refuse unknown layouts until they are inspected and tested.

A real bug came from requiring an absolute bootstrap path. The packaged desktop uses the bare embedded name. Accept those two tested forms; do not broaden the check to arbitrary relative paths or any argument containing the substring. See [runtime identity regression coverage](../scripts/e2e-runtime-identity.mjs).

Production never finds its runtime through PATH, a project file, a model profile, or `COPILOT_CLI_PATH`. That last variable is used only by explicitly launched fixture scripts. A generic `node` process should fail this guard.

**Model identity and authentication are verified together.**

Refresh calls the attached session's `rpc.model.list({ refresh: true })`. Eligible entries have a nonempty ID, `provider.kind === 'copilot'`, and either no policy object or `policy.state === 'enabled'`. Require explicit Copilot attribution: a name such as Claude or GPT does not establish the route. Refresh discovers models; it does not install anything or perform inference.

The helper uses `useLoggedInUser: true` and the SDK's existing authentication resolution. The plugin does not extract desktop tokens or build its own credential bridge. Supported signed-in-user and environment authentication are described in [GitHub's authentication documentation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate).

Before inference, query `rpc.gitHubAuth.getStatus()` on both the attached session and helper. Require both to be authenticated and to report nonempty, matching login and host, compared case-insensitively. Recheck identity immediately before sending. Identity values stay in memory and out of logs. The original machine could authenticate the helper through an existing GitHub CLI sign-in; that is not proof that every desktop-only sign-in will work. If the helper cannot verify the same identity, surface a sign-in/access error.

Re-list models in both sessions, require the requested ID to be eligible in both, and verify the helper's actual `rpc.model.getCurrent().modelId`. A saved profile is a preference, not proof of current access. A Claude model selected on this verified Copilot route uses Copilot authentication and usage accounting; it does not launch Claude Code. Preserve the provider boundary through retries and secondary tasks.

**Create a fresh helper for each bounded task.**

Use one random UUID per helper, one empty temporary workspace and a separate temporary Copilot home. Pass that UUID to `createSession`, use it as the durable accounting session ID, and verify the SDK returns it unchanged. A plugin performing several stages can create several helpers; describe that relationship in its UI and usage documentation.

The core client configuration is:

```ts
const client = new sdk.CopilotClient({
  mode: 'empty',
  workingDirectory: workspace,
  baseDirectory: temporaryHome,
  connection: sdk.RuntimeConnection.forStdio({
    path: verifiedDesktopExecutable,
    args: ['--no-auto-update']
  }),
  env: runtimeEnvironment(),
  useLoggedInUser: true,
  logLevel: 'error',
  builtinPluginDirectories: []
})
```

Adapt `runtimeEnvironment()` as an allowlist. It keeps required OS, locale, existing GitHub authentication and proxy/certificate variables. It excludes code injection, provider endpoint overrides, desktop host IPC and tracing configuration. Do not inherit `process.env` wholesale or log its values. Authentication variables may contain secrets; never put their values into command arguments.

After starting the client, prepare the durable accounting writer **before inference**. Register its callback in `createSession({ onEvent })`; this installs the listener before session creation events can arrive. These are the tested session options:

```ts
{
  sessionId,
  onEvent: event => usage.record(event),
  workingDirectory: workspace,
  configDirectory: temporaryHome,
  model: selectedModelId,
  systemMessage: { mode: 'replace', content: taskInstructions },
  availableTools: [],
  onPermissionRequest: () => ({ kind: 'denied-by-rules', rules: [] }),
  requestExtensions: false,
  requestCanvasRenderer: false,
  pluginDirectories: [],
  mcpServers: {},
  enableConfigDiscovery: false,
  skipCustomInstructions: true,
  enableSkills: false,
  enableFileHooks: false,
  enableOnDemandInstructionDiscovery: false,
  enableSessionStore: false,
  enableHostGitOperations: false,
  skipEmbeddingRetrieval: true,
  embeddingCacheStorage: 'in-memory',
  enableSessionTelemetry: false,
  memory: { enabled: false },
  skillDirectories: [],
  agentDirectories: [],
  instructionDirectories: [],
  hookDirectories: [],
  infiniteSessions: { enabled: false },
  enableManagedSettings: true,
  enforceManagedModelDefaults: true
}
```

Use the exact options supported by the installed SDK. The code snippet shows configuration, not a complete lifecycle implementation; port the checks, deadlines and `finally` handling from `models.ts` too.

Preserve the policy-related options and verify their prerequisites on the target host. There is a specific compatibility caveat: the installed `types.d.ts` says `enableManagedSettings: true` requires a session-level `gitHubToken`, which this reference configuration does not supply. The tested helper successfully creates sessions and generates with these options, but that does not prove enterprise policy fetching or enforcement. The receiving agent must resolve that declaration/runtime discrepancy before claiming managed-policy support. Use a documented host-supported authentication path if the target requires one, or report the limitation; do not extract tokens or disable policy as a workaround.

Disabling tools alone does not disable startup instructions, plugins, hooks, skills, memory or repository discovery. After creation, call `rpc.tools.initializeAndValidate()`, then require `rpc.tools.getCurrentMetadata().tools` to be an actual empty array. Require `metadata.snapshot().isRemote === false` and canonical `workingDirectory` equality with the owned empty workspace. Check real behavior, not just requested flags.

The plugin explicitly gathers and filters its own context before calling this adapter. The helper has no ambient access to the destination project through tools. If that is also true of the destination plugin, its task instructions must not claim that the user's destination agent lacks a project merely because this helper uses an empty folder.

**Generate without mutating the attached conversation.**

Send the task to the helper with `sendAndWait({ prompt, attachments }, timeout)`. The reference accepts explicit image blobs shaped as `{ type: 'blob', data: base64, mimeType }`, checks advertised vision support first, and validates attachment bytes upstream. Validate your plugin's own input sizes, attachment permissions and output format. A model reply is untrusted data; do not execute returned instructions as plugin authority.

The result is an assistant-message event. Extract and validate `result.data.content`; a missing or whitespace-only answer is an error. This event is **not** a usage summary. Rendering the result, saving it or sending it to an attached chat is a separate product action. Background generation must not silently submit a user message to the attached session or change that session's model.

We tested a native workflow first. It executed, but inherited unselected project metadata. The isolated SDK helper passed the intended context checks and was chosen for that reason. The native workflow was not universally broken; it failed this plugin's privacy requirement.

**Own cancellation and cleanup through the entire operation.**

Copy the adapter's lifecycle, not only its successful `sendAndWait` call. It applies bounded deadlines to runtime startup, session creation, access checks, generation and shutdown; the outer operation also has an abort controller. A `Promise.race` timeout alone does not cancel the underlying RPC. The owned helper must be stopped on failed or timed-out paths as well.

Closing a canvas cancels its runs. Extension shutdown signals all active helpers. The reference `close()` initiates aborts; each rewrite's `finally` performs cleanup. If the destination host can exit immediately after shutdown callbacks, add an explicit bounded wait for those owned cleanup promises. Abrupt process death can still leave temporary data.

Only stop the child/client created for that task. Never shut down the attached desktop session, kill all Copilot processes or delete their storage. Validate the resolved temporary path is owned and confined before recursive removal. If stopping fails, preserve temporary files and report failure rather than claiming cleanup succeeded.

**Retain accounting before deleting temporary state.**

Two SDK details caused the original usage gap:

- `enableSessionStore: false` disables the shared cross-session search/retrieval store. It does not prevent the ordinary session journal from being written. Disabling session telemetry also does not disable account billing.
- In the tested SDK, `forceStop()` clears session listeners/disposes the connection before waiting for the child to exit. A receipt can exist in the journal without its live event reaching your callback.

The required cleanup order is: **stop helper → reconcile its durable receipts → flush permanent accounting → remove temporary home**. Capture live `assistant.usage` events, then read only the stopped helper's owned `home/session-state/<sessionId>/events.jsonl`. Consume `session.usage_record` entries through the same projection and deduplication. Do not add `session.usage_checkpoint` aggregates as extra requests. The live event is public; the durable receipt shape was observed in this installed runtime and is an additional compatibility dependency.

The reference reconciler uses a 64 MiB read cap, treats a nonexistent journal as possible pre-session failure, and reports other read/parsing failures generically. Malformed recognized usage envelopes fail recording; missing optional counts remain valid. Failure preserves remaining temporary files for recovery. Those files can contain prompt transcripts, so disclose that behavior. A disk or accounting error must not silently trigger a fallback model that could incur another charge.

Allowlist model, normalized timestamp, nonnegative safe token counts, billing availability, Copilot `totalNanoAiu`, attribution flags and accounting identity. Preserve missing metrics as missing and zero as zero. Preserve BYOK/non-Copilot attribution so external fixtures or providers are excluded from Copilot totals. Avoid copying complete event objects: they can contain endpoints and unrelated metadata. No prompts, responses, file contents, account IDs, credentials or raw errors belong in the accounting export.

Use `accounting.sourceSessionId + accounting.usageId` for deduplication when valid, with event ID fallback. Keep the actual SDK session ID, folder ID, header session ID and accounting source ID aligned. Shared identity prevents a live event plus its durable copy from counting twice. Atomic file replacements are serialized per helper; separate UUID files prevent simultaneous tasks from overwriting each other. Port the writer and its tests together.

`cost` can represent a request/model multiplier; it is not a dollar amount. The reader uses reported `copilotUsage.totalNanoAiu / 1e9` for AI credits and keeps partial/unavailable status. Do not infer free inference from missing charge data or estimate dollars without a separate verified pricing contract. GitHub distinguishes per-call events, accumulated session metrics and account quota in its [usage and billing documentation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing).

**Give the destination plugin its own usage source and identity.**

Choose a data-directory name, environment override and project label for the destination plugin. Do not write another plugin's usage into Enhance Prompt's directory or label it **Enhanced Prompt**. That spelling was explicitly chosen by this project's owner for dashboard grouping.

Use this layout, with JSON-compatible YAML for the name file:

```text
<your-plugin-data>/usage/
  session-state/<helper-uuid>/
    workspace.yaml    {"id":"<helper-uuid>","name":"Your Plugin · <timestamp>"}
    events.jsonl
```

The JSONL begins with a `session.start` event whose `data.sessionId` is the UUID and whose `data.context.repository` is your chosen display label. Each following `session.usage_record` contains the projected receipt under `data.usage`, retaining its event identity and timestamp. This gives Usage Insights project/session grouping without creating a native desktop project.

**Usage Insights 0.1.64 automatically discovers Enhance Prompt only.** Another plugin's directory will not become discoverable merely by matching this file layout. For an initial integration, add its `usage` folder as an extra Copilot home in Usage Insights settings. For automatic discovery, make a scoped change in Usage Insights: add the plugin's path resolver in `src/node/settings.mjs` and include it in the existing `createScanner({ optionalHomes: [...] })` list in `src/node/canvas-server.mjs`, preserving the Enhance Prompt entry. Reuse `src/node/copilot-source.mjs` and `src/core/copilot.mjs`; a separate accounting parser is unnecessary.

The reader must honor disabled sources, silently tolerate a missing optional source, deduplicate real paths and receipts, and survive atomic journal rewrites. Test discovery, custom paths, missing/disabled sources, repeated refresh, copied journals, exact tokens/credits, separate sessions and names. See Usage Insights `tests/enhance-prompt-source.test.mjs` at the pinned commit for the template.

These exports contain no human prompt events. Therefore human-prompt averages and prompt previews are unavailable; use session/request totals. Do not fabricate submissions to make those counters populate. Enhancement history is separate from accounting. Define and disclose retention/clearing behavior for the destination plugin. Deleting local receipts cannot undo GitHub charges, and old deleted receipts cannot be reconstructed from output text.

**Keep support logs useful and safe.**

Log operation, timestamp, duration, outcome, recognized error code and the failed validation stage. For model discovery, log runtime/bootstrap/API booleans and received/eligible/filter counts. The original failure report identified `bootstrapPresent: false`; that was enough to fix the embedded-entry check without exposing raw process arguments.

Keep logs bounded and make them copyable on demand. Replace SDK exceptions with safe plugin errors: raw exceptions can include input or credentials. Surface identity mismatch, SDK unavailability, model filtering, tool/workspace mismatch, timeout and accounting failure distinctly. The reference uses `error.copilot_usage` and `copilot.usage` for recording failures. Adapt these names and message rendering to the destination project.

**Verify the port with fixtures before asking for real use.**

| Reference test | Evidence it provides |
| --- | --- |
| [models.test.ts](../src/copilot/models.test.ts) | Host guards, account/model/tool checks, cancellation, usage preparation and preservation on storage failure. |
| [usage.test.ts](../src/copilot/usage.test.ts) | Projection/privacy, deduplication, concurrent sessions, partial/zero/missing fields, disk failures, durable-only recovery and malformed events. |
| [routing.test.ts](../src/copilot/routing.test.ts) | Provider boundaries and no fallback after a recording error. |
| [e2e-runtime-identity.mjs](../scripts/e2e-runtime-identity.mjs) | Installed runtime accepts both legitimate bootstrap forms. |
| [e2e-copilot-provider.mjs](../scripts/e2e-copilot-provider.mjs) | Real installed SDK/runtime against a local HTTP model: actual output, image input, no tools/ambient files, cancellation, cleanup and retained accounting. It suppresses a live event to prove durable recovery. |
| [e2e-usage-insights.mjs](../scripts/e2e-usage-insights.mjs) | Actual producer and actual scanner, with synthetic Copilot receipts: exact credit/token totals, grouping/names, partial/missing coverage and refresh deduplication. |
| [e2e.mjs](../scripts/e2e.mjs) | Built extension registration, canvas/backend lifecycle and existing plugin behavior using a disposable session. |

The local provider fixture removes `GH_TOKEN` and `GITHUB_TOKEN` from its child environment, sets `useLoggedInUser: false`, uses a loopback BYOK provider, and supplies synthetic account/catalog responses through test-only dependency injection. These overrides must never become user-configurable production routes. BYOK fixture usage remains BYOK; synthetic credit tests are separate.

The scripts take `COPILOT_SDK_DIR` and `COPILOT_CLI_PATH` for test harness setup, and `USAGE_INSIGHTS_DIR` for the reader checkout. Discover the installed pair before setting them. Never redirect these tests to a paid model or an existing user session. Inspect fixture markers in outgoing requests to establish isolation; empty requested tool configuration alone is insufficient evidence.

At the reference release, Enhance Prompt passed 299 tests plus build/type/package checks and local runtime fixtures; Usage Insights passed 203 tests and its build. The owner confirmed that real Copilot rewriting worked after the runtime-discovery fix. The new usage grouping was verified with fixtures; real-account charge amounts, reporting delay and dashboard appearance still required owner validation. Treat those as distinct evidence levels. Browser/desktop automation requires the owner's explicit request; ask them to perform UI checks otherwise.

**Implementation sequence and completion criteria for the receiving agent.**

1. Inspect the destination architecture and installed declarations. Identify its extension backend, attached-session handle, build boundary and cancellation owner. Stop claiming compatibility until that mapping is concrete.
2. Port a small project-owned service for catalog, task generation and shutdown. Reuse runtime verification and isolation; adapt task instructions, inputs, output validation and error types. Keep SDK details out of the panel.
3. Add safe diagnostics and a retryable catalog UI. Prove that rejected identities/models/tools/workspaces send no prompt and cannot switch billing route. Verify policy behavior separately from successful model calls.
4. Adapt the accounting writer with the destination plugin's path/project label. Prove persistence on success, failure and cancellation, live/durable deduplication, and preservation when recording fails.
5. Connect Usage Insights through an extra home or an explicitly scoped optional-source change. Prove the new source appears under its own project, refresh does not double-count and existing sources remain intact.
6. Run the destination repository's required checks and the adapted local SDK/reader fixtures. Request owner-run UI/account validation with versions, steps and expected results. Report what was tested versus what remains unverified.

Choose task-specific timeout, concurrency and maximum input/output sizes based on the destination feature. The reference uses one helper per task and permits multiple active tasks; it does not provide a global concurrency queue. Persistent helpers, tool-enabled agents, structured outputs or shared-memory behavior require their own design and tests rather than a mechanical copy.

Keep any automatic prompt hook separate. Enhance Prompt's two-second hook excludes SDK helpers; manual background generation does not establish acceptable hook latency or recursion behavior. Preserve applicable MIT notices when reusing source. Follow the destination repository's contribution and release instructions: this project's standing instruction to push completed work to `main` is not a global rule for other projects.
