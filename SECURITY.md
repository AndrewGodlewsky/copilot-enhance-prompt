# Security policy

Enhance Prompt is a preview GitHub Copilot desktop plugin. Its local extension can read permitted project files, store drafts/history, and launch the installed Copilot runtime for model work. It is not an OS sandbox. See [data and privacy](docs/privacy.md), [what ships](docs/distribution-components.md), the [runtime inventory](runtime-inventory.json), and [third-party notices](THIRD_PARTY_NOTICES.md).

## Report privately

[Report a vulnerability privately on GitHub](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/security/advisories/new). Sign in to GitHub to use that form. Private vulnerability reporting was enabled and rechecked through GitHub's API on 2026-11-17; the public reporting route returned HTTP 200. No test vulnerability report was submitted. Notification delivery and the desktop instructions below still need owner confirmation.

Use [public issues](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/new) for ordinary bugs and feature requests. For a suspected exposure, permission bypass, unsafe file access or code execution, use the private route. If it is unavailable, open a public issue asking only for a private contact route, without exploit details or confidential content.

Include affected plugin and Copilot versions, OS, installation source/channel, expected versus actual behavior, impact, and minimal reproduction steps using synthetic data. Review **Show Logs** before attaching its report. Do not include credentials, actual private prompts, project contents, raw helper journals, or complete configuration files. Share only the minimum evidence needed. Reports remain within GitHub's advisory access controls; avoid unnecessary sensitive material even there.

## Supported versions and maintenance

Security fixes target the newest published preview version. Older previews, forks, modified builds and arbitrary main-branch commits have no separate backport promise. Report issues in any version, but expect to update to a reviewed fixed version. A new version is not automatically evidence that a reported vulnerability is fixed: consult its advisory and release notes. There is no stable v1 or long-term support line yet.

AndrewGodlewsky owns private-report triage, dependency alerts, patch review and advisories. Support is best effort, with no guaranteed response or fix deadline. A numeric acknowledgement target and notification delivery are awaiting maintainer confirmation. The [maintenance procedure](docs/maintenance.md) calls for at least weekly alert review. Do not assume silence means a report was dismissed; follow up in the private report.

For a confirmed issue, determine affected versions and reachable components, advise users whether to pause, coordinate a private fix and regression test, build and verify the exact release commit, then publish clear affected/fixed-version and recovery guidance. Keep raw reports private until coordinated disclosure. There is no automatic compensation/bounty commitment.

## Pausing and recovering

1. Stop using Enhance Prompt for sensitive work. If practical, cancel an active enhancement and let cleanup settle. **Closing the canvas cancels its work but does not prove its loaded backend has stopped.** If you suspect malicious execution, quit Copilot promptly rather than waiting to collect diagnostics.
2. In Copilot desktop, open **Customize → Installed**, find **Enhance Prompt**, and turn its plugin switch off. Fully quit Copilot, including any background instance, then reopen it. Check that the plugin cannot be opened. Menu wording can vary; these desktop steps await manual confirmation in issue #11. This document does not claim that clicking the switch immediately terminates a running worker.
3. Keep drafts, history and usage data intact. Turning off **Automatically check for updates**, context switches or Save history is not a plugin pause. Do not use **Delete everything**, uninstall unrelated plugins, or erase raw journals as an incident-recovery step. Settings → Retry usage recovery only retries verified stopped journals; it does not pause the plugin.
4. Read the security advisory/release notes. Update through Copilot's installed-plugin management while the plugin is disabled when supported. The plugin's own **Settings → Plugin updates** works only while it is running; do not re-enable a suspected vulnerable copy merely to use that button. If host policy blocks a change, ask the organization administrator; do not bypass it with another route.
5. After a fixed version is verified in the installed-plugin row, re-enable it, fully quit/reopen Copilot, and reopen the same session to retain its draft. Check the footer version and your saved data before continuing. Simply reopening a canvas left the old backend loaded in the tested runtime. The restart/same-session outcome is verified with a disposable SDK process, not desktop UI automation.

The documented CLI alternative is `copilot plugin list --json`, then `copilot plugin disable <installed-name>` or `copilot plugin enable <installed-name>`. For the ordinary marketplace install the qualified name is `enhance-prompt@copilot-enhance-prompt`; direct installs and forks can differ. Use the actual desktop-compatible executable, account and `COPILOT_HOME`. Do not use an isolated model-helper profile, assume a shell's default profile is the desktop's, or bypass a managed/repository-policy refusal. A `--plugin-dir` mount has no persisted activation switch. [Official command and policy reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).

`scripts/e2e-security.mjs` verifies direct local install → disable → enable in a disposable profile using the installed runtime, with separate CLI processes and a retained data sentinel. It uses no model or owner installation. This proves persisted activation behavior, not GUI presentation, instant shutdown or every marketplace/policy configuration. Tested Windows x64 runtime: `1.0.106-8.unstable.r43566476370.g869eef3`.

## Update the affected component

| Component | Recovery route |
| --- | --- |
| Plugin code or bundled React/CSS/backend libraries | A reviewed Enhance Prompt update through Copilot; users do not run npm to patch installed bundles. |
| Copilot SDK, executable, authentication or desktop | Update GitHub Copilot through its supported application update mechanism; the plugin does not ship replacements. |
| Development-only compiler/build tools | Maintainer updates locks and rebuilds in the verified builder; do not ask end users to install build tools. |
| Potentially exposed account credential | Rotate/revoke through the credential provider and follow organization incident procedures; deleting plugin history cannot revoke a token. |

Rollback requires maintainer review of the exact source/ref, security fixes and storage compatibility. Do not automatically reinstall an older version or overwrite user data; an older copy may reintroduce the issue. Preserve a private backup according to your organization's policy before a reviewed migration. [Updater verification and interrupted-update recovery](docs/plugin-updates.md) and [retained usage recovery](docs/privacy.md) describe what the plugin can and cannot reconcile automatically.

GitHub references: [private reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately), [maintainer report management and notification requirements](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/manage-vulnerability-reports).
