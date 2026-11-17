# Managed-account compatibility gate

**Managed enterprise compatibility is unverified.** Keep [#30](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/30) open. The current runtime accepts an unauthenticated helper session with managed settings enabled; that observation does not establish policy enforcement or authorize inference. Enhance Prompt separately checks matching authenticated accounts and eligible catalogs before sending input.

## Evidence, 17 November 2026

[Sanitized observation](audits/v1/managed-policy-observation.json) records the runtime version and installed declaration SHA-256. No raw errors, account names, paths or tokens are published.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Installed SDK `types.d.ts`, `SessionConfigBase.enableManagedSettings` | Declaration requires a session token and describes expected rejection if absent. | Actual personal or managed runtime behavior. |
| Installed SDK `index.js`, create-session forwarding | Options are forwarded; the plugin does not explicitly supply a session token/provider. | Whether the runtime resolves stored identity into policy credentials later. |
| Credential-free bootstrap probe | On SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3`, both managed-settings-off control and managed-settings-on session were created; both reported unauthenticated. No inference or credentials. | A policy bypass: no account, organization, policy fetch or authorized model request was involved. |
| Production adapter regression tests | Missing/mismatched accounts, denied/unknown catalogs, wrong workspace/tools/model/reasoning prevent inference in controlled fixtures. | Live enterprise policy delivery, entitlement or token refresh. |
| Installed runtime local-provider fixture | Empty helper/tool configuration, prepared content, reasoning, cancellation and accounting work with synthetic account/catalog and loopback inference. | Copilot account policy, credits or personal/managed login; provider override is test-only. |

The declaration and runtime differ at this unauthenticated bootstrap boundary. Do not turn this into a claim that existing personal rewriting is broken, or that enterprise checks are complete. A no-secret **Check connection** can check the attached account/catalog; it cannot attest successful helper authentication and policy enforcement without testing that helper under the relevant account.

## Current safeguards

The production helper reuses the desktop SDK/runtime, starts in an empty owned directory, disables discovery/tools/hooks/extensions/MCP/skills/memory/shared-session retrieval, denies permissions, and uses managed settings/model enforcement options. It checks actual workspace, empty tools, requested model/reasoning and matching authenticated GitHub login/host in parent and helper, then checks identities again before input. Unknown or denied models fail closed. SDK exception text is sanitized. The helper still runs with the OS user's privileges; these options are not an operating-system sandbox.

Do not fix a policy refusal by turning managed settings off, approving a permission, copying tokens into the panel, enabling another provider, changing account/host, or using a different runtime. Existing Copilot fallback profiles must pass the same checks. No credential extraction or policy change is introduced by this research.

## Owner/administrator evidence needed

Use a disposable approved test account/project. Record only runtime/plugin versions, account class and sanitized stages/codes, never login, tokens, raw SDK exceptions or journals. Obtain a separate allowance budget before Enhance/Test; account discovery alone is not inference proof.

1. Personal account: record account/catalog check, then one authorized helper result with advertised reasoning. Repeat after ordinary credential refresh if applicable.
2. Managed account: administrator supplies an allowed model and a denied model plus expected managed restrictions. Confirm the allowed path and refusal separately; do not change a real organization's policy for this test.
3. Check account/host change and expired/revoked credentials in a dedicated test setup. Prepared content must not go to a mismatched or unauthenticated helper. Record failures as failures, not fallback success.
4. For a bootstrap failure at `copilot.session` or later policy refusal, use sanitized Show Logs and have the administrator verify policy/account assignment. Keep the plugin paused if policy enforcement is uncertain. Report the specific SDK/runtime to maintainers; do not bypass the policy.

Only Windows x64 and the runtime above have this local fixture evidence. Desktop 1.4.2 is executable metadata, not an acceptance test. Later runtimes, other platforms and real managed accounts remain unverified. Repeat the isolated fixture and relevant account matrix after desktop SDK updates. Future token-provider integration requires a documented host-supported credential handoff and separate security review; extracting stored credentials is not an acceptable shortcut.

## References and reproduction

GitHub's [SDK authentication guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate) describes stored credentials and explicit/session authentication. Its logged-in-user fallback switch disables stored/GitHub CLI credential discovery; this probe sets it false and removes inherited auth environment variables. These public instructions do not override the installed runtime observation. [Multi-tenancy guidance](https://github.com/github/copilot-sdk/blob/main/docs/setup/multi-tenancy.md) concerns session identity/isolation; this plugin is a desktop integration, not a shared service.

Run `node scripts/e2e-managed-policy.mjs` with `COPILOT_SDK_DIR` and `COPILOT_CLI_PATH` pointing at the already installed desktop SDK and compatible CLI. It creates only an owned temporary home/workspace, supplies no tokens, disables logged-in fallback, redirects proxy-aware outbound traffic to an unused loopback endpoint, never calls send/model APIs, and stops only its own client. It prints allowlisted outcomes and a declaration hash. This is an observation probe, not a policy-compatibility pass. No model allowance is used; no owner installation or saved data is changed.

Use the [desktop matrix](desktop-acceptance.md), [helper contract](copilot-background-rewriting.md) and [privacy guide](privacy.md) alongside these limits.

Only share the probe's stdout JSON after a successful exit and manual inspection. Raw stderr, startup/status/shutdown failures and SDK console output are not sanitized by this developer probe; keep them private. Do not publish a combined console transcript. Production Show Logs has its own allowlist and is unchanged.
