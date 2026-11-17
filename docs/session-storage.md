# Session storage and recovery

Starting in 0.12.16, saved panel state lives in `data/sessions/<session-hash>.json` under the [plugin data directory](privacy.md). The 24-character hash is derived from Copilot's session ID; it is a filename, not encryption. The draft, reviewed result, attachment references and other `panel:` values stay together for that session. `data/state.json` keeps shared history, models and rules. Preferences and attachment bytes keep their existing locations. No draft expiry or retention change is introduced.

Normal edits read and atomically replace only the current session file. Every file has its own cross-process lock. Operations that explicitly change shared and session state lock shared data before session data. Writes to separate files are coordinated, but are not a multi-file database transaction with crash-atomic rollback.

From 0.12.17, [panel restoration](state-restoration.md) batches initial reads and shares file-change snapshots. Privacy reads still access current preferences directly.

## Upgrading

Restart Copilot after updating. The first new worker holds the shared-store migration lock, copies legacy session values into independent files (at most eight writers), and replaces shared state only after every copy succeeds. Before that final replacement, the original shared values are authoritative. Other new workers wait or report a lock timeout that can be retried after migration finishes. Large installations pay a one-time migration cost; steady-state editing does not scan inactive sessions.

A failed or interrupted migration retains the shared values. The next attempt compares any completed partial copies against those originals before retrying. If an older worker changed or deleted a legacy value in the meantime, it refuses the conflict instead of resurrecting deleted text or replacing either copy; keep the directory for maintainer recovery. Unchanged partial copies can be retried automatically. A process crash can leave a lock until its stale timeout, or an unused `.tmp` file; do not delete files to force recovery. Atomic replacement follows the existing storage conventions; this is not a promise of power-loss durability on every filesystem.

Older workers cannot use the new layout. If they write old session keys after migration, a newly opened worker reports the conflict and preserves both copies. It does not guess which draft to keep. Already-open new workers can continue using their session file, which is another reason to fully restart instead of mixing versions. Unknown future layout versions are refused.

## If recovery is needed

1. Fully quit Copilot and keep a private backup of the entire plugin data directory, including `data`, `preferences` and `attachments`. Do not uninstall, clear history, or remove session files.
2. Share the error and redacted diagnostics with the maintainer. Do not attach saved-state files or recovery exports to public issues: they contain prompt text and local paths.
3. A maintainer can use `node scripts/recover-session-state.mjs <plugin-data-directory> <new-private-export.json> --copilot-closed` from this version's source checkout. This requires the repository's development dependencies and an explicit confirmation that Copilot is closed. Ordinary users do not need Node or npm to upgrade.

The export recombines shared and session values in the previous JSON layout. It refuses a conflicting older-worker value, unknown layout, linked storage file, and an existing output filename. It leaves the live data files untouched and does not upload anything. Closing Copilot is necessary: per-file locks alone cannot produce a globally consistent snapshot while sessions keep writing.

Restoring or downgrading is a separate maintainer-reviewed action. Never replace `data/state.json` alone while leaving newer session files active: a later migration could retain keys absent from the old export. Use the complete backed-up directory, or a separately prepared complete data directory, with a compatible reviewed version. Preferences, attachments and usage receipts must also be retained. The export tool does not automate restoration or remove any files.

## Evidence

The [synthetic measurements](audits/v1/session-storage-measurements.json) retain raw timings at 100, 1,000, 10,000 and 30,000 sessions, source hashes and environment details. `node scripts/audit/session-storage.mjs` uses owned disposable fixtures, verifies every migrated draft/result and compares the former shared-file access pattern with current session access. It makes no model calls. Timings are local measurements, not latency guarantees for every disk.

Regression tests cover original Unicode data, attachments, unrelated global values, simultaneous processes, interrupted shared and session replacements, waiting for outstanding writers before releasing a failed migration, cross-process notifications, conflicting old workers, and private recovery export. Desktop reopening and appearance remain manual acceptance checks.
