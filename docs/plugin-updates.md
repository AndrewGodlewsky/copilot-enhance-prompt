# Plugin updates

Enhance Prompt checks for updates after its canvas renders. Automatic checks are enabled initially and run at most once per 24 hours for an installation/source. Settings → Plugin updates can disable automatic checks or request a manual check. Network failures stay out of the automatic notice; a manual check displays the failure. GitHub rate limits and repeated failures impose a retry delay (starting at one minute, growing to 24 hours). Manual checks bypass the daily cache, not that backoff; checks within five seconds of a successful result share that result.

An available update shows its version, View changes when the configured source has a changelog, Update, and Later. Later dismisses that particular version; a newer version can notify again. Settings reports the running, installed and available versions separately. Unknown or malformed metadata is never described as current.

## Installation and activation

Update is a human action on the authenticated loopback panel API. There is no update canvas action, model tool, user-supplied target, shell command endpoint or automatic installation. The backend resolves `enhance-prompt@<marketplace>` or an unambiguous direct installation and invokes the attached session’s `rpc.plugins.update({name})`. Copilot retains its account, repository context and policy. Required approvals remain Copilot’s responsibility; the plugin neither approves them nor retries a refusal through the CLI.

Before updating, the plugin re-reads installation identity, source, branch metadata and installed state. It waits for the panel’s queued saves and refuses updates while another canvas is working. Settings and data are stored separately from package files and are never copied to an update service. With Save history off, copy and clear unsaved request/result content before updating. Updating never turns draft saving on.

Cancellation returns to the caller promptly, while the underlying enhancement or model test keeps its update reservation until helper shutdown, usage reconciliation and cleanup settle. Other extension processes also observe that reservation. Retry Update once cleanup finishes (the reservation can take another second to clear). If helper shutdown fails or cannot be confirmed, this worker remains busy: inspect Show Logs and restart Copilot before retrying. Reopening only the canvas does not clear that conservative blocker. Retained usage files are not deleted to force an update through.

The SDK response alone is insufficient: the backend checks the source identity again and compares the installed manifest with Copilot’s managed record and live session inventory. Successful verification produces **Update installed; restart required** guidance. Restart Copilot and reopen the existing session and Enhance Prompt to retain the session’s saved draft. A new session loads the update too, but does not inherit another session’s draft. Closing/reopening the tab alone keeps the old extension process on the tested runtime. The plugin does not call `plugins.reload`, restart the app, close sessions, or promise a live reload.

If an update times out or its HTTP connection drops, its journal remains reserved while the owning extension process lives. Other canvases cannot start a duplicate update or new plugin work. A late result is still verified. After an interrupted process, reopening reconciles the installed files/inventory before offering any retry. A mismatch or uncertain result is reported, not cleaned up by uninstalling or replacing files. If Copilot never returns, use its Installed screen to inspect the result, then restart Copilot before retrying.

## Sources

| Installation | Behavior |
| --- | --- |
| This repository’s public GitHub marketplace | Read the configured default branch, marketplace catalog and `plugin.json`. No GitHub Releases are required. |
| Public GitHub fork | Follow that fork. Matching plugin names never redirect a fork upstream. |
| Custom branch / prerelease channel | Resolve that branch; compare its manifest with SemVer prerelease precedence. A branch/tag name collision is ambiguous and cannot update. |
| Marketplace relative plugin directory | Verify the remote catalog still selects the recorded repository/ref/subdirectory before checking its manifest. |
| Marketplace separate GitHub plugin repository | Verify its catalog source against the install-time source, then follow that source’s branch. |
| Direct GitHub repository / HTTPS GitHub repository URL | Require an unambiguous installed record, the same source, and one matching runtime inventory entry. Direct installs are deprecated by the tested runtime. |
| Pinned commit or tag | Report unavailable; leave the pin unchanged. Changing the selected source is a Copilot management action. |
| Live local marketplace, copied local install, `--plugin-dir`, built-in mount | No automatic updating. Edit/update the source using its own development workflow and start a new session. |
| Private repository, other Git host, missing provenance, disabled/missing SDK API, unknown profile/cache layout | Report the limitation. Use Copilot’s installation management; never guess an upstream or download a replacement. |

The adapter recognizes Copilot’s `installed-plugins/<marketplace>/<plugin>` and `installed-plugins/_direct/<source>` cache layout. It derives the profile from this package’s actual location, cross-checks the attached session inventory, and reads only the installation/source fields of its managed `config.json` and marketplace registration in `settings.json`. It does not edit either file. These files and the inventory API are experimental. Managed-only marketplace registrations that cannot be verified against this profile are unsupported. Unknown layouts or contracts fail closed. Commented JSON is supported; unsupported configuration syntax produces an unavailable result.

## Network, state and diagnostics

Checks make credential-free HTTPS GET requests only to `api.github.com` and `raw.githubusercontent.com`: repository default-branch metadata, selected branch refs (and tag ambiguity checks), the marketplace catalog when applicable, and this plugin’s manifest at the resolved commit. A HEAD checks for `CHANGELOG.md`; View changes links to that same commit on `github.com`. Redirects are refused, individual requests time out after eight seconds, JSON responses are capped at 128 KB, and a check has a 60-second overall deadline. A commit SHA in a branch response fixes the metadata snapshot; an installation’s source fingerprint is not mistaken for a Git commit.

These requests identify the plugin’s configured repository/source. They include no project paths/content, prompts, history, attachments, account credentials or tokens. Update itself uses Copilot’s installation machinery, which may download code from that source only after the explicit Update click. Automatic checks download no executable code and never evaluate remote content or invoke a model.

The plugin’s existing data directory contains `updates/<installation-path-hash>/state.json`. Atomic cross-process transactions store a source fingerprint, automatic-check preference, latest version/changelog link, last check/next check/retry timestamps, dismissed version, bounded failure count, and operation/check/work ownership metadata. No drafts or credentials are duplicated there. A changed source invalidates cached metadata and dismissal. An update journal and process-owned work reservations prevent duplicate installation across canvases/processes. Locks are not held during network or SDK calls.

Show Logs records `updates.check` and `updates.install` with safe outcomes/error codes. Raw SDK failures, source URLs, local paths and HTTP bodies are not logged. The Settings status gives human-readable recovery guidance.

## Reusing the implementation

The modules have distinct responsibilities:

- `src/copilot/update-installation.ts`: installation/profile resolution and source validation. Supply the joined session, actual package root and plugin name. Keep its cache/config parsing isolated when adapting to a newer host contract.
- `src/updates/metadata.ts`: validated GitHub metadata reads. `remoteMetadata` accepts plugin name, manifest/catalog paths and changelog path; network access is injectable.
- `src/updates/version.ts`: dependency-free SemVer validation and precedence.
- `src/updates/service.ts`: state decisions, daily cache, backoff, dismissal, concurrency and result verification. Supply running version, transactional storage, installation/metadata readers, attached-session update executor, active-work callback and safe diagnostics. Clock/process liveness are injectable in tests. Adapt the activation message to the other plugin’s verified lifecycle.
- `src/copilot/server.ts` and `web/src/transport.ts`: authenticated human-only methods, strict request fields and save flushing. Keep these outside the agent-facing protocol.
- `web/src/updates.tsx`: small notice and Settings controls, including reduced draft risk when saving is off. Automatic failures remain quiet.

Another plugin needs its own identity/metadata locations, package-root calculation, separate persistent store, busy-work integration, draft-flush boundary and UI. It must verify its host contract and activation behavior; copying the interface alone is insufficient. No updater framework or new dependency was added.

## Verification and limits

The Windows disposable runtime test used the desktop SDK and runtime **1.0.106-8.unstable.r43566476370.g869eef3**, protocol 3. `scripts/e2e-updates.mjs` installs only a temporary fixture into an isolated Copilot home, loads its cached extension, publishes a second local fixture version, and triggers its own update from an authenticated HTTP action. It verifies the attached extension can call the update API, both inventory and disk change, the existing process stays old, reopening its canvas stays old, and both a new session and a cold resume load the new code. No model request is sent. The owner’s live installation is not changed. Set `COPILOT_SDK_DIR` and `COPILOT_CLI_PATH` to the installed desktop pair to repeat it.

The additional opt-in `node scripts/e2e-updates.mjs --github-source` downloads this public marketplace package into the disposable profile without loading its extension, then tests the production provenance resolver and remote metadata reader against the explicit `main` branch. This also verified that the installed runtime’s human-readable marketplace source omits the branch; the structured registration and installed record retain it. Both fixture and public-source checks passed. Managed/team marketplace entries are refused because their effective source cannot be established from these user registration files.

Unit/integration tests cover SemVer, public/fork/branch/pin/local/ambiguous source decisions, metadata limits/offline/timeouts/rate limits, caching/dismissal, duplicate instances, active work, policy refusal, update mismatches/interruption, saved content and strict human-API authorization. The local fixture proves the runtime’s lifecycle and update permission, not every remote GitHub installation or enterprise policy combination. Managed refusals are tested with fixtures; no owner policy is modified.

Manual checks remain: notice/Settings layout at narrow and wide sizes, keyboard/screen-reader behavior, an actual GitHub marketplace update in the desktop, and app restart → reopen existing session confirming the new footer version and preserved draft. No desktop or browser UI was controlled for this work. VS Code is outside scope. [Research and current official references](copilot-update-research.md).
