# Reasoning compatibility and connection disclosure

> Use superpowers:executing-plans and obtain one fresh review before delivery.

**Goal:** Fix the rejected Low recommendation and show healthy connections as a compact, expandable indicator beside the model description.

**Scope:** Keep existing assignments, reasoning verification, privacy, usage and sending safeguards. Models retains its full connection controls. Enhance collapses successful account/catalog checks by default, allows manual expansion, and automatically shows failures. No desktop/browser control or paid inference.

- [x] Investigate the actual supported reasoning choices before changing compatibility rules. Add a reproducing regression and fix the shared resolution path without inventing support or silently downgrading explicit choices.
- [x] Add a Connected disclosure beside Enhance's model/reasoning text. Test collapsed success, manual expansion, checking and automatic error expansion. Preserve check feedback and Show Logs.
- [x] Update docs and release notes, bump to 0.10.1, rebuild, run typecheck/full tests/package checks and obtain a fresh review.
- Delivery: commit and push verified work to main without a tag or release. Report the resulting commit and push status in the completion message.

## Evidence and decisions

- Screenshot reports `error.copilot_reasoning`, not a missing model. The recommended Low setting currently resolves `highest` only if every advertised level is recognized. The catalog also withholds malformed or unadvertised reasoning capabilities. Asked the owner for the Low reasoning dropdown values to distinguish those causes.
- Installed SDK declarations say reasoning configuration is valid only when `capabilities.supports.reasoningEffort` is true, and supported values are model-defined strings. Keep parent/helper validation and applied-setting verification intact.

- Root cause confirmed against the installed runtime: `session.rpc.model.list` returns raw `capabilities.supports.reasoning_effort`, while `client.listModels` returns normalized fields. The old adapter ignored the raw array. The account's Haiku 5.5 advertises low, medium, high, xhigh and max. The owner's dropdown showed only Recommended and Highest because the actual choices were lost.
- Normalize both shapes in the shared catalog/helper preflight path. Explicit normalized fields take precedence; malformed or unsupported metadata still fails closed. Keep exact advertised values and resolve the virtual Highest choice only when its order is known.
- An isolated installed-runtime session accepted Haiku 5.5 with Max and returned the same model/reasoning from getCurrent. Zero prompts sent; no inference or UI control. Temporary workspace and Copilot home were cleaned.
- Targeted regressions passed: 23 model/reasoning tests, 7 panel status tests and 2 composer tests. Composer coverage invokes the disclosure handler and verifies collapsed success, expansion/collapse, checking and automatic error details. Final release checks follow the rebuild.

## Final verification

- Typecheck and production build passed. Rebuilt extension and both committed web directories.
- Final post-build full suite: 322 passed, 0 failed, 0 skipped. Package checks and whitespace validation passed.
- Installed SDK/runtime local fixture passed output, model selection, applied reasoning, images, isolation, cancellation, retained usage and cleanup. No paid inference.
- Fresh independent review found no blocking issues; its 32 focused tests passed.
- Manual desktop visual verification and an actual account-backed enhancement remain for the owner after updating. No desktop or browser UI was controlled.
