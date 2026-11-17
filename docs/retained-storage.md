# Inspect and clear inactive drafts

Open **Settings → Retained storage → Inspect stored data**. This is an explicit local inspection, not a startup scan. It makes no model call or external network request and returns counts, sizes, storage IDs and locations—not saved prompt contents. It remains available when a draft save has failed; its numbers describe disk contents, not unsaved text in the panel.

The report separates the current session, other active workers, known inactive sessions, unverified sessions, shared preferences/rules/models/history, temporary upload copies, usage receipts, recovery metadata, and other plugin files. History's JSON size is a subset of the shared files. Sizes are file bytes, not allocated disk space. Uploads use a shared temporary directory; raw retained helper journals elsewhere in temporary storage are not included in recovery metadata. Other files include activity records and orphaned temporary saves; they are preserved. No overall total is claimed across these scopes.

## Cleanup scope

An inspection can propose up to **100** inactive session files, identified by storage ID, last-saved time and file size. It estimates the bytes removed. Expand the preview before deciding. Check the restart confirmation and click **Clear … inactive drafts** to remove only these private fields:

- Request and result text (`draft`, `result`).
- Last-run details and displayed context (`lastRun`, `contextShown`, `contextNotes`).
- Attachment references, parked drafts and project/workspace association (`files`, `parked`, `workspaceKey`).

Control preferences in those same files stay intact. Current/active sessions, shared history/models/rules/preferences, upload files, usage receipts and recovery journals are not deleted by this action. This is separate from the existing current-session Clear and shared-data controls. Cleanup does not expire drafts automatically and does not change the pre-existing temporary-attachment retention policy. It cannot be undone.

Restart Copilot after updating and close older Copilot instances before confirming. Versions before 0.12.19 do not register their workers. Older unregistered session files remain **unverified** and cannot be selected automatically. Keep these files for maintainer-assisted recovery; do not infer inactivity from age.

## How active work is protected

Before accessing saved state, a new backend records its PID in `data/session-activity/<session-hash>.json`, under the same shared transaction used by cleanup. Session hashes identify files; they are not encryption. A confirmed live PID means active; a confirmed missing process means inactive; inaccessible, corrupt or missing ownership stays protected. PID reuse can conservatively keep an old draft active. There is no heartbeat timeout. Registration failures preserve the record and refuse that adapter's storage access rather than creating an untracked writer.

The preview's token is bound to its authenticated canvas, lasts five minutes and is consumed once. The backend chooses the data directory and targets; the client cannot submit arbitrary paths. Plans contain hashes and metadata only. Immediately before each change, the backend rechecks process activity and the exact saved-content hash under the shared and session transactions. New activity, changed content, corrupt files and links are skipped. Per-file replacements use the existing atomic storage mechanism.

Cancellation, canvas closure or a write failure stops further cleanup. Some earlier files may already have been cleared; inspect again to reconcile. No speculative deletion or automatic retry follows an interruption. The panel flushes current draft saves before cleanup and asks users to finish active work. These operations are absent from agent/model tools and use the authenticated human HTTP boundary.

This protects cooperating plugin workers and refuses detected file links/replacements. It is not an OS sandbox against a malicious process using the same account, nor proof that an old unregistered worker was closed. Cross-file cleanup is not a single crash-atomic transaction. Save or privately back up important text first.

## Bounds and evidence

Each inspection stops after 15 seconds between I/O operations or 50,000 examined entries, with directory depth limited to four. Individual filesystem calls can outlast that budget. Small ownership checks run at most 16 at a time; private JSON reads stay serial and bounded to 32 MiB each. Once 100 eligible drafts are selected, remaining sessions need only ownership/size checks. Cleanup still rereads and validates every selected file. Oversized or corrupt candidates remain protected.

**Incomplete** counts are lower bounds, not zero or a complete total. A later inspection starts again; exceptionally large stores can keep producing partial results and may require a maintainer-assisted offline review. The UI never represents that as a complete sweep. A preview is a bounded cleanup opportunity, not an instruction to delete every inactive session.

`node --expose-gc scripts/audit/retained-data.mjs` creates disposable fixtures at 100, 1,000, 10,000 and 30,000 sessions plus the same number of usage records. It verifies every session value and accounting record after cleanup, including Unicode and preserved preferences. [Initial measurements](audits/v1/retained-data-baseline.json) and [bounded-concurrency measurements](audits/v1/retained-data-measurements.json) record source hashes and endpoint memory samples. At 1,000 records inspection changed from 2,138 ms to 1,000 ms; at 10,000 it completed in 11,770 ms rather than reaching the 15-second limit. The 30,000-record inspection still reached that limit and explicitly returned partial counts; all 30,000 sessions and usage records were verified after its 100-session cleanup. These are single local samples, not latency or peak-memory guarantees.

Regression coverage includes a real separate process reopening a previewed session, failed atomic replacement, cancellation/closure, changed/expired/wrong-canvas previews, missing/corrupt/linked data, limited private reads, save failures, and the authenticated HTTP/agent boundary. No paid inference, owner installation or desktop UI is used. Desktop appearance, restart confirmation and keyboard/screen-reader behavior remain owner-run acceptance checks.
