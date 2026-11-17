# Remaining v1 work

The owner authorized working through every available issue individually and publishing a GitHub release for each delivered version. Releases remain previews until the owner/account/accessibility gates are verified. This supersedes the earlier no-tags/no-releases restriction for this backlog only.

For each issue: reproduce or establish baseline, implement the smallest complete fix, add meaningful regression/measurement coverage, update English notes and version, rebuild, run the full suite/typecheck/package checks, inspect the diff, push main, publish the matching preview tag/release, and attach evidence to the issue. Never close an unverified manual or product gate.

Current baseline: 0.12.1 / 4104c29. Tracking issue: [#40](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/40).

## Queue

Security and correctness: #5, #6, #7, #16, #17, #18, #36, #37, #39.

Distribution/maintenance: #9, #10, #11, #33.

Efficiency: #12, #13, #14, #15, #19, #20, #21, #32, #34.

Usability: #24, #25, #26, #27.

Evidence/owner decisions: #23, #29, #30, #31, #35. Prepare the evidence and concrete choices; do independent work while an answer is pending. Never consume the owner's Copilot credits or control desktop/browser UI.

## Current work

- Next: #5, attachment confinement and upload ownership.

## Delivered versions

### 0.12.2 — #2, in-flight privacy

Context permissions/exclusions are rechecked at file, Git, selection, research, preview and rewrite boundaries, including background helper startup and fallback attempts. Policy errors propagate instead of becoming ordinary unreadable-file results. The original/enhanced prompt preference still stays fixed for a run. Whole-settings reads now use one atomic snapshot rather than one read per key.

Verified: typecheck, build, 394 final tests, package checks and clean diff. New regressions first reproduced stale preview/selection/fallback payloads and model sends during helper preflight; all now pass. Independent review ran 81 focused tests. Installed SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3` passed the production helper's local HTTP fixture (isolation, output, reasoning, images, cancellation, accounting and cleanup), with no paid inference. Node 24.22.1, Windows x64.

Limits: already-sent content cannot be recalled. No desktop UI control or owner account tests. The file-symlink fixture needs Windows privilege; junction confinement tests run normally. Issue #2 records the exact pushed commit and preview release link.
