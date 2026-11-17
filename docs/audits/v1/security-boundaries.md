# Security boundaries audit — v0.12.0

What this repo does: Enhance Prompt collects selected project context, rewrites a request through Copilot, and lets a person send the result to the attached session. This review assumes one person using several canvases or sessions, an untrusted project tree, and an authenticated local UI. It does not treat a process already running as the same OS account as an unauthenticated remote attacker.

Reviewed source commit: `d25be463718f1b5d8ab663177fc9aa248956f762`. Audit date: 2026-11-16. Platform: Windows; Node `v24.22.1`; Git `2.55.0.windows.3`.

Five concrete boundary failures were reproduced with synthetic fixtures. The first three affect automatic collection or a user action already in progress. Attachment confinement and malformed session metadata are additional hardening gaps. The existing focused suite passes, so the cases need new regression coverage.

| ID | Priority / severity | Demonstrated result |
| --- | --- | --- |
| SB-01 | P1 / High, conditional on repository configuration | A context diff executes a repository-configured clean filter. |
| SB-02 | P1 / High privacy impact | Revoking project-file access during AI selection does not stop later file reads and disclosure to the rewrite request. |
| SB-03 | P2 / Medium | Closing a canvas aborts its Send response, but the prompt can still be enqueued afterward. |
| SB-04 | P2 / Medium hardening | An attachment-directory junction permits reading and appending to a file outside that directory. |
| SB-05 | P2 / Low hardening | Missing remote/local status is accepted as a local project. |

## Must fix

### SB-01 — Context collection can execute repository clean filters

**Location:** [src/context/git.ts](../../../src/context/git.ts#L19), lines 19–32 and 124–136; called by [src/context/index.ts](../../../src/context/index.ts#L433), lines 433–437.

**Trigger and impact:** Enable Git context and preview or enhance at Relevant code, AI-assisted, or AI Test level in a repository whose `.gitattributes` selects a configured `filter.<name>.clean` or process filter. Git may run that program when comparing worktree content to the index. `core.fsmonitor=false`, `--no-ext-diff`, and `--no-textconv` do not disable clean filters. This allows filesystem writes and arbitrary program behavior during an operation presented as read-only collection.

This is a conditional code-execution finding. A normal clone does not transfer the source repository's `.git/config`. The malicious command must already be in applicable Git configuration, for example in an imported repository directory or an existing configured filter. A tracked `.gitattributes` file alone cannot invent an arbitrary executable. The fixture did not establish a remote exploit or execution by merely opening the canvas.

**Observed in isolation:** The production diff helper caused a benign configured filter to create a marker file inside a disposable repository. The separately tested status helper did not create that marker. No owner repository was modified.

**Smallest fix:** Before commands that inspect worktree content, inspect effective filter configuration without executing filters, then disable every configured clean/process filter and its required flag for those child commands. Fail closed if the configuration cannot be safely inspected. A simpler conservative first fix is to omit worktree Git diff/search when such filters are configured, retaining safe project excerpts. The initial `--name-status` diff also needs the protection; it runs before the final file-exclusion pathspec is built.

**Protect:** Keep literal argument arrays, bounded output/time, Git opt-out, cancellation, rename-side exclusions, and credential masking. Do not replace this with a shell command or silently change normal user Git configuration.

**Regression gap:** Existing Git tests check exclusions, masking, cancellation and aliases, but never install a harmless clean/process filter and assert that preview and enhancement cannot execute it. Also exercise a filter on an excluded file, since name discovery happens before final exclusions.

### SB-02 — Privacy revocation during AI selection does not stop later reads

**Location:** [src/worker.ts](../../../src/worker.ts#L270), lines 270, 306–329 and 372; [src/context/index.ts](../../../src/context/index.ts#L497), lines 497–522. Preview also captures settings once at [src/worker.ts](../../../src/worker.ts#L606), lines 606–621.

**Trigger and impact:** Start an AI-assisted enhancement with project-file access enabled. While the selector is running, switch off project-file access or change file exclusions from another canvas. Once selection completes, the original gather continues using its captured policy and sends later source excerpts to the rewrite model. Only AI Test has the explicit `checkResearchAccess` revalidation.

**Observed in isolation:** The final rewrite payload contained synthetic file content created only after project access was revoked. Both selector and rewrite responses were local stubs; no provider received data.

**Smallest fix:** Reuse a run-level policy validator for every context mode, including preview. Check it before each read and each selector/rewrite call, and after asynchronous selector work. A privacy/exclusion change should cancel the run with a clear retry message. Keep prompt-set preference snapshots separate: those snapshots are intentional and must remain stable within a run.

**Protect:** Preserve the existing AI Test revocation checks, initial opt-out downgrade to Basic, canonical-path exclusions, and explicit-attachment behavior. Attachments, typed requests and custom rules are deliberately outside automatic project masking, as documented in [privacy.md](../../privacy.md).

**Regression gap:** AI Test already has a revocation test. Add the equivalent to AI-assisted mode, ordinary collection paused between steps, and preview; assert no later reads and no later model request after revocation. Test exclusion changes as well as the boolean switch.

### SB-03 — Send survives cancellation while idle-state checks are pending

**Location:** [src/worker.ts](../../../src/worker.ts#L630), lines 630–636; [src/copilot/session.ts](../../../src/copilot/session.ts#L65), lines 65–75; [src/worker-host.ts](../../../src/worker-host.ts#L49), lines 49–54 and 96. HTTP close wiring is at [src/copilot/server.ts](../../../src/copilot/server.ts#L52), lines 52–57.

**Trigger and impact:** Click Send, then close the canvas while one of the SDK idle-state checks is pending. `closePanel()` aborts the request and rejects the response, but the Send handler never receives or forwards its `AbortSignal`. When the checks later report idle, `session.send({ mode: 'enqueue' })` still runs. A user-visible cancellation therefore does not cancel the action it reports as cancelled.

**Observed in isolation:** The request rejected as aborted when the canvas closed, but the stub session subsequently received one enqueue call after the pending activity check resolved. No actual session received a prompt.

**Smallest fix:** Accept the request signal in `prompt.send`, pass it through the project host contract and adapter, and check it immediately before dispatch after all asynchronous idle checks. An already-dispatched SDK send may be irreversible; distinguish that point from cancellation before dispatch.

**Protect:** Retain attached-session matching, fail-closed activity/permissions/queue checks, concurrent-send exclusion, the duplicate-send cooldown, and enqueue-only mode. This fix must not answer permissions or introduce immediate steering.

**Regression gap:** Session tests cover busy/blocked/queued/disconnected states and simultaneous clicks; context tests cover cancellation. Neither closes a canvas or aborts Send while the SDK check is paused. Add that interleaving, asserting zero send calls.

## Should fix

### SB-04 — Attachment confinement is lexical and accepts an outside junction target

**Location:** [src/attachments.ts](../../../src/attachments.ts#L47), lines 47–62 and 94–96; [src/attachments.ts](../../../src/attachments.ts#L122), lines 122–133; caller at [src/worker.ts](../../../src/worker.ts#L353), line 353.

**Trigger and impact:** A directory junction/symlink exists beneath the shared temporary attachment directory. `loadFiles()` checks only the submitted path string, then `stat()` and `readFile()` follow the link. It therefore reads a file that was never uploaded and lies outside the attachment directory. A later `putChunk` with `index: 1` accepts the existing file as proof that earlier chunks arrived and appends outside the directory too.

**Observed in isolation:** A Windows directory junction beneath the test attachment root permitted both reading a synthetic outside file and appending to it. This requires filesystem control over that directory plus an attachment request or selected path; it is not a demonstrated web-origin bypass or privilege escalation.

**Smallest fix:** Canonicalize the attachment root and destination before reads/writes and reject reparse-point/link escapes. Track completed uploads and active chunk sequences so arbitrary existing paths are not accepted as uploaded files, and bind that ownership to the appropriate session. For protection against an actively changing local tree, hold/open verified file handles rather than relying only on a check followed by a path reopen.

**Protect:** Preserve explicit attachments, Unicode-safe filenames, byte-based image recognition, size caps, age cleanup, restored session drafts, and inclusion of attachment paths in the final prompt. Do not apply automatic secret masking to explicit attachment contents without a product decision.

**Regression gap:** Attachment tests reject ordinary outside paths and `..` traversal, but do not test file links, directory junctions, an arbitrary preexisting file, another session's upload, or a noninitial chunk without an upload record. Project-file tests already demonstrate the useful junction pattern; apply it to this separate boundary.

### SB-05 — Unknown remote status becomes permission to read locally

**Location:** [src/copilot/session.ts](../../../src/copilot/session.ts#L33), lines 33–37.

**Trigger and impact:** The SDK snapshot has an absolute working directory but omits `isRemote` or returns `null`. The check `if (info.isRemote || ...)` accepts those values, resolves the path and exposes it as a local project. That is fail-open behavior for an uncertain root, contrary to the project's boundary requirement.

**Observed in isolation:** A deliberately malformed snapshot with an absolute working directory and no remote-status boolean was accepted. The runtime declaration expects a boolean; no malformed live SDK response was observed.

**Smallest fix:** Require `isRemote === false`, a string absolute working directory, and a canonical directory. Return no local project on invalid or unavailable metadata.

**Protect:** Continue deriving the source from `metadata.snapshot().workingDirectory`, preserving canonical project IDs, and rejecting explicitly remote roots. Never substitute `session.workspacePath`.

**Regression gap:** The existing session test covers `isRemote: false` and `true`. Add missing, null and wrong-type status, missing/non-string path, and a path resolving to a file.

## Boundaries that held

- **Web-origin and transport:** The server binds only to `127.0.0.1`. Canvas URLs use 32 random bytes; API/SSE require the matching bearer token. Exact Host and supplied Origin checks precede dispatch. The existing tests reject unauthenticated, cross-origin and oversized requests. No unauthenticated API access was demonstrated.
- **Static assets and stored keys:** Static serving resolves real paths under the asset root, rejects encoded/backslash traversal and limits extensions. UI storage reads/writes use allowlists; model state cannot be directly overwritten through generic storage calls. Preferences reject unknown keys and disable unsupported capabilities.
- **Agent-facing API:** Source registration exposes only opening a canvas with an optional prompt; there is no registered send, consent or configuration action. The session ID is checked before opening. Verification here is source-level; live SDK tool presentation was outside this audit.
- **Project files:** Lexical and canonical exclusions work for ordinary static aliases, including aliases to excluded locations. `readText` rejects escaping targets, sensitive filenames, large files and NUL-containing text. Automatic instruction/source/Git masking occurs before excerpt trimming in tested cases. Private-key blocks preserve line positions after masking.
- **Research:** AI Test accepts only bounded JSON plans, limits paths to the original permitted inventory, caps rounds/reads/lines/time, rechecks privacy and cancellation, and supplies no shell/file-write tool to the model. Traversal and malformed-plan fixtures pass.
- **Cross-canvas enhancement:** Live runs are keyed by both panel ID and run ID; resuming another panel's run is rejected. Events are routed to the owner. Settings/history and session drafts are intentionally more broadly shared; they are not all isolated per canvas.
- **Session send:** Without the cancellation interleaving in SB-03, wrong-session, busy, blocked, queued, disconnected and unknown-status sends fail closed. Calls use enqueue mode, never terminal key injection.

## Remaining test gaps and bounded observations

These are not additional demonstrated vulnerabilities:

- The HTTP parser bounds each body and SSE writes have a broadcast-buffer guard, but there is no explicit request/concurrency/SSE-connection quota. Attachment size is bounded per file; the eight-file prompt cap is enforced in the UI, not `loadFiles`. A hostile authenticated client could request repeated paths or concurrent work. Sustained saturation and resource-exhaustion behavior were not load-tested.
- `readText` and static serving resolve a path, then reopen the lexical path. An actively swapping local filesystem can race that check. The attachment escape in SB-04 is deterministic; no project/static-file swap race was demonstrated here.
- `enhance.progress.get` uses a process-global run-ID map without the panel ownership check used for resume. A caller knowing a run ID can access its progress metadata. The request result contains steps and details, not the completed prompt. No cross-session leak was established; prioritize ownership consistency if metadata isolation is a requirement.
- Project file-link cases in the existing test self-report that this Windows environment cannot create file symlinks. Directory-junction coverage ran successfully. Do not describe the suite's overall zero-skipped counter as proof that file symlinks were exercised.
- Git grep has fixed-string arguments, output/time caps and post-search policy checks. Path enumeration and configured filters still require care; SB-01 is the confirmed executable-code route. No shell injection through a search term or model-proposed path was found.
- No live desktop lifecycle, account-backed model call, actual session send, owner project data, installed data-store contents, or UI automation was used.

## Verification and coverage inventory

The eight existing test files below ran together with Node's test runner: **58 passed, 0 failed**. The five dedicated synthetic probes also passed, meaning that each asserted undesirable behavior was observed. Their ignored harness was `.artifacts/v1-audit/security-probes.test.mjs`; no harness, synthetic data, private logs or credentials are part of the release artifacts.

```text
node --test src/copilot/server.test.ts src/copilot/session.test.ts src/context/context.test.ts src/context/agents.test.ts src/context/cancel.test.ts src/context/pipeline.test.ts src/context/research.test.ts src/attachments.test.ts
node --test .artifacts/v1-audit/security-probes.test.mjs
```

| Coverage | Files read |
| --- | --- |
| Transport, canvas, host and protocol | `src/copilot/server.ts`, `src/copilot/extension.ts`, `src/copilot/session.ts`, `src/copilot/services.ts`, `src/worker-host.ts`, `src/host.ts`, `src/protocol.ts` |
| Attachments and images | `src/attachments.ts`, `src/images.ts`, `web/src/attach.ts` |
| All production context modules | `src/context/index.ts`, `files.ts`, `git.ts`, `search.ts`, `research.ts`, `instructions.ts`, `stack.ts`, `secrets.ts`, `relevance.ts`, `agents.ts`, `activity.ts`, `terminals.ts` |
| Existing focused tests | `src/copilot/server.test.ts`, `src/copilot/session.test.ts`, `src/attachments.test.ts`, `src/context/context.test.ts`, `agents.test.ts`, `cancel.test.ts`, `pipeline.test.ts`, `research.test.ts` |
| Shared flow inspected selectively | `src/worker.ts` settings, enhancement, resume/progress, Send, attachment, consent and editor handlers; `src/testing.ts`; privacy/default settings; panel run-ID generation |
| Contract and environment evidence | `AGENTS.md`, `README.md`, `docs/privacy.md`, relevant context/workflow/migration documentation passages, `package.json`, `.gitignore`, `src/version.ts` |

Not checked here: model-helper account/catalog enforcement, update download/install safety, durable storage concurrency, all UI behavior, full build/typecheck/check pipeline, cross-platform runtime behavior or production resource saturation. Other audit work may cover those areas; this report makes no claims about their result.

Verdict: fix executable Git filters and privacy revocation first, then close the pre-dispatch Send cancellation gap. Keep the existing path, masking and idle-session protections intact.

Plugin version remains **0.12.0**, baseline commit `d25be463718f1b5d8ab663177fc9aa248956f762`. This sub-audit made no production fixes. See the parent audit's later [full-project verification](verification.md) for the combined results.
