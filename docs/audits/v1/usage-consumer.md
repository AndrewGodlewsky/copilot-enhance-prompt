# Usage consumer measurements — 0.12.28

The real Usage Insights consumer already avoids reparsing unchanged journals. At 10,000 synthetic helper sessions, a warm refresh took **157 ms median**, versus **1,814 ms** for one initial scan. There is no evidence here that dropping retained accounting or weakening write durability is warranted.

## Results

Windows x64, Node 24.22.1, local filesystem. Consumer commit `7579014ddb925efda304199dc1218141d6b0beed`; [raw samples and source hashes](usage-consumer-measurements.json). No competing benchmark ran during the final measurement.

| Work | Observed time | Verified result |
| --- | ---: | --- |
| Create 10,000 sessions / 20,000 receipts | 30,231 ms, one sample | Production recorder; 30,000,000 nano-AIU |
| Initial scan | 1,814 ms, one sample | Reads 10,000 journals / 9.35 MB |
| Unchanged refresh | 157 ms median of 3 | Zero journal bytes reread; same result object |
| Forced refresh | 1,657 ms median of 3 | Reads all journals; exact same totals |
| All-time report | 90 ms median of 3 | 20,000 requests / 0.03 synthetic credits |
| 90-day report | 83 ms median of 3 | 15,020 requests / 0.02253 synthetic credits |

Incremental mutations took 151–183 ms each (single samples). Assertions cover identical duplicates, new receipts, canonical atomic replacement, late production-recorder recovery, copied journals, partial/truncated tails, conflicting duplicate identities, forced reconciliation, a fresh scanner, and two concurrent refreshes. Final exact accounting is **20,002 receipts / 30,002,100 nano-AIU**. Conflicting appended duplicates intentionally keep the first receipt; they are not adjustments. The [compatibility contract](../../usage-consumer-contract.md) explains this distinction.

## Interpretation and limits

Warm scans still enumerate/stat 10,000 directories. Forced/initial scans are dominated by journal work; report aggregation is smaller in this fixture but still linear work. A consumer-owned persistent index could help larger cold scans; its reconciliation cost and correctness need separate evidence. No producer batching or cross-repository code change is justified by this measurement alone.

The fixture uses two small receipts per session, synthetic credits and a fixed 120-day distribution. This is not a billing-price estimate, real-account test or proof for arbitrarily large journals. Three samples are descriptive medians, not tail-latency estimates. The first scan has no application cache, but OS caches were not flushed; report samples have no separate JIT warm-up. Highest recorded parent RSS is about 638 MiB, including producer, fixtures and consumer; samples are not peaks or desktop/browser memory. Restart and concurrent assertions are not timed benchmarks. SQLite, WSL, VS Code, slow/network disks, native rendering, live account ingestion, other platforms and long-running soak remain untested here.

Run `USAGE_INSIGHTS_REPO=<trusted clean checkout> node scripts/audit/usage-consumer.mjs` using your shell's environment syntax. Allow several minutes and scratch disk. This opt-in workload is separate from `npm test`; do not run competing benchmarks. It checks the other checkout remains unchanged and cleans only its own synthetic root.
