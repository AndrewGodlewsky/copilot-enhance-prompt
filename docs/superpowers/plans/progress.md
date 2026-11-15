# Execution ledger: 2026-11-14-copilot-canvas.md

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

- Design approved; owner requested implementation with questions only when assistance is needed.
- Worktree already isolated on `AndrewGodlewsky/ningyo`; implement inline.
- Preflight: tasks share the typed panel/worker service interfaces; preserve protocol types while replacing runtime implementations.
- Ruling: no extra plan approval gate. The owner explicitly authorized proceeding after design approval.
- Ruling: keep checkpoints reviewable in the working tree until the new independent checks pass; do not run old publishing automation.
- Task 1: complete. Independent state/service contracts and Node test runner replace the previous runtime. Original behavioral coverage retained; 253 tests currently pass.
- Task 2: complete. Session-bound adapter, canonical project identity, fail-closed sending, scoped persistence, transactions and Windows DPAPI. Real DPAPI round-trip tested.
- Task 3: complete. Packaged extension, authenticated loopback transport, canvas lifecycle and build scripts. Real installed runtime discovers and opens the canvas.
- Task 4: implementation complete; visual inspection remains. Existing panel retained, host settings added, unsupported settings disabled, EN/VI/ZH translations checked.
- Task 5: documentation and branding updated. Obsolete screenshots moved to ignored scratch storage for reversible removal. Final consistency pass remains.
- Task 6: in progress. Installed-runtime test passes discovery, context, local-fixture enhancement, session Send, transformed hook and bypass. Desktop visual inspection and fresh whole-change review remain.
- Owner decision: show unavailable controls with explanations.
- Owner decision: investigate another hook integration before finishing. SDK callback registration hangs even in a minimal extension on both installed runtimes. Config-file userPromptTransformed works; implemented and verified it. It changes model-facing content, preserving surrounding context, while the visible chat text stays original. Ambiguous matching leaves the prompt unchanged.
- Verification: an unresponsive session status call fails closed after three seconds; equal run IDs in separate canvases no longer interfere (both regression tests observed failing, then passing).
