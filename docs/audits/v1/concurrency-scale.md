# Concurrent storage and large tracked projects

Version 0.12.27 adds verification; it does not change storage, context limits or features. All measured scenarios passed their correctness assertions. This supports the bounded workloads below, not an unrestricted 90-day archive or a 24/7 performance guarantee.

Run `node scripts/audit/concurrency-scale.mjs` from the repository root. [Individual samples and source hashes](concurrency-scale-measurements.json) accompany the harness. Node 24.22.1, Windows x64, local disk, 17 November 2026. No paid inference, desktop/browser automation or owner data was used.

| Workload | Samples | Median elapsed | Verified result |
| --- | ---: | ---: | --- |
| Four sessions, 120,000 edits total, no observers | 3 | 1,315 ms | 80 atomic commits; maximum two pending entries per queue; correct final Unicode draft in all four reopened sessions |
| Same workload with 12 storage observers | 3 | 1,445 ms | Same bounded queue/commit results; all 240 expected observer notifications delivered |
| Four child processes, 400 shared transactions and 500 retained rows | 3 | 1,272 ms | Counter exactly 400; each writer's latest value correct; retained history unchanged |
| Deep context, 10,004 tracked files and a large diff | 3 | 1,085 ms | Late source marker found; bounded diff retained; payload 6,628–6,629 characters; large unreadable-file omission reported |
| Child killed before replacement rename | 1 | Not a throughput test | Previously acknowledged Unicode value survives; a new write succeeds after the 31-second stale-lock wait |

There are 720,000 edits and 1,200 cross-process transactions across the samples. Typing uses ten waves of 3,000 edits per session, with an injected 5 ms write delay to force overlap. Each wave holds caller promises until the queue drains. Coalescing intentionally discards intermediate edit values; a resolved batch promises the latest accepted value, not an archive of every keystroke. The bounded result covers these fixed-key storage edits, not arbitrary unbounded settings/key submissions.

The observer comparison adds about 130 ms at the median in this fixture. That is an observation, not a statistically isolated overhead estimate: modes run sequentially, OS/JIT caches are not reset, and no independent warm-up is excluded. All samples remain in the report. This release makes no before/after optimization claim; [earlier draft-save measurements](draft-save-measurements.json) compare sequential and coalesced writes separately.

The context fixture includes 10,000 tiny tracked TypeScript files, a 6,001-line source with evidence at its end, a roughly 2.5 MB changed text file, README and a 1 MiB binary image. Git initialization/fixture creation are excluded from timings. The binary is never attached and must not become a context snippet. The large file exceeds the safe text-read cap; its omission stays visible while a bounded Git diff is available. A synthetic checkout is more varied than the original tiny untracked fixture, but it does not represent every monorepo, network drive, generated tree, LFS setup or image-upload workload.

The interruption test kills only its own child after a completed save and after the next temporary file has been written, before rename. Reads retain the acknowledged state, and a later write acquires the expired child lock. It does not simulate OS crash, power failure, fsync durability or sudden disk loss. Temporary files remain within the disposable root until cleanup; the harness makes no production cleanup policy change.

Parent RSS samples reached about 181 MiB; these are endpoints, not peaks. Child processes, the desktop/browser and allocations retained until garbage collection are outside that measurement. Fixture setup, cleanup and the explicit stale-lock wait are excluded from throughput timings. No p95, long-running soak, slow-disk or power-loss claim follows from these samples.

An additional 23 production tests passed for cancellation/update exclusion, usage replay/restart, failed persistence and interrupted cleanup:

```sh
node --test src/updates/lifecycle.test.ts src/copilot/usage-recovery.test.ts src/copilot/usage.test.ts
```

These include a separate updater process blocked until cancelled work's cleanup settles, concurrent/restarted usage recovery with exact deduplication, and failures that retain accounting. They complement the scale run rather than pretending 720,000 keystrokes are 720,000 model receipts.

No measured result justifies removing an existing feature. Native rendering, multi-hour use, account policy, slow disks and OS-crash acceptance remain separate gates; [#29](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/29) tracks owner desktop acceptance. Prompt-history retention and any optional archive remain the product decision in [#35](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/35).
