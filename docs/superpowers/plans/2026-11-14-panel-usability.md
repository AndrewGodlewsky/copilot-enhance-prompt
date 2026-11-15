# Panel usability implementation plan

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

> **For agentic workers:** Use superpowers:executing-plans to implement this approved plan in the existing worktree.

**Goal:** Make Enhance Prompt easier to read and operate without changing its features or safety boundaries.

**Architecture:** Improve shared React primitives first, then the composer, result, navigation and secondary screens. Keep orchestration and Copilot integration unchanged.

**Tech stack:** React, Tailwind, Radix, TypeScript; Brave for browser verification.

**Spec:** The owner approved the direction below on November 14, 2026.

## Approved direction

- Product: a workspace for developers to turn rough requests into prompts they can review.
- Character: focused, precise, approachable.
- World: an editor's workbench—text, margins, useful controls.
- Moments: original request and editable enhanced prompt carry emphasis.
- Signature: labeled “Write a request” and “Review and send” stages with small shortcut keycaps.

Keep the existing flat colors, system typography, icon, features and section order. Add visible navigation/action labels, 14px interface text, supporting text of at least 12px, 32–36px controls, a 4px spacing grid, model/style/context summaries, clear selection and focus, visible scrollbars and explanations for unavailable actions. Preserve existing keyboard shortcuts and opt-in sending.

Audit method: [Unslop by Damir Sokolovsky (@heydamir)](https://heydamir.design/unslop), CC BY 4.0.

## Global constraints

- All new UI strings use `t()` with Vietnamese and Chinese translations.
- No new dependencies, model calls, host capabilities or sending behavior.
- Preserve privacy checks, disabled unsupported settings and the user's brand assets.
- Build and commit the generated plugin; push verified work to main without force-pushing.

## Review focus

- 320px panels and longer translated labels must remain usable without horizontal page overflow.
- Keyboard users must see focus and operate segmented controls with arrow keys.
- Optional enhance-and-send must stay clearly distinct from review-first enhancement.
- Missing/busy sessions must explain why sending is unavailable; backend checks remain authoritative.
- Light and dark themes must retain readable text and distinguish selection from focus.

## Task 1: Apply and verify the approved UI

Files: `web/src/index.css`, `web/src/common.tsx`, `web/src/main.tsx`, `web/src/enhance.tsx`, `web/src/sections.tsx`, `web/src/whats-new.tsx`, shared UI primitives, `src/i18n-dict.ts`.

Interfaces: consume existing panel atoms/actions and preserve their contracts. No new backend interface.

- [x] Restore rem sizing, shared spacing, control targets, focus, scrollbars and restrained transitions.
- [x] Label navigation and primary actions; expose model/options summary and write/review stages.
- [x] Improve secondary screen headings, actions and selection; add translations.
- [x] Check real React preview in Brave at 320/390/720px, all languages, light/dark, keyboard and opt-in sending states. Maximum three visual review rounds including baseline.
- [x] Run typechecks and existing tests; do not add implementation-mirroring tests for visual changes.

## Task 2: Package and publish

Files: `plugin.json`, `src/version.ts`, three changelogs, `README.md`, generated extension/web artifacts.

- [x] Record version 0.1.2 and explain updated controls in README.
- [x] Run `npm run build`, `npm test`, `npm run check`, installed-runtime disposable-fixture E2E.
- [x] Review the diff with a fresh reviewer and resolve material issues.
Publication: commit, fast-forward main and push; verify the remote SHA before reporting completion.

## Verification record

Baseline: labels measured 9.75px, icon targets 22.75px; scrollbars hidden globally. Brave screenshots saved in ignored `.artifacts/unslop/`. Desktop UI automation is unavailable in this environment, so browser appearance and installed-runtime behavior are checked separately.


Task 1: complete. `npm test`: 254/254 passed. Final Brave visual pass: 14 states at 320/390/720px across English, Vietnamese and Chinese, light/dark; no horizontal page overflow, text below 12px or page errors. Interaction checks passed for Enter/Shift+Enter, editing, copy/send, context exclusion, refinement, segmented arrow keys and 2px keyboard focus, consent-dialog cancellation and active-run cancellation. Preview interactions use mock data; real clipboard delivery and desktop screen-reader behavior were not assessed.

Task 2: package verified. `npm run build` and `npm run check` passed. Installed-runtime E2E passed using a disposable session and local HTTP fixture, including canvas registration, context, manual enhancement, sending and hook bypass. Independent read-only review found no material issues. No backend orchestration changes or dependencies were introduced.
