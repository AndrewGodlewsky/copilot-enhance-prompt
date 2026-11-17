# First v1 remediation batch

Version **0.12.1** implements the first bounded batch from [tracking issue #40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40). All 39 work issues include evidence, a suggested change and acceptance criteria. This batch does not establish v1 readiness; the remaining privacy, attachment, lifecycle, storage and release-maintenance findings stay open.

## Changes and evidence

| Issue | Implemented behavior | Regression evidence |
|---|---|---|
| [#1](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/1) | Status/diff reads inspect effective Git configuration names, then disable clean, smudge, process and required filters through per-command overrides. Failed, oversized or unrepresentable configuration skips the read. Submodule working trees are not traversed; changed gitlinks retain short commit summaries. User configuration is never rewritten. | Isolated repositories with included clean/process filters, required drivers, malformed/oversized configuration and a child-only filter. Benign marker files demonstrated execution before the fix and no execution afterward. |
| [#3](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/3) | History saving checks current retention after waiting for its transaction/read, and checks Save history last, immediately before dispatching the write. A run started with saving off remains unsaved. Single-setting reads no longer enumerate unrelated preferences. | Opt-out during model work, history I/O and final preference I/O preserves prior history without adding the result. A real store test verifies one preference snapshot per keyed read. |
| [#4](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/4) | Canvas cancellation reaches session Send and is checked after the asynchronous idle check, immediately before enqueue. | Cancellation while idle RPC waits produces no message; a later explicit retry succeeds. Closing a canvas propagates its signal through the worker. |
| [#8](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/8) | Project metadata must explicitly identify a local, absolute, canonical directory. Missing/malformed metadata, files and failed lookups expose no project. | Null/missing/wrong-type locality and path fixtures fail closed; ordinary local discovery still passes. |
| [#38](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/38) | Progress lookup uses canvas ownership as well as run ID, including after completion. | Two canvases can reuse a run ID without sharing snapshots; a third cannot fetch either. |
| [#22](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/22) | History groups/counts entries once and counts duplicate display names once, instead of rescanning all entries and project names per project. | Exact output comparison with a frozen 0.12.0 algorithm, plus existing Unicode, identity, ordering, search, pagination and draft-preservation tests. Timings below. |
| [#23](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/23) | The progress root receives the numeric value; its visual styling is unchanged. | Static React rendering verifies 0, 50, 100 and absent values, including ARIA and determinate/completed states. **Remains open for the owner screen-reader check.** |
| [#28](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/28) | The bootstrap fixture supplies synthetic authentication and rejects a desktop launcher mistakenly used as the CLI. | Installed runtime imports its SDK and refreshes the synthetic catalog twice through both absolute and embedded bootstrap forms. |

## History measurement

The [raw samples](first-batch-history-measurements.json) compare production 0.12.1 candidate grouping against the frozen 0.12.0 algorithm in the same offline process. Three samples each, fixed ordering, no separate warm-up. These are observed medians, not guaranteed speedups or browser-render timings.

| Synthetic entries | Distinct projects | Previous algorithm | New algorithm |
|---:|---:|---:|---:|
| 50 | 50 | 0.272 ms | 0.103 ms |
| 500 | 60 | 0.550 ms | 0.305 ms |
| 10,000 | 1,500 | 100.883 ms | 7.632 ms |
| 50,000 | 1,500 | 548.146 ms | 31.470 ms |

The largest fixture was about **17.4 times faster** for grouping. Fixtures above 500 exceed the intended UI retention range; this does not increase retention or bypass the separate text budget. JSON parsing, disk reads, transport, rendering and model latency are excluded. Shared-draft storage remains the highest scale priority ([#12](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/12)); this change does not solve it. Full startup batching remains [#13](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/13).

## Verification and limits

Verification passed: `npm run typecheck`, `npm run build`, **388 tests** in `npm test` after rebuilding, `npm run check`, `node scripts/e2e-runtime-identity.mjs`, and `node scripts/e2e.mjs`. The bootstrap fixture also verifies refusal when its synthetic authentication contract is missing. Completion comments in the linked issues identify the pushed commit. All tests use synthetic data and disposable directories; no paid model calls or owner installation changes.

Runtime tested: Windows x64, Node **24.22.1**, Git **2.55.0.windows.3**, installed Copilot SDK/CLI **1.0.106-8.unstable.r43566476370.g869eef3** (desktop metadata **1.4.2**). The runtime smoke test checks package discovery, session metadata, all context levels, exclusions, privacy, retired-provider rejection, guarded fixture-session submission and redacted diagnostics. It does not operate the desktop UI.

Remaining manual checks: update/reopen the plugin in Copilot, verify the unchanged progress appearance with a screen reader, exercise ordinary Send/cancel behavior, and confirm History navigation. The broader owner/account matrix remains [#29](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/29). No live account entitlements, real model quality, managed-policy behavior or cross-platform support were established here.

Boundary limits: already-enqueued messages cannot be recalled; a history write already dispatched cannot be retroactively cancelled by a later setting change. Preferences and history remain separate stores. Git configuration can still be changed concurrently by a process with the same local account; check/open races are tracked separately in [#37](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/37). No automatic user-data deletion or feature retirement was introduced.
