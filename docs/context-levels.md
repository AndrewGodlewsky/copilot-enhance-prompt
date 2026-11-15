# Context choices

Context comes from the working directory of the Copilot session that opened the canvas.
Choose it per prompt, or set a default in Settings. Existing defaults are preserved.

| Choice | Best use | Automatically gathered context | Approximate character budget |
| --- | --- | --- | --- |
| Off | General requests or context you supply yourself | None; saved rewrite instructions and explicit attachments still apply | 0 |
| Project overview | Fast project orientation; the default for new installations | Project/agent identity, project instructions, README digest, stack, commands, file overview and configured extra files | 12,000 |
| Relevant code | Most coding tasks | Project overview plus Git status, six recent commits, a bounded diff and up to six relevant source snippets | 28,000 |
| AI-assisted | Tasks where local search misses the right files | Relevant code with larger snippets/diff and up to ten files in total, chosen with model assistance | 45,000 |

Relevant code performs local search without an extra model request. AI-assisted sends the
request and allowed candidate file paths to a selector model, adding time and possible usage
charges. Its choices come first, with local matches filling remaining slots. If selection
fails, local matches still work. Empty candidate lists skip the selector.

Saved Basic selections still work and appear as **Basic (saved): project identity only**.
They are not offered for new selections. The stored identifiers `standard`, `deep`, and
`max` remain compatible with older preferences and request clients.

## Preview and file selection

The visible preview refreshes after changes to the request, level, target, exclusions or
context preferences. **Refresh context** rereads files after edits outside the panel.
Preview makes no model calls; AI-assisted files are finalized during enhancement.
Each enhancement also rereads static context, so preview is not a frozen copy of its payload.

Unchecked project files and Excluded paths are filtered from instructions, summaries,
file lists, source snippets, Git changes and AI candidates. Resolved link targets obey
the same policy; deletions under missing directories are omitted when their original
location cannot be verified. Turning off project-file access limits collection to project identity.
Explicit attachments, typed text and saved rewrite rules are separate inputs.

Project instructions include `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`
and supported rule files. Commands come from manifests and build files; CI workflow
filenames are listed as hints. Instructions and README share a 9,000-character allowance,
with individual instruction files limited to 4,000 characters.

Relevant code prioritizes filenames, identifiers, content matches and changed files.
With Git unavailable or disabled, local search still works and reads supported hidden
instruction directories. The fallback searches up to 300 candidate files, 4 MB of text,
or 1.5 seconds, whichever comes first. A note appears when it stops early. Naming files
in the request prioritizes them. Individual source reads are limited to 200 KB; snippets
include line numbers around matches. These are excerpts, not the whole repository.

Recognized secrets in automatically collected instructions, README/extra context, stack
information, source excerpts and Git metadata/diffs are masked before shortening.
Masking cannot identify every secret. Sensitive filenames, binary files and paths outside
the project are refused. See [Privacy](privacy.md) for attachment and explicit-input handling.

## Copilot availability and chat auto-enhance

Terminal output, other agents' sessions, editor-save events and agent activity are
unavailable in the installed canvas SDK and contribute no context. Remote sessions
provide no local project files; the extension never substitutes its own directory.

Chat auto-enhance uses its separate **Include context in auto-enhance** switch, not this
menu. It can include project identity, instructions, README/extra files and stack details,
subject to privacy and exclusions. It does not perform source selection or include the
file tree or Git changes. Its cached context must match the current file preferences.
