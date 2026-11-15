# Desktop-managed Copilot rewriting

> Historical planning record. This captures the design and verification at that time; current behavior is documented in the [README](../../../README.md) and [Copilot-only plan](../plans/2026-11-15-copilot-only.md).

The owner approved reusing the desktop SDK and runtime, without npm, downloads, or a visible chat. This plan implements that direction; the native workflow failed the context-isolation check recorded in `docs/research/copilot-model-access-validation.md`.

## Contract

- Import the SDK supplied by the extension host. Reuse the executable currently running the extension, only in the recognized Copilot bootstrap environment. No PATH lookup, executable preference, downloaded fallback, or SDK dependency.
- Create a disposable, empty helper workspace and Copilot home for each request. Disable tools, plugins, hooks, skills, instruction discovery, shared session storage, memory, and automatic updates. Deny permissions. Use stdio and hide the process window.
- Read the attached session's model catalog. Offer only explicitly attributed Copilot models allowed by policy. Before inference, require the helper and attached session to resolve the same authenticated GitHub account and host, and require the selected model to exist in both catalogs. Do not copy credentials.
- Check the helper's actual working directory, offered tools, and selected model before sending. Reject missing or incompatible APIs. Copilot failures never fall back to external providers. SDK options remain an experimental integration contract, covered by local-fixture integration tests, not a promise of compatibility with every future desktop release.
- Keep existing model profiles intact. Add a Copilot preset with a live catalog, a clear billing/account explanation, and no key/endpoint/command settings. Manual enhancement and the AI context picker can use it. The two-second chat hook cannot.
- Cancellation and canvas shutdown stop only owned helper processes. Remove owned temporary state after shutdown. Image inputs use already-validated attachment bytes; no helper file reads.

## Work

1. Add tests for host-runtime discovery, account/provider/policy checks, isolation, cancellation, cleanup and fallback boundaries; implement the adapter and service seam.
2. Wire the preset, live catalog, model chain, attachments and UI. Translate changed strings into Vietnamese and Chinese.
3. Exercise the production helper against a loopback model fixture using the installed SDK/runtime. No paid generation or existing sessions.
4. Update installation/model/security documentation and workflow, bump the release version, regenerate artifacts. Run typecheck, unit tests, build, check and fixture integration tests.
5. Request a fresh whole-change review, resolve findings, commit and push verified work to main. Report the version and any remaining user-only verification.

## Verification record

- Runtime discovery and full production preflight passed inside a disposable extension using the existing account; inference was intercepted at the final send boundary. No credentials or account identifiers were saved.
- 275 unit tests passed. Typecheck, build and package checks passed. Production-helper fixture checks passed for text, images, tool/context isolation, cancellation and cleanup. The packaged-canvas fixture also passed for registration, context, enhancement, send and the hook.
- Independent review found stale selection, edited-preset catalog, hidden API key and stale hook-role cases. Regression tests now cover the fixes. No remaining code blockers; workflow documentation was corrected for vision rejection and cleanup ordering.
- Release: 0.2.0. Desktop appearance and an actual account-backed rewrite remain user validation; neither GUI automation nor paid model inference was performed.
