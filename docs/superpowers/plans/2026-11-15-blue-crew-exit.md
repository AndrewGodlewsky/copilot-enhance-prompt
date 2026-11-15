# Blue crew and 95% exit implementation plan

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

> Execute inline with superpowers:executing-plans. The owner approved the preview and requested implementation; no further design approval is needed.

**Goal:** Ship the approved 2.2px blue figures and lower/release/exit at 95%, with the sweep gated on a successful result.

**Architecture:** Keep geometry and model progress unchanged. The React hook observes the same percentage as the progress bar. The SVG controller freezes its current scene when retirement starts; a separate result-ready timestamp permits the final sweep only after the crew has left. CSS supplies the theme-specific blue.

**Tech stack:** Existing TypeScript, React, SVG, CSS and Node test runner. No dependencies.

**Spec:** [Approved preview and behavior](../../design/word-crew/README.md), plus the owner's latest confirmation: words must be placed down before figures leave.

## Constraints and review focus

- Use #426CC2 in dark mode, #244A9B in light mode, and 2.2px strokes. Preserve body geometry and text colors.
- Begin retirement once displayed progress reaches or passes 95%; success before that must also retire the crew. Never fabricate model progress.
- Lower in place for 0.24s, release for 0.10s, exit for 0.60s. No exit movement until lowering and release finish. Freeze deposited words until success, then sweep for 0.65s.
- Paused artwork must still retire and finish; hide the pause control during retirement. A subsequent percentage decrease must not restart the crew.
- Failure, cancellation, reduced motion, resize, visibility loss, changed draft/project and disposal must retain their safe cleanup behavior. Preserve input and sending safeguards.

## Task 1: Integrate and verify the approved crew

**Files:** `src/panel/word-crew.ts`, `src/panel/word-crew.test.ts`, `web/src/word-crew.ts`, `web/src/use-word-crew.ts`, `web/src/enhance.tsx`, `web/src/index.css`, `scripts/word-crew.test.mjs`, `scripts/word-crew-lifecycle.test.mjs`, README, design notes, version files, changelog and generated package.

**Interfaces:** Add `readyAfter: number | null = 0` to `finishFrame(seconds, height, readyAfter)`, where null waits indefinitely and a number is the result-ready time relative to retirement. Add idempotent `retire()` to the SVG controller; `finish()` also retires and records success. Pass the displayed running percentage to `useWordCrew` and expose `retiring` for the pause control.

- [x] Add tests that fail before integration: retirement lowers then releases before exit; it holds all text without sweeping or completing while the model is pending; an early success waits for retirement; repeated retirement/finish calls do not reset timing.
- [x] Extend the hook harness for the 94%/95% threshold, percentage regression, new runs, pause, success, and failure/cancellation after retirement. Run `node --test src/panel/word-crew.test.ts scripts/word-crew.test.mjs scripts/word-crew-lifecycle.test.mjs`; confirm the new cases fail for missing behavior.
- [x] Implement the interfaces above, reuse existing finish poses, and apply blue CSS tokens and 2.2px strokes. Run the focused tests and root/web typechecks; expect success.
- [x] Update current documentation, version to 0.5.2 and English changelog. Build with `npm run build`, then run `npm test -- --test-concurrency=1` and `npm run check`; expect all passing. Serial test execution avoids the Windows temporary-file rename contention observed in earlier parallel runs.
- [x] Review the final change and generated artifacts. Independent review found no issues and independently reran the seven focused tests successfully.

**Verification:** Root and web typechecks, build, all 337 tests after the build, and package checks passed. Packaged web copies, theme colors and extension/hook versions match. No desktop/browser UI or paid model calls were used; native appearance remains a manual owner check.

**Integration:** Commit verified work and fast-forward/push main. No force push, tag or release. Report exact version/commit and the remaining manual check.
