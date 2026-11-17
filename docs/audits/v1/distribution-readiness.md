# V1 distribution, maintenance, and usability readiness

Audit date: 2026-11-16. Baseline: **Enhance Prompt 0.12.0**, commit `d25be463718f1b5d8ab663177fc9aa248956f762`, branch `AndrewGodlewsky/readme-diagram-flat-style`. This is an audit, not a release or a production change.

**Recommendation: keep the development-preview label until the release gates below are met.** Both npm audits returned zero reported advisories, but that does not establish the safety of the plugin, its build inputs, or the desktop-owned runtime. The clearest release gaps are missing third-party distribution notices, absence of repository-defined release verification and maintenance automation, incomplete security reporting/recovery guidance, and two reproducible UI defects. The existing isolation, explicit-send, update-provenance, privacy, and diagnostics design provides a useful foundation; this review is not a clean bill of health for those boundaries.

## Evidence and limits

This review read repository source and documentation, inspected installed dependency manifests and the installed desktop SDK declarations, queried official npm/GitHub/vendor documentation, and ran read-only dependency audits plus builds with `write: false` and static React rendering. It did not open a browser or desktop UI, use an account-backed model, change an installation/profile, run `npm audit fix`, modify production code, or commit/push anything. Full-suite/build validation belongs to the parent audit; only the narrow checks listed here were run by this workstream.

- `node --version`: `v24.22.1`; `npm --version`: `12.0.2`; registry: `https://registry.npmjs.org/`.
- Root and web `npm audit --json` both exited **0**, with `vulnerabilities: {}` and all severity counts **0**. Audit metadata counted 36 root and 167 web dependencies, including platform/optional entries; these are not shipped-code counts.
- Raw reports are ignored local evidence: `.artifacts/v1-audit/npm-audit-root.json` and `npm-audit-web.json`. SHA-256 respectively: `9D27C0653876233F8C5B4C97164FD6233BDE9E7A9710412C0D28ABB07487BD7F` and `0ED2D3EB37EAF2044CAB896E7A07C308D42A338D49819F4721D11FE3CEFE5559`.
- Bundle inventories are `.artifacts/v1-audit/bundle-dependencies.json`, `backend-metafile.json`, and `frontend-modules.json`. Static UI evidence and its reproducible script are `ui-distribution-probe.json` and `ui-distribution-probe.mjs` in that directory. They use synthetic data only.
- File metadata for `%LOCALAPPDATA%/Programs/GitHub Copilot/github.exe` reports **1.4.2**. The installed `copilot-sdk/cliVersion.d.ts` declares **1.0.106-8.unstable.r43566476370.g869eef3** and `COPILOT_CLI_USE_NPM_PACKAGE = false`. Installed `extension.d.ts` and `canvas.d.ts` were inspected without launching the app; canvas contracts explicitly remain experimental. This matches [the recorded supported setup](../../copilot-background-rewriting.md), lines 77–83, but is not a new compatibility test.
- No remote repository settings were inspected. Absence of checked-in CI/Dependabot files does **not** prove that GitHub alerts, branch rules, private reporting, or external CI are disabled. Their actual configuration is unverified.

npm documents that audit sends dependency metadata to the configured registry and reports known vulnerabilities; it does not inspect peer dependencies. These two scans cover the npm trees, not arbitrary source bugs, undisclosed issues, the host SDK/runtime, the host's browser/native libraries, or whether a compromised package introduced malicious code. [npm audit documentation](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/)

## What users receive and execute

The marketplace entry selects the repository root (`source: "./"`), and the README recommends the public GitHub branch. This is a Git repository distribution with committed builds, not an npm-published application package: both package manifests are private. The baseline Git tree contains **305 tracked files, 7,080,178 bytes uncompressed**, including docs/design assets, tests, build scripts, TypeScript/React source, locks, and compiled output. A GitHub ZIP contains that tracked tree; the marketplace source also identifies that root. Transfer compression, Git objects, and the precise cache-copy implementation are host details, not measurements from a fresh installation in this audit. [Marketplace manifest](../../../.github/plugin/marketplace.json), line 5; [README](../../../README.md), lines 15–37 and 47–67; [GitHub source/path reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)

| Boundary | Files/dependencies | What actually happens |
| --- | --- | --- |
| Plugin metadata | `plugin.json`, `.github/plugin/marketplace.json`, `assets/icon.svg`, root `LICENSE` | Copilot discovers the package and its branding. The manifest has no hook, MCP server, command, or skill registration. |
| Extension execution | `com.github.copilot/extensions/enhance-prompt/extension.mjs` (306,658 bytes) | Copilot loads this Node-targeted ESM bundle. It contains project backend code and four npm libraries listed below. It joins the attached session and starts the loopback server. |
| Canvas rendering | Adjacent `web/index.html`; `assets/app.js`, `sections.js`, `history.js`, `dropdown-menu.js`, `CHANGELOG.js`, `index.css`, `history.css`, `icon.png` | The browser executes local bundled JavaScript, lazily loads sections/history/release text, and renders CSS/images. There is no remote script/CDN import in this entry. These nine web files plus the extension total **1,025,846 bytes**. |
| SDK and inference | `@github/copilot-sdk/extension`, `@github/copilot-sdk`, existing Copilot executable | External to the package. The host supplies them; the helper launches the already running host executable in a disposable directory. No separate SDK/runtime npm install is part of normal use. |
| Developer build inputs | Root/web `package.json` and lockfiles; `scripts/`; TypeScript, esbuild, Vite, React/Tailwind plugins, platform bindings, type declarations | Developers install and execute these to produce bundles. Normal plugin users do not run `npm ci`, Vite, TypeScript, or the repository's test/evaluation scripts. |
| Additional downloaded material | `src/`, `web/src/`, docs, tests, original art, `src/web-dist/` | Present in the repository distribution. Copilot loads the packaged extension/web path; it does not generally execute these development files simply because they were downloaded. `src/web-dist` duplicates the compiled web output used by the build/check process. |

Evidence: [build](../../../scripts/build.mjs), lines 6–23; [extension bootstrap](../../../src/copilot/extension.ts), lines 15–17, 25–56; [helper](../../../src/copilot/models.ts), lines 34–75 and 186–188; [packaged HTML](../../../com.github.copilot/extensions/enhance-prompt/web/index.html); [lazy sections](../../../web/src/main.tsx), lines 31–36; [Vite configuration](../../../web/vite.config.ts), lines 16–24. The dev-only mock import is gated by `import.meta.env.DEV` at main lines 103–109; it is not a production provider.

**Runtime dependency classification matters.** `proper-lockfile` is declared under root `devDependencies`, but its code and `graceful-fs`, `retry`, and `signal-exit` ship inside `extension.mjs`. A root `npm audit --omit=dev` would therefore exclude code that users execute. Conversely, compiler/platform packages in lockfiles do not all ship as runtime JavaScript. The audit used the full trees. [Root package manifest](../../../package.json), lines 18–24; [lockfile](../../../package-lock.json), lines 530–565.

| Backend bundled package | Locked and installed version | License metadata |
| --- | --- | --- |
| proper-lockfile | 4.1.2 | MIT |
| graceful-fs | 4.2.12 | BlueOak-1.0.0 |
| retry | 0.12.0 | MIT |
| signal-exit | 3.0.7 | ISC |

The in-memory frontend build traced emitted JavaScript modules to **54 packages**, including React/React DOM **19.3.1**, Base UI **1.9.0**, Lucide **1.70.0**, Sonner **2.0.8**, class-variance-authority **0.7.1**, clsx **2.1.1**, tailwind-merge **3.7.0**, and the underlying Radix/Floating UI/accessibility helpers. `radix-ui` **1.8.1** is the installed import facade; emitted modules come from its individual packages. CSS imports include `tw-animate-css` **1.4.0** and generated Tailwind **4.3.5** output. The exact emitted-package inventory follows below. [Web manifest](../../../web/package.json); [web lock](../../../web/package-lock.json); [CSS imports](../../../web/src/index.css), lines 1–2.

Installed build tooling matched the locks: root esbuild **0.25.12**, TypeScript **5.9.3**, `@types/node` **22.20.5**, `@types/proper-lockfile` **4.1.4**; web Vite **8.3.6**, `@vitejs/plugin-react` **6.3.0**, `@tailwindcss/vite`/Tailwind **4.3.5**, TypeScript **5.9.3**, `@types/node` **26.6.6**, `@types/react`/`@types/react-dom` **19.3.0**. Root esbuild and optional web `fsevents` **2.3.3** have install-script flags in their locks. That is build-environment exposure, not a claim that normal plugin installation runs npm lifecycle scripts or that a flagged script is malicious. Use locked clean installs in a controlled builder; npm CI enforces manifest/lock agreement. [npm CI](https://docs.npmjs.com/cli/v11/commands/npm-ci/)

## Release findings

Severity below is a recommended **v1 release priority**, not a CVSS rating or a claim of exploitation.

### D1 — High release priority: distribute third-party notices

Only the original project's `LICENSE` is tracked. It correctly preserves `Copyright (c) 2026 cattfan`, but it is not a substitute for the notices of bundled dependencies. The shipped extension and all five shipped JS chunks contain **zero `copyright` or `license` strings**; no `THIRD_PARTY_NOTICES`, license directory, or SBOM is tracked. The backend's `legalComments: 'inline'` cannot copy standalone license files from dependencies that have no license comment in their source. [Original license](../../../LICENSE); [build](../../../scripts/build.mjs), line 12; [attribution](../../../README.md), lines 180–184.

Confirmed examples: installed `node_modules/proper-lockfile/LICENSE` has its own 2018 MOXY notice and MIT permission text; `retry/License` has separate copyright holders; `signal-exit/LICENSE.txt` has ISC notice text; `graceful-fs/LICENSE.md` requires its license text or link to reach recipients. React's upstream MIT license also requires the copyright and permission notice with copies. These texts are currently absent from the executable bundle and no separate distribution notice supplies them. [React license](https://github.com/react/react/blob/main/LICENSE), [Blue Oak notice requirement](https://blueoakcouncil.org/license/1.0.0).

**Acceptance:** produce notices from the exact modules/assets shipped, include required texts and attribution in the repository/package, preserve the original MIT license, and check that the generated package contains them. Include copied UI component provenance and icon/font/art licenses in that review. Do not classify the whole release merely by the root MIT declaration or assume every lockfile package executes in the product. The lockfiles also contain Apache, ISC, Blue Oak, 0BSD, BSD, and MPL metadata, some belonging only to build tools; assess each actual distribution component.

### D2 — High release priority: make source-to-bundle verification repeatable

`.github/` contains only `plugin/marketplace.json`; no checked-in workflow, Dependabot configuration, CODEOWNERS, release checksums, SBOM, or attestation process exists at the baseline. The documented local sequence is good, but the actual executable bundles are committed and installed from a mutable branch. `scripts/check.mjs` typechecks, inspects manifest/markers, and compares the two generated web directories. It does **not** rebuild the extension from source or prove that two equally stale web directories match current React source. [Check script](../../../scripts/check.mjs), lines 6–35; [release instructions](../../../AGENTS.md); [README](../../../README.md), lines 158–178.

**Acceptance:** add a clean Windows CI job using both lockfiles, the existing typecheck/build/test/check sequence, and a post-build diff against all committed generated outputs. Record Node/npm and supported host versions. Add advisory review for both npm roots and dependency PRs; check actual branch protection and security alert settings separately. Keep untrusted PR CI without secrets and use current GitHub workflow dependency locking or verified commit pinning. [GitHub secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use), [Dependabot directories and schedule](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

For the stable channel, publish an identifiable reviewed commit and package digest; use an immutable release/ref policy and provide a verified package inventory. A signed build attestation can link a release archive to its commit and builder, but consumers must verify it and it does not certify safe code. Keep tag/release creation as an owner decision. [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations).

### D3 — High release priority: publish security reporting and maintenance ownership

The existing support route points users to public GitHub issues, with no tracked `SECURITY.md`, supported-version policy, response target, or security-specific private report route. [Footer](../../../web/src/footer.tsx), line 14; [Settings feedback](../../../web/src/sections.tsx), lines 680–687; [support guide](../../user-guide.md), lines 9–17. Private reporting may already be enabled in repository settings; this audit did not verify it.

**Acceptance:** publish a concise security policy with supported plugin/desktop versions, the monitored private reporting route, expected acknowledgement target, and security update/disable instructions. Verify the route works before announcing it. Direct normal UI bugs to public issues and suspected credential exposure, sandbox/privacy bypass, or malicious-package reports privately. GitHub supports private vulnerability reports and a `SECURITY.md` with reporting and supported-version information. [Security policy](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy), [private reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

### D4 — Medium release priority: close the declared host validation gap

The README calls this an experimental Windows preview and explicitly separates installed-runtime synthetic fixtures from real account-backed rewriting. Update documentation still lists manual layout, keyboard/screen-reader, actual GitHub marketplace update, and restart/reopen preservation checks as pending. Those statements must remain until measured; npm results cannot close them. [README](../../../README.md), lines 19–21 and 172–178; [update verification limits](../../plugin-updates.md), lines 56–64.

**Acceptance:** record a small supported-host matrix and owner-run evidence for fresh install → canvas → model selection → rewrite → reviewed send; cancellation/close; clipboard/download; narrow/wide/zoomed UI; and GitHub update → restart → same-session draft restoration. Test a catalog/account that lacks recommended models. New users receive explicit unavailable-model guidance, but a missing preset is a likely onboarding friction point. Keep non-Windows and enterprise policy variants outside the supported matrix until verified.

## Confirmed UI findings and review targets

| ID / priority | Evidence and user effect | V1 acceptance |
| --- | --- | --- |
| U1 / High | **Enhance can start while an attachment uploads.** `attachFiles` adds a path only after all chunk requests complete ([attach](../../../web/src/attach.ts), lines 53–88). Both Enhance buttons omit `uploadingNames()` from their disabled conditions ([composer](../../../web/src/enhance.tsx), lines 274–279). `runEnhance` checks only draft/busy and immediately snapshots completed paths ([actions](../../../src/panel/actions.ts), lines 306–328). The static fixture with `pending.png` left both buttons enabled, while Clear was disabled. A user can obtain or auto-send a rewrite that omits the file still shown as uploading. | Reserve upload state in the operation boundary; prevent both enhancement entry points until the attachment set is settled, or explicitly cancel/exclude with visible confirmation. Verify a delayed final chunk cannot silently miss the next rewrite. No live model is needed for this regression. |
| U2 / Medium | **Progress exposes no numeric value to assistive technology.** The wrapper removes `value` from props and uses it only in CSS ([Progress](../../../web/src/components/ui/progress.tsx), lines 7–25). A static render with `value: 50` produced `role="progressbar" data-state="indeterminate"` with no `aria-valuenow`. The total's label includes a percent, but each step's label does not. | Pass the value to the Radix root and verify numeric semantics at 0, partial progress, and completion; retain truly indeterminate behavior only when intended. [Radix reference](https://www.radix-ui.com/primitives/docs/components/progress) |
| U3 / Medium | **Undo has a short discovery window and expires even if a toast is paused.** Action/error notices last eight seconds ([Notices](../../../web/src/common.tsx), lines 18–31). History removal is immediate; worker recovery expires after 60 seconds ([worker](../../../src/worker.ts), lines 148 and 821–841). Installed Sonner pauses its own timer during interaction/hidden-document states, but not that worker expiry. A person returning to a paused visible Undo can receive a failed restoration. | Provide a persistent, discoverable recovery route or an explicit adjustable/extendable window, and align visible action availability with backend expiry. Manually test keyboard/screen-reader discovery. This is a timing/accessibility risk, not a complete WCAG conformance determination. [W3C timing guidance](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html) |
| U4 / Medium | **Automatic What's new is tied to an unstable origin.** `seen-version` is saved in `localStorage` ([release UI](../../../web/src/whats-new.tsx), lines 95–100). The server binds a random port ([server](../../../src/copilot/server.ts), lines 147–148), and updates require backend restart. When restart changes the origin, the previous seen version is unavailable, so the code treats it as a first install and does not automatically open the notes. This is a code-level inference from origin semantics, not an observed desktop failure. | Store the version marker with durable plugin settings and test it across a server-port change. Manual footer release history already works. [MDN origin-scoped storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) |
| U5 / Low | Repeated rule/profile/structure controls are named only `Enable`, `Disable`, `Delete`, `Edit`, or `More` ([sections](../../../web/src/sections.tsx), lines 141–144, 360–365, 403–419). These names omit the corresponding rule/profile/structure when controls are navigated out of visual context. | Include the item's name or a concise rule excerpt in the accessible label; verify the control list with a screen reader. |
| U6 / Medium documentation | The guide says Clear keeps the reviewed result ([user guide](../../user-guide.md), line 27), while `clearRequest()` empties both draft and result ([actions](../../../src/panel/actions.ts), lines 441–449), and the current button label states that behavior. | Correct the guide to match the implemented destructive scope. Clear should not be used as a preservation step until needed text has been copied. |

Additional polish/review targets, not confirmed correctness bugs: History Copy intentionally copies the enhanced text even when Original request is selected (tooltip and [guide](../../user-guide.md), line 48 document this); label it **Copy enhanced prompt** to remove ambiguity. Lazy sections use `Suspense fallback={null}` without a render error boundary ([main](../../../web/src/main.tsx), lines 76–89), so test missing/stale chunks and offer retry/reopen guidance. SSE reconnect failures are diagnostics-only and retry every two seconds ([transport](../../../web/src/transport.ts), lines 70–103); verify that a stalled event stream cannot leave misleading connection/progress status. Do not call these fully reproduced desktop defects.

Existing source measures worth preserving: English document language, heading/navigation structure, explicit button names for icon actions, arrow-key radio groups, visible focus outlines, labeled Radix dialogs, status/alert regions, text size controls, narrow History project picker, reduced-motion CSS and animation opt-out, explicit automatic-send confirmation, startup failure with Show Logs, and clipboard fallback for diagnostics. [HTML](../../../web/index.html), [common controls](../../../web/src/common.tsx), [focus/reduced motion](../../../web/src/index.css), lines 140–151; [motion hook](../../../web/src/use-word-crew.ts), lines 14–30; [logs](../../../web/src/logs.tsx), lines 23–53. Source review cannot establish actual contrast, focus order/return, popup clipping, 200–400% zoom, forced-colors behavior, or screen-reader announcements in the host; request owner-run checks for those.

## Maintenance schedule to adopt before v1

| Cadence / trigger | Concrete work | Release evidence |
| --- | --- | --- |
| Every dependency or source change | Review lockfile delta and install scripts; run both clean installs and required typecheck/build/test/check; compare committed generated outputs; regenerate runtime inventory/notices for changed bundled code. | CI log, clean generated diff, dependency reachability decision. |
| Daily notifications; weekly triage | Monitor GitHub advisories/Dependabot and host vendor security releases. Review alerts across both npm roots, including bundled packages classified as dev dependencies. Separate shipped reachability from build-only exposure. | Named maintainer; short decision for every actionable alert, with owner/date. |
| Weekly dependency PR batch | Use Dependabot for `/` and `/web`; review and test updates, including transitive changes. Keep security fixes out of a routine waiting queue when their impact warrants faster action. | Reviewed lockfile/build change; no automatic `audit fix --force` policy. |
| Every supported desktop/runtime update | Inspect changed installed declarations; run isolated no-account fixtures covering provider isolation, account/catalog checks, send/close, update lifecycle, and accounting. | Supported-version matrix; owner UI check if the host changed. |
| Every plugin release | Repeat dependency scan, package inventory/license check, verified source/build comparison, update/restart/draft smoke test, release notes, and source/digest recording. Reconfirm no paid traffic in automated tests. | Identified source commit and hashes; attestation if the release process supports verification. |
| Monthly | Test security-report delivery and recovery instructions; review unresolved accessibility issues and temporary-data cleanup failures; inspect trusted release/branch permissions. | Maintenance log and any support limitations. |
| Immediately on credible incident | Triage affected versions and executed component; pause affected use/distribution, prepare an advisory and tested fix, document recovery. | Affected/fixed versions, mitigation, verification and communication owner. |

These are proposed operating targets, not existing promises. A zero-advisory report should never postpone investigation of a demonstrated privacy/send violation or suspected malicious artifact.

## Disable, update, and recovery guidance

The product docs explain normal updates and uninstall, but lack a concise security pause procedure. Publish the following guidance after verifying it with the supported host:

1. **Pause when there is a concrete reason.** A credible advisory affecting the shipped code/runtime, suspected altered distribution, unexpected disclosure or send, or a helper isolation failure warrants stopping affected use while the maintainer investigates. This audit found no reported npm advisory requiring an immediate security shutdown. A build-tool-only advisory should trigger build/release triage; do not automatically claim every installed user is exploitable.
2. **Stop active plugin work and disable the plugin.** Cancel the current run and close its canvases. Disable Enhance Prompt in Copilot's Installed screen, or use `copilot plugin disable enhance-prompt@copilot-enhance-prompt`; restart Copilot so the existing extension process is no longer loaded. Confirm disabled status with plugin inventory. Managed/repository settings may control activation; follow their indicated administrator/configuration route instead of trying to override policy. GitHub documents disable as separate from uninstall. [GitHub plugin command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
3. **Keep useful evidence safely.** For an ordinary failure, capture Show Logs before restart because its buffers are in memory. For suspected malicious behavior, do not reopen the suspected plugin just to obtain its diagnostics. Report plugin version, installed source/ref, app/runtime versions, and safe reproduction steps through the private security route. Avoid uploading raw helper journals, plaintext data folders, attachments, credentials, or prompts; the documented recovery journals may contain transcripts. [Privacy](../../privacy.md), lines 11–17.
4. **Update the component that owns the fix.** Bundled JavaScript/library fixes require an Enhance Prompt update/rebuild; SDK/runtime/browser fixes require the host vendor's update. Normal public branch installs can use Settings → Plugin updates or `copilot plugin update enhance-prompt@copilot-enhance-prompt`. Follow the configured fork/ref; do not silently switch pins or sources. Disabling this plugin's automatic checks only disables its metadata polling, not the plugin or Copilot's separately configured marketplace auto-update. [Plugin update behavior](../../plugin-updates.md), lines 3–39; [GitHub auto-update reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).
5. **Recover a normal interrupted update without deleting data.** Finish work, wait for queued saves/uploads, and copy any needed unsaved request/result before Clear when Save history is off. If update status is uncertain, inspect Copilot's installed inventory and restart before retrying; the updater intentionally refuses duplicate/uncertain updates. Restart the app and reopen the same session, then verify the running footer version, installed source/version, saved draft, settings and history. Closing/reopening just the canvas is insufficient on the recorded host. [Recovery contract](../../plugin-updates.md), lines 9–15.
6. **Rollback only to an identified good version.** v1 should publish a tested rollback target and compatibility notes. Copilot supports ref/commit pinning, but this plugin intentionally refuses automatic movement of pinned installations. Use host installation management and the reviewed known-good commit after checking data compatibility; do not use Delete everything or wholesale profile/cache removal as an update repair. No stable rollback release is claimed here. [Source behavior](../../plugin-updates.md), lines 19–31; [GitHub pinning reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).

The authenticated loopback server is a web-origin boundary, not an OS sandbox: it uses a random canvas token, exact origin/host checks, request limits, static-file confinement and CSP ([server](../../../src/copilot/server.ts), lines 13–36, 61–75 and 137–165). Already-running processes as the same OS user remain outside that boundary. Normal plugin privacy controls do not replace disabling an untrusted executable. Continue describing the helper as constrained by the installed runtime, not as a complete OS sandbox. [Existing security limitations](../../copilot-background-rewriting.md), lines 65–81.

## Coverage inventory

| Area | Files reviewed / evidence |
| --- | --- |
| Product/distribution documentation | `AGENTS.md`, `README.md`, `LICENSE`, `docs/getting-started.md`, `user-guide.md`, `privacy.md`, `settings.md`, `troubleshooting.md`, `plugin-updates.md`, `copilot-background-rewriting.md`, historical `copilot-migration-assessment.md`, relevant SDK handoff/version references. |
| Packaging | Both package manifests and lockfiles; root/plugin marketplace manifests; `.gitignore`, `.gitattributes`; `scripts/build.mjs`, `check.mjs`, `test.mjs`; `web/vite.config.ts`, `web/index.html`; emitted bundle imports/content, package counts and module inventories. `.github/` inventory was complete. |
| Every `web/src` top-level TS/TSX module | `attach`, `common`, `copilot-connection`, `effort-models`, `enhance`, `footer`, `history`, `logs`, `main`, `mock-host`, `panel-runtime`, `preferences`, `quiet-desk`, `sections`, `store`, `theme`, `transport`, `updates`, `use-word-crew`, `whats-new`, `word-crew`, `env.d.ts`. |
| Every UI wrapper and stylesheet | `components/reui/{alert,badge}`, `components/ui/{button,checkbox,dialog,dropdown-menu,input,progress,select,spinner,switch,textarea,tooltip}`, `lib/utils`, `index.css`, `layout.css`, `history.css`. |
| Panel/runtime lifecycle | Full `src/panel/{actions,setup,state}.ts`, `src/runtime.ts`, `src/copilot/{extension,server}.ts`; relevant `panel/view.ts` labels, worker history Undo, helper SDK/runtime creation; existing composer static-test harness. No claim of full security coverage of context/model/storage implementations from this workstream. |
| Installed external code | Direct dependency versions, backend licenses, Sonner timer semantics, current SDK `extension.d.ts`/`canvas.d.ts`/`cliVersion.d.ts`, host executable version metadata. |
| Not performed | Live account inference; owner app/profile modification; browser automation/screenshots; screen-reader/visual tests; fresh GitHub marketplace install/update; independent OS-level threat assessment; full host dependency audit; GitHub security-settings inspection; code changes or release publication. |

## Exact emitted JavaScript package inventory

This list comes from an in-memory build of the reviewed source with the installed locked packages. It describes modules emitted by the bundlers, not a standardized SBOM and not every package fetched by npm. The facade `radix-ui`, CSS inputs, and build tools are described above. Versions/licenses below are package metadata; standalone notices still need to be assembled and checked.

| Runtime | Package | Version | License metadata |
| --- | --- | --- | --- |
| Backend | `graceful-fs` | 4.2.12 | BlueOak-1.0.0 |
| Backend | `proper-lockfile` | 4.1.2 | MIT |
| Backend | `retry` | 0.12.0 | MIT |
| Backend | `signal-exit` | 3.0.7 | ISC |
| Frontend | `@base-ui/react` | 1.9.0 | MIT |
| Frontend | `@base-ui/utils` | 0.5.0 | MIT |
| Frontend | `@floating-ui/core` | 1.8.0 | MIT |
| Frontend | `@floating-ui/dom` | 1.8.0 | MIT |
| Frontend | `@floating-ui/react-dom` | 2.1.9 | MIT |
| Frontend | `@floating-ui/utils` | 0.2.12 | MIT |
| Frontend | `@radix-ui/number` | 1.1.3 | MIT |
| Frontend | `@radix-ui/primitive` | 1.2.0 | MIT |
| Frontend | `@radix-ui/react-arrow` | 1.1.17 | MIT |
| Frontend | `@radix-ui/react-checkbox` | 1.4.1 | MIT |
| Frontend | `@radix-ui/react-collection` | 1.2.0 | MIT |
| Frontend | `@radix-ui/react-compose-refs` | 1.1.5 | MIT |
| Frontend | `@radix-ui/react-context` | 1.3.0 | MIT |
| Frontend | `@radix-ui/react-dialog` | 1.3.1 | MIT |
| Frontend | `@radix-ui/react-direction` | 1.2.0 | MIT |
| Frontend | `@radix-ui/react-dismissable-layer` | 1.2.1 | MIT |
| Frontend | `@radix-ui/react-dropdown-menu` | 2.2.1 | MIT |
| Frontend | `@radix-ui/react-focus-guards` | 1.2.0 | MIT |
| Frontend | `@radix-ui/react-focus-scope` | 1.3.1 | MIT |
| Frontend | `@radix-ui/react-id` | 1.1.4 | MIT |
| Frontend | `@radix-ui/react-menu` | 2.2.1 | MIT |
| Frontend | `@radix-ui/react-popper` | 1.4.0 | MIT |
| Frontend | `@radix-ui/react-portal` | 1.2.0 | MIT |
| Frontend | `@radix-ui/react-presence` | 1.1.11 | MIT |
| Frontend | `@radix-ui/react-primitive` | 2.2.0 | MIT |
| Frontend | `@radix-ui/react-progress` | 1.2.1 | MIT |
| Frontend | `@radix-ui/react-roving-focus` | 1.2.1 | MIT |
| Frontend | `@radix-ui/react-select` | 2.4.1 | MIT |
| Frontend | `@radix-ui/react-slot` | 1.5.0 | MIT |
| Frontend | `@radix-ui/react-switch` | 1.4.1 | MIT |
| Frontend | `@radix-ui/react-tooltip` | 1.4.1 | MIT |
| Frontend | `@radix-ui/react-use-callback-ref` | 1.1.5 | MIT |
| Frontend | `@radix-ui/react-use-controllable-state` | 1.3.0 | MIT |
| Frontend | `@radix-ui/react-use-effect-event` | 0.0.5 | MIT |
| Frontend | `@radix-ui/react-use-is-hydrated` | 0.1.3 | MIT |
| Frontend | `@radix-ui/react-use-layout-effect` | 1.1.4 | MIT |
| Frontend | `@radix-ui/react-use-size` | 1.1.5 | MIT |
| Frontend | `@radix-ui/react-visually-hidden` | 1.2.13 | MIT |
| Frontend | `aria-hidden` | 1.2.6 | MIT |
| Frontend | `class-variance-authority` | 0.7.1 | Apache-2.0 |
| Frontend | `clsx` | 2.1.1 | MIT |
| Frontend | `get-nonce` | 1.0.1 | MIT |
| Frontend | `lucide-react` | 1.70.0 | ISC |
| Frontend | `react` | 19.3.1 | MIT |
| Frontend | `react-dom` | 19.3.1 | MIT |
| Frontend | `react-remove-scroll` | 2.7.2 | MIT |
| Frontend | `react-remove-scroll-bar` | 2.3.8 | MIT |
| Frontend | `react-style-singleton` | 2.2.3 | MIT |
| Frontend | `scheduler` | 0.28.0 | MIT |
| Frontend | `sonner` | 2.0.8 | MIT |
| Frontend | `tailwind-merge` | 3.7.0 | MIT |
| Frontend | `tslib` | 2.9.1 | 0BSD |
| Frontend | `use-callback-ref` | 1.3.3 | MIT |
| Frontend | `use-sidecar` | 1.1.3 | MIT |

## Workstream completion

Plugin remains **0.12.0**, baseline commit `d25be463718f1b5d8ab663177fc9aa248956f762`. This workstream made no production changes. Its limits above remain distinct from the parent audit's later [combined verification](verification.md).
