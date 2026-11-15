# English-only Enhance Prompt

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

Goal: remove localization and output-language selection throughout the plugin while preserving user data, Unicode input, structured errors, and all existing safety boundaries.

Architecture: literal English UI text; a pure `formatText(template, params)` helper only for placeholders; structured messages rendered in English; one English output policy shared by every model rewrite. Retired stored keys are cleaned through existing transactions and stale request overrides are ignored.

Stack: TypeScript, React, Node test runner, Vite/esbuild, committed Copilot extension and hook.

Spec: the owner's English-only request in this conversation supersedes the repository's former translation requirements. No desktop/browser automation, paid model tests, tags, or releases. Complete verified work is pushed to main without force-pushing.

Global constraints: preserve custom rules and structures, drafts, history, credentials, models, usage records, the green Lift icon, privacy controls, sending guards, and hook pass-through behavior. Plugin-authored text is English; external/user content remains intact. Historical English release notes and attribution remain accurate.

Review focus: overlooked localization state, legacy storage loss, rule precedence, Unicode/literal preservation, generated stale chunks, and untested rewrite routes.

- [x] Replace UI/panel translation calls, remove language controls/state and preview locale behavior; update UI tests.
- [x] Remove worker/protocol language handling; enforce English across rewrite routes and add pipeline regressions.
- [x] Replace translation modules with formatting/structured-message rendering; clean persisted legacy settings, remove runtime locale properties, update documentation/build tooling and regression coverage.
- [x] Bump to 0.3.0, rebuild, run typecheck/full tests/package checks, inspect generated assets and review the complete change.

Publication: commit the verified changes and fast-forward/push main; report version, commit, verification, and remaining manual checks. Do not tag or create a release.

Verification: typecheck, build, all 299 post-build tests, and package checks passed. The installed-runtime smoke test passed with a disposable session and local model fixture. Review found and resolved a preview-only Vietnamese response and outdated rule example; scoped re-review passed. Generated web directories contain only the English changelog. Icon and license files are unchanged. Desktop visual checks and paid-model output evaluation were not run.
