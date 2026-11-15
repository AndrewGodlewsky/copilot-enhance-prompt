# Copilot-only implementation plan

> **For agentic workers:** Use superpowers:executing-plans with independent backend and panel tasks delegated under superpowers:dispatching-parallel-agents. Track completed work here.

**Goal:** All model work goes through the installed GitHub Copilot desktop SDK/runtime. Remove direct providers, chat auto-enhance, desktop completion notifications and periodic feedback solicitation.

**Architecture:** Keep the existing Copilot catalog, background helper, accounting, context and guarded send workflow. Delete alternative provider clients and chat hook registration. Normalize saved model configurations to Copilot profiles; obsolete settings are inert. Preserve unrelated saved data and document the removed hook for future reconsideration.

**Tech Stack:** TypeScript, React, Node test runner, esbuild/Vite.

**Spec:** Owner approved the recommendations and explicitly approved removing all chat auto-enhance, with a repository recovery note. Enhance, Send to Copilot, issue links, Show Logs, effort assignments, context choices and usage records stay.

## Global constraints

- No desktop/browser control or paid model tests.
- English authored text; preserve user content, rules, drafts, history, attachments and usage records.
- Preserve green Lift icon, current layout outside removed controls, privacy, cancellation and send safeguards.
- Never silently convert an external profile into a Copilot model or execute a stale external profile.
- No new dependencies or runtime downloads; no force-push, tag or release.

## Shared interfaces

- `ModelProfile`: `id`, `name`, `preset: 'copilot'`, `provider: 'copilot'`, `model`, `enabled`.
- `ProfileView`: profile plus `effectiveModel`. `ModelsConfig`: `profiles`, `selectorProfileId` (AI-assisted stays).
- `ModelsView`: `profiles`, `selectorProfileId`. No API keys, environment detection, provider choices or hook roles.
- `ProfileInput`: optional id plus name/model/enabled, optional fixed Copilot preset/provider for compatibility. Validate any supplied provider/preset and reject external values.
- `models.catalog`: optional preset/profileId/refresh. Copilot only, reject obsolete non-Copilot identities. `models.roles`: selectorProfileId only. Remove models.detect, hook.last and hook events.
- `data.summary`: history/profiles/catalogs only. Keep structured error helpers; delete HTTP provider execution.
- Remove allowEnvKeys; retain allowOnlineModelLists (Copilot access checks) and existing other privacy controls.

## Tasks

- [x] Backend: simplify profiles/model chain, catalog and worker; remove notifications and chat auto-enhance; remove direct API/CLI implementation; adapt backend tests and add stale-profile rejection tests.
- [x] Panel: remove provider/key/CLI controls, chat auto-enhance and notifications; remove feedback solicitation/state; keep issue links. Update mock host, preview tests and affected panel fixtures.
- [x] Host and migration: remove hook package/server integration and protected API-key services; retire legacy settings and encrypted API keys using existing transaction conventions; preserve unrelated state and Copilot assignments; test migration.
- [x] Documentation and release: record recovery source at commit d466c96c99a75bf9ec7491fc660fded3b7f11283, update current README/workflow/dev instructions, retire provider evaluation tooling, bump to 0.7.0, rebuild committed assets and remove stale hook artifacts.
- [x] Verification: typecheck, build, final full tests and package checks; scan for active external providers, hook routes and removed settings. Independent review completed, including migration follow-up.

## Review focus

- Legacy profiles or forged requests must never reach an external endpoint or silently select a Copilot model.
- Existing encrypted API keys and legacy preferences must not affect behavior; cleanup must preserve all unrelated data and tolerate concurrent sessions.
- Existing Copilot models/effort choices, selector roles, fallbacks and usage accounting must still work.
- Removing hook endpoints/allowlists must not weaken human-only controls or attached-session sending checks.
- Existing package directories must not retain a working hook or external-provider code after rebuild.


## Execution record

- Implemented the backend, panel, host migration, documentation and 0.7.0 generated package.
- Ruling: also remove the unsupported separate-agent launch path because it is external connectivity. Keep unrelated unavailable context/editor controls.
- Ruling: retain inactive saved autoEnhance* preferences for recovery, but delete encrypted apiKey.* values, retired model profiles and solicitation state. Never decrypt legacy keys. Both stores retain unrelated values.
- Review fixes: preserve explicit pre-effort external choices and unavailable AI-assisted selector references until the user replaces them. Show the unavailable selector even when fewer than two profiles remain. Propagate picker usage-accounting failures before final rewriting.
- Verified after rebuilding: npm run typecheck, npm run build, npm test -- --test-concurrency=1 (292 passed), npm run check. Source/package scans found only intentional migration guards, recovery/history text and secret-redaction patterns for retired features.
- Independent final review and focused follow-up found no remaining material issues. No desktop/browser control or paid model requests performed. Manual desktop layout and account-backed enhancement remain user checks.
- Integration authorized: commit verified work and fast-forward/push main without force, tags or a release.
