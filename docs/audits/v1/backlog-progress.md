# Remaining v1 work

The owner authorized working through every available issue individually and publishing a GitHub release for each delivered version. Releases remain previews until the owner/account/accessibility gates are verified. This supersedes the earlier no-tags/no-releases restriction for this backlog only.

For each issue: reproduce or establish baseline, implement the smallest complete fix, add meaningful regression/measurement coverage, update English notes and version, rebuild, run the full suite/typecheck/package checks, inspect the diff, push main, publish the matching preview tag/release, and attach evidence to the issue. Never close an unverified manual or product gate.

Current baseline: 0.12.1 / 4104c29. Tracking issue: [#40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40).

## Queue

Security and correctness: delivered; see versions below.

Distribution/maintenance: #11 (manual/maintainer confirmation pending), #33 (runtime package prepared; stable channel/manual gates pending).

Efficiency: #12/#13/#15/#19/#20/#21/#32 shipped and closed. #14 saving implementation shipped (native-close/manual gate remains); #34 actual consumer evidence is shipped and closed.

Usability: #24/#25/#26/#27 shipped and closed.

Evidence/owner decisions: #23, #29, #30, #31. The owner resolved #35 by keeping bounded History for v1 (0.12.33). Runtime-only marketplace preparation is approved under #33; manual and live-model gates remain pending. Never consume the owner's Copilot credits or control desktop/browser UI.

## Current work

### 0.12.33 — owner decisions and #35 completion

Owner accepted bounded recent History for v1: existing count/text limits, filtered Markdown export and Undo remain, with no archive/import/long-term guarantee. #35 can close after verification/publication. The owner approved AndrewGodlewsky's best-effort seven-calendar-day private-report acknowledgement target without a guaranteed response or fix deadline. Manual disable/restart/re-enable and notification delivery remain open in #11. The current save indicator, immediate attempts, Retry and best-effort close flush are accepted; native observations remain #14/#29. New live evaluations remain pending by explicit choice; the zero-call study stays prepared, unchanged. The owner selected a separate runtime-only marketplace branch; its preparation/migration testing is the next #33 delivery, not an automatic source switch.

Ruling: these answers resolve product choices, not missing test evidence. No paid calls, automatic expiry, owner installation changes or desktop control are authorized. This release records the decisions and closes only #35.

Verified: typecheck, build, 543 final tests, package/diff checks and disposable installed-runtime archive fixture pass. Independent review found no blockers and checked 30 relative links and version-only runtime changes. Corrected its current-queue inconsistency so #35 is no longer listed as pending; historical entries remain intact. No new behavior/test was added for these documentation decisions. Native checks, private-report delivery, account policy, live evaluations, next-release branch implementation and historical external/CI evidence were outside this review. Exact hosted CI/publication follow.

### 0.12.32 — #35, archive and feature-cost decision

Published a concrete decision brief recommending bounded recent History for v1 while preserving usage, drafts and all existing features. It documents effective count/text limits, filtered Markdown export without import/restore, and the evidence separating current History from usage accounting. An optional archive needs separate indexed/paged storage, opt-in privacy/retention, migration/recovery/export rules and 10k/50k/100k evidence before caps change. AI context/reasoning and native animation trade-offs remain evidence-gated; no removal or expiry is inferred. README now states the practical History limits; the historical audit points to current results and the eight remaining acceptance gates.

Ruling: the owner decision is still pending, so #35 remains open. Publishing a recommendation does not approve an archive or change retention. Synthetic scale evidence is not a 24/7, peak-memory or exhaustive 90-day guarantee.

Final verification: typecheck, build, 543 final tests, package/diff checks and disposable installed-runtime archive fixture pass. Independent review found no findings, resolved 113 local Markdown file links, checked actual count/text bounds and export code, and confirmed 31 closed audit issues/eight open gates on GitHub. Thread limit required reusing an independent reviewer of unrelated releases. No new test is needed for unchanged production behavior; the full existing suite is retained. Review rulings: owner archive scope, an unapproved archive implementation, model quality, native rendering/AT/close/update activation, account policy/billing, long-running/peak/tail performance, hostile same-account and power-loss guarantees remain unverified. External guide availability and every historical CI result were not independently rechecked. Exact hosted CI and preview publication follow; #35 and tracker #40 stay open for the recorded gates.

Previous release 0.12.31 / b6e93bd passed exact Verify 44075875098; preview and three runtime archive assets were published; #31 remains open for authorized model-quality evidence.

### 0.12.31 — #31, frozen paired quality study

Added eight new public synthetic holdout cases and offline preparation of 48 actual original/enhanced production inputs across three target model/reasoning tiers. Exact shared user/context, distinct system text, hashes and semantic/literal criteria are stored in SQLite; a zero call ceiling and unapproved route prevent generation. Preparation refuses an existing output directory. The new quality-gate protocol separates rewriting, reasoning, context replay, actual retrieval and downstream completion, with predefined scoring, failures, missing pairs, budget and no-proxy rules. Production prompts, defaults and independent context depth are unchanged.

Regression first failed on the absent staging module, then passes for 24 exact pairs, Unicode, original builder fidelity, target identities, saved hashes, no claimed generations, zero-budget refusal and no overwrite. A real offline preparation creates 48 pending rows; only its sanitized protocol/hash manifest is committed. No inference or judging was performed.

Ruling: this is preparation, not evidence of quality improvement. #31 remains open for a permitted route/budget, actual model availability and paired/downstream results. A different subscription model cannot be relabeled GPT-6.1 Sol. The historical runner remains unchanged; a future authorized executor must consume frozen payloads rather than rerender old candidates. Existing prompt preferences stay intact.

Final verification: typecheck, build, 543 final tests, package/diff checks and disposable installed-runtime archive fixture pass. Independent final review reproduced both staging tests and input/source hashes, finding no blockers. Its minor request for exact score aggregation and hard-failure adjudication was regraded Important for a predeclared evidence protocol: those rules are now explicit, unresolved disputes are inconclusive, and the method document is hashed in the manifest. A missing-method-hash regression failed then passed; the final full suite and offline preparation were rerun. No minor remains deferred for this release. Review rulings: no actual target access/reasoning, quality, downstream success, statistical generalization, future executor/blinding/retry implementation, retrieval evaluation or human ground truth is established. The retained preparation was additionally reproduced locally; raw SQLite remains ignored. Exact hosted CI/publication follow; #31 remains open.

Previous release 0.12.30 / d7b9595 passed exact Verify 44074230567; preview and three runtime archive assets were published; #30 remains open for managed-account evidence.

### 0.12.30 — #30, managed-account contract evidence

Published current official/installed authentication research and an opt-in credential-free runtime observation probe. It imports only the installed SDK, uses an owned empty home/workspace, strips inherited credentials, disables stored/CLI fallback, blocks proxy-aware outbound access, never sends/model-tests, bounds calls and stops only its own runtime. Raw published evidence has only version/hash/boolean outcomes. Both control and managed-settings-enabled sessions are accepted unauthenticated on the installed runtime, differing from the declaration's expected missing-token rejection. This is not a successful policy or inference test. Production account/catalog/isolation checks remain unchanged; 21 model regressions passed separately.

Ruling: #30 stays open for personal and administrator-approved managed-account evidence. Do not disable managed settings, extract credentials, bypass policy or introduce another provider to reconcile a declaration/runtime discrepancy. Existing personal user success is not enterprise acceptance. This release adds no model request or account secrets. Full verification and independent final review follow.

Final verification: the updated observation probe again reports both unauthenticated session creations; 21 focused model regressions, typecheck, build, 541 final tests, package/diff checks and disposable runtime archive fixture pass. Independent review verified syntax, 21 local links, installed declaration hash/SDK forwarding and current official references, with no blockers. Thread limit required an independent earlier reviewer. Final: minor (deferred): developer-probe raw SDK stderr/startup/status/stop errors are not sanitized; documentation limits shareable evidence to inspected successful stdout JSON, while production Show Logs remains allowlisted. Review rulings: managed/personal auth, policy/entitlement/refresh, native UI, other platforms/runtimes and OS network isolation are unverified; proxy settings are not a sandbox. #30 stays open. Exact hosted CI/publication follow.

Previous release 0.12.29 / 13f8147 passed exact Verify 44073146422; preview and three runtime archive assets were published; #29 remains open for owner acceptance.

### 0.12.29 — #29, owner desktop acceptance preparation

Published a concise owner-run matrix with environment/result template, disposable/synthetic setup, allowance-marked steps and explicit expectations across installation/update/restart, catalog/managed policy, rewrite/send/cancel, attachments, saves/native close, History, rules, connection recovery, widths/zoom/text sizes, keyboard/AT, pause and usage. Every native/account row is pending; no owner installation is changed and no model is called. Historical audit results remain historical. See [desktop acceptance](../../desktop-acceptance.md).

Ruling: headless fixtures and static ARIA checks cannot close native rendering, focus, close-flush, account policy or billing gates. Keep #29 open for observed owner results or explicitly approved unsupported scope. Do not manufacture destructive/network failures in the owner's profile, automatically claim v1, or infer authorization for paid steps. Full checks and final review follow for the documentation/package release.

Final verification: typecheck, build, 541 final tests, package/diff checks and disposable runtime archive fixture pass. Independent review found no findings and verified 68 local Markdown targets. Thread limit required reusing an independent reviewer of an unrelated earlier issue; no author self-review or second review of this release. Review rulings: actual desktop install/rendering/focus/AT/clipboard/download/restart, live entitlements/policy, output/cancel latency/billing, pre-Saved native close, untested platforms and private-report delivery remain pending; no broader claim is made. External docs were not fetched by this reviewer. Exact hosted CI and publication follow, with #29 kept open.

Previous release 0.12.28 / 2632134 passed exact Verify 44072230633; preview and three runtime archive assets were published and #34 is closed.

### 0.12.28 — #34, actual accounting consumer

Added an opt-in harness importing the clean Usage Insights scanner/report builder read-only. 10,000 production-recorder sessions / 20,000 synthetic receipts verify exact totals across cached/forced refresh, new/duplicate receipts, canonical replacement, production late recovery, copied journals, partial/truncated tails, restart and concurrent refresh. All-time and 90-day reports are checked separately. Raw sanitized evidence and a producer/consumer compatibility contract are committed; no other repository or production behavior changes.

Final measured initial scan is 1,814ms; warm median 157ms with zero journal bytes reread; forced median 1,657ms; all-time report median 90ms; 90-day report median 83ms. Production fixture creation is separate at 30.2s. Final totals are 20,002 receipts / 30,002,100 nano-AIU. This identifies existing incremental behavior, not an optimization delivered by this release. Rebuild, full verification and one independent final review follow.

Ruling: keep accounting durable and retained. No global producer manifest, delayed writes, expiry or consumer repository change is justified at this measured size. An optional future consumer-owned derived index is specified with replacement/prefix/identity reconciliation. Conflicting appended duplicate identities are first-wins, not corrections; don't invent a correction protocol. No paid models, owner data/profile access, desktop automation or real-account billing claim. SQLite/WSL/VS Code, other platforms, cold disks, UI memory and long soak remain unclaimed.

Review: no blockers. Regraded timing/copy-semantics accuracy as important for published evidence: a failing synchronous-stage assertion led to a sync-preserving diagnostics timer; the entire measured workload was rerun. Clarified first-wins per receipt, with distinct receipts merged across copied journals. No deferred minor. Full rebuilt suite and runtime archive fixture pass (541 tests). Review rulings: timings were not independently rerun; recorded source hashes/fixtures establish only this environment. No live billing, native UI/memory, SQLite/WSL/VS Code, slow disks, other OS, soak, peak/tail latency, full crash lifecycle or future index/batching proof. Imported checkout must be trusted. Exact hosted CI and publication follow before closure.

Previous release 0.12.27 / 8ff50a4 passed exact Verify 44069903778; preview and three runtime archive assets were published, and #32 is closed.

### 0.12.27 — #32, concurrent writers and interrupted persistence

Added an opt-in production-storage/context workload: six 120,000-edit samples across four sessions, with/without 12 storage observers; three 400-transaction runs across four child processes with 500 retained rows; owned-child termination between temporary write and atomic replacement with stale-lock recovery; and three Deep gathers over 10,004 tracked files, long source, large diff and an unattached binary. Latest session values, counters/history, observed queue bounds, late evidence, omission notes and context budgets are asserted. No production behavior or features changed.

Existing 23 focused cancellation/update/usage recovery interleaving tests pass, including separate-process reservation exclusion and deduplicated receipt replay. The new benchmark records all samples and parent memory endpoints. Typing includes a deliberate 5ms write delay; superseded edits coalesce, so acknowledgement is of the latest batch value rather than archival retention of every keystroke. No before/after speed improvement is claimed by this verification-only release.

Independent review found no blockers and one measurement-precision minor: a global notification count could hide a missing subscriber behind another's duplicate. The harness now asserts exactly 20 draft notifications for each of 12 subscribers and reports the per-subscriber counts. The final measured run is repeated after that change. No deferred minor; one review/fix pass.

Final verification: the revised scale workload passes all assertions, along with the 23 focused interleaving tests, typecheck, rebuild, all 541 final tests, package/diff checks and the disposable runtime archive fixture. Final median typing is 1,315ms without observers and 1,445ms with observers; shared transactions 1,272ms; tracked context 1,085ms. Highest sampled parent RSS is 180.51MiB, not a peak. SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Node24.22.1, Windows x64. Generated/exact hosted CI and release evidence follow before closure.

Review rulings: the final benchmark and full checks are executor evidence, not an independent stress rerun. Native/browser memory, long soak, cold/slow/network disks, other platforms, OS/power loss, fsync and production orphan cleanup remain unclaimed. The unattached image does not verify uploads. Arbitrary settings/key flooding and archive/retention choices remain outside this fixed-key test. No production logic or paid-account behavior is changed. Final exact CI, assets and publication are recorded separately.

Ruling: do not manufacture slow-disk, native rendering, OS power-loss or 24/7 soak evidence. The real killed-child test demonstrates process interruption, not fsync/power-loss durability. One runtime/Windows machine, local filesystem and synthetic tracked data do not establish enterprise or other-platform compatibility. Existing feature/capacity/retention decisions remain unchanged. Independent review and final verification follow.

Previous release 0.12.26 / 17e8653 passed exact Verify 44068355156; preview and three runtime archive assets were published, and #27 is closed.

### 0.12.26 — #27, section and event-stream recovery

Lazy sections have named loading feedback, a render boundary and explicit retry with a fresh lazy wrapper. Enhance has a boundary without unloading the surrounding app. The authenticated event subscription has visible states, a 45-second header/idle bound, 65,536-string-unit frame bound, 2–30-second failure backoff and a coalesced manual Retry. Invalidated/unauthorized canvas tokens stop automatic retries and offer reopen guidance. Closing aborts the stream; safe status polling runs only while connected. Commands, saves and model runs are never replayed by this loop.

Controlled stream failures first failed on the absent implementation. Tests cover disconnect/reconnect, missing/forbidden tokens, stalls, invalid/oversized frames, cancellation and repeated clicks. The production transport fixture verifies no request replay after a backend-token reset and acknowledged draft saves remain acknowledged. React server markup plus a hook fixture exercises rejected lazy loader retry, failure diagnostics and unchanged composer atoms. These are not mounted native desktop tests.

Ruling: preserve existing in-flight enhancement ownership/result handling; reconnect restores future events only. No automatic reload, cache-busting executable import, session restart or resubmission is safe. Local unsaved edit-form state inside a failed section may reset; saved data and composer atoms remain outside it. Browser suspension can delay timers. Manual focus, layout and actual desktop restart checks remain #29. Full verification and final independent review follow.

Independent review found valid coalesced frames were rejected by an aggregate read-size limit. A 70-event burst regression failed before parsing individual bounded frames fixed it; complete and incomplete oversized frames still fail. Added explicit timer tests for exponential backoff, 30-second cap and heartbeat reset. No minor findings. One review/fix pass, then full rebuilt verification.

Final verification: typecheck, build, all 541 tests, package/diff checks and disposable runtime archive fixture pass. Installed SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Node24.22.1, Windows x64. Generated, exact-commit hosted CI and release evidence follow before issue closure.

Review rulings: actual browser import-cache fetch retry, native focus/keyboard/appearance, close delivery, restart and suspension remain owner gate #29. Reconnect intentionally does not replay missed events or comprehensively resynchronize every preference. Local unsaved edit forms can reset, as documented. Account availability is separate. Existing persistence/server quotas/same-user filesystem threat guarantees are unchanged; no paid inference or owner installation mutation. Parent records full tests/runtime/generated/CI and publication separately.

Previous release 0.12.25 / 89bcdaa passed exact Verify 44066759022; preview and three runtime archive assets were published, and #26 is closed.

### 0.12.25 — #26, durable release history and accurate action copy

A worker-owned release.check operation records its running version in shared storage under the existing cross-process transaction. SemVer ordering prevents older canvases rewinding the marker, and only one concurrent canvas claims a newer release. A missing/invalid marker establishes a quiet baseline; origin-local browser markers are not imported. Manual footer history remains available after errors. The initial promise survives StrictMode effect replay; cancelled effects cannot open dialogs. History explicitly says Copy enhanced prompt on either text view, and Clear documentation now includes the reviewed result. See [release-history behavior](../../release-history.md).

Worker regressions first failed on the absent operation, then passed for baseline/reopen, concurrent claims, malformed state, failed writes and older versions. SemVer/prerelease/build cases and independent production disk adapters verify retained markers and unchanged user data. The dialog hook/loader fixture rejects localStorage access, exercises effect replay, lazy notes/retry and manual access after a failed check. Rendered History copy includes the same explicit label in Original view.

Independent review found an important diagnostic allowlist omission and a minor development preview still writing the retired browser key. Both received failing regressions and fixes: sanitized release-history errors now reach Show Logs, and the mock release check handles the preview flag. One review/fix pass; no deferred minor. Typecheck, rebuild, all 535 final tests, package/diff checks and disposable runtime archive fixture pass. SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Node24.22.1, Windows x64. Exact hosted Verify and publication evidence follow in #26.

Review rulings: actual desktop reopen, dialog focus, keyboard/screen reader and narrow-width Copy appearance remain #29. Independent disk adapters run in one process; the existing transaction has separate-process coverage, but this release does not claim a multiprocess dialog test. Same-version changed bytes/build metadata intentionally do not reopen notes. Storage infrastructure and same-user hostile filesystem interference are unchanged. No paid inference or owner installation changes occurred.

Ruling: the first upgrade to this feature cannot reliably recover browser markers from earlier ports; establish one quiet durable baseline rather than guessing. Claiming is an at-most-once display attempt, not acknowledged reading; a closed canvas/lost response can consume an attempt, and manual notes remain available. Shared data directories share the marker. No network/model call, migration of user content or policy change is introduced.

Previous release 0.12.24 / e26c6cb passed exact Verify 44064966814. Preview and all three runtime archive assets were published; #25 is closed.


### 0.12.24 — #25, item-specific action names

Rules, structures and advanced profiles name their row in switches, menu actions, edit/delete/reset, model picks and tests. A current row number disambiguates duplicate or truncated names; previews cap at 96 Unicode code points and preserve saved content. Visible action words remain part of accessible names. Interaction primitives, target IDs and layout are unchanged. See [owner accessibility checks](../../item-action-accessibility.md).

Rendered-name regression first failed on generic Disable, then passed for all repeated actions. Fixtures cover duplicated, empty and long profile labels, duplicate rules/structures, built-in resets and Unicode surrogate pairs. Menu content is exposed by a static fixture; real portal/focus/voice/screen-reader checks remain in #29, explicitly documented. Full rebuilt verification and independent review follow.

Ruling: current row position is a readable disambiguator, not a persistent ID; it changes after reordering and filtering. Keep previews concise instead of reading a 500-character rule on every focus. Existing stored text remains untouched. No paid model calls, owner data mutation or UI automation.

Independent review found long item names could overflow IconAction tooltips on narrow canvases. A rendered long-token tooltip regression failed before a viewport-bound max-width and anywhere wrapping fixed it; accessible names remain complete. No minor findings. One review/fix pass, then rebuilt full verification.

Review rulings: actual tooltip positioning, zoom, menu portals, focus return, reorder/delete announcements, voice and screen-reader behavior remain owner gate #29. Code-point truncation can split a grapheme cluster; the documented contract preserves surrogate pairs, not all combining/ZWJ clusters. Single active edit-form Save/Cancel controls are outside repeated-row naming. The model picker's selected-value announcement remains existing Radix behavior. Executor separately verifies full tests/runtime/generated/CI/push/publication. No paid account calls or owner-data migration are involved.
Final verification: typecheck, build, all 529 tests, package/diff checks and final disposable runtime archive fixture pass. SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Node24.22.1, Windows x64. Generated assets rebuilt; exact hosted CI and release evidence follow in #25 before closure. Manual accessibility remains #29.

Previous release 0.12.23 / 251bab8 passed exact Verify 44063669439. Preview release and all three runtime archive assets were published; #24 is closed.


### 0.12.23 — #24, reliable History recovery

History exposes Recently deleted with worker-owned one-minute Undo metadata. Buttons use the absolute backend deadline, including resume from a hidden document, and click-time checks reject expired actions. Deletion/restore/recovery lists and Clear share the existing transaction queue. Failed writes keep the record; simultaneous restore succeeds once; capacity/privacy are rechecked. Up to ten waiting entries are preserved without silent eviction; an eleventh individual deletion waits rather than breaking an existing promise. Recovery remains in memory and accepts no client-supplied entry data. See [recovery behavior](../../history-recovery.md).

Tests first reproduced missing deadlines, cross-worker access, lost failed-write recovery and silently evicted entries. Panel tests first reproduced a missing deadline and now reject expired actions without a backend request. Hidden/resumed clock tests, static keyboard-accessible markup, capacity/privacy and concurrent restore fixtures cover the new behavior. Full rebuilt verification and independent review follow before publication.

Ruling: keep the existing one-minute, ten-entry memory bounds. Refusing an eleventh individual deletion is safer than silently invalidating an earlier Undo. Clear history and worker restart end recovery; this is not durable trash or a cross-installation recovery service. Manual desktop/screen-reader checks stay in #29. No paid calls or owner installation mutation.

Independent review found four important defects, all reproduced RED→GREEN: derived-history effect identity caused repeated refreshes; another worker's Clear left recovery usable; a delayed history read passed stale expiry/privacy/limit checks; and an already-cleared/restored toast remained enabled. Stable raw-history dependencies, a shared random Clear generation (atomic with production history deletion), checks after reads, and observable recovery metadata fix them. A 20-caller refresh burst now performs two requests and drops the obsolete snapshot. React hook-dependency and markup fixtures run without a browser; they do not claim mounted desktop behavior.

Ruling: regrade the accessible Undo/Restore name mismatch as important because voice users must be able to target the visible word; a failing rendered-name regression now passes with “Undo deletion of …”. The test-regex minor was a verification blocker: `/disabled/` matched CSS classes, corrected to the actual disabled attribute. No minors remain deferred. One review/fix pass; no re-review.

Review rulings: manual keyboard/focus/screen-reader/suspend and width checks remain #29. Executor owns full rebuilt suite/runtime/CI/publication evidence. No paid account behavior is claimed. Recovery intentionally ends at worker restart; the wall-clock limitation remains documented. Existing history capacity policy is preserved. Worker ownership and Clear generations are not an OS sandbox against same-user filesystem modification. The fallback adapter invalidates before clearing if atomic patch is unavailable; a failed fallback Clear can conservatively end Undo, rather than permit content resurrection.
Final verification: root/web typecheck, rebuild, all 527 tests, package and diff checks pass. Production disk adapters verify that atomic Clear persists its generation and rejects old recovery after new history arrives. The final runtime-only archive fixture passes exact package hashes, registration/context/send guards and synthetic update/data retention using SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Node24.22.1, Windows x64. No paid inference, live installation changes or UI automation. Exact hosted Verify, push and release evidence follow in #24 before closure.

Previous release: 0.12.22 / 0d8dbcd, exact Verify 44059689860 attempt 2 succeeded. Attempt 1 had one existing OS-process-identity timeout under Windows load; the unchanged rerun passed all 515 tests. No timeout or production safety check was relaxed. Release assets and #21 closure were verified; evidence records the transient rather than claiming it fixed.


### 0.12.22 — #21, context coverage and explicit paths

Filename discovery now reports counts, partial limits and unavailable reads; Git uses NUL-framed names. Safe explicit relative candidates precede ordinary/AI selection within unchanged six/ten-file limits, including paths beyond scan depth/count. Exclusions and confined final reads still win; candidate names do not imply existence. Partial discovery falls back to per-file content reads instead of Git grep with an incomplete refusal list. Unicode keywords, early/latest hit retention and separated snippet regions improve evidence without increasing character/model budgets. Budget markers count toward their limits.

Regression tests first failed for absent coverage operations, missed explicit targets and late-hit retention, then passed. Tests cover every code context route, policy exclusion, incomplete Git records, Unicode/unusual names, inaccessible/depth/file limits, source redaction and strict excerpt/total budgets. Typecheck and 54 focused tests pass; scale measurement, full rebuilt checks and final review follow before publication.

Ruling: counts describe inspected names/eligible candidates, not total project size or files read. Complete discovery is scoped by privacy. Only relative paths are prioritized; absolute/external input is left to explicit attachments. At most twelve named candidates, six/ten snippets and existing budgets remain. Fixed-space hit retention favors early/latest evidence and cannot guarantee every match. Historical exact-output benchmarks reproduce their recorded versions; this release intentionally changes evidence selection. Preview 0.12.21 shipped at 190ee12 after exact Verify 44057318517 succeeded, with all three archive assets; #20 is closed.

Full-suite evidence first exposed a source-preservation regression: selecting one representative per hit cluster omitted a matched return statement. The existing privacy test failed, then passed after prioritizing distinct centers followed by all matched lines and then neighboring lines. Redaction still precedes excerpt selection.

Independent review found unreadable dotted candidates could consume all snippet slots. Missing and existing-binary fixtures both failed before bounded confined text probes removed unreadable candidates from selection. The review's punctuation finding is regraded important: silently reading a different sibling violates explicit-path identity, not just presentation. A quoted comma-ending filename regression failed before literal quoted parsing fixed it. Final focused coverage/pipeline/privacy: 39 passed. No deferred minor findings; one review/fix pass, followed by rebuilt full verification and refreshed scale hashes.

Review rulings: executor verifies final artifacts/runtime/CI/publication and reruns measurements after code changes. Endpoint RSS/tiny-file tests are not peak or production performance; Windows fixtures do not prove all Unix filenames/Unicode folding. Desktop/account/accessibility gates remain manual. Bounded scans/matches are not exhaustive or transactionally consistent. Rewrite sets, usage and send implementations remain unchanged; existing full/runtime fixtures cover their regressions without paid inference.

Final verification: typecheck/build, all 515 tests, package/diff checks and the disposable runtime-only archive fixture pass. Three final paired 30,001-file samples find the named target in every current run and none of the old runs; exclusion is verified. Median collection 1539.4→1507.0 ms, emitted content 476→491 characters, below unchanged 28,000. This is coverage evidence, not a significant speed claim. Source hashes match the final tested code. SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Node24.22.1, Windows x64; no paid models or owner installation changes. Exact hosted CI and publication are recorded in issue/release evidence before closure.

### 0.12.21 — #20, coalesced context discovery

Equivalent overlapping requests share only file discovery keyed by canonical project, Git permission and exclusion policy. Privacy and cancellation belong to each caller; all owners leaving aborts discovery. Manual Refresh starts a new generation. Each request rereads instructions/stack/source through existing policy readers. Diagnostic filename summaries are bounded to 32 roots/90 seconds and contain no project text; completed discoveries never supply later evidence.

Focused tests cover independent arrays, cancellation and privacy revocation, all-owner cancellation, refresh generations, project/policy boundaries, failure/capacity recovery, fresh edited/added/deleted files, and automatic versus manual preview intent. An undefined rejection first reproduced an uncaught failure; the fix now rejects every owner and permits retry. The focused 27-test suite passes. Full rebuilt verification and independent review are recorded before publication.

Three paired samples compare production Standard gathering at 999bcc6 with this version. All output items match. At 30,001 files, median four-caller latency falls 2,843.388→833.309 ms and listings 4→1; two callers 1,547.402→866.520 ms, listings 2→1. The committed measurement includes 1,001-file runs, source hashes and endpoint memory (not peak RSS). No paid calls, owner data or UI automation.

Ruling: do not add a completed discovery cache whose invalidation cannot cover all nested files/ignore rules. Sequential preview→Enhance remains fresh and gets no claimed cache acceleration. Sharing is process-local and is not a filesystem snapshot; these limits are explicit in docs/context-discovery.md. Issue #19 shipped as 999bcc6, preview 0.12.20, exact Verify 44054689752 successful.

Independent review found a fallback walker that only checked cancellation on directory entry. A real flat-directory regression first failed, then passed after per-entry cancellation/access checks; the final access check also covers a one-entry directory. No minor findings. Full verification is rerun after this correction; the Git-based benchmark is unaffected. Review rulings: sequential caching, cross-process sharing and transactional snapshots are intentionally unclaimed; desktop interaction remains manual, paid-account performance is not authorized, endpoint memory is not a peak-memory claim. The executor verifies full build/tests/runtime/publication separately; none is inferred from the focused review.

Final verification: typecheck, rebuild, all 508 tests, package and diff checks pass. The disposable runtime-only archive registers/serves the built canvas, checks all context levels and fresh edits through the adapter, and retains synthetic stored data across its local metadata update. SDK/CLI 1.0.106-8.unstable.r43566476370.g869eef3, Windows x64, Node 24.22.1. Hosted Verify must pass the exact pushed commit before publication; issue/release evidence records that result.

Initial hosted Verify 44056939915 passed 507/508 tests. Its Windows temporary directory alias differed from the canonical root returned by gathering; the new diagnostic assertion incorrectly queried the alias. The test now checks the returned canonical root. Production context items were correct, and runtime behavior is unchanged. Final full local/hosted verification is required again before publication.

- #15 shipped in 0.12.19 / ef6f55c (Verify 44052500782), preview and runtime archive published, issue closed. #19 batched repository search is in verification for 0.12.20. #14/#11/#33 owner gates remain open.

## Delivered versions

### 0.12.20 — #19, one repository keyword scan

Initial code-context gathering counts all keywords and captures excerpt positions in one bounded Git process. The per-keyword ranking formula is unchanged. Framed filenames, escaped Unicode literal patterns, full-record parsing and explicit unavailable/incomplete notes prevent silent false completeness. Privacy is rechecked before/after search; selected content still goes through confined reads and redaction. [Behavior and limits](../../context-search.md).

New tests first failed for the absent batched operation, then passed against real Git counts/ranking, Unicode, overlap, literal punctuation, exclusions and binary/no-match behavior. Additional coverage checks framed unusual names, truncation, timeout/cancellation and exactly one grep through integrated gathering. The 30,001-file benchmark compares three alternating current/prior production gathers and verifies every count and emitted item. Median search improved 2,942.491→651.543 ms; integrated gather 5,441.310→2,370.800 ms. Raw measurements/source hashes are retained. Typecheck/build, all 499 final tests, package/diff checks and the disposable installed-runtime archive fixture pass. The first full suite exposed a Windows fixture-directory EBUSY during cleanup after a bounded child process; matching existing cancellation fixtures, owned temporary cleanup now retries briefly. No production assertion was weakened.

Independent review passed all five new tests plus seven existing Git safety/cancellation tests, checked source hashes/medians and found no blockers or deferred minors. Review rulings: #21 retains unusual-name enumeration/explicit-path work; the framing parser alone cannot supply missing enumeration. Partial-budget coverage and named-runtime Unicode evidence stay qualified, as do tiny-file timing/endpoint-memory observations. Repository edits between search and excerpt reads remain non-transactional; final confined reads and privacy checks still apply. Executor full/runtime/CI/generated/release checks are separate from review; the benchmark was run by the executor, its hashes and assertions independently reviewed. Desktop/account checks remain unperformed owner gates, without paid traffic or UI automation. Hosted CI and exact publication evidence are attached to #19 before closure.

Ruling: retain a shared four-megabyte/five-second search bound rather than allowing source output to grow without limit. Dense/long matching lines can exhaust it sooner than the former per-word count outputs; show incomplete evidence instead of claiming equal coverage beyond the bound. UTF-8 casefold equivalence is tested on the installed Git and a named corpus, not every Git locale/Unicode version. Parser delimiter safety does not imply complete unusual-name enumeration; #21 owns that separate path. No model, feature expiry or account/desktop mutation is introduced.

### 0.12.19 — #15, retained storage and inactive draft cleanup

Settings provides explicit scoped local counts and a five-minute, canvas-bound preview of up to 100 inactive drafts. Worker ownership is registered before storage access. Fresh liveness and content checks under existing transactions preserve current/newly active/changed/unknown/corrupt sessions. Only eight private composer keys are removed; controls, shared history/preferences, uploads and usage/recovery stay intact. Cancellation or write failure stops further cleanup and requires a fresh inspection. [Scope and bounds](../../retained-storage.md).

Focused tests cover real child-process reopening, authenticated human-only HTTP, wrong-canvas/expired/changed plans, cancellation/close, links/corruption, bounded private reads, failed atomic replacement and current-save preservation. Regressions first failed for reading private contents beyond the preview and for blocking read-only inspection behind a failed save, then passed. Synthetic 100/1k/10k/30k fixtures verify every session value and accounting record after cleanup. At 1k inspection fell from 2,138 ms to 1,000 ms; 10k completed in 11,770 ms. At 30k it still reaches 15 seconds and reports partial counts. Raw single samples and source hashes are retained; these are not rendering or peak-memory guarantees. Measurements precede the final unreadable-scope reporting correction; scan limits and cleanup algorithms are unchanged.

Independent review passed 22 focused tests and identified one reporting omission, initially graded minor. Ruling: regrade it as important under the explicit incomplete-count contract; an unreadable preferences directory must not imply a complete shared-data total. The junction regression failed, then passed after the scope-existence correction. Final typecheck/build, all 494 tests, package/diff checks and the disposable installed-runtime archive fixture pass. No deferred minors remain. Exact hosted CI and publication evidence is attached to #15 before closure.

Final review rulings: desktop rendering, assistive technology and restart usability remain #29, and native close remains #14; claiming either without owner evidence would hide a host limitation. Closing old workers cannot be inferred from PID records; retain explicit confirmation and conservative unknown-file protection. Same-account hostile races, fsync/power-loss durability and cross-file atomicity remain unclaimed rather than weakening preservation checks. Full scans/peak memory/universal latency are not established by bounded single local samples. Unknown legacy drafts, uploads and helper journals stay outside this cleanup to avoid unauthorized loss. Paid/account behavior is unchanged and untested. Executor-owned full/runtime/CI checks are separate from the review's focused tests. Existing saturation-test listener warnings do not come from new subscriptions and remain unchanged; those tests pass.

Ruling: require explicit restart confirmation because older unregistered workers cannot be proved closed. Unknown old drafts remain protected, with no age-based expiry or automatic migration into cleanup eligibility. PID reuse/inaccessible processes are conservatively active/unknown. Activity-registration failure refuses storage rather than allowing an untracked writer. This can need maintainer recovery. Ruling: bounded inspection returns lower bounds instead of blocking on unlimited data; repeated scans start over and exceptionally large stores may require offline review. No complete 30k sweep is claimed. Same-user hostile filesystem races and cross-file power-loss atomicity remain outside the existing cooperative storage guarantee. Desktop rendering/restart/assistive-technology acceptance remains #29.

### 0.12.18 — #14, coalesced saves and visible recovery

The panel keeps one active batch and only the latest queued value per key within a storage batch. Settings form ordering barriers. Authenticated batch saves use existing file transactions and key/size boundaries. Sending, enhancement, model tests, previews, clearing and updates flush first. Saving/Saved/failure and explicit Retry are visible below navigation. An opt-out transaction clears current private fields, retires failed private saves, and filters late queued writes. Cancellation after a flush wait cannot send a prompt. [Details and limits](../../draft-saving.md).

Local typecheck/build, all 481 final tests, package/diff checks and the disposable installed-runtime package fixture pass. Tests first reproduced missing batch/flush behavior, opt-out/re-enable resurrection and stale settings reads; all now pass. Synthetic bursts at 100/1k/10k/30k verify final Unicode content after reopening and exactly two coalesced disk writes. At 1k the serial path is 1,001 writes / 1448.157 ms versus two / 5.664 ms; at 30k the new path is 43.720 ms. Raw counts, timings, source hashes and endpoint memory samples are committed. These are held-first-save bursts, not desktop typing, rendering, peak RSS or large-baseline extrapolations.

Final review: fixed an important oversized-batch defect. Two individually accepted 450k-character Japanese fields reproduced HTTP 413 together and unrecoverable Retry. A real-server regression failed before size/complexity-aware splitting, then passed with exact Unicode, partial failure/Retry, complex values and old-envelope depth preserved. The reviewer passed 13 focused tests and found no minors. No second review replaces the full rebuilt test suite.

The full-suite reproduction exposed a Windows EPERM rename sharing failure while a large stored file was observed. A new regression first failed and then verified at most six rename attempts, unchanged old content on persistent failure, and immediate failure for unrelated errors. Locks remain held and replacement remains atomic; only the narrow Windows sharing case waits a total of up to 310 ms between attempts. The final rebuilt suite and runtime fixture were rerun after this correction.

Final review rulings: native-close warning/durability and desktop visual/accessibility behavior remain explicit manual gates; unsupported host guarantees cannot be invented. Same-session collaborative merging remains outside this change, with documented last-writer behavior (simultaneous edits can replace each other's saved composer). Power-loss/fsync and cross-file crash atomicity remain unclaimed (partial writes can need recovery). Paid/account model behavior is unchanged and untested here because no paid calls are authorized. These limits are disclosed rather than counted as passed acceptance tests.

Ruling: #14 remains open for native-close/manual acceptance. SDK onClose is fire-and-forget; browser pagehide/keepalive and beforeunload warnings are best-effort only. A visible Saved acknowledgment plus copy/Retry guidance is shipped, without a false final-keystroke guarantee. No private browser cache or automatic expiry is added. Different sessions are isolated; same-session canvases retain last-successful-write semantics rather than collaborative merging. Independent review and exact hosted CI/release evidence are recorded before publication.

### 0.12.17 — #13, batched restoration and shared observers

Authenticated initial restoration deduplicates keys, reads each participating store once and applies values together. Local edit/request/generation guards reject late snapshots. One per-process observer per file compares external changes for all subscribers; corrupt reads do not imply deletion and the last subscriber removes the watcher. Privacy/ordinary reads continue reading current files directly. [Behavior and benchmark](../../state-restoration.md).

Verified: typecheck/build, all 474 final tests, package/diff checks and disposable installed-runtime archive fixture pass. Instrumented tests prove two reads for mixed shared/session batches, one observer parse for three subscribers, fresh privacy values, missing/deleted keys, bounded authenticated HTTP inputs, local edits and older async responses, cross-process notifications and watcher disposal. The production state layer over real loopback HTTP restores 18 fields with one request/two reads instead of 18/18. Median 500-history/20-composer restore improved from 23.951 ms to 10.867 ms; historical 30k shared-store redundant-read comparison improved from 1653.840 ms to 73.788 ms. Raw samples/source hashes and endpoint memory observations are retained; benchmark finished under a 512 MiB V8 heap limit, without paid inference or UI control.

Final independent review ran 15 focused tests and found one important race: a local write could absorb unrelated external edits/deletions into the baseline without notifying subscribers. Two failing regressions reproduced it before and during initial observer loading; the fix emits missing differences without installing obsolete snapshots. Final focused five observer tests and the whole suite pass. No minor findings were identified.

Ruling: batch snapshots are atomic per file, not across shared/session files. Observers expose latest state, not every intermediate write. These measurements exclude rendering and observer startup, and memory samples are not peak RSS guarantees. Disconnected event recovery remains #27 and desktop acceptance #29. No general long-lived data cache is introduced. Hosted CI and exact release/commit evidence are attached to #13 before closure.

### 0.12.16 — #12, session storage partitions

Each session's draft, result and attachment references now use a separate atomic file and lock. Shared history/models/rules and unrelated preferences remain intact. Migration copies at most eight files concurrently, settles failed writers before releasing the global lock and commits shared replacement last. Inactive drafts do not expire. A private offline export supports maintainer-reviewed recovery without changing live files.

Verified: typecheck/build, all 466 final tests, package/diff checks and installed-runtime archive fixture pass. The fixture preserves synthetic drafts/results/preferences through a managed local metadata update and tests the built canvas with no paid model. Instrumented tests prove session edits do not read or rewrite shared/other-session files. Cross-process transactions and notifications, partial-copy failures and Unicode preservation pass. [Raw measurements](session-storage-measurements.json) verify every body at 100/1k/10k/30k sessions. At 30k, median small writes dropped from 358.359 ms to 2.108 ms; the one-time migration took 29.707 seconds. Timing depends on disk/load; some checks ran concurrently during this final measurement.

Final review fixed two important findings with failing regressions followed by green tests: validate unknown/mixed layouts before cleanup changes any preferences or models; refuse conflicting partial copies after an older worker edits/deletes source values instead of resurrecting text. No minor findings remain. The review's seven initial focused tests and the final nine focused tests passed.

Ruling: retain both ambiguous copies and request recovery, rather than guessing or deleting data. Unchanged interrupted copies retry automatically. Close old workers by restarting Copilot after upgrade. A large migration can exhaust another worker's bounded lock wait and require retry. Separate file transactions are not crash-atomic across files; no power-loss/fsync or OS sandbox guarantee is added. Recovery requires a closed app/private backup and does not automate rollback. Desktop appearance/reopening remains part of #29. Hosted CI, exact commit and preview archive checksums are attached to #12 before closure.

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
