# Release history and upgrade notes

Click the footer version to read **Release history** at any time. Notes come from the English changelog bundled with the running panel. This does not fetch releases, install code or make a model call; checking for available updates is a separate feature.

**What's new** can open automatically after an upgrade. Starting in 0.12.25, the worker stores the highest recorded running version in the plugin's shared local data as `releaseHistory.seenVersion`. Canvas ports, browser origins, session changes and worker restarts do not reset this marker. Concurrent canvases share a transaction: only one claims the notice for a new version. Older code cannot rewind the marker. Semantic prerelease ordering is respected; build metadata alone does not count as an upgrade.

The first opening with no valid durable marker records a quiet baseline. This includes the first upgrade to this feature: the old origin-scoped browser marker cannot reliably identify earlier openings on other ports and is not imported. Use the footer to read that version's notes. Later higher versions can open their notes once. Installations intentionally sharing the same data directory also share this marker.

This is a once-per-version **attempt** to display notes, not proof that someone read them. If a canvas closes or loses its response after a successful claim, the footer still provides the notes. Storage failures do not advance the marker and are recorded in Show Logs; opening another canvas can retry. Missing notes have a visible Retry action. React's development effect replay reuses its initial request rather than consuming a notice in a discarded effect.

Only a version string is stored. No drafts, history, credentials or project information are migrated, erased or sent. The worker records its own running version, not a client-supplied target. Manual footer history remains available when automatic marking fails or an older runtime lacks the operation. Actual desktop reopen and focus behavior remain owner acceptance checks.

## Clear and Copy

**Clear** below Write a request empties that request, its attachments and the **Review and send** result. Saved History and Context Level, Style and Effort choices remain available. Original attachment files are not deleted.

In History, **Copy enhanced prompt** always copies the saved enhanced text, even when **Original request** is selected for reading. **Reuse** opens both texts in Enhance without sending them.
