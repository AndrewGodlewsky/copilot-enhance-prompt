# Enhance Prompt: GitHub Copilot desktop port

Status: approved by the owner on 2026-11-14. The owner selected a native
canvas with the existing panel and features and authorized implementation.

## Outcome

Install this repository as an Enhance Prompt plugin in the GitHub Copilot
desktop app. Open its canvas, write a rough request, choose context and style,
enhance it with a configured model, inspect or edit the result, and explicitly
send it to the attached Copilot session. Preserve the model configuration,
rules, history, attachments, privacy controls, and translations.

The repository should describe and build a Copilot plugin. Remove the original
host's references from shipped source, generated output, assets, filenames,
documentation, package metadata, and scripts. Preserve the MIT copyright
notice. Do not rewrite Git history, rename the user's checkout, change Git
remotes, publish a release, or modify unrelated installed plugins.

## Approaches

The owner selected the **native canvas** approach because it preserves the
existing visual workflow. The alternative was a **chat skill**, with a smaller
implementation but no equivalent visual model/settings/history interface.
A standalone companion application is unnecessary: the installed Copilot app
supports extension-owned canvases directly.

This is a substantial platform port. Reuse the prompt and model logic and
React components; replace the host boundary and tests that exercise it.
Avoid a large imitation of the original host API.

## User experience

Keep the existing tab layout and primary flow:

```text
Enhance Prompt                          [Current Copilot session]
Enhance | Models | Rules | History | Settings

Rough request
[Style] [Context] [Language] [Model] [Attachments]
[Enhance]       Progress / context preview

Enhanced prompt, editable
[Copy] [Save] [Send to Copilot]
```

The canvas belongs to the session that opened it. Switching the app's visible
session must not retarget an existing canvas. Show the project/session
identity in the panel. Follow the app's documented theme tokens. Keep English,
Vietnamese, and Chinese translations and the Enhance Prompt brand.

## Architecture

### Plugin and runtime

Use a root `plugin.json` with the Agent Plugins schema, the stable plugin name
`enhance-prompt`, and this fork's repository metadata. Package the canvas under
`com.github.copilot/extensions/enhance-prompt/` and provide a marketplace
catalog for desktop discovery. Confirm the installed app recognizes this
layout before proceeding with the rest of the port.

The extension joins its existing session through
`@github/copilot-sdk/extension`, registers a `createCanvas` declaration, and
owns its lifecycle. Build backend TypeScript into JavaScript for the extension
entry point and bundle the existing web UI. Commit the runtime assets needed
for installation from the repository; users must not need a development build.
Use the SDK supplied by Copilot rather than shipping a conflicting SDK copy.

Define a small typed service interface for what Enhance Prompt needs:
project identity, session state and send, settings, storage, secrets, progress,
and optional host capabilities. Move panel state primitives into project-owned
code. Shared business logic must not import the previous host's runtime.

### Canvas transport

The extension serves the compiled UI and request/event endpoints on
`127.0.0.1` at an ephemeral port. Authenticate access with an unguessable
per-instance token, validate request origins and inputs, restrict static paths,
bound request sizes, and keep credentials out of URLs and logs. The renderer
uses HTTP requests and server-sent events; it has no privileged host bridge.

Keep `src/protocol.ts` as the typed contract, adapted to the actual service
operations. Cancel enhancement on explicit cancel, canvas close, or lost
ownership. Closing one canvas must not cancel another canvas's work. Clean up
event subscriptions, requests, and servers when the extension disconnects.

Agent-callable actions may open/populate the canvas, inspect state, preview
context, and request an enhancement. Only the human's UI action may authorize
session submission or enable automatic sending. Tool invocation is not proof
of a human click. Reuse the same validation and privacy checks for both paths.

### Context and project identity

Use the attached session's actual working directory, resolved through a
documented session/runtime contract. `session.workspacePath` is an artifact
directory and must not be treated as the source repository. Verify this
distinction with the installed runtime.

Keep the context levels, exclusions, instruction-file readers, relevant-file
selection, stack detection, git collection, budgets, and secret masking.
Include `.github/copilot-instructions.md`, which the existing reader already
supports. All project-file reads continue through `readText`.

Use a canonical project path for ownership and persistence. Project names are
labels, not unique identities. Project ambiguity holds back sending and
project-specific data rather than selecting another project by name.

### Model execution

Preserve the existing API providers, custom endpoints, subscription CLIs,
profile ordering, live catalogs, model overrides, fallback, timeout budgets,
isolated CLI working directory, and cancellation. Preserve rewrite semantics
in `src/prompts.ts`; add Copilot to relevant target-agent guidance.

For this port, Copilot is the destination agent and the existing configured
providers remain the rewrite engine. Do not silently route requests through
the main Copilot conversation or assume that its subscription exposes a
general completion API. A native Copilot rewrite provider is a separate
product decision if the owner wants it; it is not necessary to preserve the
existing functionality.

### Sending and automatic enhancement

Replace terminal paste/Enter controls with an explicit **Send to Copilot**
action directed to the attached session. Copy remains available. No terminal
emulation, keystroke injection, or arbitrary shell command represents a send.

Check session identity and state immediately before sending. Refuse a send
when the session is working, blocked on user input, closed, disconnected, or
its state cannot be established. Preserve the draft/result for review. Do
not queue a result that might later answer a confirmation. Verify that the
runtime's send semantics make this check effective; if no safe atomic path
exists, keep sending unavailable and bring that limitation to the owner.

Keep the opt-in enhance-and-send flow: capture draft, session, project,
settings, and run identity when enhancement starts; recheck them when it
finishes. Send the run's own result only once and only if nothing changed.

Implement automatic enhancement using the extension's programmatic prompt
hook, off by default. Preserve rules-only and AI modes, original prompt on
failure, nonempty output, bounded execution, and prevention of re-enhancing
prompts produced by this panel. Do not assume shell hook output can rewrite
a prompt. Verify hook timing and cancellation against the installed app.

### Persistence and credentials

Keep preferences, model profiles, rules, history, undo, and drafts in durable
plugin-owned storage under the user's Copilot data directory. Partition
project data by canonical path and session drafts by stable session identity.
Storage must survive a changing loopback port and extension restart. Serialize
writes safely across concurrent extension processes; test concurrent history
and settings updates.

Credentials use an OS-protected store. On Windows, DPAPI-protected storage is
an acceptable implementation; send secret material through process input,
never command arguments. On platforms without an available secure store,
report that saved keys are unavailable and retain supported CLI/environment
options. Never silently fall back to plaintext key storage. Environment
access also obeys the plugin privacy setting and the host's explicit grant.

Keep existing attachment upload limits, byte-based image identification,
private temporary storage, path validation, expiry, image-provider handling,
and inclusion of attachment paths in the enhanced prompt. Project files and
attachments have distinct read authorization.

## Host-specific feature mapping

| Original behavior | Copilot behavior |
| --- | --- |
| Panel entry point and status shortcut | Discoverable canvas and documented open flow |
| Choose a terminal destination | Show the canvas's attached session; send only there |
| Paste with optional Enter | Explicit Send to Copilot; Copy for manual insertion |
| Launch a different CLI agent | Capability-dependent new-session handoff; do not silently start a different application |
| Read terminal scrollback | Only supported, explicitly authorized session context; do not label chat events terminal output |
| Read other agents' activity | Off by default; enable only with a supported, scoped runtime API and existing privacy checks |
| Observe editor saves | Use a supported event if available; otherwise explain unavailability |
| Native save dialog | Supported host integration or a browser download with a clear success/failure result |
| Desktop notifications | Supported host notification integration, with in-panel completion always available |

The implementation must explicitly audit this table. Unsupported host
capabilities must be described honestly and cannot be marked implemented by
returning mock data. If a listed capability has no acceptable equivalent,
present the specific loss and proposed UI treatment to the owner before
declaring the full port complete. Core enhancement, model configuration,
context controls, rules, history, attachments, and reviewed session sending
are required for completion.

## Cleanup and contributor workflow

Replace the old manifest, generated-type dependency, host imports, runtime
global, test harness, CLI scripts, development bridge, and release tooling.
Update `AGENTS.md` to the new architecture and test/build commands while
retaining the behavioral and privacy invariants. Update install instructions,
translations, changelogs, repository links, and all screenshots that still
show the original platform. Start the fork's release notes without implying
historical upstream releases were Copilot releases. Keep upstream history in
Git. Do not push or publish during the migration.

Retain a browser development mode with sample data clearly separated from
production. Port tests to a normal JavaScript/TypeScript runner and test the
real project-owned panel store. Delete obsolete host-shape tests only when
their applicable behavior has equivalent coverage in the new architecture.

## Verification and completion

1. Verify package discovery, SDK loading, canvas open, and reload in the
   installed desktop app before expanding the integration.
2. Run meaningful tests for context privacy, secret masking, path boundaries,
   attachment handling, provider fallback, cancellation, persistence, and
   project/session isolation.
3. Test reviewed and automatic sends, including edits during enhancement,
   blocked/busy sessions, disconnect, close, duplicate action, and switched
   visible session. Never use live user confirmations as test targets.
4. Build and type-check the backend and UI without the old host installed.
   Test packaged output, not just development source.
5. Inspect the canvas in the real app and the browser preview; use Brave for
   browser automation. Check narrow layout, supported themes and languages,
   keyboard actions, model editing, attachments, rules, history, and reload.
6. Verify a real enhancement with an available configured provider and an
   explicit send in a dedicated harmless test session. Do not claim live
   verification when credentials or app interaction prevented it.
7. Scan tracked text, filenames, generated bundles, and images for original
   platform references. Preserve license attribution and Git history.

Success means an installable native desktop canvas with the preserved core
workflow, truthful capability handling, reproducible build, passing relevant
tests, and documented desktop verification. A renamed repository or a
mock-backed panel is not sufficient.

## Builder decisions and evidence

The builder may choose the test runner, bundler, module boundaries, storage
format, secure-store implementation, and transport details consistent with
the constraints above. Target verification on the user's Windows installation;
do not claim macOS/Linux runtime testing without running it.

The platform APIs are experimental. Confirm actual signatures in the bundled
SDK before implementation. See the linked sources and repository findings in
[the migration assessment](../../copilot-migration-assessment.md).
