# Enhance Prompt for GitHub Copilot: original migration assessment

**Implementation update, November 14, 2026:** the native canvas port, local marketplace package, storage and session adapters, and command-based transformed-prompt hook are now implemented. Unit and installed-runtime integration checks have passed; desktop visual verification remains unfinished. The sections below preserve the initial assessment and its then-open questions. For current behavior and installation, read the [README](../README.md) and [end-to-end workflow](prompt-workflow.md).

**Language update, November 14, 2026:** references below to language selection, translation work and localized release links describe the original migration scope. Version 0.3.0 uses an English interface and English rewritten instructions; follow the current README and workflow for active guidance.

Assessment date: 2026-11-14. Target confirmed: the GitHub Copilot desktop app.

The prompt engine and React interface are reusable. The host integration must
be replaced before this repository is an installable Copilot plugin. The
chosen approach is a native canvas extension that preserves the visual
workflow. The owner selected this approach. This document records findings;
the implementation design is in
`superpowers/specs/2026-11-14-copilot-canvas-design.md`. The migration is not
yet implemented.

## What the project does today

1. The React panel collects a rough request, style, context level, language,
   optional attachments, model choice, and project rules.
2. `src/panel/actions.ts` sends typed requests defined in `src/protocol.ts` to
   the worker. Panel state and behavior are separate from React rendering.
3. `src/worker.ts` resolves the project and privacy settings, gathers context,
   reads explicitly attached files, builds the model instructions, and runs a
   model chain with timeout and fallback behavior.
4. `src/context/` supplies project instructions, stack information, file
   candidates, selected source excerpts, and optional git/activity context.
   File reads reject sensitive paths and links outside the project. Content
   sent to models is masked before it is truncated.
5. `src/prompts.ts` controls rewrite behavior and styles. `src/llm.ts` calls
   configured HTTP providers; `src/cli.ts` supports subscription CLIs in an
   isolated temporary directory. `src/models.ts` selects models and fallback.
6. Results return to the panel for review, editing, copying, saving, or an
   explicit send. History, rules, model settings, keys, and preferences depend
   on host-provided persistence. Optional automatic enhancement intercepts
   outgoing prompts through a host hook.

The current manifest declares one panel, six commands, one status item,
three hooks, two events, and 35 settings. The test runner, generated types,
development bridge, release scripts, documentation, and screenshots also
depend on the original platform. A text rename alone cannot migrate them.

## Confirmed Copilot extension facilities

GitHub's current desktop documentation supports plugins containing skills,
hooks, custom agents, MCP servers, and canvas extensions. Canvases open in the
right side panel and expose actions to the agent.

The SDK bundled with the installed GitHub Copilot app was also inspected:

- `createCanvas` and `joinSession` register an extension-owned canvas.
- Canvas callbacks include the session and canvas instance identity.
- A canvas returns a loopback URL; the interface talks to its own extension
  server. There is no equivalent privileged browser-to-host bridge to reuse.
- The session exposes `send`, events, and programmatic prompt hooks.
- The extension runtime supplies the SDK; the shipped entry point must be
  JavaScript supported by that runtime. The current TypeScript worker cannot
  be shipped unchanged and expected to be transpiled by Copilot.
- Persisted data must have a stable project, session, or user identity. A
  transient canvas instance ID or changing loopback origin is insufficient.

These are documentation and type-contract findings. No extension has yet been
loaded, no model call has been made, and no message has been sent in Copilot.

## Migration map

| Existing responsibility | Proposed Copilot implementation | Still to establish |
| --- | --- | --- |
| Visual prompt editor and result | Reuse the React interface in a native canvas | Verify rendering and interaction in the desktop app |
| Panel requests and progress events | Authenticated loopback endpoints and event stream | Cancellation, reload, and close behavior |
| Focused project and terminal selection | Bind operations to the attached Copilot session and its actual project directory | Exact project-directory API; the SDK session artifact directory is not the source repository |
| Prompt generation | Reuse the prompt builder and provider chain | Whether Copilot itself should be the default rewrite model |
| Terminal paste and Enter | Reviewed, explicit handoff to the attached Copilot session, plus Copy | Session busy/blocked behavior and duplicate-send prevention |
| Settings, rules, history, drafts | Durable user/project storage owned by the plugin | Concurrent sessions and project isolation |
| Saved API keys | Secure credential storage or explicitly configured environment credentials | Available supported key-store integration; never silently replace it with plaintext files |
| Automatic prompt rewriting | Copilot programmatic prompt hook, off by default | Runtime behavior, timing, recursion prevention, and cancellation |
| Other terminals and editor activity | Adapt only where supported and meaningful in Copilot | No feature-equivalence assumption |
| Packaging and discovery | Copilot plugin manifest, canvas extension, marketplace metadata | Verify against installed desktop discovery |
| Tests and release checks | Independent test runner, build, package checks, desktop smoke test | Port host-dependent tests while preserving behavioral coverage |

## Approaches to choose from

**Native canvas port (recommended).** Preserve the editor, result, styles,
context controls, rules, models, and history. Replace platform services with
real Copilot integrations. This best matches the request to turn the existing
plugin into a desktop plugin. Host-specific controls need adaptation rather
than merely different labels.

**Chat skill.** Package the enhancement instructions and context workflow as a
skill invoked in conversation. This is substantially smaller, but it replaces
the current visual workflow and does not preserve the settings, model chain,
and history interface as a product.

## Cleanup and verification requirements

- Replace the original platform's package identity, manifest, runtime imports,
  generated types, test imports, scripts, development bridge, installation
  instructions, translations, release links, and obsolete screenshots.
- Keep the Enhance Prompt name and the existing MIT copyright notice.
- Update the repository's contributor instructions to describe the new host
  and checks. Old host-specific rules must not become fictional Copilot APIs.
- Preserve privacy switches, safe project file reads, secret masking,
  attachment validation, review before sending, and project isolation.
- Update English, Vietnamese, and Chinese UI strings together.
- Scan tracked source, generated assets, documentation, and filenames for
  old-platform references after migration. Git history and the workspace's
  physical parent directory are separate from the plugin's shipped contents.
- Test the real session handoff and canvas lifecycle in the desktop app,
  in addition to unit and integration tests. Document any unverified feature.

## Sources

- [Customizing the GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app)
- [Working with canvas extensions](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions)
- [Plugin and marketplace reference](https://docs.github.com/en/copilot/reference/plugin-and-marketplace-reference)
- [Creating a plugin](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)
- [SDK extension authoring guide](https://github.com/github/copilot-sdk/blob/main/nodejs/docs/agent-author.md)
- Installed app references: `copilot-sdk/canvas.d.ts`, `extension.d.ts`,
  `session.d.ts`, `generated/rpc.d.ts`, `docs/extensions.md`, and the app's
  bundled `create-canvas/SKILL.md`. Desktop behavior must be checked against
  the installed runtime rather than assumed from CLI documentation alone.
