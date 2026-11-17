# Retained usage and Usage Insights

Enhance Prompt keeps accounting independently of editable prompt History. Clearing History never expires receipts. The current Usage Insights scanner already consumes these journals incrementally; this review does not change either plugin's runtime behavior. See [measured results](audits/v1/usage-consumer.md).

## Producer contract

`src/copilot/usage.ts` creates one session journal per helper under the plugin's usage root, with a synthetic workspace labeled **Enhanced Prompt**. It persists allowlisted accounting fields, not prompts, transcripts, tokens or credentials. Missing credits remain unknown rather than being invented as zero. A receipt's `(sourceSessionId, usageId)` identifies an immutable event; repeated identities retain the first accepted receipt.

Writes replace the journal atomically. Late recovery can replace an existing journal with the original receipts plus newly recovered receipts. Consumers must handle replacement and truncation, not just append offsets. Shutdown/recovery durability must not be traded away to batch writes. See [privacy and retention](privacy.md) for recovery ownership and limits.

## Observed consumer contract

This review inspected Usage Insights commit `7579014ddb925efda304199dc1218141d6b0beed`, particularly `src/node/copilot-source.mjs`, `src/node/read-queue.mjs`, `src/core/copilot.mjs` and `src/core/copilot-report.mjs`.

- Unchanged size/mtime/ctime snapshots reuse parsed journals. A warm refresh still enumerates and stats directories; it does not reread every receipt.
- Growing files use a verified consumed-prefix hash before parsing appended bytes. Changed identity, truncation or changed prefix triggers a reparse. Incomplete trailing lines wait for completion.
- Receipt identities deduplicate replay. Overlapping copies contribute distinct receipt identities; for a conflicting value under the same identity, source order determines the first accepted value. This merges receipts, not authoritative corrections.
- Appending another value under an existing receipt identity is **not a correction protocol**: first accepted identity wins. Replacing the canonical journal's original value is recognized on rescan. This describes the fixture behavior, not a request to edit real accounting.
- Refreshes serialize within a scanner. Unchanged refreshes can return the same result object. All-time and 90-day report aggregation still processes the selected records when requested.

## Recommendation

Keep the current producer format and consumer incremental behavior. The measured 10,000-session warm scan is dominated by directory/file metadata work; a producer manifest or delayed durability adds risk without demonstrated need at this size. No change to the Usage Insights repository is included or required.

If larger measured workloads justify persistent indexing, scope it separately in the consumer:

1. Cache derived receipt identities and aggregates with canonical source/session identity, file identity, size, times and consumed-prefix hash. Receipts remain the source of truth.
2. Commit the derived cache transactionally. Version its schema and source fingerprint; rebuild on corruption or incompatibility.
3. Reconcile replacements, truncations, late receipts, duplicate sources and partial tails. Unavailable sources mean incomplete coverage, not permission to erase spending.
4. Retain a full reconciliation action. Test cold/warm scans, concurrent refresh, restart, corrections and time-range boundaries against exact integer accounting before comparing speed.

Any future correction protocol needs a versioned shared definition of authoritative sequence or distinct adjustment events. Do not reinterpret conflicting duplicate receipts by guessing. Any batching must preserve acknowledged durability and recovery; no retention expiry is proposed.

## Reproduce safely

Set `USAGE_INSIGHTS_REPO` to a trusted clean checkout and run `node scripts/audit/usage-consumer.mjs` from this repository. It imports that checkout's actual scanner/report code, verifies its commit/clean state and selected source hashes before and after, and writes only an owned temporary fixture plus the sanitized measurements in this repository. Imported code must be trusted; this is not a sandbox for arbitrary checkouts.

The harness creates 10,000 production-recorder sessions and 20,000 synthetic receipts over 120 days. It supplies only fixture roots, disables WSL/VS Code discovery, makes no model calls, and never opens an owner session/profile. It removes only its own temporary root. Published measurements contain timings, counts, memory endpoints and code hashes, not paths, prompt text or real accounting. Benchmark code/data are excluded from the runtime archive.
