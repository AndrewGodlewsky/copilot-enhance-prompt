# Restoring saved panel state

Version 0.12.17 loads persisted panel fields with one authenticated `storage.getMany` request for the current set of 18 keys. The backend groups them into shared and session data and reads each participating JSON file once. Requests accept at most 64 allowlisted readable keys; they cannot choose a session, installation, path or arbitrary internal key. Duplicate keys are read once. Older test/preview clients without the batch method retain a bounded four-read fallback.

The production state layer applies each batch together. It tracks edits and request order so a late restore cannot overwrite a newer local edit, a newer shared-state response or a rebound canvas. Shared history change notifications from one batch coalesce into one reload. Session form values retain their existing behavior: reopening restores them, but a different canvas does not overwrite a person's active form on every keystroke.

File observers now share one parse and prior snapshot per observed file within a process, regardless of subscriber count. Stat polling runs every 500 ms; idle polls do not read/parse JSON. Atomic local writes compare the full latest state before updating the observer's snapshot, preserving external changes or deletions between polls. Obsolete in-flight reads cannot replace it; an initial read that loses the race can still identify missing notifications. Corrupt/unreadable files preserve the last comparison snapshot instead of falsely announcing every key as deleted. A later valid change recovers normally. The last subscriber removes the watcher and releases its snapshot.

This observer snapshot is only for notifications. Ordinary reads, bulk reads and keyed privacy checks read current files; there is no indefinite data cache. Separate files can reflect separate moments if another process writes during a batch. A notification stream is a view of current state, not a guaranteed log of every intermediate filesystem write. Missed/disconnected canvas-event recovery is tracked separately in #27.

## Measurement and tests

Run `node --expose-gc --max-old-space-size=512 scripts/audit/hydration.mjs` for owned synthetic fixtures. The benchmark executes the real state restoration code through the authenticated HTTP server. It checks restored content, requests, disk reads, raw time samples, heap/RSS observations and source hashes. It does not drive a browser, measure React rendering, contact a real account or invoke a model. Observer startup is settled before measuring either mode and is tested separately.

The [recorded results](audits/v1/hydration-measurements.json) compare the prior single-key path and the new batch path:

| Synthetic history and composers | Prior median | Batch median | Prior requests / reads | Batch requests / reads |
| --- | ---: | ---: | ---: | ---: |
| 50 history entries, 20 saved composers | 18.972 ms | 4.418 ms | 18 / 18 | 1 / 2 |
| 500 history entries, 20 saved composers | 23.951 ms | 10.867 ms | 18 / 18 | 1 / 2 |

The historical pathological shared-file fixture with 30,000 synthetic session values compares 20 redundant reads (1,653.840 ms median) with one snapshot (73.788 ms). This is a microbenchmark of the old layout, not a supported 30,000-entry history or measured desktop startup. The run completed with a 512 MiB V8 heap limit; recorded heap/RSS samples are endpoint observations, not peak-memory measurements or an OS memory limit.

Regression tests instrument reads for shared observers and batch restore; exercise authenticated key/size boundaries; preserve Unicode, missing/deleted values and fresh privacy settings; delay old responses and initial observer reads; test corrupt-file recovery, local-write ordering and subscriber disposal. Existing real child-process notification tests continue to run. Desktop responsiveness remains a manual acceptance check in #29.
