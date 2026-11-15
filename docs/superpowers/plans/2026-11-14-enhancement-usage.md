# Enhancement usage retention implementation plan

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

> **For agentic workers:** Use superpowers:executing-plans for the Enhance Prompt work and superpowers:subagent-driven-development for the independent Usage Insights reader task. Track completed steps here.

**Goal:** Retain background Copilot accounting and show all helpers as separate sessions under the user-requested project label **Enhanced Prompt** in Usage Insights.

**Architecture:** Keep runtime execution in the existing isolated temporary home. Subscribe to runtime usage events and persist an allowlisted accounting-only journal in the plugin's durable `usage` home before temporary cleanup. Usage Insights discovers that home automatically and reuses its existing receipt parser, filters and project/session grouping. Neither plugin writes into Copilot's own session store.

**Tech stack:** Existing TypeScript/Node SDK adapter and JavaScript Usage Insights scanner, with no new dependencies.

## Approved scope and implementation decisions

The owner accepted the accounting-only retention proposal and requested one project named Enhanced Prompt with separate sessions. The existing plugin brand stays Enhance Prompt. No prompt/response text, file contents, credentials, endpoint URLs or account identities are exported. Each helper (including model tests and Max's selection call) is a separate usage session. No native desktop project or chat is opened.

Persist to `<Enhance data directory>/usage/session-state/<owned UUID>/events.jsonl`, with a small `workspace.yaml` (JSON-compatible YAML) for its timestamped name. The root defaults to `%LOCALAPPDATA%/copilot-enhance-prompt/usage` on Windows and `~/.local/share/copilot-enhance-prompt/usage` elsewhere, matching existing plugin storage. `ENHANCE_PROMPT_DATA_DIR` remains supported. The journal starts with `session.start`, `context.repository: 'Enhanced Prompt'`, then contains projected `session.usage_record` entries from live `assistant.usage`. Runtime accounting IDs remain the deduplication keys; absent metrics stay absent, and missing credits stay unavailable. Preserve BYOK attribution for test fixtures; never relabel it as Copilot.

Create the journal before sending. Queue atomic replacements per owned session, reconcile the stopped helper's durable receipts, flush, and report persistence failures without deleting the helper's remaining usage records. Do not use whole receipts or aggregate checkpoint totals as additional calls. Separate helpers have separate files, so simultaneous sessions cannot overwrite each other.

## Review focus

- Failed/cancelled calls can still incur usage; capture reported events on all exit paths.
- Duplicate live events must not double-count, including after reload/force refresh.
- Missing/partial charges must stay distinguishable from complete zero charges.
- Unknown event fields, invalid metrics, provider overrides and secret text must not enter retained records.
- Storage failures must be visible; disabling a source or using a custom data directory must behave predictably.

## Tasks

### 1. Durable accounting writer and helper integration

- [x] Add `src/copilot/usage.ts` and tests for safe projection, deduplication, unavailable/zero/partial credits, concurrency and disk failure.
- [x] Add an SDK usage listener in `src/copilot/models.ts`, prepare storage before inference, flush before cleanup on success/failure/cancellation, and localize recording errors.
- [x] Extend fixture tests to prove persisted accounting survives temporary-home removal and contains no private payload.

### 2. Usage Insights source discovery (independent repository)

- [x] Add optional discovery of Enhance Prompt's usage home, respecting disabled sources and custom paths; use existing journal parser and session names.
- [x] Test project/session grouping, token/credit totals, repeated refresh/deduplication, absent home, disabled source and privacy.
- [x] Follow that repository's release process for the next patch version; build and run its tests.

### 3. Integration, documentation and release

- [x] Exercise the writer with the real installed SDK/runtime and a local model fixture, then the real Usage Insights scanner. Use synthetic Copilot receipts for credit-total assertions; no paid inference or existing-session access.
- [x] Update docs explaining source location, project grouping, no prompt export, missing historical records and limits. Bump Enhance Prompt to 0.2.4 and synchronize all changelogs/generated artifacts.
- [x] Run typecheck, tests, build and package check; independent review of both changes.
- [x] Prepare verified releases for `main`: Enhance Prompt 0.2.4 and Usage Insights 0.1.64. The completion reply records the commit hashes after verifying the pushes.

## Verification and review record

- Enhance Prompt: 299 tests passed; typecheck, build and package check passed. Installed runtime canvas fixture and Copilot-provider fixture passed without paid inference. Cross-repository writer/scanner fixture passed with synthetic accounting.
- Usage Insights 0.1.64: 203 tests and build passed. Reader review found no critical or important issues.
- Producer review found that SDK `forceStop` detaches live event listeners before the child exits. Added bounded reconciliation of the stopped helper's owned durable journal through the same allowlist/deduplication; the installed-runtime fixture suppresses a live event and proves recovery. Invalid usage envelopes now fail visibly and preserve temporary state. Re-review approved both fixes.
- Ruling: keep the source through history/data clearing, matching the owner's request not to delete accounting; disclose it in Settings and privacy docs. Native desktop project creation is unnecessary for Usage Insights grouping.
- Pending user validation: update both installed plugins, restart Copilot, run a real Copilot enhancement and check **Enhanced Prompt** in Usage Insights. Automated tests do not verify real account charges or billing delay. Previously deleted receipts are unrecoverable.
