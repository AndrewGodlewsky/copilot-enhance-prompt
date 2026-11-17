# Remaining v1 work

The owner authorized working through every available issue individually and publishing a GitHub release for each delivered version. Releases remain previews until the owner/account/accessibility gates are verified. This supersedes the earlier no-tags/no-releases restriction for this backlog only.

For each issue: reproduce or establish baseline, implement the smallest complete fix, add meaningful regression/measurement coverage, update English notes and version, rebuild, run the full suite/typecheck/package checks, inspect the diff, push main, publish the matching preview tag/release, and attach evidence to the issue. Never close an unverified manual or product gate.

Current baseline: 0.12.1 / 4104c29. Tracking issue: [#40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40).

## Queue

Security and correctness: #36, #37, #39.

Distribution/maintenance: #9, #10, #11, #33.

Efficiency: #12, #13, #14, #15, #19, #20, #21, #32, #34.

Usability: #24, #25, #26, #27.

Evidence/owner decisions: #23, #29, #30, #31, #35. Prepare the evidence and concrete choices; do independent work while an answer is pending. Never consume the owner's Copilot credits or control desktop/browser UI.

## Current work

- Next: #36, process identity for stale update reservations.

## Delivered versions

### 0.12.8 — #18, backend resource bounds

Finite integer setting ranges, request shape/depth/list limits, eight-file/80 MiB aggregate validation and bounded upload chunk counts now apply behind the UI. Worker operations retain capacity through cancellation cleanup; enhancement concurrency is capped separately. Authenticated HTTP/SSE and canvas limits reject excess work with clear retry guidance; request bodies have bounded size/time. Saved out-of-range numeric preferences use clamped effective values without rewriting them. Existing larger model configurations stay readable/editable; oversized fallback chains and additional profiles are refused. See [resource limits](../../resource-limits.md) for exact bounds.

Verified: typecheck, build, 438 final tests, package checks and clean diff. Regressions first reproduced numeric/list bypasses and unlimited worker calls, then verified limits, cancellation retention, eight uploads and four enhancements, HTTP/SSE saturation, timeout cleanup and remaining capacity for another canvas. Independent review found four simultaneous startups could reject 16 of 80 reads; a failing startup regression led to four-at-a-time restore and bounded retry of read-only capacity failures. A real HTTP fixture now restores all 80 atoms across four canvases with at most 16 simultaneous reads. Installed runtime built-extension fixture passed without paid calls or UI automation. Manual rendering remains #29. Issue #18 records the commit and preview release.

Ruling: quotas apply per worker/server, not to all desktop processes; no OS-wide quota is claimed. Initial restore reads may retry capacity errors twice, while writes and model calls never retry automatically. Existing history retention still follows the effective setting when history changes; validation itself deletes no saved data.

### 0.12.7 — #17, recover retained usage accounting

Helpers register ownership before receiving input. A confirmed stop and cross-process lock protect receipt replay, durable commit and cleanup. Startup retries at most eight stopped journals with persisted backoff; Settings offers a local retry and Show Logs includes counts without transcript text or paths. Receipt identities deduplicate replay after restarts. History clearing leaves accounting intact. Unconfirmed or legacy unregistered helpers remain untouched.

Verified: typecheck, build, 428 final tests, package checks and clean diff. Disk-write failure, concurrent retries (including another process), restart, duplicate receipts, bounded batches, live/replaced/junction paths, and interrupted cleanup are covered. Independent review found three additional defects, reproduced in failing tests and fixed: a real Windows locked file now retains the ownership marker until cleanup succeeds; malformed journal tails settle queued writes; final lifecycle failures remain sanitized accounting errors and cannot trigger another model fallback. Empty-root crash recovery validates original directory identity. Installed SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3` passed production helper and built extension local fixtures without paid inference or owner installation changes. No UI automation; Settings appearance remains a manual check. Issue #17 records the pushed commit and preview release.

Limits: unknown helper shutdown, changed ownership, malformed/unreadable retained data and older unregistered helpers are not automatically deleted. They can need maintainer-assisted recovery. This is not an OS sandbox against another process running as the same user.

### 0.12.6 — #16, complete attachment inputs

Upload behavior now lives in the testable panel layer. The whole selected batch is reserved before awaiting a file, using unique IDs even for duplicate filenames. Both enhancement buttons and their operation boundary refuse pending/failed uploads. Cancel explicitly excludes a file; failures remain visible with Remove/re-attach guidance. Clear is blocked while uploads run and clears failures afterward. Closing aborts upload requests and discards late results. Auto-send checks both attachment identities and upload revisions after enhancement.

Verified: typecheck, build, 416 final tests, package checks and clean diff. The delayed batch test first failed, then passed with both enhancement paths blocked, full attachment inclusion and no send on completion. Additional regressions cover duplicate names, final-chunk failure/retry, incomplete responses, Cancel/close, restored state, Clear, changed attachments and cancelled late uploads before auto-send. Static UI checks cover both buttons and accessible Cancel. Independent review passed 18 focused tests with no blockers. No paid calls or desktop/browser UI control; manual appearance checks remain #29. Issue #16 records the pushed commit and preview release.

### 0.12.5 — #7, complete project identities

New project rules and history retain full canonical paths up to 32,768 UTF-16 code units. Labels remain separate from matching. Versioned identity markers distinguish new complete paths from legacy values at the old 200-character cap. Ambiguous old rules remain visible with recovery guidance but never apply; ambiguous history remains searchable under No project recorded and warns on reuse. Saved text and paths are preserved.

Verified: typecheck, build, 411 final tests, package checks and clean diff. Long Windows/Unicode paths with shared prefixes first reproduced rules/history collisions. Regression coverage checks distinct worktrees and duplicate folder labels, short legacy compatibility, exact-cap new identities, oversized identities and preserved content. Independent review found two whitespace collisions; both were reproduced in failing tests and fixed before the final rebuild/suite: preserve raw legacy cap evidence and complete paths ending in Unicode whitespace, including context lookup. No SDK integration changes, paid inference or desktop UI control. Manual layout verification remains in #29. Issue #7 records the pushed commit and preview release.

Ruling: old identities exactly at the historical cap are conservatively treated as incomplete, even if a rare original identity was exactly that long. The old format has no completeness marker. This costs a manual rule re-add or history classification, avoiding guesses that could apply another project's rules.

Ruling: an old version may already have trimmed a clipped trailing space and resaved a shorter identity. That cannot be distinguished from a legitimate short legacy identity. Preserve short compatibility, document manual review for those old rules, and do not guess or delete saved content.

### 0.12.2 — #2, in-flight privacy

Context permissions/exclusions are rechecked at file, Git, selection, research, preview and rewrite boundaries, including background helper startup and fallback attempts. Policy errors propagate instead of becoming ordinary unreadable-file results. The original/enhanced prompt preference still stays fixed for a run. Whole-settings reads now use one atomic snapshot rather than one read per key.

Verified: typecheck, build, 394 final tests, package checks and clean diff. New regressions first reproduced stale preview/selection/fallback payloads and model sends during helper preflight; all now pass. Independent review ran 81 focused tests. Installed SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3` passed the production helper's local HTTP fixture (isolation, output, reasoning, images, cancellation, accounting and cleanup), with no paid inference. Node 24.22.1, Windows x64.

Limits: already-sent content cannot be recalled. No desktop UI control or owner account tests. The file-symlink fixture needs Windows privilege; junction confinement tests run normally. Issue #2 records the exact pushed commit and preview release link.

### 0.12.3 — #5, attachment ownership and confinement

Uploads have durable session-owned receipts, strict chunk sequence/size checks and cross-process locking. File operations validate canonical boundaries and hold verified regular single-link handles; BigInt file identities preserve Windows inode precision. Existing directories are never overwritten. Saved draft/parked attachments are adopted only after safe validation. Cleanup removes only registered original files, including writes interrupted before receipt commit; unknown/replaced files and links stay untouched.

Verified: typecheck, build, 401 final tests and package checks; built extension smoke test with the same installed SDK/CLI and disposable local fixture. Outside junction and forged later-chunk regressions failed before the fix. Coverage includes root junctions, hard links, replacements, duplicate/out-of-order chunks, other sessions, legacy draft restoration, Unicode names, byte-sniffed images, limits and interrupted writes. Independent review passed 25 focused tests and injected a failed receipt rename to check recovery. No paid inference or UI automation.

Limits: a malicious process sharing the OS account can still race parent directories or modify receipt files; this is not an OS sandbox. Unregistered legacy data is intentionally not recursively deleted. Manual desktop attachment/reopen checks remain in #29. Issue #5 records the pushed commit and preview release.

### 0.12.4 — #6, cancelled work and update reservations

Underlying request handlers and enhancement outcomes remain tracked after callers cancel. The production updater includes those operations and background helper shutdown/accounting/cleanup in its busy check. A failed helper stop remains an update blocker until the worker restarts; usage is not erased to bypass it.

Verified: typecheck, build, 403 final tests, package checks and clean diff. A regression first demonstrated a separate child-process updater installing during cancelled cleanup; both enhancement and model-test paths now keep it blocked and permit installation once cleanup settles. Cancellation returns before the held cleanup. Provider tests hold both shutdown and accounting and simulate failed shutdown. Independent review ran 21 focused tests with no blockers.

Installed SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3`: production helper fixture passed; disposable update fixture passed inventory/disk verification, old running process and reopened canvas, new session and cold resume. No paid models, live owner installation changes or desktop UI control. Issue #6 records the commit/release.
