# Remaining v1 acceptance gates

The implementation pass is complete through **0.12.32**. Of the 39 audit issues, 31 are closed and eight remain open for evidence or owner decisions. These are preview releases, not a claim that v1 is ready for mass adoption. [Tracker #40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40) and the [release ledger](backlog-progress.md) link each change, verification and limitation.

## What still needs a result

| Issue | Delivered | Remaining acceptance or decision |
| --- | --- | --- |
| [#11](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/11) Security guidance | Private reporting enabled; pause/update/recovery guidance and Settings links; disposable CLI disable/re-enable/data checks | Owner desktop disable/restart/re-enable with saved data, private-report notification delivery, maintainer response expectations. No response SLA has been promised. |
| [#14](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/14) Draft saving | Bounded coalescing, Saving/Saved/Retry and explicit flushes before dependent actions; multi-process and failure tests | Native close has no confirmed blocking flush. Verify it and accept/document the limitation; wait for Saved before closing. Acknowledged saves and unacknowledged final keystrokes are different guarantees. |
| [#23](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/23) Accessible progress | Numeric ARIA values and static regressions | Real screen-reader announcement and native visual check. |
| [#29](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/29) Desktop acceptance | [Owner-run matrix](../../desktop-acceptance.md), explicit safe setup and allowance-marked steps | Record results on one candidate version: layouts, focus/keyboard/assistive technology, drafts, attachment/send behavior, update activation and account/usage integration. Paid steps require separate authorization. |
| [#30](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/30) Managed policy | Installed-contract research and reproducible credential-free probe | Administrator-approved managed-account and personal-account evidence. Unauthenticated session creation is not a successful policy/inference test. |
| [#31](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/31) Prompt quality | 48 paired frozen production inputs, SQLite ledger with zero call ceiling, scoring/adjudication and downstream protocol | Approved route/budget, actual target identities/reasoning, model outputs and blinded paired/downstream results. No quality improvement is claimed from preparation. |
| [#33](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/33) Distribution | Runtime-only ZIP, checksums/inventory and disposable exact-file installation/update tests | Stable managed-channel choice and manual desktop branding/data checks. Current marketplace remains unchanged; the optional local ZIP has no online update provenance. |
| [#35](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/35) Archive/cost choices | [Concrete History decision brief](../../history-archive-decision.md), measured evidence and archive requirements | Owner decision on bounded recent History versus a separate optional archive, including export/retention/recovery expectations. No feature removal or automatic expiry is assumed. |

## Verified scope

Each version in this remaining-backlog pass was rebuilt and checked locally before push, then passed the exact-commit hosted Verify workflow before its preview release. Final local checks for 0.12.32 include typecheck, build, 543 tests after build, package/generated-output checks and disposable runtime-only installation/canvas/update fixtures. Those fixtures do not operate the desktop UI or update the owner's installation.

The installed-runtime evidence uses Windows x64, Node 24.22.1 and Copilot SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3`; desktop executable metadata was 1.4.2. The CI runner also records its own tool versions. Other runtimes/platforms, real billing, native rendering and power-loss durability are unverified.

Scale evidence includes [720,000 synthetic edits, 1,200 cross-process transactions and a 10,004-file project](concurrency-scale.md), plus [the actual Usage Insights consumer with 10,000 sessions and 20,000 initial receipts](usage-consumer.md). Correctness assertions passed for those workloads. Endpoint RSS and several timing samples are not peak-memory, p95 or 24/7 soak guarantees. No owner Copilot allowance or real project data was used.

## Deferred review limits

Two nonblocking review items remain explicitly documented:

- Installed runtime-package checks verify all expected file hashes but do not enumerate extra files created by the host in its cache. This limits the completeness claim; no cleanup of those files is attempted.
- The opt-in managed-policy developer probe can emit unsanitized SDK stderr or startup/status/shutdown errors. Only inspected successful stdout JSON is shareable; production Show Logs remains allowlisted. Do not post raw probe console output.

Other per-release rulings are in the ledger. Same-user filesystem races are mitigated, not an OS sandbox; unsupported process identities use conservative recovery; interrupted work is never evidence of permission to bypass policy or erase usage. No automatic data expiry, account-policy bypass, silent model substitution or new archive was introduced.