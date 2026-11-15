# Copilot Canvas Implementation Plan

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

> **For agentic workers:** Use superpowers:executing-plans. Track completed steps here and decisions in `progress.md` alongside this plan.

**Goal:** Ship Enhance Prompt as a native GitHub Copilot desktop canvas with the existing core workflow and no dependency on the original host.

**Architecture:** Preserve the rewrite engine, context collectors, and React components. Introduce project-owned panel services, a Copilot session adapter, durable storage, and an authenticated local canvas server. Package built JavaScript and web assets as a Copilot plugin.

**Tech Stack:** TypeScript, Node.js, React, Vite, Node's test runner, Copilot's bundled extension SDK.

**Spec:** `docs/superpowers/specs/2026-11-14-copilot-canvas-design.md`

## Global constraints

- Keep the Enhance Prompt brand and MIT notice.
- Translate all UI string changes into Vietnamese and Chinese.
- Preserve safe file reads, secret masking, attachments, privacy checks, and reviewed sending.
- Bind a canvas to its session and canonical project path.
- Ship JavaScript; the desktop app supplies the extension SDK.
- Verify on Windows; use Brave for browser checks.
- Do not publish, push, change Git remotes, or alter unrelated plugins.

## Review focus

- Two processes editing preferences/history: preserve both updates.
- A session starts work or requests input during enhancement: hold back the result.
- A canvas reload changes its port: retain drafts/preferences and cancel abandoned runs.
- A webpage probes loopback endpoints: refuse unauthenticated and cross-origin requests.
- A remote or unidentified project is attached: never read a local lookalike directory.

### Task 1: Independent runtime and tests

**Files:** `package.json`, `tsconfig.json`, `src/runtime.ts`, `src/host.ts`, `src/testing.ts`, `src/protocol.ts`, existing source/tests, `web/tsconfig.json`, `web/vite.config.ts`.

**Interfaces:** `PanelClient` provides request/events, settings/storage and file export. `EnhanceWorker` provides typed requests, persistence, and a bounded platform operation interface. Production and tests use the same panel state primitives.

- [ ] Capture the existing test baseline.
- [ ] Add runtime tests for independent atoms, persistence hydration, subscriptions, and cancellation; run and observe missing-runtime failure.
- [ ] Replace runtime/type/test imports with project-owned modules and remove generated host type dependency.
- [ ] Port the test fixtures to Node's runner; preserve assertions applicable to the new host.
- [ ] Run type checks and the independent tests. Checkpoint the diff.

### Task 2: Copilot session and durable storage

**Files:** `src/copilot/session.ts`, `src/copilot/storage.ts`, `src/copilot/secrets.ts`, corresponding tests, `src/worker.ts`, `src/privacy.ts`, `src/context/`.

**Interfaces:** `createSessionPlatform(session)` supplies attached-project/session operations and guarded sending. `createStorage(directory)` supplies atomic JSON persistence. Credentials remain separate from ordinary JSON values.

- [ ] Write failing tests for project identification, remote refusal, blocked/busy/disconnected sending, duplicate sends, concurrent storage writes, and credential round trips.
- [ ] Implement against the installed SDK's `metadata.snapshot`, `metadata.activity`, prompt hooks, and `send` contracts; reject unsupported operations.
- [ ] Replace terminal semantics with explicit session submission; preserve provider execution, privacy, rules, context, and history.
- [ ] Test hook recursion, cancellation, project isolation, and persistent state across instances. Run the regression suite.

### Task 3: Installable canvas and transport

**Files:** `src/copilot/canvas.ts`, `src/copilot/server.ts`, transport tests, `scripts/build.mjs`, `plugin.json`, `.github/plugin/marketplace.json`, `com.github.copilot/extensions/enhance-prompt/extension.mjs` and built assets.

**Interfaces:** `createCanvasServer(worker, panelId)` returns a loopback URL and close function; each panel has independent authorization and cancellation. The entry joins a Copilot session and declares the canvas.

- [ ] Write failing tests for authorization, origin checks, invalid inputs, static traversal, lifecycle cleanup, and independent panel cancellation.
- [ ] Implement requests and server-sent events; keep agent-callable actions separate from human-only send/consent endpoints.
- [ ] Build and validate the distributable plugin. Check SDK import resolution and canvas discovery against the installed runtime.

### Task 4: Panel adaptation

**Files:** `web/src/canvas-client.ts`, `web/src/panel-runtime.ts`, `web/src/mock-host.ts`, `web/src/main.tsx`, `web/src/enhance.tsx`, `web/src/sections.tsx`, `src/panel/`, `src/i18n-dict.ts`, related tests.

**Interfaces:** The production `PanelClient` uses the canvas server; the explicit development preview uses sample data. Session capability data controls unavailable operations.

- [ ] Add failing tests for attached-session labels, guarded submission, unsupported capabilities, and settings/draft rehydration.
- [ ] Connect the existing UI, translate changed strings, retain models/rules/history/attachments and keyboard access.
- [ ] Remove terminal paste/Enter UI; expose reviewed Send to Copilot and Copy. Adapt capability-dependent controls honestly.
- [ ] Build and inspect the narrow panel in Brave; run panel tests.

### Task 5: Branding and contributor workflow

**Files:** `README.md`, translated readmes, `AGENTS.md`, guides/changelogs, scripts, assets, package metadata, generated bundles.

- [ ] Replace old-platform documentation, scripts, package identity, install links, and screenshots with verified Copilot workflows.
- [ ] Preserve the license and source attribution; record this fork's own release notes.
- [ ] Add package checks for required assets and forbidden old-host references. Run them and the build.

### Task 6: Desktop verification and review

**Files:** integration tests and `docs/copilot-verification.md`.

- [ ] Test packaged canvas load/reload and persistence in the installed app.
- [ ] Verify enhancement and explicit sending in a dedicated harmless test session using an available configured provider.
- [ ] Run full type checks, tests, build, and package validation; record evidence and limits.
- [ ] Obtain a fresh whole-change review, fix important findings, and repeat affected checks.
- [ ] Report implemented behavior and exact verification, including unresolved platform gaps.
