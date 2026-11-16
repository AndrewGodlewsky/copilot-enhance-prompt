# History library implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The owner has approved implementation and pushing verified work to main.

**Goal:** Implement the approved compact project library, without the folder/project heading in its reading pane.

**Architecture:** Keep existing history storage and worker actions. Put filtering, project labels and bounded pagination in panel helpers/state; render the library in a dedicated React History component. Preserve selection and native scrolling through React reconciliation.

**Tech stack:** Existing TypeScript, React, Tailwind/CSS, house controls and Node test runner; no new dependencies.

**Spec:** [Approved History design](../../design/history/README.md).

## Constraints

- Keep exact saved project identities, individual duplicate prompts, user text, unknown-project entries and existing legacy current-project filtering.
- Search original and enhanced text; sort newest/oldest; show 12 entries per page. Reset pagination when a filter/order changes and clamp after deletion.
- Reuse, Copy, Delete/Undo, filtered export and clear-history confirmation keep their existing behavior. Reading never modifies the composer or sends anything.
- Keep English labels, shared themes, the banner, green icon, privacy and sending safeguards. Do not control desktop/browser UIs.
- Version 0.8.0; build committed assets, verify, commit and push main without a tag or release.

## Review focus

- Identically named folders and worktrees must not merge; show distinguishing parent paths.
- Unknown/removed projects and legacy stored scope must resolve predictably without losing entries.
- Last-page deletion and changed searches must not leave a blank page or unrelated selected prompt.
- Long/Unicode/HTML-like content remains safe and readable, including matches only inside enhanced text.
- Narrow canvases need a project selector and stacked reader; no large folder artwork or redundant project heading above the title.

## Tasks

- [x] Add failing helper/state tests in `src/history-library.test.ts` for project identity/labels, search, sort, pagination, selection and unchanged composer data. Adapt existing history tests to 12-entry pages and all-project navigation.
- [x] Implement pure decisions in `src/panel/history.ts` and update `src/panel/state.ts`; retain `filteredHistory` for existing export. Use existing `historyScope` persistence for encoded project selections and support legacy `all`/`project` values.
- [x] Add an SSR regression test in `scripts/history.test.mjs` for the approved reading pane, both text views, empty/search states, safe content rendering and available actions.
- [x] Implement `web/src/history.tsx` and scoped responsive `web/src/history.css`; remove the old section and load History independently. Reuse existing controls/actions. Keep fixed-size icons only in project navigation and buttons.
- [x] Update documentation, version and changelog; rebuild and run typecheck, full tests after build, and package checks. Have a fresh reviewer inspect the complete change while verification runs.
- [x] Address review findings and verify the final release artifacts.

Publication: commit verified work, fast-forward main and push; report version, commit and remaining manual visual checks. Git history records the published commit.

## Execution record

- Existing isolated worktree is clean at `628a391`; dependencies are already installed. No storage schema migration is needed. The current-project scope remains readable for existing installations.
- Ruling: import the new History section directly from `main.tsx` rather than re-exporting it from `sections.tsx`. This keeps its stylesheet lazy and isolates unrelated section tests; behavior is unchanged.
- Preserve the legacy all-project fallback when a current-project preference meets only unassigned old entries. Invalid saved scope values also fall back to all projects.
- Review finding resolved: bound list excerpts to 240 characters before highlighting so screen readers do not announce an entire saved prompt for each row. The title is bounded at 160 characters; full content is retained in the reader and actions.
- Final verification for 0.8.0: typecheck, build, 299 tests after rebuilding, package checks and whitespace checks passed. Fresh review found no remaining blockers. Desktop/browser visual checks remain for the owner; no UI automation or paid model calls were used.
