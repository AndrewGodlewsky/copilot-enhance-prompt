# Native tab icon investigation

**The measured failure was missing session logo metadata for the live local installation.** Switching Enhance Prompt to a cached GitHub marketplace install restored its exact SVG in both affected sessions. The plugin stayed at v0.1.5 throughout this comparison. Usage Insights already used a cached GitHub install and supplied its SVG correctly.

The earlier conclusion that opening a fresh session solved the problem was too strong. The owner did see the top-tab logo once, then reported generic squares again. The panel image and Installed-row logo also worked, but those observations did not prove that the session's tab consistently received its logo.

## Evidence from the running desktop

On November 14, 2026, a read-only query to Copilot desktop 1.4.2's local API requested `list_session_plugins` for two affected sessions. The `session_extensibility_result` responses for `session.plugins.list` contained:

| Plugin | Live local Enhance Prompt installation | After switching Enhance Prompt to GitHub |
| --- | --- | --- |
| Enhance Prompt v0.1.5 | `icon` absent in both sessions | SVG data URL, 826 characters, in both sessions |
| Usage Insights | SVG data URL, 558 characters, in both sessions | Same SVG in both sessions |

The decoded Enhance Prompt logo after the switch matched `assets/icon.svg` byte for byte by SHA-256. The same session IDs and plugin version were checked before and after. No icon code or asset changed between those measurements. This isolates the installation path as the operative difference for this failure; it does not establish the precise internal cause of Copilot's local-plugin metadata bug.

The switch used Copilot's own CLI: disable the live plugin, remove its local marketplace registration, add the GitHub marketplace, and install the plugin. A disposable configuration tested the sequence first. The source checkout remained on disk, and other marketplace registrations and plugin enabled states were checked for changes. Model settings, credentials, and history live outside the installation directory.

The desktop metadata check passes after this switch. After restarting Copilot and reopening Enhance Prompt, the owner confirmed that the very top tab beside its close button displays the prompt/spark logo. Both metadata delivery and the visible tab have now been checked.

## How the native tab chooses its icon

Inspection of the installed desktop frontend established this sequence:

1. The plugin manifest declares `extensions.com.github.copilot.logo`.
2. Copilot supplies the encoded image in plugin metadata. The Installed view and session tabs use separate inventories.
3. A session's extension tab resolves its owning plugin from the extension ID and looks it up in that session's inventory. An ambiguous match does not select a plugin logo.
4. The tab accepts a base64 PNG or SVG data URL of at most 350,000 characters. Without an accepted image or another fallback, it displays the generic canvas icon.

Both plugins now follow the same setup: a small manifest SVG and no canvas icon override. `plugin:enhance-prompt:enhance-prompt` correctly identifies the `enhance-prompt` plugin.

In desktop 1.4.2, this selector does **not** consume the canvas declaration's `icon` field. Propagating a PNG path through SDK discovery and opening events never established that the desktop tab would use it. Version 0.1.5 removed that ineffective override and its SDK declaration mutation.

The original PNG is 1,277,758 bytes and exceeds the selector's encoded-image limit. The compact SVG fixed that asset-size problem in v0.1.4. The subsequent missing-logo problem in live local installations is a separate issue. The PNG was the panel image and favicon during this investigation; v0.1.6 replaces the panel header with Quiet Desk and retains the favicon. The native tab's manifest SVG is unchanged.

## Verification boundaries

- Compared Usage Insights source and its installed package against Enhance Prompt's manifest, canvas registration, and marketplace configuration.
- Ran the installed desktop's extracted selector functions in an isolated Node harness. Missing logo metadata and the original oversized PNG produced no image candidate; the SVG was selected. Changing `canvas.icon` did not affect this result.
- An isolated SDK probe found that global live-plugin listings included `installedFrom` while session listings omitted it. That was a clue, not proof of the exact internal defect. The running desktop's missing `icon` and the successful installation switch provide the direct evidence.
- Queried the running desktop's local API without controlling its UI or sending chat messages. Diagnostic output included only the two plugin names, versions, source indicators, image types, lengths, and hashes. Credentials, image data URLs, and conversation content were not logged.
- `npm run check` verifies the packaged SVG and its encoded size. `npm run e2e` verifies canvas ownership and lifecycle events; its isolated empty-mode session does not reproduce desktop metadata enrichment or tab rendering.

## Installation guidance

Use the [GitHub marketplace installation](../README.md#install-from-github-recommended) for normal use. Existing local installs can follow the [source-switch instructions](../README.md#repair-an-existing-local-installation), then restart Copilot and reopen the installed canvas. Updating the source checkout no longer updates a cached install; use Copilot's plugin update command after changes reach GitHub.

Local marketplaces remain useful for development, with the observed desktop logo limitation. Do not treat a successful panel image, Installed-row logo, or one fresh-session result as sufficient evidence of a reliable tab icon.

The frontend inspection applies to Copilot desktop 1.4.2 and its embedded `useWebSocketTransport-euwzmhb6.js` module. The CLI probe used the installed runtime ending in `r43566476370.g869eef3`. These experimental host details may change. Extracted application code, authentication material, and scratch probes are not shipped with the plugin.
