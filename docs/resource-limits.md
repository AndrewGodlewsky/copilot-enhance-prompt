# Resource limits

The backend enforces these limits even when a stale panel or direct authenticated request bypasses a control. No model is invoked to validate them.

| Resource | Limit |
| --- | --- |
| Saved history preference | 0–500 entries, integer; existing size budget also applies |
| Per-model timeout | 5–300 seconds, integer; overall run budgets still apply |
| String preference | 64,000 characters |
| Request or sent prompt | 1,000,000 characters |
| Files per prompt | 8; 10 MiB each; 80 MiB combined before buffering file contents |
| Images sent as images | Existing 4-image, 5 MiB-per-image limits |
| Upload chunk | Existing 44 KiB raw; at most 1,024 chunks per file |
| Excluded context paths | 1,024; 32,768 characters per path |
| Rules / structures / sections | Existing 1,000 / 20 / 12 limits, now checked before saving |
| Saved model profiles | 50; existing larger sets remain readable/editable but must be reduced before adding profiles or using an oversized fallback chain |
| HTTP request body | 2,500,000 bytes and 10 seconds to finish receiving |
| JSON structure | 24 levels deep, 20,000 values, 1,024 entries per object/list |
| Concurrent HTTP API requests | 24 per canvas, 64 per server |
| Outstanding worker operations | 32, including cancelled operations still cleaning up; at most 8 upload handlers |
| Concurrent enhancement runs | 4, including resumable/cancelled runs still settling |
| Event streams | 2 per canvas, 16 per server; slow consumers disconnected at a 1 MB queued-output threshold |
| Canvases / HTTP connections | 16 canvases, 128 connections per server |

Concurrency limits belong to an extension worker/server, not the whole desktop application. Startup restores saved state using four reads at a time; only these idempotent reads retry a capacity error, at most twice after two/four seconds. Saturation returns a readable error and HTTP 429 with a two-second Retry-After hint. The plugin does not automatically repeat model work or writes. Close an unused canvas or finish pending work, then retry. Closing streams and completing handlers release their reservations; caller cancellation does not release a worker slot until the underlying operation has settled.

Old out-of-range finite numeric preferences are rounded/clamped when read; invalid types/nonfinite values use defaults. Their stored values are not rewritten by this normalization. Existing history, drafts and attachments are not deleted by validation. Normal history retention still follows the effective setting on subsequent history changes. Unsupported legacy terminal limits are bounded too (1–1,000 lines; 1–8 other agents; 10–300 lines each), but their capabilities stay disabled.

These are robustness limits, not an OS sandbox or a disk-storage quota. A process running as the same user is outside the plugin's isolation boundary. Long-term stored-data budgeting and startup/read efficiency have separate audit issues.
