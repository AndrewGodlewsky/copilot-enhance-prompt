# Audit verification record

Product source: **0.12.0**, commit `d25be463718f1b5d8ab663177fc9aa248956f762`. Audit date: 16 November 2026 local time; raw timestamps use UTC. Only reports and the offline benchmark harness/tests were added. Production source, manifests, version, release notes and generated application bytes are unchanged.

## Checks run

| Check | Observed result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; rebuilt extension and web assets match committed baseline bytes. |
| `npm test`, after rebuild | **378 passed, 0 failed**, about 8.6 seconds. Includes two new inexpensive audit-harness tests. No paid inference. |
| `npm run check` | Passed: both type configurations, manifest/catalog, packaged-copy equality, icon and retired-integration checks. |
| Root and web `npm audit --json` | Both exited 0 with zero reported known vulnerabilities. Full trees included because some bundled code is classified as development dependencies. |
| Six offline benchmark modes | Passed workload assertions; 50,000 history entries, 30,000 synthetic session pairs, 30,001 project files, and 20,000 usage receipts across 10,000 sessions. Samples retained in `measurements.json`; exact limitations in `performance.md`. |
| Security-boundary focused suites | 58 passed; five additional disposable probes confirmed the documented undesirable behaviors. |
| Runtime/storage/update focused suites | 117 passed; three additional fixtures confirmed privacy/lifetime/path bugs. Ordinary cross-process update reservation and dead-owner recovery passed. |
| Static UI rendering | Confirmed pending-upload Enhance buttons remain enabled and a numeric progress value renders without `aria-valuenow`. No browser rendering claimed. |
| `node scripts/e2e-copilot-provider.mjs` | Passed using installed SDK/runtime and only a loopback fake model: output, model/reasoning, images, isolation, cancellation, journal reconciliation, retained receipts and cleanup. |
| `node scripts/e2e.mjs` | Passed in a disposable headless session: package/canvas identity, theme persistence, empty synthetic catalog behavior, all context levels, exclusions/privacy, retired-provider rejection, guarded send to fixture session and safe diagnostics. No actual desktop canvas was rendered. |
| `node scripts/e2e-runtime-identity.mjs` | **Failed: maintained fixture is stale.** Runtime/bootstrap checks and SDK import passed, then catalog checking reached authentication, which its synthetic parent does not implement. |
| Disposable identity fixture with only `gitHubAuth.getStatus` added | Passed absolute and embedded bootstrap, SDK import, and two refreshed synthetic catalogs in each. No production or maintained test file was changed. The stale fixture remains a v1 release-check fix. |

Focused suites overlap the full suite; do not sum them into an inflated independent test count. A probe passing because it reproduced a bug is not a fixed-bug regression test. Existing Windows file-symlink tests can return early when privilege is unavailable; the runner's zero-skipped total does not establish that those cases ran. Directory-junction cases did run.

Before the successful runtime runs, the test environment was mistakenly pointed at the desktop launcher (`github.exe`) rather than the SDK CLI executable. Those attempts failed to provide the required bootstrap/protocol response and are not plugin compatibility results. The configured path was then resolved read-only from the installed SDK runtime; no alternate runtime was downloaded. This reinforces the need for documented runtime discovery and explicit fixture preflight. Only test-owned clients were stopped; no existing user session or installation was targeted.

## Environment actually exercised

- Windows x64; Node **v24.22.1**; npm **12.0.2**; Git **2.55.0.windows.3**.
- Desktop executable metadata: **1.4.2**. This is metadata inspection, not a visual UI test.
- Installed SDK and CLI: **1.0.106-8.unstable.r43566476370.g869eef3**. Successful tests used the existing `copilot.exe` in that version's SDK runtime cache and the desktop's `copilot-sdk` directory.
- Account/catalog responses were synthetic. The fixture explicitly routed inference to local HTTP and validated outgoing content. These runs do not verify live Copilot entitlement, managed enterprise authentication, actual credit charges, or real billing ingestion.
- Dependencies were already installed; no dependency versions or lockfiles were changed. No fresh `npm ci` claim is made for this audit; a clean install/build remains part of the proposed release CI.

## Documentation and evidence

The independent reports contain file references, observed outcomes and conditions. Large synthetic corpora, logs, temporary scripts, build inventories and raw audit responses remain ignored under `.artifacts/v1-audit`; they are not distribution artifacts. The published metric JSON contains sizes/timings/runtime versions only. The maintained benchmark can regenerate the large workloads on demand.

Local Markdown targets and heading anchors are checked before commit. Mermaid source is checked for balanced diagram fences and reviewed against source by another reviewer. No browser/desktop automation was used to render diagrams; their visual rendering remains a manual check. This follows the owner's restriction even though the Markdown validation skill normally requests a browser check.

## Remaining verification

No fresh live marketplace update/restart, account-backed enhancement, enterprise policy validation, real Usage Insights date-range query, model-output quality trial, screen-reader/keyboard/zoom/contrast/width inspection, sustained 24/7 soak, power-loss durability test, full host/third-party source audit, or non-Windows compatibility test was performed. Installed-runtime fixtures do not close those gaps.

The newly discovered security and correctness findings are **unfixed**. Convert each reproduction into a maintained regression when implementing its fix; test cross-feature interactions, especially privacy changes during AI selection, cancelled send checks, and cancellation followed by update.
