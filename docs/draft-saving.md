# Saving edits

From 0.12.18, the status below navigation shows **Saving**, **Saved**, or **Save failed** with **Retry save**. Saved means this canvas's queued requests were acknowledged after atomic file replacement. It is not a backup or a power-loss/fsync guarantee. With draft/history saving disabled, the status says **Draft saving is off**; other preferences still save.

The first save starts on the next microtask, without a debounce timer. While a request is active, further edits to the same storage key replace its pending value. Different fields edited together use an authenticated batch (at most 64 allowlisted keys). Large or complex groups split into ordered requests using the server's byte/complexity limits; a single field can use the existing single-key envelope to preserve its supported size/depth. Oversized individual fields still fail visibly. Settings changes remain ordering barriers. The backend chooses the session and destination files, takes the existing cross-process transaction locks, rechecks privacy, and replaces each participating file atomically. Split requests and shared/session files are not jointly crash-atomic.

Send, enhancement, model tests, context previews, data clearing and plugin updates await the queue before starting their operation. Cancelling an operation during that wait prevents the operation, while saving the draft continues. A failure stays visible until that key is saved successfully, superseded by Clear, or explicitly retried. Successful unrelated saves cannot hide it. Retry uses only the current failed values. Turning retention off removes current private fields under the same transaction used for saving and retires failed private saves; inactive sessions are not expired.

Each canvas owns its queue. Different Copilot sessions have separate files. Two canvases of the same session still share that session's saved composer, with last successful write winning; this change does not add collaborative editing or cross-canvas draft merging. Active forms do not automatically import every remote keystroke. Do not edit the same request simultaneously in two canvases if both versions need to be kept.

## Closing limitation

Wait for **Saved** before closing the canvas or app. If saving fails, use **Retry save** or copy the request and reviewed prompt before closing. Attachments already uploaded remain subject to the existing ownership/retention rules.

The installed Copilot extension SDK `1.0.106-8.unstable.r43566476370.g869eef3` declares `CanvasOptions.onClose` as fire-and-forget: return values are ignored. The plugin cannot hold Copilot's native Close button open. It requests a standard browser before-unload warning for unsaved changes and attempts to drain saves before its own close request on pagehide. The browser may discard that async work or reject keepalive bodies over its limit. Host-close callbacks can already have removed the canvas. No last-keystroke guarantee is claimed for immediate native close, process termination or a connection failure.

No browser localStorage/IndexedDB, extra private backup, automatic retry loop, model call or remote upload is added. Manual desktop acceptance of the indicator, warning (if supported), reopen and failure recovery remains in #14/#29; the native-close limitation keeps #14 open.

The disk layer makes up to six attempts to rename its already-written temporary file only for Windows EPERM/EBUSY sharing errors, waiting at most 310 ms in total between attempts while holding the transaction lock. This does not retry HTTP requests or model calls. Other errors fail immediately, and persistent sharing errors retain the previous saved file and report failure. A temporary file can remain for reviewed recovery after an unsuccessful replacement.

## Verification and measurement

`node --max-old-space-size=512 --expose-gc scripts/audit/draft-saves.mjs` uses disposable production session storage and synthetic Unicode text. It holds the first save, submits a burst, drains disk writes and reopens through a fresh service to verify the exact final text. The [raw report](audits/v1/draft-save-measurements.json) records source hashes, counts, durations and endpoint memory samples. Every coalesced burst at 100, 1,000, 10,000 and 30,000 edits writes twice. The old serial path is actually run only at 100 and 1,000; larger baseline times are not extrapolated. This is a storage/queue stress case, not normal typing cadence, network latency, peak memory or browser rendering.

Tests cover delayed acknowledgments, superseded errors, Clear, explicit Retry, privacy opt-out/re-enable, stale settings reads, separate sessions, cancellation before Send, batch authentication/limits, and best-effort pagehide ordering. No paid inference, owner installation changes or desktop/browser automation is used.
