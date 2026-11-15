# Effort controls implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the current worktree.

**Goal:** Replace composer model selection with three configurable effort tiers and require explicit enhancement buttons.

**Architecture:** A small shared effort module defines the tiers, setting keys and model assignment encoding. The worker resolves assignments from settings; the panel sends the tier. Existing model catalogs populate Settings. Production storage initializes assignments using its cross-process transaction.

**Tech stack:** TypeScript, React, existing Node test runner and build scripts.

**Spec:** [Effort controls design](../specs/2026-11-14-effort-controls-design.md)

## Constraints and review focus

- Preserve credentials, history, drafts, model profiles, Unicode, privacy and sending safeguards.
- No speculative model defaults or reasoning parameters; all three begin with the current model.
- Check saved model overrides, concurrent initialization, deleted/disabled assignments, stale catalogs and stale request overrides.
- Check ordinary input editing and explicit enhance-and-send behavior separately.
- No UI automation or paid model calls. Commit verified generated artifacts and push main without force.

## Implementation

- [x] Add regression tests for one-time assignment migration, per-tier routing, invalid assignments, and composer structure/shortcut removal. Run them and confirm the missing behavior fails.
- [x] Add `src/effort.ts`; update defaults, service migration, protocol and worker resolution. Keep legacy direct profile/model requests compatible when no effort is supplied. Add actionable structured errors.
- [x] Update panel state/actions/view and transport persistence keys. Reuse the model menu in Settings, retain unavailable selections visibly, and show the active assignment in the composer. Remove request-box key handlers and the unused combined shortcut action; retain result-editor send.
- [x] Update affected tests, preview fixtures, README and current docs. Bump to 0.4.0 and add an English changelog entry.
- [x] Run typecheck, build, final full tests, package check and local-runtime fixture. Obtain an independent code review; resolve findings and repeat affected checks.
- [x] Commit verified work, fast-forward main, push without force, verify the remote hash and report manual UI/model-quality checks still pending.

## Verification record

Typecheck and build passed; the final post-build suite passed 330/330 tests. Package checks and the installed-runtime local-model fixture passed. Independent review findings were fixed and covered by regressions. Desktop visual verification and paid-model quality evaluation remain manual.
