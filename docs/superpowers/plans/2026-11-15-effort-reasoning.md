# Effort models, reasoning and Copilot connection status

Approved scope: Low uses Claude Haiku 5.5 at its highest advertised reasoning level; Medium uses GPT-6.1 Sol at High; High uses Claude Opus 5.5 at Medium. Add separate model/reasoning controls and actionable account/catalog status on Enhance. Preserve existing assignments, privacy, accounting and sending safeguards.

## Implementation

1. Add catalog reasoning metadata, exact recommended-model resolution and per-tier reasoning preferences. Keep saved custom/Auto assignments; new installations use recommendations. Add a Settings action to apply the recommendations to existing installations. Tests cover absent/ambiguous models, unsupported reasoning, unknown highest-level vocabulary and migration.
2. Pass the resolved reasoning to the first rewriting model, AI Test research, and the AI-assisted selector when it uses that model. An explicitly separate selector and fallback models keep their own defaults. Validate both catalogs and read back the helper's actual reasoning before sending any content. Tests exercise accepted, rejected and silently changed reasoning and preserve helper isolation/accounting.
3. Check desktop authentication during catalog discovery. Enhance shows checking, account/catalog ready, or actionable failure with Retry, Settings and Show Logs. Retry fetches metadata only; sign-in stays in Copilot. Helper failures remain visible until a successful enhancement or configuration change. Tests cover retry, stale async responses and error privacy.
4. Document model-specific support and truthful readiness limits; bump to 0.9.0. Rebuild committed assets, run typecheck, full tests after build and package checks. Obtain a fresh independent review, fix material findings, commit and push main without tags/releases.

## Decisions

- No paid preflight: a successful account/catalog check does not prove background inference will succeed. The UI states that the background connection is verified when Enhance runs.
- Highest means the highest advertised value in the known ordered vocabulary (minimal, low, medium, high, xhigh, max). Unknown vocabulary requires an explicit selection, rather than guessing the provider's ordering.
- The saved model assignment selects recommended versus custom behavior; reasoning defaults to model default for existing/custom assignments. Recommended reasoning is used only with the corresponding recommended model.
- Exact preset availability comes from the installed desktop catalog. No model IDs are fabricated and no extra SDK/runtime is installed.

## Verification ledger

- Baseline: 0.8.0, b07722f3c408628faee869140cd6a2dcbe2b914d. Worktree initially clean.
- Installed declarations confirm SessionConfig.reasoningEffort, ModelInfo.supportedReasoningEfforts/defaultReasoningEffort and model.getCurrent().reasoningEffort.
- Manual desktop visual/account checks remain with the owner; no UI automation or paid inference tests.
- Implemented all four tasks. Existing saved pairs remain intact; recommendations can be applied explicitly, and fresh installations start with them. Preview fixtures use the same resolver.
- Independent review found and verified fixes for reasoning failures being swallowed by best-effort context gathering and nested fallback account failures disappearing from composer status. No remaining blockers.
- Final verification for 0.9.0: typecheck, build, all 315 tests after rebuilding, package checks and whitespace checks passed. The installed SDK/runtime local-fixture test also passed: actual High reasoning reached the local endpoint, with isolation, cancellation, retained usage and cleanup intact. No paid inference.
- Exact recommended model availability in the owner's Copilot account and desktop visual checks remain unverified. Metadata Retry does not certify a successful background inference run.
