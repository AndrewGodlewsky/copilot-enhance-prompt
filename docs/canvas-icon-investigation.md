# Native tab icon investigation

The compact SVG works in a fresh Copilot session. The owner confirmed this on November 14, 2026, while an existing session continued to show generic squares. The Installed plugin row also displayed the SVG correctly. An existing session's logo metadata can lag behind the files served inside its canvas, so the panel's updated version number alone does not establish that the tab refreshed its logo.

## Comparison with Usage Insights

| Part | Usage Insights | Enhance Prompt |
| --- | --- | --- |
| Manifest logo | `extensions.com.github.copilot.logo` points to a small SVG | Same field points to `assets/icon.svg` since v0.1.4 |
| Canvas registration | No `icon` option or SDK mutation | Matches this setup in v0.1.5 |
| Tab identity | Plugin name is the first segment after `plugin:` in the extension ID | `plugin:enhance-prompt:enhance-prompt` identifies `enhance-prompt` |
| Installation inspected | Cached GitHub marketplace install | Live local marketplace install |
| Fresh-session tab | Owner reports working | Owner confirmed the prompt/spark logo with v0.1.4 |

The installation difference did not prevent Enhance Prompt's local install from displaying its logo in a fresh session. There is no need to reinstall from GitHub to solve this observed case.

## Actual desktop path

Inspection of the installed Copilot desktop 1.4.2 frontend established this sequence:

1. The plugin manifest declares the logo asset.
2. Copilot supplies plugin metadata, including an encoded image, to the desktop. The Installed view and a session's tabs use separate plugin inventories.
3. A session's extension tab resolves its owning plugin from the extension ID and finds that plugin in the session inventory. An ambiguous match does not select a plugin logo.
4. The tab accepts a base64 PNG or SVG data URL of at most 350,000 characters. Without an accepted image or another fallback, it displays the generic canvas icon.

In this build, the tab selector does **not** consume the canvas declaration's `icon` field. Putting a PNG path into discovery, opening events, and open-canvas state therefore never proved that the tab would use it. Version 0.1.5 removes that ineffective override and the mutation used to preserve it through the older bundled SDK.

The original PNG is 1,277,758 bytes; its encoded data URL exceeds the desktop selector's limit. The SVG is small enough. The PNG remains appropriate for the panel header and favicon, which follow a separate browser image path.

## Evidence and verification limits

- Compared the Usage Insights source and installed package with Enhance Prompt's manifest, canvas registration, and marketplace metadata.
- Inspected the installed SDK declarations and the desktop's embedded frontend files. Executed the actual extracted selector functions in an isolated Node harness: a missing plugin logo and the original large PNG produced no image candidate; the SVG was selected. Changing `canvas.icon` did not change that result. No desktop or browser automation was used.
- An isolated runtime probe showed that global and session plugin listings differ: the global listing included `installedFrom` for live plugins, while the session listing omitted it. This difference alone was not proof of a broken local-install logo path; the owner's fresh-session check ruled out that explanation for this case.
- The owner confirmed both the Installed-row logo and the fresh-session native tab. This check preceded the v0.1.5 cleanup, which keeps the same manifest and SVG.
- `npm run check` verifies the compact logo and encoded size. `npm run e2e` verifies canvas ownership and lifecycle events. Its isolated empty-mode session does not reproduce the desktop's plugin inventory, metadata enrichment, or tab rendering.

After updating logo metadata, open the installed canvas in a new Copilot session. If a new session also shows generic squares, check the Installed-row logo separately and report both results with the plugin and desktop versions. Do not assume that a favicon change or a successful SDK icon-path assertion fixes native tabs.

The frontend inspection applies to desktop 1.4.2, including its embedded `useWebSocketTransport-euwzmhb6.js` module. The integration probe used the installed runtime ending in `r43566476370.g869eef3`. These experimental host details may change; the extracted application code and scratch probes are not shipped with the plugin.
