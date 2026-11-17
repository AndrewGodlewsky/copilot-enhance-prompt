# Remaining v1 work

The owner authorized working through every available issue individually and publishing a GitHub release for each delivered version. Releases remain previews until the owner/account/accessibility gates are verified. This supersedes the earlier no-tags/no-releases restriction for this backlog only.

For each issue: reproduce or establish baseline, implement the smallest complete fix, add meaningful regression/measurement coverage, update English notes and version, rebuild, run the full suite/typecheck/package checks, inspect the diff, push main, publish the matching preview tag/release, and attach evidence to the issue. Never close an unverified manual or product gate.

Current baseline: 0.12.1 / 4104c29. Tracking issue: [#40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40).

## Queue

Security and correctness: delivered; see versions below.

Distribution/maintenance: #11 (manual/maintainer confirmation pending), #33 (runtime package prepared; stable channel/manual gates pending).

Efficiency: #12, #13, #14, #15, #19, #20, #21, #32, #34.

Usability: #24, #25, #26, #27.

Evidence/owner decisions: #23, #29, #30, #31, #35. Prepare the evidence and concrete choices; do independent work while an answer is pending. Never consume the owner's Copilot credits or control desktop/browser UI.

## Current work

- In progress: #33, optional runtime package and channel policy. Next: #12, partition session drafts. #11's guidance shipped in 0.12.14 / 1a21bfa; hosted CI passed (run 44035339697), with manual/maintainer confirmations still open.

## Delivered versions

### 0.12.15 — #33, optional runtime archive

A committed-tree allowlist produces a runtime-only ZIP, exact archive checksum and per-file/size report. It validates the existing inventory, full notices, manifest, version and regular-file paths, then independently lists/extracts the ZIP and compares bytes. It rejects stale input, omitted files from Git export attributes, links and overwrites. Source remains at the recorded commit; no SDK/runtime/npm dependency is added.

Verified unit cases first failed before the packager existed, then passed. A disposable real CLI install matched every expected package file's hash. Its built extension passed registration, asset/context/privacy/theme/diagnostic/sending fixtures; a synthetic metadata-only managed update preserved other package bytes and separate synthetic drafts/results/preferences. No paid model calls, live installs or desktop UI. Typecheck/build, all 457 final tests and package/diff checks pass; the final rebuilt package passed the runtime fixture again. Exact measured archive/source sizes and hosted CI are recorded with the release assets and issue evidence.

Independent review found no blockers. Final minor (deferred): installed-cache tests do not enumerate unexpected host-created files; they compare all expected file hashes. Evidence wording is corrected to reflect that limit. Archive tests do reject extra/missing ZIP members. No claim about the host adding zero cache metadata is made.

Ruling: retain the existing root marketplace and all fork/ref/pin behavior. The optional ZIP is a manual local install with online updates unavailable; it is not a silent distribution migration. Stable managed small-package channel/signing decisions and desktop branding/data checks remain open in #33. Hashes are integrity comparisons, not signatures; Git transfer sizes and cross-toolchain archive reproducibility are not claimed.

### 0.12.14 — #11, security support and recovery

Private reporting was enabled via the GitHub API and rechecked; its public reporting route returned HTTP 200. SECURITY.md describes preview support, maintainer ownership, safe report content, disabling/restarting, component-specific updates, retained accounting and reviewed rollback. Settings links to the guide and private report without changing public Feedback. No self-disable command, restart, uninstall or automatic upload is exposed.

Verification: Settings rendering first failed for missing guidance/links, then passed with static HTTPS destinations and safe external-link attributes. A disposable CLI fixture installed a synthetic plugin, disabled/re-enabled it across separate processes and verified a retained data sentinel. Runtime `1.0.106-8.unstable.r43566476370.g869eef3`, Windows x64; no model calls, owner-profile mutation or GUI automation. Full build/test/CI evidence is attached to the issue/release before publication.

Local typecheck/build, all 456 final tests, package and diff checks pass. Independent review passed both composer tests, checked eight local documentation links, and found no blockers. Hosted CI is checked on the exact release commit before publication.

Ruling: keep #11 open until the owner confirms desktop pause/re-enable/data retention and private-report notification/response expectations. An API-enabled route is not proof of inbox delivery. No numeric response commitment or immediate worker shutdown is claimed. Guidance deliberately avoids deletion and policy bypass. Owner questions are pending; other issues can proceed.

### 0.12.13 ? #10, clean-build CI and monitoring

Read-only Windows workflows install both locks with pinned Node/npm, run typecheck/build/final tests/package checks, and reject modified/staged/deleted/untracked generated artifacts. Separate full-tree audits cover both roots on schedule and dependency changes. SHA-pinned actions and weekly Dependabot PRs cover both npm roots/actions; no secrets, model calls, auto-merges or publication.

Local verification: clean root/web npm ci, typecheck/build, 454 final tests, package checks and clean diff pass. Both full dependency audits report zero known advisories. A failing generated-guard regression now covers modified/staged/removed/new outputs and excludes unrelated files. Independent review found no blockers. Actual GitHub runner evidence will be recorded in #10 before publishing.

The first real Windows CI run passed 446/454 tests and failed eight usage-recovery tests: the trusted accounting root can use Windows short-name/case aliases. A local case-alias regression reproduced the failure. Resolve that trusted root before validating its recovery child; root and child links are still refused. Both new regressions pass. The corrected full suite has 456 tests; the final runner result is attached to #10 before release.

Final GitHub Verify passed on fb2ce46 (run 44034466167); dependency audit passed on unchanged locks/workflow at 9347e90 (run 44033872155). Version 0.12.13 was pushed to main and published as a preview; #10 is closed. Local and hosted suites both passed 456 tests.

Repository API verified alerts/security-update PRs were disabled; both are now enabled and rechecked. Secret scanning/push protection were already enabled. Main is unprotected, with no rulesets; workflows are read-only but repository policy allows all actions. Ruling: do not change direct-to-main policy by silently imposing PR-only enforcement. CI status is advisory until owner policy changes. Documented in [maintenance](../../maintenance.md).

### 0.12.12 ? #9, distribution notices and inventory

Builds trace four backend and 54 frontend emitted JS packages, plus two reviewed CSS packages, to locked versions and full license/copyright/notice texts. Root THIRD_PARTY_NOTICES.md and runtime-inventory.json ship with the unchanged original MIT license. Copied shadcn/ReUI source notices and art/font provenance are documented. No additional runtime dependency/download is added.

Verified: typecheck/build, 453 final tests, package checks and clean diff pass. Repeated generation produced identical inventory/notices. Drift checks cover locks, sources, artifacts, assets and full notices; test coverage verifies runtime-vs-build classification, copied/icon notices, missing/empty licenses and newline stability. Independent review found omitted CSS source hashes; a failing regression was added and the omission fixed before rebuilding and rerunning the suite. No paid inference or UI automation.

Ruling: react-remove-scroll-bar 2.3.8 omits its LICENSE and its npm gitHead is unavailable upstream. A version-scoped official current MIT snapshot is retained with the author and provenance explicitly documented, without claiming historical byte identity. Future versions fail until licensed/reviewed. Canonical text hashes normalize CRLF to LF and are not exact archive digests. Exact copied component versions were not recorded upstream; retain both shadcn/ReUI notices conservatively. Issue #9 records commit/release.

### 0.12.11 ? #39, moving-source update verification

Verification failures now retain expected source fingerprint/version across reopening and source-cache resets, before any reload notice. Interrupted journals require source as well as version. Newer same-source installs identify the actual installed version; Update explains that notes do not pin installation bytes.

Verified: three failing regressions reproduced misleading reload outcomes and missing version detail. Typecheck/build, 451 final tests, package checks, clean diff and disposable installed-runtime update fixture pass. Independent review passed 20 focused updater tests without blockers. Fixtures cover source redirects, older/prerelease mismatches, same-source advancement, metadata commit snapshots and interrupted recovery. SDK declarations and current official CLI documentation expose name-based updating only. No paid calls, owner branch changes, live installation changes or UI automation.

Ruling: a successful explicit check after the user reviews Copilot acknowledges current provenance; automatic checks cannot do so. Same-version changed bytes cannot be verified by this host contract. No alternate installer, silent pin/source change, signature claim or automatic rollback is introduced. Stronger stable artifacts remain #33/#35. Issue #39 records commit/release.

### 0.12.10 ? #37, confined file reads

Project and static reads share a bounded verified-handle reader. Fresh canonical checks, BigInt identities and before/after metadata reject detected replacements; hard links are omitted, privacy errors propagate, and static responses preserve MIME/CSP with generic 404 failures. See [file-read boundary](../../file-read-boundary.md).

Verified: a failing owned-junction fixture first exposed outside project text; it now returns null. Typecheck, build, 446 final tests, package checks, clean diff and installed-runtime built-extension fixture pass. Independent review passed 19 focused tests with no blockers. Coverage includes growth/replacement, held handles, access revocation, hard links, Unicode, bounds and HTTP safeguards. No paid calls, owner data or UI automation.

Ruling: hard links are refused because their other names cannot be confined. Detected edits require refreshing context. This is defense in depth against path races, not an OS sandbox against a malicious same-user process. Windows may itself refuse parent renames while a child handle is open. Linux and privileged file-symlink behavior were not exercised. Issue #37 records the commit/release.

### 0.12.9 — #36, update reservation process identity

New work and installer reservations record OS process creation identity alongside PID. Windows uses a bounded hidden built-in PowerShell read of StartTime UTC ticks; Linux uses boot identity and process start ticks. A live PID with a different known creation identity no longer owns an old reservation. Positive matches cache for five seconds; mismatches requery. Missing/unsupported identity and older PID-only records stay conservative, with no age-based expiry.

Verified: typecheck, build, 441 final tests, package checks and clean diff. Synthetic PID reuse first reproduced an indefinitely reserved interrupted install; regressions verify old work recovery, matching/unknown identities, legacy records, late completion and unchanged user data. Real Windows parent/child identities are distinct and become unavailable after child exit. Existing real child-process work/cancellation exclusion passes. Independent review passed 17 focused tests with no blockers. Disposable installed-runtime update fixture passed inventory/disk verification and old/new session lifecycle without paid models or live installation changes. Issue #36 records the commit/release.

Ruling: unsupported/failed identity queries retain PID-only behavior instead of guessing an owner is dead. A legacy live/recycled PID can still require manual restart/investigation. Linux identity parsing is implemented but not exercised on Linux in this Windows session. No claim of forcing actual OS PID reuse is made; that case uses explicit injected identities.

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
