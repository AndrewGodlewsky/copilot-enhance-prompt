# Copilot background rewrite validation

Validated 2026-11-14 with the installed desktop SDK and runtime `1.0.106-8.unstable.r43566476370.g869eef3`, initially against plugin **0.1.7**. An independent icon update advanced the plugin to **0.1.8** before these findings were merged. This work validates integration choices; it does not change the shipped rewrite providers or bump the plugin version.

## Decision

**Use a dedicated headless SDK session for the next implementation.** The owner authorized trying the native workflow first and pivoting if it did not meet the requirements. A history entry is acceptable; opening or focusing a new window is not.

The native workflow runs successfully, but the installed runtime adds the parent's project path and a directory listing to its subagent request. That bypasses Enhance Prompt's context selection and redaction. The exposed workflow agent options and custom-agent configuration have no per-agent control to remove this environment block. Changing the parent session's configuration would affect the user's conversation and is not an acceptable workaround. This limitation concerns the tested runtime and public controls, not every possible future implementation.

## Evidence from disposable sessions

Every generation request in these experiments used a loopback HTTP fixture. No paid model was called, no existing session was used, and no desktop automation was performed. Synthetic markers were placed in a temporary project, parent conversation and parent system instructions. The fixture recorded what the runtime actually sent.

| Check | Native workflow | Separate headless SDK session |
| --- | --- | --- |
| Return generated text programmatically | Passed | Passed |
| Select a model different from the parent | Passed | Passed |
| Leave the parent's model unchanged | Passed | Passed |
| Expose no tools to the rewriting model | Passed with custom agent `tools: []`, even when parent tools were enabled | Passed with session `availableTools: []` |
| Exclude parent conversation and instructions | Markers absent; parent control request contained them | Separate session; exact outgoing messages checked |
| Exclude unselected project metadata | **Failed:** project path and synthetic filename appeared | Passed: no path, directory listing, file content or instruction markers |
| Cancellation | Cooperative workflow ended as `cancelled` | Aborting closed an in-flight model HTTP request |
| No new desktop window or focus change | Not visually verified | Not visually verified |

The headless request contained exactly the replacement system prompt and the supplied user request, with a runtime-added timestamp. Its working directory deliberately contained synthetic instruction and filename markers to verify they were excluded, rather than relying only on an empty directory. Production should still use an empty temporary working directory and the plugin's existing context/redaction pipeline.

The disposable plugin required the Agent Plugins `$schema` declaration for discovery. Once corrected, extension registration and native workflow execution succeeded. This was a probe setup issue, not a workflow startup defect.

## Authentication check without generation

A separate no-inference experiment used the existing GitHub CLI login in a disposable parent session. A native workflow that only returned a JSON fixture completed successfully. The attached session's model catalog returned 15 entries.

From inside that extension process, after the host had applied its normal environment filtering, a second SDK client in `mode: "empty"` authenticated through GitHub CLI. Its disposable session also returned 15 catalog entries. Comparing the two `resolvedAuthLogin` values in memory confirmed the same resolved account; only the boolean comparison and counts were recorded. No token values were read, copied or logged.

This proves that account/catalog access works in this machine's **GitHub CLI login configuration**. It does not prove support for desktop-only keychain credentials or that a separately selected desktop account matches that login. Empty mode disables keychain access. Production must compare the attached and helper session identities, fail clearly on a mismatch or missing identity, and never silently use another account, BYOK provider, Claude Code, or an externally billed API.

## Repeat the local contract checks

Set `COPILOT_SDK_DIR` and `COPILOT_CLI_PATH` to the installed desktop SDK directory and runtime executable, then run:

```sh
node scripts/e2e-model-access.mjs
```

The script creates temporary plugin, project and session data, runs both paths against a local fixture, reports native metadata inheritance, and checks headless isolation and cancellation. It deletes only its disposable sessions and temporary directory. It does not run the account comparison, call a paid model, modify installed plugins or enable the new provider. No request payloads or credentials are written to the repository.

## Implementation boundary and remaining checks

The next product change should add a clearly named GitHub Copilot provider, discover the allowed first-party models through the attached session, and validate that the helper uses the same account and route. The helper should use no tools, configuration discovery, skills, file hooks, extensions, memory or cross-session retrieval; replace its system message; and accept only the prepared prompt and permitted context. A run must own its session, timeout and cancellation, including cancellation when its canvas closes. Rewriting and sending to the active conversation remain separate actions.

Still pending: real Copilot inference through the intended account, desktop window/focus behavior, plugin lifecycle integration, failure handling and user-facing model/account configuration. The project forbids paid-provider test traffic; use the fixture for automated checks. Actual account-backed use needs a deliberate owner-run validation after the integration is available. The chat auto-enhance hook remains a separate latency/recursion problem.

Sources: [initial source-cited research](copilot-model-access.md), [reproducible installed-runtime contract check](../../scripts/e2e-model-access.mjs), and the installed SDK's `extension.d.ts`, `workflow.d.ts`, `types.d.ts` and `docs/workflows.md`. The experiments settle the installed behavior; public documentation alone does not establish desktop presentation or account equivalence.
