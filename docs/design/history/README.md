# History design proposals

Open [the interactive comparison](history-prototypes.html) in a browser. It is a self-contained file: no server, dependencies, network requests, or access to plugin data. Choose A or B at the top. Search, project navigation, ordering, prompt previews, light/dark mode, a narrow layout, and sample Reuse/Copy/Delete actions work. Reset restores the illustrative history.

**Status: awaiting the owner's design selection.** These are standalone prototypes; the plugin is unchanged at version 0.7.0.

## Two approaches

**A — Project library (recommended).** A project rail, compact prompt list, and reading pane make it possible to browse and read without repeatedly expanding tall cards. Actions belong to the selected prompt. At narrower widths the project rail becomes a selector; the reading pane sits below the list on small screens. This suits frequent switching between projects and comparing similar requests, at the cost of some horizontal space.

**B — Project groups.** Projects form collapsible sections with compact prompt rows. Reuse, Copy, and Delete remain on each row; selecting a row expands its original request or enhanced prompt in place. A project selector jumps directly to a single project's history. This gives the prompt more reading width, but expanded entries move subsequent rows down the page.

Both proposals retain individual entries, including repeated requests. Project names are shortened for scanning; full saved paths remain available in the reader and project tooltips. Projects with the same last path segment are distinguished by their parent path. Unknown projects have their own group. Selecting a project filters history; it does not change the attached Copilot session or its project.

## Design decisions

- Keep the plugin's Segoe UI/system typography and flat neutral surfaces. Dark palette: canvas `#101010`, panels `#181818`, hover/selection `#282828`, rules `#383838`, text `#f2f2f2`, secondary text `#b2b2b2`. Preserve the green Lift mark. Light mode uses the corresponding white/gray surfaces. No new animation or decorative banner.
- Left-align titles and content. Use a 14px reading size, 12px secondary metadata, and 18–22px headings. Put full paths and long model details in the reader, not every list row.
- Keep search visible and search both original and enhanced text, as today. Highlight matches and identify matches found only inside the enhanced prompt. Show exact result counts. Use pages of 12 in the demo to demonstrate bounded navigation through a longer history.
- Show the original first line as the entry title, with a short second-line excerpt to distinguish otherwise identical requests. These are excerpts, not generated titles.
- Reading a prompt never replaces the composer. Reuse deliberately opens both saved texts and the saved style in Enhance; the demo presents that handoff in a dialog. A different source project is clearly identified. Copy copies the enhanced text. Delete has Undo. Nothing is sent to Copilot by these actions.
- The surrounding Quiet Desk banner, plugin navigation and footer are out of scope. The small navigation strip is illustrative; unrelated tabs are not interactive.

## Grounding in the current implementation

`src/history.ts` stores `id`, `at`, `original`, `enhanced`, `style`, `model`, `source`, and an optional `project` string. The production project identifier is a path; old entries can lack it. The prototypes group by the exact stored project string, without inventing repository IDs or merging separate worktrees. A future implementation should follow the existing canonical project identity rules.

`src/panel/state.ts` currently searches original and enhanced text, filters only all/current project, and incrementally shows entries. `web/src/sections.tsx` draws the tall cards. `src/panel/actions.ts` keeps reading separate from Reuse, copies the enhanced text, and supplies Undo after deletion or composer replacement. Those semantics must survive a redesign.

The saved model and style are shown; context level, effort, tokens, cost, repository branch, tags, and favorites are not recorded in history, so these prototypes do not claim to display them. Both concepts can work without a history storage migration. Project navigation, shortened names, ordering, excerpts and pagination would be presentation changes. Existing history export/clear controls should be retained during implementation; the demos place them in a secondary menu.

## Review before implementation

Try switching projects, searching for `retry` (including a match inside enhanced text), opening similar requests, paging, and deleting/undoing a sample entry. Compare both themes and the narrow preview. Copy uses the browser clipboard only on an explicit click; if clipboard access is blocked, a dialog provides selectable text.

Browser/desktop UIs were not controlled, per the owner's instruction. Manual visual review remains: clipping at the actual Copilot canvas width, keyboard focus, search highlighting, reading comfort, and preference between A and B. No production build or runtime changes are part of this proposal.

Verification: 43 Node VM checks covered the sample data, both render paths, project separation, searching both texts, pagination, repeated requests, escaping/Unicode, Reuse, clipboard fallback, deletion/Undo, empty states, themes and reset. Six final navigation checks covered preserved list scroll and filter/view changes. Static HTML checks and `npm run check` passed. These checks do not substitute for browser rendering or visual approval.
