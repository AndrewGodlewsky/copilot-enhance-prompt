# Enhanced prompts implementation plan

**Goal:** Ship a separate enhanced rewrite set with a default-on, saved “Use enhanced prompts” checkbox and an exact original fallback.

**Architecture:** Keep `src/prompts.ts` unchanged. A separate prompt-set builder selects the original or enhanced system instructions once per worker run. The existing preference store and Settings row carry a boolean; no new transport or model route is needed.

**Tech stack:** Existing TypeScript worker, React/Radix panel and Node tests.

**Spec:** [Enhanced and original prompts](../../enhanced-prompts.md), implementing the owner's explicit checkbox/default/fallback request.

## Constraints and review focus

- Preserve the original builder byte for byte; keep historical evaluations on that builder.
- Default missing/invalid saved preference to enabled; preserve an explicit false across sessions.
- A running enhancement keeps its choice across collection and fallback; client request fields cannot override the saved choice.
- Keep all nine styles, rules, structures, English policy, literal Unicode, attachments, privacy and sending safeguards.
- No live model calls or desktop/browser automation. Rebuild package assets, version and release notes, then verify and push main without tags.

## Tasks

1. Add failing worker/persistence tests for default-on behavior and exact fallback. Add prompt-set coverage for all nine styles, conflicting saved instructions, custom headings and literal content.
2. Add `src/prompt-sets.ts` with separate enhanced policies and `buildRewriteSystemPrompt(options, useEnhancedPrompts = true)`. Wire `useEnhancedPrompts` through defaults and the worker's initial settings snapshot; validate it with existing boolean preference conventions.
3. Add the labeled checkbox to Prompt preferences, explaining original fallback and next-run behavior. Verify rendered accessibility and checked default without UI automation.
4. Test both settings with normal, AI-assisted and AI Test final rewriting, all effort tiers and fallback. Verify a mid-run preference change applies only to later runs.
5. Update user documentation, version and changelog. Run typecheck, build, final full tests and package checks; request independent code review. Commit verified work and push main.

The new policy is a user-trial revision based on observed errors. Passing routing and contract tests does not establish improved model outputs.
