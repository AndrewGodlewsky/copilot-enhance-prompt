# Runtime, security, storage, and update audit

What this repo does: Enhance Prompt builds a rewrite request from user input and permitted context, runs it in a disposable Copilot helper, and returns the result for review. It stores preferences, session drafts, shared history, and filtered usage receipts locally. This audit assumes one user with several canvases and extension processes open, repeated cancellation, and months of accumulated sessions.

Audit date: 2026-11-16. Plugin version: **0.12.0**. Source baseline: **d25be463718f1b5d8ab663177fc9aa248956f762**. Three bugs were reproduced without model traffic: turning off history during a rewrite still saves that rewrite, cancellation releases update protection before model cleanup finishes, and long project paths share rule scopes. Ordinary cross-process update exclusion worked in a separate-process fixture.

No production code, owner profile, installed plugin, or account was changed. No browser or desktop UI was controlled. No live model, catalog, account, or remote update request was made. Existing tests and additional disposable fixtures were used. The writing and audit workflows used the ponytail audit and LLM writing skills.

## Must fix

### RS-1 — P1: A rewrite can save prompt text after Save history is disabled

**Confirmed by a disposable fixture.** `enhance()` snapshots settings before model work. `waitForRun()` later passes that original snapshot to `addHistory()`, which checks its old `saveHistory` value. A user can turn saving off from another canvas while the first rewrite is in flight; the completed request and result are then written to shared history. This contradicts the documented instruction to disable Save history to stop retaining new content.

References: [worker.ts](../../../src/worker.ts), lines 152–165, 270, 395, and 543–554; [services.ts](../../../src/copilot/services.ts), lines 76–84; [privacy.md](../../privacy.md), paragraph beginning “History, context summaries and session drafts”. The server's current-preference check for panel storage at [server.ts](../../../src/copilot/server.ts):125–128 does not cover the worker's history write.

**Reproduction:** Start `enhanceRequest()` with `mockHost`, one enabled synthetic Copilot profile, context `off`, and a fake `copilot.rewrite` that waits on a promise. Once the fake model is waiting, call `host.settings.set('saveHistory', false)`, resolve the model promise with `{text:'synthetic result'}`, and await the request. The fixture observed:

```json
{"saveHistory":false,"retainedHistory":[{"original":"synthetic request","enhanced":"synthetic result"}]}
```

The displayed JSON omits generated IDs, timestamps, and unrelated fields. This test used the production `enhanceRequest`, `createWorkerHost`, and history code, with only host/model calls mocked.

**Smallest fix:** Re-read the current retention preference immediately before the history mutation and refuse the write if it is off. Keep the rewrite prompt-set snapshot separate: the intended per-run prompt policy does not require retaining an old privacy choice. Add a test that changes the setting while inference waits and verifies no history entry is created. If left unchanged, the user can explicitly stop saving and still have new prompt content retained.

### RS-2 — P2: Cancellation permits an update while model work is still stopping

**Confirmed by a disposable fixture.** `cancelPanelRuns()` and the aborted `waitForRun()` path delete the live-run entry immediately. The update busy callback observes only `liveRuns.size`; the `withWork()` reservation is released when the HTTP-facing request finishes. The underlying model operation can still be stopping its helper, flushing usage, or preserving a failed journal. The SDK adapter itself waits for `forceStop()` and receipt handling, but its lifetime is no longer represented in update exclusion.

References: [worker.ts](../../../src/worker.ts):467–468, 504–514, 529–543; [worker-host.ts](../../../src/worker-host.ts):56–64 and 77–83; [updates/service.ts](../../../src/updates/service.ts):131–136 and 156–167; [extension.ts](../../../src/copilot/extension.ts):49–54; [models.ts](../../../src/copilot/models.ts):252–279. The generic request `Promise.race()` also needs consideration for cancelled `models.test` and other work that is not in `liveRuns`.

**Reproduction:** Create two `createUpdates()` instances sharing a real temporary `persistentStore`, both with `busy: hasActiveRuns`. Run `one.withWork(() => enhanceRequest(...))`; the mocked rewrite receives the abort signal but holds its completion promise to represent shutdown/receipt flushing. An install through the second updater is initially rejected. Abort the enhancement request and await its rejection, then retry install before releasing the model promise. The real updater calls its synthetic update executor and reports restart-required state while the model remains active:

```json
{"blockedBeforeCancel":true,"abortSeen":true,"modelActive":true,"busyAfterCancel":false,"workAfterCancel":{},"updateWhileActive":true,"status":"reload"}
```

**Smallest fix:** Keep a busy reservation until the underlying worker/helper promise has settled, including cleanup, independently of whether the caller is still waiting. Preserve prompt cancellation and late-result suppression. Add the combined cancellation/update fixture, including `models.test`, rather than testing cancellation and update exclusion only in isolation. If left unchanged, “finish active work before updating” is false during normal cancellation, and restart guidance can arrive while usage recovery is still in progress. No lost charge or damaged installed files were observed in this synthetic reproduction.

### RS-3 — P2: Long canonical project paths share project-specific rules

**Confirmed by a direct function fixture.** Production workspaces identify their project by canonical directory path, but `projectScope()` truncates the entire `project:<path>` key to 200 characters. Two distinct projects under a sufficiently long common parent become indistinguishable; a rule saved for one applies to the other. Both paths in the fixture were 211 characters, below the traditional Windows 260-character path ceiling.

References: [rules.ts](../../../src/rules.ts):20–25, 61, and 82–85; [session.ts](../../../src/copilot/session.ts):36 and 57; [context/index.ts](../../../src/context/index.ts):223–235. This is an identity collision, not a question of model obedience to a rule.

**Reproduction:**

```js
import { projectScope, ruleApplies } from './src/rules.ts'
const common = 'c:/projects/' + 'a'.repeat(190)
const first = common + '/client-a'
const second = common + '/client-b'
const rule = { scope: projectScope(first) }
console.log(projectScope(first) === projectScope(second)) // true
console.log(ruleApplies(rule, { workspace: null, project: second })) // true
```

**Smallest fix:** Preserve the full canonical identity within an explicit generous path-size limit; truncate only its display label. Existing truncated values cannot be expanded safely and should not silently match a longer project during migration. Add a test for two paths sharing more than 192 initial characters. If left unchanged, instructions intended for one client/project can be included in another project's rewrite.

## Should fix or explicitly accept before v1

### RS-4 — P2: Old session drafts have no lifecycle or aggregate storage bound

**Confirmed implementation limit; performance severity belongs with the separate storage benchmark.** Every session's panel data is retained in one `data/state.json`, with a hashed session prefix. Session isolation is correct, but there is no last-used timestamp, session expiry, aggregate size ceiling, or control to delete all inactive session drafts. Each get parses the full file, each set rewrites it, and each active storage watcher parses and compares it when the file changes. History's one-million-character cap does not cap these drafts.

References: [services.ts](../../../src/copilot/services.ts):18–21 and 87–94; [storage.ts](../../../src/copilot/storage.ts):21–29, 38–46, 49–65; [history.ts](../../../src/history.ts):19–36. `data.clear(all)` removes only the current session's panel keys because `storage.keys()` filters other session prefixes: [server.ts](../../../src/copilot/server.ts):110–112. This scope is accurately disclosed in [privacy.md](../../privacy.md); it is not an undisclosed “delete all data” claim.

**Practical reproduction:** Use `createServices()` with distinct synthetic session IDs and a disposable data directory, save a draft/result pair through each, then inspect the underlying `data` store. All session keys remain after starting another session or clearing only its panel keys. The separate benchmark measures 100–30,000 pairs; this audit did not duplicate that expensive workload.

**Smallest fix:** Give inactive session data a deliberate lifecycle and a visible cross-session cleanup action, preserving the currently active session. Choose a retention policy before introducing automatic deletion. Keep per-session prompt data in separate files so routine edits do not rewrite every past session. If left unchanged, normal long-term use accumulates private text and makes every draft operation increasingly expensive.

### RS-5 — P2: Preserved usage journals have no supported recovery step

**Confirmed recovery gap, with an existing regression test for preservation.** An accounting failure correctly stops fallback and leaves the helper's temporary home intact. The failed recorder cannot be reopened: its failure flag is permanent and `createUsageRecorder()` requires creating a new session directory. On the next run a new UUID is used. The only production reconciliation call is in the current rewrite's `finally` block; there is no startup scan, recovery registry, or retry command for a previously retained journal.

References: [models.ts](../../../src/copilot/models.ts):163, 192–193, and 258–279; [usage.ts](../../../src/copilot/usage.ts):117–150; [models.test.ts](../../../src/copilot/models.test.ts), test “a usage flush failure is visible and preserves the helper directory for recovery”; [models.ts](../../../src/models.ts):117–133. A repository-wide search found no other production `reconcileUsageJournal` caller.

**Practical reproduction:** Make the recorder's `flush()` reject after a synthetic model result, as the existing adapter test does. Verify the helper directory remains. Start another rewrite: it uses a fresh session ID and never revisits that directory. Raw recovery journals may include request/context/response text, unlike the filtered permanent receipt source.

**Smallest fix:** Persist an internal record of owned failed helper journals and provide a bounded retry that resumes receipt output by accounting identity after the original helper has stopped. Delete raw recovery files only after successful durable reconciliation. A documented manual recovery command is a smaller initial option. Do not erase accounting automatically to solve growth. If left unchanged, a transient disk problem can leave paid usage absent from the normal retained source indefinitely and leave raw temporary transcripts waiting for manual recovery or OS cleanup. This is disclosed as a limitation in [copilot-background-rewriting.md](../../copilot-background-rewriting.md), not evidence that every failed request is unaccounted for.

## Runtime and update trust boundaries inspected

| Boundary | Observed behavior and limit |
| --- | --- |
| Shipped code | `scripts/build.mjs:20` bundles the extension while leaving both Copilot SDK entry points external. The host loads the committed `extension.mjs` and compiled local panel. No SDK npm installation or runtime download exists in the production model path. |
| Runtime selection | `src/copilot/models.ts:34–76` uses the current executable, a Copilot executable basename, recognized bootstrap argument, SDK environment marker, parent PID match, and `realpath`. It does not search PATH for a runtime or honor a profile executable. These are host-context checks, not a cryptographic signature verification. A compromised same-user host/runtime remains outside this guarantee. |
| Executed helper | `src/copilot/models.ts:182–208` starts the same runtime through stdio with `--no-auto-update`, an owned empty workspace and temporary Copilot home. It passes an allowlisted OS/auth/proxy/certificate environment, disables discovery, tools, hooks, extensions, MCP, skills, shared session retrieval, and telemetry, and denies permission requests. The helper still has the OS account's privileges; isolation is enforced through SDK/runtime behavior. |
| Pre-inference checks | `src/copilot/models.ts:210–241` checks requested session identity, same authenticated GitHub login/host, eligible Copilot entries in both catalogs, exact helper directory, empty actual tools, actual model and reasoning, vision support, then account identity again. Unknown provider/policy entries fail closed. Raw SDK errors are not returned to users. |
| Paid usage | The recorder is prepared before inference. Rewrites, selection, research, fallback attempts, and model tests use the same model route. Live and stopped-helper receipts are deduplicated, allowlisted, and flushed before normal deletion. Explicit accounting failures stop fallback. No account billing amounts or delayed real receipts were validated in this audit. |
| Automatic update checks | `src/updates/metadata.ts:27–95` uses credential-free GET/HEAD to two fixed HTTPS hosts, rejects redirects, caps JSON at 128 KB, and reads manifests/catalogs at a resolved commit. Requests send repository/source metadata, not prompts or project content. Checks do not evaluate executable content. |
| Installation identity | `src/copilot/update-installation.ts:33–72` matches the actual package root against managed records, current inventory, marketplace registration, recorded source and version. It refuses local/ambiguous/unrecognized sources and inventory disagreement. Forks and configured refs remain their own source; pins/tag ambiguity are refused by metadata resolution. The experimental profile/cache layout remains an integration dependency. |
| Human authorization | `src/copilot/server.ts:93–103` allows update only through the authenticated panel API and rejects client-supplied target fields. The canvas exposes no update action. `src/updates/service.ts:122–145` revalidates metadata, reserves work transactionally, rereads installation, and asks the attached session to update only the resolved plugin identity. It does not answer permissions or use a CLI fallback. |
| Update completion | Installation success requires a fresh consistent disk/inventory/provenance view with an adequate version, not only SDK success. A timeout keeps a durable pending operation while its owner PID lives; a late result is verified. Failed requests are not retried through an alternate installer. The adapter follows the selected branch; it does not pin the install operation to the metadata commit or verify a package signature. |
| Persistent state | `src/copilot/storage.ts:31–47` uses renewable `proper-lockfile` locks, nested transactions, restrictive creation modes, and rename-based replacement. History changes and normal profile edits use transactions. The source contains no silent corruption reset: malformed state throws. No power-loss durability or filesystem corruption recovery was tested. Windows ACL inheritance, not POSIX mode flags alone, determines local access. |
| Diagnostics | `src/diagnostics.ts:4–20, 36–78` projects known operations/error codes and keeps 200 entries. Model/account/request text and raw SDK errors are excluded. Logs are memory-only until the user copies them. |

Permanent usage storage is deliberately unbounded and explicitly independent of Save history and Delete everything. It has one directory per helper with a start event, workspace metadata, and receipts. `src/copilot/usage.ts:125–145` also rebuilds that session's entire receipt string on each event; normal one-request helpers have few events, so the separate benchmark's many-small-sessions and abnormal-one-session cases should be distinguished. Do not describe retention of accounting as a new privacy defect or delete it without a chosen accounting policy.

## Hypotheses and integration questions, not confirmed bugs

1. **Managed-policy authentication needs a real Copilot preflight.** The locally installed SDK's `types.d.ts:2726–2731` says `enableManagedSettings: true` requires session `gitHubToken` and expects a fail-closed rejection if omitted. The plugin sets that option at `src/copilot/models.ts:207` but supplies neither session token nor token provider; it uses existing runtime authentication instead. The installed `index.js:15631–15638` forwards the fields without filling a session token in that request. The local provider fixture injects an external provider and fake account/catalog (`scripts/e2e-copilot-provider.mjs:42–60`), so it does not settle whether current real Copilot authentication satisfies this contract or how managed enterprise policies behave. No live account call was made. Treat this as a compatibility gate to verify, not proof that current rewriting is broken.
2. **PID reuse can retain a stale work/update reservation.** Ownership records keep only a PID (`src/updates/service.ts:8–14, 23, 60, 134, 160`). A different live process can eventually reuse a crashed owner's PID, making that reservation look live. Ordinary dead-owner recovery passed. Actual OS PID reuse was not forced. A process-instance token tied to a held lease would remove the ambiguity; never clear a possibly live install on a time limit alone.
3. **SDK privacy options are experimental promises.** The actual empty tool list, directory, model, account and reasoning are checked, but the plugin does not negotiate all discovery/privacy capabilities. Read-only inspection found the relevant options in this installed SDK. That is not proof future SDK versions enforce them identically. Keep the installed-runtime isolation fixture as a release gate after desktop updates.
4. **Branch movement remains outside the metadata snapshot.** The checker resolves a commit, but the update RPC accepts the installed plugin name, not that commit. A branch can move between checking and installation. Source/version verification detects several mismatches but does not bind installed bytes to a reviewed changelog commit. This is the stated branch-following update model; exact artifact approval would require a stronger host contract.

The installed SDK files inspected read-only were under `%LOCALAPPDATA%/Programs/GitHub Copilot/copilot-sdk`: `types.d.ts`, `extension.d.ts`, `generated/rpc.d.ts`, `generated/session-events.d.ts`, and relevant sections of `index.js`. In particular, `index.js:15221–15278` shows `forceStop()` disconnecting listeners, killing its own child, and waiting for its exit; this supports the need to retain usage journals until stop/reconciliation completes. `generated/rpc.d.ts:40572–40645` describes the attached-session plugin APIs retaining account, working directory and managed policy. These local declarations were not replaced with assumptions from generic CLI documentation.

## Coverage inventory and evidence

Read in full: `src/copilot/models.ts`, `usage.ts`, `services.ts`, `storage.ts`, `update-installation.ts`; every production module in `src/updates`; `src/models.ts`, `llm.ts`, `worker.ts`, `rules.ts`, `presets.ts`, `effort.ts`, `privacy.ts`, and `diagnostics.ts`. Also traced `src/copilot/extension.ts`, `server.ts`, `worker-host.ts`, relevant session/context identity lines, history bounds, attachment cleanup entry points, build configuration, and current privacy/runtime/update documentation. Tests in the assigned areas were inspected, with deeper reads of model, accounting, storage and update fixtures.

| Verification | Result | What it establishes |
| --- | --- | --- |
| Focused source suites: Copilot models/usage/storage/update-installation, update service, models/rules/effort/privacy/diagnostics, update transport | **87 passed**, 0 failed, about 1.1 seconds | Current fixture expectations for provider/account rejection, helper options, receipt projection, migration, history locking, source/provenance decisions, backoff, update authorization, and save flushing. |
| Worker and authenticated server suites | **30 passed**, 0 failed, about 8.7 seconds | Rewrite chains, timeout/cancellation/resume ownership, context fixtures, strict panel API/update requests. |
| Additional cancellation/update fixture | **Bug reproduced** | The work reservation vanishes while the underlying synthetic model remains active. |
| Additional in-flight history switch fixture | **Bug reproduced** | Current Save history is false while new prompt/result text lands in history. |
| Additional long-path rule fixture | **Bug reproduced** | Distinct 211-character canonical path strings share the scope and apply the same rule. |
| Additional separate-process work reservation fixture | **Passed** | A real child Node process's live reservation prevents a parent updater from installing; after killing only that fixture child, install proceeds. No Copilot process is involved. |

Commands run from the repository root:

```powershell
node --test src/copilot/models.test.ts src/copilot/usage.test.ts src/copilot/storage.test.ts src/copilot/update-installation.test.ts src/updates/updates.test.ts src/models.test.ts src/rules.test.ts src/effort.test.ts src/privacy.test.ts src/diagnostics.test.ts scripts/update-transport.test.mjs
node --test src/worker.test.ts src/copilot/server.test.ts
```

The additional fixtures were passed to `node --input-type=module` through a PowerShell single-quoted here-string; they imported production functions, used synthetic data, and removed only their verified temporary roots. No fixture script or test data was added to the shipped package. The combined cancellation/update scenario should become a permanent regression test when fixed. Existing “simultaneous instances” update tests use multiple services in one process; the separate-process check above adds evidence but is not yet a maintained regression test.

**Verdict:** Preserve the existing fail-closed provider/update design. Fix the history privacy race and cancellation lifetime tracking before relying on v1 privacy/update guarantees, then remove the project-scope collision and define recovery/retention behavior.

**Not checked:** Live Copilot account/catalog/billing, desktop-only credentials, enterprise policy combinations, actual remote plugin installation, runtime download/signature provenance, desktop restart presentation, screen-reader/keyboard behavior, OS crash/power-loss durability, and the separate large-storage benchmarks. This sub-audit did not rebuild, run the full repository suite, or rerun installed-runtime integration scripts; its only repository change is this report.

Plugin **0.12.0**, baseline commit `d25be463718f1b5d8ab663177fc9aa248956f762`. Findings remain unfixed. This workstream's scope is distinct from the parent audit's later [full-project and installed-runtime verification](verification.md).
