# Quiet Desk Implementation Plan

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

> **For agentic workers:** Execute this approved design in the current isolated worktree. Use the verification-before-completion skill before publishing.

**Goal:** Add the approved still Quiet Desk banner and a persistent single-button theme toggle.

**Architecture:** Keep state decisions in a panel appearance module, render the illustration in a focused React component, and replace the transport-owned theme listener with one appearance controller. Existing durable panel storage owns the preference.

**Tech Stack:** Existing React, TypeScript, CSS, Lucide, Node test runner; no new dependencies.

**Spec:** [Quiet Desk design](../specs/2026-11-14-quiet-desk-design.md)

## Constraints and review focus

- Flat colors, no motion, all text translated, no browser/desktop automation.
- Unknown saved theme values follow the system; explicit choices survive remounts and system changes.
- A changed draft or a run from another project must not display a stale success or failure state.
- Clock changes are sampled on open/focus/visibility, not animated or continuously polled.
- Theme must cover notices/dialogs as well as the banner, without competing listeners.
- Preserve version/release notes in the footer and the installed native tab's manifest icon.

## Steps

- [x] Write failing appearance tests for time boundaries, current-draft run states, stale results, and persisted theme behavior.
- [x] Implement `src/panel/appearance.ts`, capture the run's input in `beginRun`, and pass the focused tests.
- [x] Add the React desk/banner and a disposable theme controller; integrate header, language picker, and footer. Add English/Vietnamese/Chinese copy and controller/render checks.
- [x] Update version to 0.1.6, all changelogs, README, and built assets. Run typecheck, full tests, build, check, and whitespace validation.
- [x] Review the complete change and resolve findings with regression tests.

Publication: commit this verified tree, fast-forward main, push, verify remote HEAD, and update only this cached plugin installation using the official CLI. Report the resulting commit and installed version in the completion message.

## Progress

Implemented the approved design with both requested refinements. The reviewer found that reusing a successful history entry after a failed run could retain the failure state; a related delete-all case retained terminal run identity. Both are fixed, with regression tests that preserve active runs.

Validation: all 263 tests pass; root and web typechecks, build, package checks, and whitespace validation pass. The installed runtime smoke test opens a disposable canvas, verifies that a theme choice survives a new canvas URL, enhances through a local model fixture, sends to its disposable session, and verifies the packaged prompt hook. It calls no external model. Rendering tests cover all 18 still scenes and all three UI languages with one theme button.

One full-suite run encountered Windows `EPERM` while atomically replacing a temporary hook-test settings file, before its hook assertion. The unchanged hook test passed three isolated reruns and the full suite then passed. The cause was not established; no speculative storage changes were made.

No browser or desktop automation was used. Installed visual verification remains with the owner after the update and restart.
