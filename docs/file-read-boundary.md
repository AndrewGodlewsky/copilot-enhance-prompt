# Project and panel asset reads

Starting in 0.12.10, project text and panel assets use the same bounded, verified file-handle reader. Ordinary files and aliases that resolve inside the selected root remain supported. Files that change during a read are omitted; save the file and refresh context to try again.

The reader resolves the root and candidate, checks confinement and policy, records BigInt filesystem identity, opens a regular single-link file, and compares the held handle with fresh path and root checks before and after reading. The read allocates at most the checked file size plus one byte, detecting growth without unbounded `readFile` allocation. It closes the handle on success, refusal and policy failure. `O_NOFOLLOW` and `O_NONBLOCK` apply where the platform supports them; those flags alone do not confine parent directories.

Project reads retain their caller's byte limit (normally 200,000), sensitive-name and binary filtering, exclusions and repeated privacy checks. Policy revocation propagates instead of being hidden as an unreadable file. Unicode, source content and subsequent masking-before-trimming are unchanged. Hard-linked files are refused: their other names can be outside the project or carry sensitive filenames that this path cannot discover. No user files or saved data are modified.

Static assets are limited to 8 MiB per file and the existing HTML, JavaScript, CSS, PNG, SVG and WOFF2 MIME allowlist. Bytes are fully verified before sending a success header. A missing, replaced, oversized or disallowed file returns a generic 404 without a filesystem path. Authentication, Host/Origin checks, CSP and `nosniff` remain in place.

## Evidence and limits

Owned temporary Windows fixtures reproduced an outside-file disclosure by replacing a project parent folder with a junction between validation and opening. That regression now returns no text. Shared-reader tests cover substitution before opening and after holding a handle, growth, file replacement, access revocation, inside aliases, outside junctions, hard links, bounds and Unicode. Windows can itself reject a parent-directory rename while a child is open; tests accept only that verified OS refusal or a confined/refused result. HTTP tests verify static refusal, MIME and CSP. No owner files, privilege changes, browser automation or paid models are involved.

This is defense in depth, not an OS sandbox or an integrity signature. A malicious process running as the same OS user can edit project/package contents, race paths between individual checks, or restore a path after substitution. Holding a verified handle prevents a later pathname change from redirecting that read, but cannot guarantee a coherent snapshot against arbitrary in-place writes. Detected size, time or identity changes are refused; undetectable same-user manipulation remains outside the guarantee. Linux flags are used when available but these fixtures were run on Windows only. Per-user isolation requires an operating-system boundary.

See the historical [security audit](audits/v1/security-boundaries.md) for the original hypothesis, and [backlog evidence](audits/v1/backlog-progress.md) for subsequent fixes.
