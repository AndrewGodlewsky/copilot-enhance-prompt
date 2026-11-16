# History inline details implementation plan

> **For agentic workers:** Use superpowers:executing-plans. The owner requested this layout change and authorizes verified work to be pushed to main.

**Goal:** Widen and collapse the project navigation, and expand prompt details within the list instead of a separate reading pane.

**Architecture:** Keep history storage, filtering and existing actions. Use the current selected-entry state for a single open accordion row, allowing no selection. Keep the existing reader inside that row. A canvas-local Projects toggle hides the wider sidebar without changing the filter; narrow canvases retain the project dropdown.

**Tech stack:** Existing React, TypeScript, scoped CSS and Node tests; no dependencies.

**Spec:** The owner's screenshot and request: readable project names, collapsible red-box sidebar, click a prompt to show the information currently on the right beneath that prompt. Rows start closed. Project names wrap, and the full path stays available. Search, ordering, pagination, both saved texts, Reuse/Copy/Delete/Undo and export keep their existing behavior.

## Approach and constraints

Use inline accordion rows, as requested, rather than retaining the separate reader. One open row keeps long histories compact. Make the desktop sidebar at least 230px wide instead of 150px. The collapse control stays available above the list, with an accessible expanded state. The active project remains visible when its sidebar is hidden. No animations, data migration, desktop/browser control or model traffic.

## Review focus

- A collapsed or deleted row must not automatically open a different prompt.
- Filtering and paging must not show details for an entry outside the visible page.
- Long project names and duplicate folder names remain readable and distinct.
- Keyboard controls expose expansion; actions are outside the row's button.
- Saved Unicode and HTML-like text remain literal; reading cannot modify or send a draft.

## Tasks

- [x] Update pagination/selection tests and SSR rendering tests to require closed rows and inline disclosure, then observe failures.
- [x] Update `src/panel/history.ts`, `src/panel/state.ts`, `web/src/history.tsx` and `web/src/history.css` using existing state and reader/action components.
- [x] Update current README/user guide and the design amendment, bump to 0.10.4, and add an English changelog entry.
- [x] Run focused tests, typecheck, build, final full tests and package checks. Obtain a fresh code review before integration.

Publication: commit verified work, fast-forward main, push without force, and verify the remote commit. Report remaining manual visual checks.

## Verification record

- Observed three expected failures against the old separate-reader and automatic-selection behavior; all 21 focused history/action tests passed after the change.
- Typecheck, build, 325 post-build tests, package checks and whitespace checks passed. No new dependencies or storage schema changes.
- Fresh review found no blockers or concrete regressions in selection, filtering, deletion, accessibility or responsive rules.
- Remaining manual check: wide/narrow Copilot canvas, long project names, sidebar hide/show, row open/close and keyboard focus in both themes. No desktop/browser UI was controlled.
