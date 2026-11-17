# History and feature-cost decision before v1

**Recommendation: keep bounded recent History for v1, preserve all usage accounting, and treat a long-term prompt archive as a separate opt-in feature. The owner's decision is pending.** Nothing in this document changes retention, defaults or features. Track the decision in [#35](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/35).

## What exists today

History defaults to 50 entries, allows an effective maximum of 500, and additionally caps combined original/enhanced text at 1,000,000 JavaScript string units. Individual stored prompt fields are capped at 20,000 units. These are storage bounds, not a promise of a date range: long entries can fill the text budget before the entry count. Heavy daily use will not retain an exhaustive 90 days. Changing the history limit can prune entries on a subsequent history write; it is not an archive migration.

Session drafts/results are separate, partitioned by session, with no automatic expiry. Retained model usage is separate again and has no automatic expiry. Clearing prompt History does not erase spending records. User-controlled retained-data cleanup targets eligible inactive session data, not usage journals. Current History export downloads Markdown for the currently filtered entries. It is a readable copy, not a restorable database backup, searchable archive or all-data export. There is no History import action.

## Concrete choice

| Choice | What users get | Cost and limits |
| --- | --- | --- |
| Keep bounded History for v1 (recommended) | Fast recent-prompt search/reuse, existing filtered Markdown export, no new storage system or privacy choice | Clearly document that it is recent history, not exhaustive 90-day recall; users must export deliberately if they need an additional copy. Existing caps stay unchanged. |
| Approve a separate optional archive project | Potential long-term searchable prompt recall with explicit retention and export controls | Needs indexed/paged storage, migration/recovery design, confidentiality controls, large-data evidence and a new reviewed implementation. Raising current array caps alone is not sufficient. |

The initial [50,000-entry benchmark](audits/v1/performance.md) exposed whole-array costs; subsequent work improved grouping, session partitioning, save coalescing and repeated reads without removing features. The [current concurrency evidence](audits/v1/concurrency-scale.md) uses 500 retained History rows. It does not prove a 50,000-row production archive. The [actual Usage Insights consumer](audits/v1/usage-consumer.md) already reuses unchanged journals at 10,000 sessions; prompt History and usage accounting are different datasets.

## If an archive is chosen

Approve a separate issue/design before raising caps. The minimum contract should decide:

1. Explicit opt-in and clear distinction between recent History, archived prompt text, session drafts, attachments and usage. Explain plain-text-at-rest exposure, filesystem access and organizational rules; do not imply encryption from opaque filenames.
2. Stable entry/project IDs, transactional append/update/delete, indexed project/date/search queries and bounded pages. Search should not deserialize every full prompt into the canvas. Measure full-text indexing and invalidation before selecting a storage engine/dependency.
3. Retention choices with a no-expiry option; no silent deletion, content truncation or automatic import of old private data. Exact-text export, schema version, checksum/validation, duplicate handling and explicit restore semantics.
4. A resumable, non-destructive migration with private backup/rollback guidance. Preserve the original store until validated; no automatic cleanup of unknown or linked files. Define multi-process ownership, crash recovery and corruption handling.
5. Synthetic 10k/50k/100k entries with mixed Unicode and realistic length distributions; cold/warm project/search/page queries, concurrent writers, interrupted migration/restart and bounded memory. Record exact result equality, latency samples, source hashes and native rendering separately. Set acceptance budgets before implementation.

This is a design outline, not approved implementation or a promise of 100k support. Backup format, archive retention, attachment handling, deletion recovery and storage dependency remain decisions.

## Other feature trade-offs

| Feature | Measured evidence | Current decision |
| --- | --- | --- |
| AI-assisted / AI Test | Extra selector/research calls exist; a configured time budget is not measured cost. Earlier quality study has proxy/regression limits. | Keep available; compare evidence quality and downstream task outcomes under [the evaluation protocol](research/v1-quality-gate.md) before changing defaults/removing it. |
| Highest reasoning on Low | Earlier subscription trials were faster at lower reasoning on some cases, with factual/scope regressions. No target-model universal win was established. | Keep configurable effort/reasoning; don't equate Low with low latency or increase context automatically. |
| Stick-figure animation | Initial pure simulation costs were small; actual browser layout/paint was not measured. | Keep approved animation, pause and reduced motion. Profile native rendering before proposing removal. |
| Usage retention | Warm real-consumer scan was about 157ms at 10k sessions in the current local fixture. | Preserve receipts; any consumer index must reconcile rather than expire accounting. |
| Old session drafts | Session partitioning removes whole-history rewrite amplification; storage still grows. | Keep explicit cleanup and no automatic expiry. |

## Decision record

Status: **Awaiting owner response**. No implicit choice is made by publishing this document. Record the chosen v1 scope, reasons, export/retention/recovery expectations and any unsupported promise in #35. If an archive is requested, create a separately scoped design issue and leave implementation unapproved until its storage/privacy contract is reviewed.
