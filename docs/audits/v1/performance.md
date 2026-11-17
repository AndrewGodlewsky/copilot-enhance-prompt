# Performance and scale review

**Fix shared draft storage and repeated repository scans before cutting features.** The isolated alternatives below preserved their fixture outputs and were substantially faster. They are experiments, not installed optimizations or promises of equivalent end-to-end speedups.

Audited product: **0.12.0**, source `d25be463718f1b5d8ab663177fc9aa248956f762`. Measurements were collected on 16 November 2026 local time (17 November UTC), Windows x64, Node **24.22.1**, Git **2.55.0.windows.3**. All data was synthetic. No Copilot model, account, browser, desktop UI, or owner's usage database was used. [Recorded samples](measurements.json), [harness and reproduction instructions](../../../scripts/audit/README.md), [architecture diagrams](architecture.md).

## What “90 days” means in this plugin

Enhance Prompt does not aggregate all-time/90-day Copilot activity. It creates prompts, keeps a bounded prompt history, and writes local usage receipts consumed by Usage Insights. A large Usage Insights date-range query is a separate application's workload. This audit tested the receipt producer and a simple reader, not that application's indexing/query engine.

There are three different growth patterns:

| Data | Current bound | Consequence |
| --- | --- | --- |
| Prompt history | Default 50 entries; UI maximum 500; one million original-plus-enhanced characters overall; 20,000 characters per saved text | It cannot promise an exhaustive 90-day prompt archive for heavy users. Long prompts can exhaust the character cap before 500 entries. The backend does not independently enforce the UI's 500 maximum; add validation. |
| Session drafts/results | Session-prefixed keys in one shared data JSON file; no aggregate lifetime bound | Old sessions accumulate and slow unrelated reads/writes. The history cap does not protect this file from draft growth. |
| Usage receipts | One retained directory per helper; no automatic expiry | Accounting remains available as requested. Directory count grows even though individual files are small. A consumer needs incremental indexing at long-term scale. |

Sources: [history limits](../../../src/history.ts), [session storage](../../../src/copilot/services.ts), [storage engine](../../../src/copilot/storage.ts), [receipt recorder](../../../src/copilot/usage.ts).

## Method and interpretation

Six offline workloads used production functions. Most timings have three samples and report the median; one-sample workloads are explicitly marked. Samples are retained rather than inventing percentiles from three observations. Fixture creation is outside timed context/storage/history operations, but inside the usage creation measurement. OS filesystem caches were not flushed; there was no independent warm-up or randomized baseline/prototype ordering. These are local elapsed times, not a controlled hardware benchmark, user-facing p95, billing estimate, or 24/7 soak test.

History fixtures have repeated synthetic strings; real vocabulary/size distributions can differ. Context fixtures are 30,000 tiny TypeScript files plus a README, in 100 directories, with an initialized Git repository and untracked files. They do not model a large tracked checkout, huge generated files, slow network disks, binary-heavy repositories, or enormous diffs. The Git-disabled walk uses that same tree. The storage fixture has two 1,024-character values per session, not full real session contents. Its `lastEnhanced` suffix is a synthetic companion key, not a production panel-key contract.

The benchmark compares output equality for project grouping, repeated storage reads, and per-keyword file counts. That supports the local optimization hypothesis; it does not prove that a proposed cache has correct concurrent invalidation, that a batched search preserves every truncation boundary, or that an implementation is ready to merge.

## 1. Shared draft storage: highest scale priority

Every `get` reads/parses the whole store; every `set` reads, serializes, and atomically replaces it under a cross-process lock. Draft typing can queue such writes. Separate preferences and data directories exist: the small-write test below operates on the **shared data file**, not the production preferences file.

| Retained synthetic sessions | File size, decimal MB | Read one draft, median ms | Write one small data key, median ms | Four competing writes, median ms | 20 redundant concurrent reads, one sample ms | One snapshot serving those reads, one sample ms |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.216 | 0.714 | 3.630 | 93.687 | 8.056 | 0.823 |
| 1,000 | 2.155 | 3.148 | 9.566 | 108.335 | 63.539 | 7.806 |
| 10,000 | 21.550 | 34.730 | 76.430 | 410.000 | 678.246 | 41.699 |
| 30,000 | 64.650 | 117.282 | 249.864 | 1,055.577 | 2,122.402 | 99.553 |

The last comparison is a **same-key redundant-read microbenchmark**, not a measured canvas startup: it asks `get` for the same key twenty times, then compares one parsed snapshot returning that value twenty times. Production startup also issues concurrent persisted-atom reads, so it exposes a real amplification mechanism. The 21.3× result is for this operation only. The four-write timing uses one process and does not verify final values; separate functional fixtures cover cross-process coordination.

Whole-process peak RSS was about **2.83 GiB** during the storage workload. That includes the fixture object/string and twenty overlapping full-file loads; it is not Copilot's measured working set. Watchers stat the file every 500 ms and parse/compare it **when it changes**; they do not parse the entire file every idle polling interval. Multiple listeners/canvases can add more work not included in the table.

Preserve functionality by:

1. Partitioning drafts/results by session, keeping shared preferences/history separate. Use versioned migration, rollback/recovery, and the existing atomic cross-process transaction semantics.
2. Adding a bulk snapshot read for initial state and one shared change-feed read per store revision. Invalidate after committed writes; do not use an indefinitely stale memory cache.
3. Coalescing rapid draft edits, with a durable flush before close, update, send, and any operation claiming the draft is saved. Explicitly surface a failed save.
4. Offering storage size and inactive-session management. Automatic deletion is a separate product decision; it is not necessary for partitioning to eliminate whole-history rewrites.

**Trade-off:** deleting old session drafts would cap retained text but loses reopen convenience. Partitioning and batching should be tried first; there is no need to remove that convenience to obtain the main improvement.

## 2. Project gathering: fewer scans before larger context budgets

| Operation on 30,001 files | Median ms | What is excluded |
| --- | ---: | --- |
| Git enumeration and project rules | 878.514 | Model calls |
| Off gathering | 0.005 | Model calls |
| Project overview / Standard | 852.550 | Model calls |
| Relevant code / Deep | 5,044.866 | Model calls |
| AI-assisted / Max | 5,004.363 | Selector replaced by a deterministic stub |
| AI Test initial gathering | 4,963.473 | Research and rewrite model calls |
| Direct static cache hit | 0.003 | Normal `gatherContext` forces a refresh, so it does not obtain this hit |

The final synthetic payloads were only 1,233 characters for Standard, 2,616 for Deep and AI Test, and 2,960 for Max. Scanning work, not payload volume alone, dominates this fixture. These numbers are not evidence that Max is faster than Deep in real use: its extra inference was stubbed.

The search experiment compared five concurrent per-keyword Git processes with one combined fixed-string pass over the same tree:

| Search strategy | Median ms | Correctness evidence |
| --- | ---: | --- |
| Current separate processes | 2,975.215 | Production `gitGrepCount` |
| Single-pass prototype | 659.400 | Every keyword/file count matched the current output on this fixture |

That is **4.5× faster for this search operation**, saving about 2.32 seconds. It is not an integrated gather speedup. Production allows 5 seconds/4 MB per search; the prototype allows 30 seconds/16 MB and omits the cancellation/refused-path arguments. It also needs quoted/unusual filename and all-no-match handling. Preserve production exclusions, redaction, Unicode/path semantics, timeout/cancellation, output bounds and partial-result handling before adopting it.

Preserve functionality by batching keyword work, sharing an in-flight enumeration between equivalent preview/enhancement requests, and caching only reusable facts under an explicit freshness rule. Key caches by canonical project and privacy/exclusion state. Refresh on user request and relevant changes. Re-read privacy at every later file/model boundary. Do not “optimize” away security filtering or silently serve stale file contents.

**Coverage must be visible.** The non-Git walk took 677.565 ms (one sample), returned its maximum **8,000 of 30,001** files, and missed the explicitly targeted fixture file. The fallback also has a depth bound. Git enumeration caps at 50,000 names; fallback content search caps files/bytes/time. These limits prevent runaway work but are not exhaustive understanding. Show scanned/eligible/truncated counts and why a requested path was omitted; prioritize explicit safe paths before a bounded general walk.

## 3. History: optimize before raising retention

| Entries | Distinct project paths | Current grouping, median ms | Single-pass grouping, median ms | Search and sort, median ms |
| ---: | ---: | ---: | ---: | ---: |
| 50 | 50 | 0.593 | 0.064 | 0.015 |
| 500 | 60 | 0.761 | 0.271 | 0.109 |
| 10,000 | 1,500 | 113.645 | 6.399 | 4.501 |
| 50,000 | 1,500 | 557.055 | 26.532 | 20.515 |

At 50,000 entries, grouping improved **21×** with identical labels, counts, ordering and project selection. The maintained harness test also covers Unicode, unassigned entries, duplicate folder names and an empty current project. Current grouping repeatedly scans entries for each project; the alternative accumulates counts once. This is useful if retention expands, but it is not a present 557 ms regression for a normal 500-entry installation.

The 50,000-entry serialized fixture is 91.16 MB. `history.parse` in the raw results means validation/projection of an **already parsed array**; it does not measure JSON decoding, transport, or DOM rendering. Search uses already newest-first input and a query matching about 5% of entries; it is not worst-case sorting. The UI's 12-entry pagination helps rendering but would not eliminate loading/filtering a future 50,000-entry history. These stress sizes exceed the intended UI range and character budget. Do not simply raise the current cap: add paged/indexed storage and archive/export semantics first.

**Trade-off:** an unlimited searchable prompt archive increases retained private text and migration/support cost. Keeping the current bounded recent-history feature is fastest, but loses old prompt recall. If 90-day/full-history search is a v1 requirement, make it a separate storage feature rather than removing the cap in place.

## 4. Usage accounting: retain receipts, plan the consumer index

The recorder produced **20,000 usage receipts in 10,000 sessions** in 35.812 seconds (one sample), including atomic metadata/event file creation and flushes. This is roughly 3.58 ms per session averaged over the run; it is not the latency of a live model call. All 20,000 receipts were read back and counted. They occupied 7.43 MB of event text plus metadata/filesystem allocation, across 20,000 files.

A simple sequential read/parse of those receipts took **3.421 seconds** (one sample), excluding directory enumeration and workspace metadata reads. This is a consumer simulation, not Usage Insights. It demonstrates why repeatedly rescanning every session should be replaced with a consumer-side incremental index, with deduplication and correction/recovery handling. The 20,000-file count follows the recorder's two-files-per-session format; it is not measured allocated disk space.

The recorder reconstructs a session's receipt file after each event. Abnormal single-session bursts took 9.897 ms for 10 events, 85.807 ms for 100, and 1,025.890 ms for 1,000 (one sample each). Typical helpers produce few events; optimizing this tail is lower priority than shared drafts and scanning. Batch only with durable reconciliation, and never discard receipts to hide cost or improve a benchmark.

Keep a separate recovery registry for failed helper journals. They may contain raw transcripts and currently lack a supported resume/reconcile path. Size inspection, exact-accounting deduplication and successful-flush cleanup are preferable to expiry. Changing the receipt format or grouping requires coordinated Usage Insights testing.

## 5. Animation, panel, models and updates

| Area | Observed cost or bound | Recommendation |
| --- | --- | --- |
| Word crew | Word creation, crew setup and 600 simulation steps: 2.247 ms at 50 words, 5.200 ms at 200, 12.926 ms at 1,000; excludes geometry/layout/paint/frame scheduling | No measured reason to remove it. Keep reduced motion and opt-out; profile actual host rendering/visibility on a lower-end machine. |
| History rendering | 12 entries per page and inline expansion | Keep pagination. Measure narrow/large-text/50%-400% zoom interactions manually; do not infer frame rate from pure function timings. |
| Diagnostics | 200 entries per component, projected fields | Keep bounded support evidence; do not add raw prompt/file logs for profiling. |
| Model helpers | Isolated helper startup, account/catalog/tool checks, receipt flush and stop | Preserve isolation and accounting. Reusing a persistent helper might save startup but introduces state/account/policy leakage risks. No startup-cost measurement here justifies it. |
| Model catalog | Explicit refresh and existing cached checks | Measure host preflight separately before reducing verification. Never cache entitlement or account identity across unsafe boundaries. |
| Update checks | Automatic 24-hour cache, bounded metadata, coalescing/backoff; explicit installation | Avoids constant remote metadata polling and code downloads for checks; the panel still polls local update state every five seconds. Fix cancellation/work lifetime before optimizing update exclusion. |
| Attachments | Chunked uploads; bounded per-file/image sizes; text excerpts | Fix upload/run coordination and canonical confinement first; add backend aggregate/session quotas. No large-image memory profile was performed. |

## Functionality trade-offs worth a decision

**No feature removal is needed for the measured 4.5× and 21× local gains.** Implement and remeasure those mechanisms first.

| Possible change | Work eliminated | What users lose | Evidence and decision |
| --- | --- | --- | --- |
| Use Project overview instead of Deep by default | About 4.19 seconds of local work on this fixture | Relevant source excerpts/diffs | Standard is already the default. Keep the choice; do not silently downgrade requested context. |
| Remove AI-assisted or AI Test | Selector call, or up to two research calls / 45-second research budget | Model-directed evidence selection | No new quality or model-latency experiment here. Keep experimental/opt-in; benchmark collected evidence and downstream task quality before removal. A time budget is not measured cost. |
| Lower reasoning for the Low effort preset | Potential reasoning latency/usage | Possible output quality | Prior [prompt research](../../research/prompt-evaluation-findings.md) showed regressions and proxy-model limitations. Current highest reasoning is not necessarily fast. Do not change defaults based on this offline audit. |
| Expire inactive drafts | Storage/retention growth | Reopening old session text | Prefer partitioning and user-controlled cleanup; automatic expiry needs explicit product agreement. |
| Remove old usage | Files and full-scan work | Spending history | Conflicts with the existing retention goal. Keep accounting and coordinate incremental consumption. |
| Remove animation | Browser rendering work | Approved visual feedback | Pure computation is small; browser cost remains unmeasured. No evidence supports removing it. |

## Release performance gates

After fixes, rerun these fixtures on the same environment and retain samples. Add sustained concurrent typing/save/close/update tests, a many-canvas watcher test, crash/reopen recovery, realistic tracked repositories and large diffs, Unicode requests/path retrieval, and delayed upload tests. Run a manual host frame/memory profile with long text and images. Do not claim 24/7 reliability from one short run.

Proposed targets to validate, not existing guarantees: single-session draft operations should be independent of inactive session count; initial hydration should read each store revision once; grouping should scale approximately with entries plus projects; deep gathering should avoid one full repository search per keyword; no accepted optimization may weaken cancellation, redaction, accounting durability or source identity.
