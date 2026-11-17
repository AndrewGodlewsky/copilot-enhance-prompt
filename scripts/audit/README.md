# Offline v1 audit workloads

Run from the repository root using Node 24 and the locked root dependencies. These tools use synthetic files, temporary stores, production pure/backend functions, and local Git. They make no model calls, use no Copilot allowance, do not control the desktop/browser, and do not touch the owner's plugin installation or saved data.

```powershell
node --test scripts/audit/v1-benchmark.test.mjs
node scripts/audit/v1-benchmark.mjs history
node scripts/audit/v1-benchmark.mjs storage
node scripts/audit/v1-benchmark.mjs usage
node scripts/audit/v1-benchmark.mjs context
node scripts/audit/v1-benchmark.mjs search
node scripts/audit/v1-benchmark.mjs animation
node scripts/audit/concurrency-scale.mjs
```

`concurrency-scale.mjs` is a separate opt-in workload. It creates and removes only its own temporary root, launches owned fixture children, waits 31 seconds for an interrupted writer's stale lock, and commits sanitized measurements to `docs/audits/v1/concurrency-scale-measurements.json`. Allow a few minutes and roughly 100 MiB of scratch disk; parent memory is measured but is not an enforced cap. It runs six 120,000-edit samples and 1,200 cross-process transactions, then gathers context from 10,004 tracked files. See [method, results and limits](../../docs/audits/v1/concurrency-scale.md). It is not part of ordinary `npm test` and must run separately when these contracts change. Do not run competing benchmarks while collecting timings.

Run modes sequentially when comparing elapsed times. `context` creates 30,001 files; `search` reuses a `context-*` fixture in `.artifacts/v1-audit`, so run context first. History reaches 50,000 entries; storage reaches 30,000 draft/result pairs; usage creates 10,000 sessions and 20,000 receipts. These are opt-in workloads, not part of the ordinary full test suite. Only the two inexpensive harness regression tests are included in `npm test`.

Each mode writes a unique fixture directory plus `{mode}-results.json` under ignored `.artifacts/v1-audit`. Later runs replace only the corresponding result JSON; they create new fixture directories. Nothing is automatically deleted. Keep adequate disk space and memory: the original storage stress process peaked around 2.83 GiB including synthetic objects and overlapping reads. Delete only verified synthetic fixture directories when finished; do not target an application data directory. Do not commit fixtures or console logs.

The reported three-sample medians are local observations; some workloads deliberately use one sample. Fixture generation, cache warmth, JIT and filesystem load affect timings. `history.parse` validates an array, not JSON bytes. `storage.writeOneSmallPreference` is a historical metric name for a small key in the data file, not the separate preferences file. `storage.hydrate20Keys.*` repeats the same key twenty times and compares a snapshot; it is not a canvas startup benchmark. The alternative grouping/search/storage algorithms live only in this harness. Search equality holds for this fixture, not every production filename/output cap. Animation timing excludes browser rendering.

The published [performance report](../../docs/audits/v1/performance.md) and [samples](../../docs/audits/v1/measurements.json) record the baseline commit, environment, workload sizes and interpretation. The version constant identifies that historical audit; record the actual product version if adapting the harness for a later release. Full installed-runtime/paid-model benchmarks are separate and are not launched by these commands.
