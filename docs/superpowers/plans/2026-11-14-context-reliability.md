# Context Reliability Implementation Plan

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

> **For agentic workers:** Use superpowers:executing-plans for implementation and a fresh whole-change review at the end.

**Goal:** Make context controls reliable and clarify the speed/context choices.
**Architecture:** Shared file filtering in context collection, fresh manual gathers, policy-aware hook cache, and cancellable panel previews.
**Tech Stack:** Existing TypeScript, React, Node, Git, and Copilot adapter; no dependencies added.
**Spec:** [Approved design](../specs/2026-11-14-context-reliability-design.md).

## Constraints and review focus

Preserve saved settings, user text, attachments, privacy switches, icon, and sending safeguards.
Check alias paths, stale async responses, changes to extra files, cancelled reads, and unavailable Git.
No paid provider traffic or desktop/browser UI control. Commit verified work and push main.

## Tasks

- [x] Add failing context regression tests through the production session adapter with temporary files and model stubs.
- [x] Apply shared path/item filtering, canonical-path checks, and pre-truncation masking in context/files, instructions, stack, Git, gather, and hook callers.
- [x] Refresh manual gathers, key hook caches to file preferences, add bounded non-Git search, and enforce ten final AI-assisted files.
- [x] Add failing preview race/freshness tests; implement debounced refresh, cancellation, late-response rejection, and explicit refresh.
- [x] Present the approved four levels with explanations and saved Basic compatibility; test choices and defaults.
- [x] Update current context/privacy/workflow docs and English changelog; bump all version sources to 0.3.1.
- [x] Run typecheck, build, final full tests, package checks, and installed-runtime fixture checks; review and resolve findings.
Release step: commit, fast-forward main, push without force, and verify the remote commit. Record the resulting commit and push status in the completion report.

## Execution record

- Baseline: clean worktree at 12c2a9b, v0.3.0; prior audit reproduced six defects.
- User approved the four clearer choices while retaining the current default and saved Basic selection.

- Implemented shared canonical filtering, pre-trim masking, fresh gathers, bounded local search, the ten-file cap and cancellable previews.
- Independent review found alias-path and extra-source masking defects; fixed them with regressions, including removed directory aliases and ordinary deleted-file diffs.
- Final verification: typecheck, build, 316 tests, package checks and installed-runtime E2E all passed. E2E used a disposable session and local HTTP fixture; no paid provider traffic or desktop/browser UI control.
- Remaining manual checks: desktop menu/refresh appearance and subjective rewrite quality with the user's real project/model.
