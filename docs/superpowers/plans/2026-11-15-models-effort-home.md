# Models effort configuration implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. One fresh review follows implementation and verification.

**Goal:** Make Models the home for effort configuration and make connection checks visibly complete.

**Architecture:** Reuse effort preferences and the verified Copilot catalog. Add a direct catalog assignment alongside legacy profile assignments; do not migrate or replace existing choices. Share a connection status component between Enhance and Models. Retain optional profiles, fallback ordering, testing and context selection under Advanced options.

**Tech stack:** TypeScript, React, existing panel state and Node test runner; no new dependencies.

**Spec:** Owner approved moving effort configuration to Models with direct catalog choices. Owner confirmed Retry has no obvious feedback; no failed rewrite was reported.

## Constraints and review focus

- Preserve saved assignments, including unavailable external references; never silently convert them.
- Require a verified catalog for direct choices and reject unsupported reasoning before inference.
- A metadata check must not submit a prompt, erase an actual rewrite failure or imply successful background inference.
- Late responses and closed canvases must not update the connection check status.
- Keep sending consent, privacy, usage accounting, artwork and request locking unchanged. No desktop/browser control or paid tests.

## Tasks

- [x] Add regression coverage for profile-free selection, missing catalog/models, preserved legacy choices and model-specific reasoning. Extend effort resolution, preference validation and worker catalog checks.
- [x] Move effort controls to Models, provide direct unique catalog options, retain profiles under Advanced options, and route the Enhance shortcut there. Check section ownership through server rendering.
- [x] Record safe check attempts/results and show persistent completion feedback with accurate action labels. Test errors, repeated successes, late responses, close and diagnostic privacy. Explain the empty request's disabled Enhance button.
- [x] Update current docs and version to 0.10.0. Rebuild, typecheck, run full tests after build and package checks. Review, commit and push main without tags or releases.

## Ledger

- Baseline: clean worktree at 4a0648d (0.9.0). Retry calls models.catalog only and can complete before the loading state is noticeable; successful results repeat identical copy. The owner confirmed this is the observed issue. The screenshot's disabled Enhance is consistent with the empty draft guard.

- Direct catalog choices require current account/catalog validation. Legacy profile assignments and reasoning remain intact; no automatic conversion or migration was added.
- Owner confirmed the reported Retry issue was missing visible feedback. Checks now retain attempt/time/result, with accurate action labels and safe copied diagnostics. They make no inference request and cannot erase a background failure.
- Independent review found hidden description-only rows and discovery restarting after close during delayed startup/preset saves. Regression tests reproduced both; fixes use visible paragraph children and canvas lifecycle guards. Reviewer verified the fixes and reported no outstanding actionable findings.
- Final verification: typecheck, rebuilt extension/web assets, all 320 tests after rebuilding, package checks and whitespace checks passed. No desktop/browser control or paid inference. Manual desktop appearance and interaction checks remain with the owner.
- Delivery: commit verified changes and fast-forward main; no tag or release. The existing worktree remains available for this ongoing project.
