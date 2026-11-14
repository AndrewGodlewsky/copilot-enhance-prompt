# Using Enhance Prompt

The header switches between Enhance, History, Models, Rules and Settings. The language picker supports English, Vietnamese and Chinese. Auto follows the webview's locale; appearance follows the system color scheme.

## Enhance

Write the request, choose style and context level, and optionally select a structure or output language. Paste, drop or pick attachments. Preview the context and exclude anything unnecessary before running a model. Cancel stops the current run. Refine moves the result back into the composer.

Send creates a new message in the attached Copilot session. It checks the session again immediately before submitting. Copy and file download are available for manual handoff. A failed send leaves the result available.

## Models and rules

Models supports API providers, local endpoints, subscription CLIs, custom commands, model catalogs, testing and ordered fallback. The selected rewriting provider receives the prompt and permitted context. Copilot receives the result only when sent.

Rules contains reusable instructions and structures. Global rules apply everywhere; project rules use the canonical project path so same-named folders remain separate. The original prompting and model features are described in [Models](models.md) and [Context levels](context-levels.md).

## History and settings

History supports searching, reusing, removing with Undo and exporting visible entries. Settings controls saved drafts/history, project and Git reads, model catalogs, environment keys, automatic sending and the prompt hook. [Privacy](privacy.md) explains storage and reads.

Unavailable terminal, editor and desktop-notification settings are disabled. They do not silently read chat transcripts or start another application.
