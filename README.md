# Enhance Prompt for GitHub Copilot

Turn a rough request into a clear prompt using the project's files, rules and Git changes. Review the result in a native GitHub Copilot desktop canvas, then send it to that canvas's attached session.

[![End-to-end flow: user text and allowed context become a rewrite request; the configured model returns a prompt for review and delivery to Copilot. A separate optional hook transforms chat prompts.](docs/assets/prompt-workflow.svg)](docs/assets/prompt-workflow.svg)

[Read the complete workflow and editable diagrams](docs/prompt-workflow.md). The rewriting model produces the task prompt; Copilot receives that prompt and does the work. Optional chat auto-enhance changes the model-facing text while the visible chat keeps your original message.

The React panel retains model chains and fallback, prompt styles, reusable rules and structures, attachments, context preview, history, and English, Vietnamese and Chinese translations. Copilot is the destination; rewriting uses the API or subscription CLI models you configure in **Models**.

[Tiếng Việt](docs/readme/README.vi.md) · [简体中文](docs/readme/README.zh-CN.md) · [User guide](docs/user-guide.md) · [Changes](CHANGELOG.md)

## Download and install

**Development preview, version 0.1.2.** The `main` branch contains the Copilot plugin, including its built extension and panel. Install it from GitHub or download a local copy using the instructions below. The package includes the root `plugin.json` and `com.github.copilot/` directory.

### Requirements

- [GitHub Copilot desktop](https://github.com/features/copilot) with canvas extension support, signed in to your account. This port targets the experimental SDK bundled with the Windows app on November 14, 2026.
- Node.js **22.18 or newer** on `PATH`; the packaged chat hook starts `node`.
- Copilot CLI available as `copilot` for the command-line installation below. If the command is missing, follow [GitHub's CLI setup instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-getting-started).
- One rewrite model: an API provider, a local model endpoint, or an installed and authenticated subscription CLI. Configure it after installation. External API costs belong to that provider, separately from Copilot.

Windows supports encrypted saved API keys through DPAPI. On other systems, use a key available in the extension's environment or a subscription CLI; saved keys are unavailable. Desktop environments may omit shell environment variables. Other platforms have not been verified.

### Get the plugin folder

If you already have this Copilot checkout, use it directly. Otherwise, [download the main branch as a ZIP](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/archive/refs/heads/main.zip) and extract it, or clone it with Git:

```sh
git clone --branch main https://github.com/AndrewGodlewsky/copilot-enhance-prompt.git
```

Built extension and panel files are included; users do not need `npm install` or a build step.

### Add the local marketplace, then install

Open PowerShell in the extracted repository root, the folder containing `plugin.json`. Run:

```powershell
copilot plugin marketplace add (Get-Location).Path
copilot plugin install enhance-prompt@copilot-enhance-prompt
copilot plugin list
```

The first command registers the marketplace. The second installs and enables the plugin. Check that `enhance-prompt` appears in the list. From another shell, replace `(Get-Location).Path` with the quoted absolute path to the folder.

Keep that folder: plugins installed from a local marketplace load directly from it. To use changes, start a new session or restart the existing one. [GitHub's plugin command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).

### Install from GitHub

You can add the repository without downloading it yourself:

```sh
copilot plugin marketplace add AndrewGodlewsky/copilot-enhance-prompt
copilot plugin install enhance-prompt@copilot-enhance-prompt
```

To select a published branch or tag, use `"AndrewGodlewsky/copilot-enhance-prompt#COPILOT_REF"` as the marketplace source. Use either the local or GitHub marketplace source for this name; you do not need both.

The desktop route is **Customize → marketplace settings** next to the marketplace dropdown. Add `https://github.com/AndrewGodlewsky/copilot-enhance-prompt.git`, find **Enhance Prompt** under Browse, and click **Install**. [GitHub's desktop installation guide](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app#adding-plugins).

### Open the canvas

In **Customize → Installed**, check that Enhance Prompt is enabled. Open a session for your project, then ask Copilot to **open the installed Enhance Prompt canvas**. You can also look for it in Customize's Canvas view. Use the installed canvas, rather than `/create-canvas`, which creates a new extension. Start a new session if the newly installed extension has not appeared. [Canvas documentation](https://docs.github.com/en/copilot/how-tos/github-copilot-app/working-with-canvas-extensions).

To update a local install, replace or update the files in its existing folder and start a new session; rebuild first if you changed source code. For a GitHub install, run `copilot plugin update enhance-prompt@copilot-enhance-prompt`. Remove either installation with `copilot plugin uninstall enhance-prompt@copilot-enhance-prompt`.

## Use it

1. In **Models**, add an API provider, local model, custom CLI, or detected subscription CLI. API calls use that provider's account and billing; installing this plugin does not give them access to your Copilot subscription.
2. In **Enhance → Write a request**, describe the task and choose a model. **Options** opens style, context, output language and structure settings. Preview the context and uncheck items to exclude them; use **Attach files** for explicit attachments.
3. Click **Enhance**. Progress reports the context and model steps; Cancel stops the run.
4. In **Review and send**, edit the enhanced prompt. **Send to Copilot** submits a new message to the attached session shown in **Send to**. **Copy** keeps the handoff manual. The download icon saves a file; the up-arrow uses the result as a new input for refinement.

In the request box, **Enter** enhances and **Shift+Enter** adds a line. **Ctrl+Enter** (or **⌘+Enter**) sends a current result, or enhances first when one is not ready. In the result box it sends your edited text. If you explicitly enable **Send right after enhancing**, the request-box shortcut and separate **Enhance and send** button can skip review; **Enhance** still stops at the result. Navigation has visible labels, controls have keyboard focus indicators, and segmented choices support arrow keys.

Send refuses busy, blocked, queued, disconnected or unknown sessions. It never answers a pending permission request. Copilot's SDK has no atomic “send only if still idle” operation: the plugin checks immediately before sending and uses the normal queue, never immediate steering. If work starts between those operations, the message waits in the queue.

**Send right after enhancing** is optional, off by default, and requires its confirmation dialog. It checks that the session, project and input are unchanged and that the session is idle. [Details](docs/settings.md).

## Platform differences

| Capability | Copilot behavior |
| --- | --- |
| Prompt editor, rewrite models, fallback, rules, history, attachments | Retained in the canvas |
| Destination picker | The canvas's attached Copilot session |
| Optional Enter after paste | Replaced by explicit Send as a new chat message |
| Automatic prompt rewriting | Optional transformed-prompt hook; changes model-facing text while the chat shows the original; off by default |
| Terminal scrollback and other-agent context | Unavailable with the current adapter |
| New external CLI agent, editor-save events, opening editor tabs | Unavailable with the current canvas SDK |
| Desktop notifications | Unavailable; progress and completion appear in the panel |
| Save dialog | Browser download |

Unavailable settings are disabled and explained. Switching the visible desktop tab does not retarget an existing canvas. Open the canvas in the intended session.

## Data and privacy

The worker reads the project directory from Copilot session metadata, never from its session-artifact directory. Remote workspaces expose no local project files. Project reads obey privacy switches and reject sensitive filenames and escaping symlinks. Recognized secrets in source excerpts and Git diffs are masked before trimming; other context is not uniformly masked. Explicit attachments, your request and custom instructions are not automatically secret-masked. Preview and exclude context before enhancing. Fallback can send the payload to multiple configured providers; Max's file selector can use a separate model. [Exact data flow](docs/prompt-workflow.md).

Preferences, profiles, rules and history are local. Saved prompt history is not encrypted; drafts and results are scoped to the Copilot session. Windows API keys use DPAPI under the current Windows account; they are never saved as plain text. The default data directory is `%LOCALAPPDATA%/copilot-enhance-prompt` on Windows and `~/.local/share/copilot-enhance-prompt` elsewhere. `ENHANCE_PROMPT_DATA_DIR` overrides it for tests or a separate installation.

The canvas uses an authenticated loopback server with origin and path checks. It exposes no agent-callable send, credential or consent action. There is no tracking or analytics. [Privacy details](docs/privacy.md).

## Development

Install dependencies and rebuild the packaged extension and panel after changing source:

```sh
npm ci
npm --prefix web ci
npm run typecheck
npm test
npm run build
npm run check
npm run web:dev
```

The development panel runs at `http://localhost:5174` with sample data, without model calls or real sends. Use `?lang=vi&theme=dark&width=380`, `?tab=models`, or `?demo=fix+the+login+page` to preview states.

`scripts/e2e.mjs` loads the built package in an isolated installed Copilot runtime and exercises canvas discovery, project metadata, context preview, enhancement, sending and the packaged prompt hook. Its disposable session uses a local model fixture; no external model is called. Set `COPILOT_SDK_DIR` and `COPILOT_CLI_PATH` to the desktop SDK directory and runtime executable. See [AGENTS.md](AGENTS.md) for the architecture and behavioral invariants.

The current port has passed unit tests, type checks, package checks and that installed-runtime integration test. Desktop visual verification remains unfinished; the preview is not a published stable release.

Enhance Prompt is free under the [MIT License](LICENSE). Original copyright remains with cattfan. This fork is not affiliated with GitHub or the model providers. [Report an issue](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues).
