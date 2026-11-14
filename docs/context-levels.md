# Context levels

Context comes from the working directory of the Copilot session that opened the canvas.
Choose a level per prompt, or set its default in the panel's Settings.

| Level | Context |
| --- | --- |
| Off | Your prompt and instructions, without project context |
| Basic | Project and destination agent identity |
| Standard | Agent rules, README digest, stack, commands, repository tree and explicitly included files |
| Deep | Standard plus git status, recent commits, diff and up to six relevant files |
| Max | Deep with up to ten files and optional model-assisted file selection |

## Files and git

Standard reads instruction files such as `AGENTS.md`, `CLAUDE.md`, and
`.github/copilot-instructions.md`. It extracts project commands from package manifests,
build files and CI configuration. Deep searches for identifiers, paths and keywords in
your request, then includes numbered snippets around relevant matches.

Max's file picker uses a configured model and can incur an additional model call.
Opening the context preview itself does not call a model. Untick context items to omit
them from the next enhancement. Budgets limit each level's context size.

Project-file and git privacy switches apply to previews and enhancement.
Secret filenames, binary files and configured exclusions are skipped.
Secret values are masked before snippets and diffs are shortened.

## Copilot availability

Terminal output, other agents' sessions, editor-save events and agent activity are
unavailable in the installed canvas SDK. Their controls explain this limitation.
They do not contribute context at any level.

Remote sessions provide no local project files. The plugin must not substitute the
extension's own working directory or Copilot's session-artifact directory.

See [Privacy](privacy.md) for file and attachment handling.
