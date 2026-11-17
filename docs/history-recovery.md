# Recovering a deleted prompt

After deleting one prompt, use **Undo** in the notice or open **History → Recently deleted**. The recovery window lasts one minute from the successful deletion. Hovering a notice or leaving the app in the background does not extend it. The button changes to **Undo expired** when that deadline passes; the backend also checks the deadline before restoring anything.

Up to ten deleted prompts can wait for recovery. When all ten slots are occupied, another individual deletion is refused until you restore one or a window expires. This keeps earlier recovery promises intact. **Clear history** is a separate, confirmed action that ends recovery. Restarting the plugin's backend also ends recovery; this is temporary Undo, not a durable trash folder.

Recovery requires history saving to be enabled and room within your history limit. A failed write does not consume a still-valid recovery record, so you can retry. Simultaneous restore requests restore an entry only once. The recovery list uses native keyboard-operable disclosure and button elements. Manual keyboard/screen-reader and hidden-desktop checks remain part of the v1 acceptance matrix.

## Implementation and privacy

The deleting worker owns the original record in memory. `history.removed` returns only its ID, a 120-character title and absolute expiry; `history.restore` accepts only an ID and never replacement prompt data. A separate worker cannot restore another worker's record. Deletion, restore, enumeration and clearing use the existing history transaction queue. Restore rechecks expiry, saving preference and history capacity inside that queue; it consumes the record only after a successful write.

No deleted content or recovery records are written to disk, uploaded or logged. Clear stores one random generation marker beside history so other workers cannot resurrect previously cleared content, even after new prompts arrive. Production storage changes that marker and clears history in one atomic patch. Adapters without patch support invalidate first and fail closed if clearing fails. Existing saved history, drafts and settings keep their established persistence and retention rules.

Recovery UI uses the same machine clock as the worker, checks deadlines on timers and focus/visibility changes, and rechecks at click time. Buttons also observe recovery metadata so Clear or a successful restore invalidates old notices. Metadata refreshes coalesce across the section and toast buttons; a request during refresh schedules one trailing refresh. Clock changes can alter a wall-clock window; recovery never promises persistence across worker restarts or independent installations. Metadata refresh failures clear the local list and offer Retry recovery.
