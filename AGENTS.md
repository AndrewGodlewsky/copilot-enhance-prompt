# Working on Enhance Prompt

GitHub Copilot desktop plugin with a native canvas. `plugin.json` is the Agent Plugins manifest. The runtime loads `com.github.copilot/extensions/enhance-prompt/extension.mjs`; its adjacent `web/` contains the compiled React panel. Both are generated and committed. The host supplies `@github/copilot-sdk/extension`.

## Architecture

- `src/copilot/`: session adapter, durable storage, authenticated HTTP/SSE transport and extension lifecycle.
- `src/worker.ts`: prompt enhancement and model orchestration through the project-owned `EnhanceWorker` interface in `src/host.ts`.
- `src/protocol.ts`: typed panel requests and events. Inputs are plain JSON.
- `src/runtime.ts`: project-owned panel state and service interfaces. `#panel`, `#host`, `#testing` resolve through package imports.
- `src/panel/`: behavior, state, labels and event wiring. `web/src/` draws the UI. Put testable decisions in the panel modules.
- `src/context/`, `src/models.ts`, `src/copilot/models.ts`: secure project reads and Copilot model orchestration.

Before changing SDK integration, inspect the installed SDK declarations and [migration assessment](docs/copilot-migration-assessment.md). The SDK is experimental. Internal names such as `terminalId` and `workspace.list` are the plugin's service contract, not Copilot SDK methods. The production adapter maps them to the attached session; it never injects terminal keystrokes.

## Verify changes

```sh
npm ci
npm --prefix web ci
npm run typecheck
npm run build
npm test
npm run check
```

Build after changing backend, panel or release notes. Run the final tests after rebuilding. The normal test suite uses Node's test runner and no desktop app. It includes real child-process tests; allow up to five minutes for an individual test. `node scripts/e2e.mjs` tests the built extension with the installed runtime when `COPILOT_SDK_DIR` and `COPILOT_CLI_PATH` are set. It uses a disposable session to check registration, context, rejected legacy-provider requests and sending. `scripts/e2e-copilot-provider.mjs` tests rewriting through the installed SDK with an isolated local HTTP model fixture; never send test traffic to a paid provider or an existing session.

`npm run web:dev` previews sample data at port 5174. `scripts/shot-web.mjs` uses Brave by default. Live account-backed evaluation is separate and uses the owner's Copilot plan; describe that validation accurately.

## Behavioral invariants

- Write plugin-authored UI and rewritten prompt text in English. Use literal English strings in the panel and a small `formatText` helper only for interpolation. The English output policy takes precedence over conflicting custom rules, structures or project instructions. Preserve user data, custom rules and structures, Unicode, code, identifiers, filenames, paths, URLs, quoted text and error messages as supplied. Keep `Enhance Prompt` unchanged as a brand; use `BRAND`.
- Keep flat colors in brand assets and UI imagery. Preserve the MIT license and original copyright.
- Keep the original rewrite builder intact as the fallback for `useEnhancedPrompts: false`. Enhanced instructions live separately in `src/prompt-sets.ts`; snapshot the preference for each enhancement and its fallbacks. When changing either set or its selection, read [the prompt-set contract](docs/enhanced-prompts.md).
- Get the source project from `metadata.snapshot().workingDirectory`, never `session.workspacePath`. Reject remote or uncertain project roots. Project rules use the canonical project path; drafts are scoped to the session.
- Check privacy switches before every read: preview, enhancement, AI-assisted selection and AI Test research. Project files go through `readText`; refuse sensitive filenames and links escaping the project. Mask before trimming. Use `redactCode` for source code and `redactSecrets` for terminal-like text.
- Attached files are read only from the attachment directory and only when explicitly attached. Recognize images by bytes. Include their paths in the rewritten prompt.
- Send only to the attached session, after checking activity, pending permissions and queue state. Fail closed on missing status. Never answer permissions, use immediate steering, type terminal keys, or turn an agent action into user consent.
- Automatic sending stays off until explicitly enabled in its dialog. Recheck session, project, input, activity and cancellation after enhancement. Send the run's own result. A closing canvas cancels its work.
- All model work uses the installed Copilot SDK/runtime and verified Copilot account/catalog. Reject external profiles and stale external assignments; never silently convert them to Copilot models. Keep usage accounting for rewriting, selection, research and tests.
- Prompts entered directly in chat remain untouched. The retired hook has no registration or runtime path; inactive saved chat settings exist only for recovery. Read [the retirement note](docs/chat-auto-enhance-retirement.md) before reconsidering it.
- Preferences and history use atomic writes and cross-process transactions for read-modify-write operations. Migration removes legacy encrypted API-key entries while preserving unrelated state.
- Copilot helpers run in an empty temporary directory and receive only prepared input. Do not let this absence become a false statement about the destination agent's project.
- Notices carry plain-data actions. Undo restores only an entry the worker recently removed. Async runs belong to their canvas and cannot be resumed by another instance.
- Loopback endpoints require authentication and validate origin, host, request size and static-file confinement. Keep agent-facing canvas actions separate from human UI operations.
- Unsupported settings are disabled in both UI and backend. Do not emulate missing host capabilities with successful mock responses.

## Release artifacts

Keep `plugin.json`, `src/version.ts`, and the English `CHANGELOG.md` in sync. Rebuild and check the generated package. Do not commit scratch scripts, test data, private logs or credentials.

Starting with 0.11.2, every version bump must prepend a dated `## [X.Y.Z] - YYYY-MM-DD` entry to `CHANGELOG.md` with short, user-oriented bullets: what changed, where users find it, and any action they need to take. This file supplies the footer version's Release history and What's new views; rebuild it with each version. Preserve older entries as recorded; backfilling or rewriting historical notes is outside scope.

Commit and push completed, verified work to `main` unless the owner requests otherwise. Never force-push. Tagging and creating releases remain separate owner decisions; the build/check scripts publish nothing.

For the remaining v1 audit backlog (#40), the owner explicitly authorized one version and GitHub release per completed issue. Publish these as preview releases after verification and pushing main; record user-oriented notes and evidence in the issue and `docs/audits/v1/backlog-progress.md`. This authorization does not authorize paid Copilot tests, desktop automation, user-data expiry, or marking manual/product gates complete without evidence.

The owner approved preparing the separate `runtime-preview` marketplace branch. Source changes still go to `main`. Follow [runtime channel publication](docs/runtime-marketplace.md): generate from an exact verified source commit, retain runtime-only ancestry, publish with a normal fast-forward push, and never merge source history or automatically migrate existing installations. A push to `main` alone does not publish this optional channel. Bounded recent History remains the approved v1 scope; live prompt evaluations remain pending.

For this project, every completion report must state the plugin version, whether changes were pushed, the destination branch and commit, and any verification still pending.
