# Using Enhance Prompt

The header switches between Enhance, History, Models, Rules and Settings. The interface and plugin-authored messages are in English.

The Quiet Desk banner changes its still illustration with the current draft and enhancement status. Its window shows morning (05:00–11:59), afternoon (12:00–17:59), or night (18:00–04:59), using your local clock when the panel opens or regains focus. There is no animation. A finished page means a prompt is ready to review, not that it has been sent or verified.

Use the single theme button at the banner's top right to switch the entire panel between light and dark. It initially follows the system, then remembers your choice across canvases and sessions. Time of day changes the artwork independently. The plugin version at the bottom is plain text; release notes appear once after an update.

## Footer and support logs

**Enhance Prompt** opens the GitHub repository. **Settings** opens the Settings tab. **Feedback** opens the repository's new-issue form for you to review and submit; nothing is posted automatically.

If something fails, reproduce it and select **Show Logs → Copy logs** before restarting. Paste the report into your issue along with what you expected and what happened. Reopen the dialog to capture newer events. If clipboard access is blocked, the text is selected so you can copy it manually. Logs are also accessible from the connection-error screen.

For an empty Copilot model picker, press its **Refresh model list** button and wait for the result, then open **Show Logs → Copilot model discovery**. This section is included by **Copy logs**. It records the last attempt, runtime verification, SDK import/API checks, model-list response, eligible/excluded counts and any recognized failure code. It does not collect model names or IDs. A saved Copilot profile is not confirmation that the session's integration is working. Refresh retries the live list; it cannot repair an incompatible SDK/runtime, grant account access, or override the model-list privacy switch. It downloads nothing and makes no generation request.

Reports include the plugin version, runtime version, OS/architecture, timestamps, operation results, durations and recognized error codes. Copilot events identify the failing stage, such as account checks, model generation or helper cleanup. Raw error messages, prompts, rewritten text, file contents, paths, account names, API keys and connection tokens are excluded. Each component retains at most 200 events in memory; restarting clears them. Reports are never uploaded automatically. If the worker is unavailable, the report contains panel events only. These are plugin diagnostics, not the desktop application's full logs.

## Enhance

Write the request and choose Context Level, Style, and Effort. Low, Medium, and High use the models assigned in Settings. Options contains structures and the context preview. Paste, drop or pick attachments, and exclude unnecessary context before clicking Enhance. Enter adds a line without enhancing or sending. Cancel stops the current run. Refine moves the result back into the composer. The rewritten instructions and headings use English while preserving your code, paths, quoted text and other supplied data.

The dropdown is named **Context Level**. **AI Test** is a separate experimental choice beside AI-assisted: the effort model can inspect excerpts and request more evidence before rewriting, in up to two rounds and 45 seconds. Preview shows its initial context only. Research adds model usage; its progress and final context note show the work performed. [AI Test limits and privacy](context-levels.md#ai-test-experimental-follow-up-research). **General** is the default style; the other eight offer shorter prompts, specifications, task-specific workflows or custom formatting. Structures change headings while keeping the style's purpose. **Plan first** stops after the plan unless the current task explicitly requests implementation. [Style guide and review](styles.md).

Send creates a new message in the attached Copilot session. It checks the session again immediately before submitting. Copy and file download are available for manual handoff. A failed send leaves the result available.

## Models and rules

Models offers the live GitHub Copilot catalog, saved profiles, testing and ordered fallback. Add a model from that list, assign it to an effort in **Settings > Effort models**, then select the effort in Enhance. The helper reuses the desktop SDK/runtime without npm or another download. Claude, GPT and other listed model families use your Copilot account. **Test** makes a small model request that counts toward Copilot usage.

The selected Copilot model receives the prompt and permitted context. The attached chat receives the result only when sent. Copilot runs remain within Copilot for fallback, the AI-assisted file picker and AI Test research. Account mismatches, unavailable models, or missing runtime controls stop the request. [Background rewriting and troubleshooting](copilot-background-rewriting.md).

Rules contains reusable instructions and structures. Global rules apply everywhere; project rules use the canonical project path so same-named folders remain separate. The original prompting and model features are described in [Models](models.md) and [Context levels](context-levels.md).

## History and settings

History supports searching, reusing, removing with Undo and exporting visible entries. Settings controls saved drafts/history, project and Git reads, model catalogs and optional sending after enhancement. [Privacy](privacy.md) explains storage and reads.

Unavailable terminal and editor settings are disabled. They do not silently read chat transcripts or start another application.
