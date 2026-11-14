# Quiet Desk banner

Approved direction: concept B from [the prototypes](../../prototypes/banner-concepts.md), with the owner's requested changes: replace the top logo/version row with “GitHub Copilot,” and use one icon button to toggle light/dark mode.

The banner keeps the Enhance Prompt title, a short tagline, and a visible workflow status on the left; the flat desk illustration sits on the right. No animation or gradients. Morning (05:00–11:59), afternoon (12:00–17:59), and night (18:00–04:59) change the window and lamp. Sample local time on open, focus, and return to a visible panel. Draft, running, ready, failed, and cancelled states change the paper, without pretending to measure progress or quality. Empty drafts show a blank sheet. A stale result must not mark a different draft ready.

The single top-right toggle has a descriptive tooltip and accessible label naming the next theme. Initially follow the system; after a click, persist the explicit light/dark preference in existing plugin storage. It affects this panel, including dialogs and notices, not the desktop chrome. It remains independent of the scene's local time.

Implementation choice: move the version/release-notes button to a quiet footer; preserve its existing dialog and update behavior. Place the language picker beside the navigation. On narrow panels the illustration sits below the title; controls and translated text can wrap. All new UI copy is translated into Vietnamese and Chinese.

Prompt Press was considered for its direct workflow metaphor. Quiet Desk was selected for its calm writing-room identity and changes with local time. No extra project reads, analytics, or prompt interpretation are needed. Existing enhancement, privacy, sending, and native-tab-logo behavior stay intact.

Verification: state/time boundaries, stale results and cross-project runs, durable theme selection, system changes, rendering of all scenes, translation coverage, full existing tests, build and package checks. No browser or desktop automation; the owner performs the installed visual check.
