# V1 implementation work plan

The owner authorized creating all audit issues and beginning implementation. [Tracking issue #40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40) is the live backlog. Historical findings and measurements remain in the audit; issue status records subsequent fixes.

## Constraints

Use existing isolated worktree. Preserve English/Copilot-only behavior, original prompt fallback, privacy, explicit-send boundaries, data and usage accounting. No paid Copilot calls, desktop/browser automation, owner installation changes, data expiry or feature removal. Commit verified batches to main; no force pushes, tags or releases. Manual/account/product gates remain open until evidence exists.

## First implementation batch

Implemented in 0.12.1; [results and verification](first-batch-results.md). Issues #1, #3, #4, #8, #22, #28 and #38 are ready to close with the verified push. The code for #23 is complete; its owner screen-reader check remains open. The other work items remain queued in #40.

1. #1: protect Git diff/status collection from configured filter programs; test benign side effects and configuration failure without changing user config.
2. #3: re-read retention immediately before history mutation; test opt-out while model/history I/O waits.
3. #4 and #8: propagate Send cancellation through the session boundary; require explicit local directory metadata.
4. #38: bind progress lookup to owner, preserving legitimate resume.
5. #22: replace repeated history scans with one-pass counting, prove exact output equivalence and measure.
6. #23 and #28: repair progress semantics and synthetic bootstrap fixture.
7. Review complete diff; version/changelog, build, final full tests/check; push and attach evidence to completed issues.

## Review focus

- Never treat a malformed/incomplete Git config read as absence of executable filters.
- Cancellation must be checked after asynchronous idle checks, not only at handler entry.
- A stale privacy snapshot must not override a later opt-out, including while storage is waiting.
- Run IDs are not ownership credentials; completed progress must retain its actual owner.
- Keep history labels/query semantics and limits unchanged; do not claim the 50k fixture is typical retained history.

## Review rulings

- Guard submodule traversal too: a child repository can define filters absent from its parent. Preserve gitlink commit summaries with `--ignore-submodules=dirty` and `diff.submodule=short`; child working-tree content is deliberately omitted.
- A whole-settings read can sample Save history before later preference I/O. Read historyLimit and then Save history directly, with no unrelated awaits after that final check. A one-snapshot keyed getter is a prerequisite; general startup batching stays in #13.
- Keep #23 open until the owner screen-reader check is recorded. Static ARIA verification does not establish desktop assistive-technology behavior.
- This is the first implementation batch. The complete 39-item backlog includes product/account/manual gates; no mass-adoption readiness claim or feature-removal decision follows from this batch.

## Backlog

- [#1](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/1) Prevent configured Git filters from executing during context collection | P1 · security
- [#2](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/2) Honor privacy and exclusion changes during in-flight context collection | P1 · privacy
- [#3](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/3) Stop retaining completed prompts when Save history is disabled mid-run | P1 · privacy
- [#4](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/4) Cancel pending Send before the session enqueue boundary | P1 · sending
- [#5](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/5) Confine attachments canonically and track owned upload sequences | P1 · attachment security
- [#6](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/6) Keep update work reservations until helper cleanup has settled | P1 · lifecycle
- [#7](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/7) Preserve complete canonical project identity in rules and history | P1 · correctness
- [#8](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/8) Reject missing or malformed local-project metadata | P1 · fail closed
- [#9](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/9) Ship complete third-party notices and a generated runtime inventory | P1 · distribution
- [#10](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/10) Add clean-build CI, dependency monitoring and release-integrity checks | P1 · maintenance
- [#11](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/11) Publish security reporting, pause, update and recovery guidance | P1 · support
- [#12](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/12) Partition session drafts to avoid rewriting all old sessions | P1 · performance
- [#13](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/13) Batch initial state reads and share change snapshots | P1 · performance
- [#14](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/14) Coalesce rapid draft saves with explicit durable flush boundaries | P1 · performance
- [#15](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/15) Show retained-data size and offer safe inactive-session cleanup | P2 · privacy and storage
- [#16](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/16) Wait for attachment uploads before Enhance or Enhance and send | P1 · input correctness
- [#17](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/17) Recover retained helper journals after failed usage flush | P1 · accounting and privacy
- [#18](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/18) Enforce backend ranges and aggregate request/upload limits | P1 · robustness
- [#19](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/19) Batch repository keyword search while preserving safety and ranking | P1 · performance
- [#20](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/20) Reuse fresh context enumeration across preview and enhancement | P2 · performance
- [#21](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/21) Expose context coverage limits and prioritize explicit safe paths | P1 · context correctness
- [#22](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/22) Compute history project counts in one pass | P2 · performance
- [#23](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/23) Expose numeric progress correctly to assistive technology | P2 · accessibility
- [#24](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/24) Align History Undo visibility with a reliable recovery window | P2 · accessibility and recovery
- [#25](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/25) Name repeated rule/model/structure actions by their item | P2 · accessibility
- [#26](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/26) Persist release-history state across canvas origins and correct action copy | P2 · usability
- [#27](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/27) Provide actionable recovery for failed chunks and disconnected canvas events | P2 · resilience
- [#28](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/28) Repair the stale installed-runtime bootstrap authentication fixture | P1 · release verification
- [#29](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/29) Complete the v1 owner-run desktop and account acceptance matrix | P1 · release gate
- [#30](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/30) Verify managed-policy authentication and SDK isolation contracts | P1 · compatibility research
- [#31](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/31) Validate enhanced prompt quality and reasoning/context trade-offs before changing defaults | P2 · research gate
- [#32](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/32) Extend offline scale tests to concurrency, recovery and realistic repositories | P1 · scale gate
- [#33](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/33) Design a smaller verified installable package and stable distribution policy | P2 · packaging decision
- [#34](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/34) Specify incremental usage consumption without deleting accounting | P2 · cross-plugin performance
- [#35](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/35) Decide long-term prompt archive and optional feature-cost trade-offs | P2 · product decision
- [#36](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/36) Harden stale update reservations against process-ID reuse | P2 · hypothesis validation
- [#37](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/37) Test and harden project/static-file check-to-open races | P2 · hypothesis validation
- [#38](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/38) Apply canvas ownership checks to progress lookups | P2 · boundary consistency
- [#39](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/39) Document and test branch movement between update check and installation | P2 · provenance validation
