# Context choices

Context comes from the working directory of the Copilot session that opened the canvas.
Choose it per prompt, or set a default in Settings. Existing defaults are preserved.

For a worked example, source-by-source explanations and privacy simulations, open the
[interactive HTML guide](context-levels-guide.html). Download the file and open it in a
browser; it is self-contained, works offline and does not read your files. The guide covers
the stable levels as of 0.5.2; the AI Test experiment added in 0.6.0 is described below.

| Choice | Best use | Automatically gathered context | Approximate character budget |
| --- | --- | --- | --- |
| Off | General requests or context you supply yourself | None; saved rewrite instructions and explicit attachments still apply | 0 |
| Project overview | Fast project orientation; the default for new installations | Project/agent identity, project instructions, README digest, stack, commands, file overview and configured extra files | 12,000 |
| Relevant code | Most coding tasks | Project overview plus Git status, six recent commits, a bounded diff and up to six relevant source snippets | 28,000 |
| AI-assisted | Tasks where local search misses the right files | Relevant code with larger snippets/diff and up to ten files in total, chosen with model assistance | 45,000 |
| AI Test | Experiment with follow-up investigation before rewriting | Relevant code, then up to two model-directed rounds of protected searches and file excerpts | 45,000 maximum |

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
AI Test also previews only its initial Relevant code context, not its later research.
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
With Git available, one bounded scan counts all keywords and supplies excerpt positions.
Incomplete or unavailable searches are identified in context notes. See [search behavior,
limits and measured performance](context-search.md).
With Git unavailable or disabled, local search still works and reads supported hidden
instruction directories. The fallback searches up to 300 candidate files, 4 MB of text,
or 1.5 seconds, whichever comes first. A note appears when it stops early. Naming files
in the request prioritizes them. Individual source reads are limited to 200 KB; snippets
include line numbers around matches. These are excerpts, not the whole repository.

Recognized secrets in automatically collected instructions, README/extra context, stack
information, source excerpts and Git metadata/diffs are masked before shortening.
Masking cannot identify every secret. Sensitive filenames, binary files and paths outside
the project are refused. See [Privacy](privacy.md) for attachment and explicit-input handling.

## AI Test: experimental follow-up research

Select **AI Test** under **Context Level**, choose an effort, and click **Enhance**.
AI-assisted and all saved defaults keep their existing behavior. The experiment works as follows:

1. Gather the same initial project overview and relevant code as **Relevant code**.
2. Send the original request, filtered file inventory and actual excerpts to the model
   assigned to the selected effort. The model returns structured requests for more evidence,
   or indicates that it has enough context. It does not implement the task.
3. The plugin validates those requests, performs permitted reads and literal text searches,
   masks recognized secrets, and returns numbered excerpts to the next research round.
4. After at most two rounds, combine the evidence with your style, rules, structure and
   explicit attachments for the normal English prompt rewrite. The final rewrite sees
   the actual excerpts, not a model-authored summary of what files supposedly contain.

Research uses the effort's model, not the AI-assisted file-picker setting. There is no
research-model fallback, and at most two additional model requests. Final rewriting retains
its existing fallback setting within Copilot. Requests use the existing
background helper and usage recording; research sessions are grouped under **Enhanced Prompt**
in Usage Insights, just like rewriting. No chat window opens. Research adds Copilot usage.

| Limit | Behavior |
| --- | --- |
| Research time | Up to 45 seconds, or half the remaining run budget if shorter; final rewriting has its own remaining budget |
| Research rounds | At most two; stop early if the model has enough context or obtains no new excerpts |
| Requests per round | Up to three file ranges and two literal search terms; no regular expressions or model-controlled commands |
| Search scan | One combined scan per round, up to 300 files, 4 MB or 1.5 seconds; a partial search does not prove absence |
| Initial path inventory | At most 600 paths and 16,000 characters; searches use the filtered project inventory within scan limits |
| New evidence | At most eight excerpts, each up to 80 lines / 4,000 characters; 16,000 added characters total |
| File size | Individual files larger than 200 KB are not read |
| Automatic context | At most 45,000 characters; explicit inputs and attachments remain separate |

The helper still has no file tools, shell, network tools or write permissions. The plugin
brokers every research request through its protected reader. Project-file privacy,
unchecked files, exclusion patterns, sensitive-file rules and link confinement apply.
Turning off Git access does not disable this local text search. If privacy or file preferences
change during research, the run stops so you can retry under the new settings.

Progress shows the research round and excerpt count. The finished context list marks added
files **read during AI Test research (excerpt)**, and the note reports rounds, searches,
excerpt count and why research stopped. **Show Logs** includes `context.research`, `.round`,
`.read` and `.search` events without prompt text, queries, paths or file contents.

Malformed replies, ordinary model failures and research timeouts retain the evidence already
gathered and continue to rewriting with a note. Cancellation, privacy changes and Copilot
usage-recording failures stop the entire run. No request is sent to the attached chat without
the existing send action or explicitly enabled send-after-enhance behavior.

This is a bounded experiment, not a complete repository audit. Large repositories, image-only
requirements, or relevant files outside the scan budget may still need explicit guidance or
attachments. Attachments are supplied to the final rewrite, not to the research rounds.
Compare the resulting prompt with Relevant code or AI-assisted before deciding whether the
additional context justifies the extra time and usage.

## Copilot availability

[Coverage notes and explicit file paths](context-coverage.md) explain scan limits, eligible counts, omitted requested files and excerpt selection. Complete discovery is not a claim that every file was read or sent.

Overlapping requests can share filename discovery while keeping cancellation and privacy checks separate. Instructions and source contents are always reread. [Freshness, Refresh and measured concurrency](context-discovery.md).

Terminal output, other agents' sessions, editor-save events and agent activity are
unavailable in the installed canvas SDK and contribute no context. Remote sessions
provide no local project files; the extension never substitutes its own directory.

Prompts typed directly into Copilot chat are unchanged by this plugin. These context
choices apply to canvas enhancement.
