var e=`# Changes

## [0.12.4] - 2026-11-17

### Fixed
- Cancelling an enhancement or model test no longer allows an update to replace the plugin while its background helper is still stopping or saving usage. Cancellation still returns promptly; retry Update after cleanup finishes.
- If helper shutdown cannot be confirmed, updates stay blocked. Check Show Logs and restart Copilot before trying again.

## [0.12.3] - 2026-11-17

### Fixed
- Attachments now belong to the Copilot session that uploaded them. Uploads reject missing, repeated or out-of-order chunks and refuse links or files substituted outside the upload process.
- Safe attachments in saved drafts are preserved when upgrading. If an attachment is missing, incomplete or unsafe, attach it again. Cleanup removes registered copies and leaves unrelated files alone.

## [0.12.2] - 2026-11-17

### Fixed
- Turning off context access or changing file exclusions in Settings now stops an enhancement or context preview that was using the old settings, including AI selection, research and fallback models. Try again to use your updated settings.
- Privacy is checked again while the background model starts, before project instructions or request context are sent. Content already sent to Copilot cannot be recalled.

## [0.12.1] - 2026-11-16

### Fixed
- Project context collection now disables configured Git filter programs during status and diff reads. Unreadable or unsupported filter configuration skips those reads instead of running a filter.
- Git context keeps submodule commit summaries without inspecting submodule working-tree content.
- Turning off **Settings → Privacy → Save history** during an enhancement prevents that completed prompt from being added to History. Existing history is preserved.
- Closing a canvas cancels a pending **Send to Copilot** before it reaches the session's send boundary. A message already accepted by Copilot cannot be recalled.
- Uncertain project metadata no longer exposes a local directory, and progress lookups are limited to the canvas that started the enhancement.
- History project counts use fewer repeated scans, and the enhancement progress bar exposes its numeric progress to assistive technology.

## [0.12.0] - 2026-11-16

### Added
- **Settings → Prompt preferences → Use enhanced prompts** is checked by default. It selects a separate set of rewrite instructions for all nine styles, with clearer handling of task boundaries, approvals, uncertain evidence and open decisions.
- Uncheck it to use the original prompts from 0.11.2. The choice is remembered across sessions and applies to the next enhancement; a running enhancement keeps its original choice through fallback attempts.
- Both sets keep your custom instructions, rules and structures. Switching leaves drafts, attachments, history, model assignments and context collection unchanged. The revised set is available to try; improved model output has not yet been established by live evaluation.

## [0.11.2] - 2026-11-16

### Added
- Click the version number in the footer to browse versions and their release notes. Choose **What's new** to see just the current version's changes.
- New versions will include short notes explaining what changed for users. Existing historical notes are kept as recorded.

## [0.11.1] - 2026-11-15

### Added
- Settings → Appearance now offers Small, Medium and Large chat text. Medium preserves the existing sizing; Small is 12.5% smaller and Large is 25% larger. The choice applies to request and review editors and saved prompt text in History, including its previews, and is remembered across sessions.
- The word animation measures the selected editor font and adjusts when the text-size preference changes.

## [0.11.0] - 2026-11-15

### Added
- Quiet update checks after opening the canvas, at most once every 24 hours. Settings includes Check for updates and Automatically check for updates.
- A compact update notice with View changes, Update and Later. Checks follow the installed public GitHub source and branch, including forks; pins, local development and uncertain sources are reported explicitly.
- User-triggered updates through the attached Copilot session, with saved-draft checks, protection against simultaneous updates and active work, interruption recovery, and verification against both Copilot inventory and installed files.
- Separate running, installed and available versions. After installation, restart Copilot and reopen the existing session to load the new code while retaining its saved draft. Reopening only the canvas keeps the old backend on the tested runtime.

## [0.10.10] - 2026-11-15

### Changed
- Clear now empties both Write a request and Review and send, including attachments and saved result metadata. It remains available when only the reviewed prompt has content. Cleared content stays empty after reopening; saved history is preserved.

## [0.10.9] - 2026-11-15

### Changed
- Give the canvas more room at wide sizes, with separate reading widths for each tab. Keep request writing, progress and review vertically ordered.
- Move opened prompt options and context into a right-hand column on wide canvases. Keep the same controls inline on smaller canvases, without changing the selected context or opening Options automatically.
- Stack Context Level, Style and Effort on narrow editors, use two rows at medium widths, and show all three across only when the editor has room.
- Compact the Quiet Desk banner on narrow and short canvases. Keep the theme toggle and workflow status available, and limit the artwork's size on large screens.

## [0.10.8] - 2026-11-15

### Changed
- Remove the outer Write a request card's focus highlight. Keep focus indicators on the text box and individual controls.

## [0.10.7] - 2026-11-15

### Changed
- Move Clear below the request text box on the right. Use an outlined text-only button so the action is easier to recognize.

## [0.10.6] - 2026-11-15

### Changed
- Include the Markdown filename and Downloads folder guidance in the confirmation when downloading a reviewed prompt or history export.

## [0.10.5] - 2026-11-15

### Added
- Add Clear beside Write a request to remove the saved request text, images and attachments. Cleared content stays empty when reopening the canvas; saved history, the reviewed result and prompt preferences remain available. Clear waits for uploads, active operations and the completion animation to finish.

## [0.10.4] - 2026-11-15

### Changed
- Widen the History project sidebar and wrap long project names. Add a Projects button to hide or show the sidebar while keeping the selected project filter.
- Expand prompt details directly below each history row instead of in a separate reading pane. Rows start closed, open one at a time, and close when clicked again. Keep both saved texts, metadata, project location, Reuse, Copy and Delete available in the expanded row.

## [0.10.3] - 2026-11-15

### Changed
- Restore the recommended Medium preset to GPT-6.1 Sol with High reasoning and High to Claude Opus 5.5 with Medium reasoning. Low remains Claude Haiku 5.5 at its highest supported reasoning. Explicit model and reasoning selections remain unchanged.
- Document provider reasoning support and Copilot access requirements. Keep account/catalog and applied-setting checks before inference; unavailable recommendations require a manual model choice and never silently switch to another model.

## [0.10.2] - 2026-11-15

### Fixed
- Change the recommended Medium preset to GPT-6.1 Terra with High reasoning and High to Claude Sonnet 5.5 with Medium reasoning. Low stays on Claude Haiku 5.5 at its highest supported reasoning. Tiers set to Recommended follow the updated presets; explicit model and reasoning selections remain unchanged.
- Distinguish an unavailable recommended model from multiple matching catalog entries. Explain that users need an available model or a change in Copilot account access; refreshing alone cannot grant access.

## [0.10.1] - 2026-11-15

### Fixed
- Read reasoning capabilities from both the raw Copilot session catalog and normalized SDK metadata. Restore supported reasoning choices, including Max for the recommended Claude Haiku 5.5 Low preset, while retaining account, model and applied-reasoning checks before inference.
- Keep a saved Highest choice available when it resolves to an advertised level, and accept an explicitly advertised Highest level.

### Changed
- Show a compact green check and Connected beside Enhance's model description. Click it to open connection checks and logs. Errors open the details automatically; manual checks keep their progress and result visible. Models retains its full connection controls.

## [0.10.0] - 2026-11-15

### Changed
- Move Low, Medium and High model/reasoning settings to the Models tab and point Enhance's Effort settings shortcut there. Choose directly from the account's Copilot catalog without adding a profile. Preserve existing assignments and reasoning choices.
- Keep optional saved profiles, ordered fallback, model tests and the separate AI-assisted context model under Advanced model options.

### Fixed
- Make connection checks visibly complete with a check number, time and result. Show Check connection when connected, Retry connection after an access failure and Refresh models for configuration problems. A check never submits a prompt or erases a background rewrite failure.
- Keep Show Logs available after success and include safe check outcomes, empty-request and busy states. Explain why an empty request leaves Enhance disabled.

## [0.9.0] - 2026-11-15

### Added
- Configure separate model and reasoning choices for Low, Medium and High effort. Recommended presets are Claude Haiku 5.5 at highest supported reasoning, GPT-6.1 Sol at High, and Claude Opus 5.5 at Medium, subject to your Copilot catalog. Existing assignments stay unchanged until you select Use recommended presets.
- Show account/catalog status beside the composer with Retry and Show Logs. Missing models, sign-in failures and unsupported reasoning have actionable explanations. Retry checks metadata without submitting your draft.
- Validate explicit reasoning against both Copilot catalogs and the helper's applied setting before inference. Use it for rewriting, AI Test and the following AI-assisted selector; separate selectors and fallback models keep their own defaults. Stop on unsupported or ignored reasoning instead of silently substituting a level.
- Include safe readiness diagnostics and the successful attempt's reasoning in the result. Keep SDK/runtime reuse, isolated helpers, usage accounting and sending safeguards.

## [0.8.0] - 2026-11-15

### Changed
- Replace tall history cards with the approved project library: project navigation, a compact prompt list and a separate reading pane that starts directly with the prompt title.
- Browse any saved project, distinguish folders with the same name, and find older entries with no recorded project. Use the project dropdown on narrower canvases; the reader moves below the list on small screens.
- Search original and enhanced text with highlighted matches, switch between both saved texts, sort newest or oldest first, and navigate pages of twelve prompts.
- Preserve Reuse, Copy and Delete with Undo. Move filtered export and clear-history actions into More; clearing history explicitly confirms that it affects every project. Saved prompts, project identities, drafts and sending safeguards stay unchanged.

## [0.7.0] - 2026-11-15

### Changed
- Make GitHub Copilot the sole model connection for enhancement, AI-assisted context, AI Test and fallback. Keep Copilot-provided Claude, GPT and other available models, the installed desktop SDK/runtime, effort assignments and usage accounting.
- Remove direct provider APIs, local model servers, separate model CLIs, API-key controls and separate-agent launching. Retire external profiles and their encrypted API keys without changing saved Copilot models, drafts, history, rules or usage records. Effort and AI-assisted picker assignments to removed profiles require a new selection instead of silently choosing a model.
- Remove all chat auto-enhance modes and the packaged prompt hook. Manual Enhance, Send to Copilot and optional enhance-and-send remain. Preserve inactive old chat preferences and document recovery in \`docs/chat-auto-enhance-retirement.md\`.
- Remove unavailable completion notifications and periodic feedback reminders. Keep GitHub issue links and Show Logs.

## [0.6.1] - 2026-11-15

### Fixed
- Prevent each animated figure from immediately picking up the word it just deposited. Its next trip must start at a different location with a different word; other figures may still collect deposited words.
- Rest when no different word is available, including one-word requests. Apply the same selection rule to the standalone animation and color previews while preserving the approved colors, movement, and 95% set-down and exit sequence.

## [0.6.0] - 2026-11-15

### Added
- Add **AI Test** beside AI-assisted in Context Level. It starts with Relevant code context, lets the selected effort model request protected file excerpts and literal searches in up to two research rounds, then rewrites using the actual evidence. Existing context levels, defaults and chat auto-enhance remain unchanged.
- Bound research to 45 seconds (or half the remaining run budget), eight new excerpts and 16,000 added context characters. Retain evidence after ordinary research failures; stop on cancellation, privacy changes or usage-accounting errors.
- Show research progress, excerpt attribution and a completion note. Add content-free research events to Show Logs. Copilot research uses the existing background helper, provider boundary and Enhanced Prompt usage grouping.

## [0.5.3] - 2026-11-15

### Fixed
- Keep the word-carrying animation available for long, scrolled requests. Measure only the visible text range, preserve wrapped word fragments, and ignore offscreen words when building the scene.
- Keep all visible words in wide request boxes while limiting the crew to sixteen figures. Ignore queued scroll events when the viewport has not moved.
- Preserve the original request and scroll position, reduced-motion behavior, and the 95% word-placement and exit sequence.

## [0.5.2] - 2026-11-15

### Changed
- Use the approved deep-blue stick figures with thicker 2.2-pixel strokes, unchanged body geometry, and a darker blue in light mode. Keep text colors unchanged.
- At 95% displayed progress, lower held words in place, release them, and only then run offscreen. Keep deposited words still until the prompt succeeds; the final sweep waits for both the result and the crew's exit. Fast completions still play the full set-down and exit sequence.
- Stop animation frames while waiting after the crew exits. Keep cancellation, failure, reduced motion, original-request restoration, and sending safeguards unchanged.

## [0.5.1] - 2026-11-15

### Fixed
- On successful completion, have each stick figure lower its held word at its current position, release it, and then run offscreen. Keep deposited words in place until the whole-text sweep; avoid leaving them suspended in midair.

## [0.5.0] - 2026-11-15

### Added
- Bring the approved classic stick-figure crew into Write a request. Figures carry bare words between fixed positions, with varied trips and a small kick to make room.
- Lock request editing during enhancement. Keep real progress visible; only successful completion sends the crew offscreen and slides all decorative text downward together without compressing its spacing.
- Reveal the exact original request after the sweep. Failure and cancellation skip the success effect. Animation never changes model input, drafts, history, generated prompts or sending checks.
- Add Pause animation and respect reduced-motion preferences. Preserve readable native text when layout cannot be safely animated, and stop artwork on resize, hidden panels or rendering failure.

## [0.4.0] - 2026-11-14

### Changed
- Replace the composer's Model picker with Context Level, Style, and Effort. Keep structures and context preview in Options.
- Assign Low, Medium, and High to rewriting models in Settings. Start all three with the current model and show the assignment beside an Effort settings link. Effort is independent of context and provider reasoning settings.
- Preserve saved profiles, credentials and user data. Initialize assignments once across sessions and report deleted or disabled assignments clearly. Existing fallback and billing-route safeguards remain in effect.
- Make request-box Enter keys ordinary editing keys. Start enhancement with Enhance or the explicitly enabled Enhance and send button. Keep Ctrl/Cmd+Enter sending in the result editor.

## [0.3.2] - 2026-11-14

### Changed
- Rename Balanced to General across the interface and history exports while preserving its saved identifier and existing default selections. Keep the composer dropdown named Context.
- Review and document all nine styles. Keep each style's purpose when a Structure replaces its headings.
- Make Plan first stop after the plan unless the current task explicitly requests implementation. Preserve Code review's review-only boundary against saved instructions.
- Keep important details in Concise prompts, ground verification commands, and prevent agent-format hints from overriding the selected style.
- Clarify scope and evidence in Detailed spec, Bug fix, New feature and Refactor. Remove implementation boilerplate from Concise, Code review, Plan first and Custom only.
- Fall back to General when Custom only has no instructions, and explain how shared custom instructions apply.

## [0.3.1] - 2026-11-14

### Changed
- Offer four clearer context choices: Off, Project overview, Relevant code, and AI-assisted. Keep existing defaults and saved Basic selections. Explain which choice adds another model request.
- Refresh context previews after request and preference changes, ignore obsolete responses, and add Refresh context for project edits. Preview no longer blocks enhancement.

### Fixed
- Apply excluded paths and unchecked project files across rules, summaries, file lists, source excerpts, Git changes and AI candidates, including resolved link targets.
- Mask recognized secrets in automatically gathered instructions, README/extra context, stack details and Git metadata before trimming, as already done for source snippets and diffs.
- Reread static context for each preview and enhancement. Match hook caches to current file preferences so removed extra files or changed exclusions cannot reuse old context.
- Read supported hidden instruction directories and search file contents without Git, with bounded reads and a visible limit notice.
- Limit AI-assisted selection to ten source files total, prioritizing AI choices and filling from local matches. Skip the selector when there are no candidates.

## [0.3.0] - 2026-11-14

### Changed
- Use English for plugin-authored interface text and rewritten instructions, including the optional AI chat hook. Remove the panel and output language controls and the Vietnamese and Chinese documentation copies.
- Keep existing rules, structures, drafts, history and model settings. Preserve user-supplied text, Unicode, code, paths, quotations and other data while applying the English output policy ahead of conflicting language instructions.
- Replace translation tables with literal English text and a small interpolation helper. Remove retired language preferences without disturbing other saved data.

## [0.2.4] - 2026-11-14

### Added
- Keep reported Copilot tokens and AI credits in a permanent, local accounting-only source. Usage Insights 0.1.64 discovers it automatically and groups separate background sessions under **Enhanced Prompt**, including model tests and Max file selection.
- Preserve reported usage on failure or cancellation. Recording failures appear in Show Logs and stop model fallback; remaining helper files are kept for recovery. Prompt text, responses, credentials and endpoints are not exported.
- Document updating both plugins, partial/missing charges, retained records and the limit that already-deleted historical receipts cannot be recovered. Verify the installed SDK with a local model and the actual Usage Insights reader with synthetic accounting.

## [0.2.3] - 2026-11-14

### Fixed
- Fix Copilot model discovery and Refresh being blocked by runtime verification when the desktop launches its embedded \`extension_bootstrap.mjs\` entry. Recognize that exact entry name as well as the SDK's absolute preload path, preserving executable, SDK and parent-process checks.
- Add a safe \`bootstrapEmbedded\` diagnostic flag and installed-runtime regression coverage for both launch forms. The checks use a synthetic catalog and make no paid model requests.

## [0.2.2] - 2026-11-14

### Changed
- Distinguish Copilot runtime verification, SDK loading, model-list failures and an empty eligible catalog in the model picker. Refresh retries live discovery; it does not download components or run a model.
- Add a **Copilot model discovery** section to Show Logs and copied reports: runtime/API checks, failure stage, safe error codes, model counts and filtering totals. No paths, model IDs, account identifiers or raw errors are included.
- Log explicit refresh attempts and privacy-blocked discovery. Disable the Copilot model picker and Save while its list is unavailable or loading.

## [0.2.1] - 2026-11-14

### Added
- Footer links to the repository, Settings, diagnostic logs and a new GitHub issue. The version is plain gray text; release notes still appear once after an update.
- Copyable support logs with timestamps, operation outcomes, durations, error codes and Copilot failure stages. Logs use bounded memory and exclude prompts, file contents, paths, account names and API keys; nothing is uploaded automatically.
- Panel diagnostics remain available when the worker cannot connect, with manual selection if clipboard access is unavailable.

## [0.2.0] - 2026-11-14

### Added
- GitHub Copilot model preset with a live account-specific catalog and background rewriting through the desktop's existing SDK/runtime. No npm installation, separate runtime download, or API key for users.
- Disposable helpers with account/model verification, no tools or ambient project discovery, cancellation and temporary-state cleanup. Copilot fallback and Max file selection stay within Copilot.

### Changed
- New model forms start with GitHub Copilot. Existing profiles are preserved. API and subscription CLI providers remain explicit alternatives.
- Document installation, Copilot billing, sign-in and experimental runtime compatibility limits. Copilot helpers are excluded from the two-second chat auto-enhance hook.

## [0.1.8] - 2026-11-14

### Changed
- Replace the prompt-and-spark icon with the green Lift speech bubble and upward arrow. Keep the compact SVG for Copilot plugin metadata and a matching PNG favicon.

## [0.1.7] - 2026-11-14

### Fixed
- Make light/dark changes immediate across the request card, shared controls, and notification close buttons by removing color fades that lagged behind the banner.

## [0.1.6] - 2026-11-14

### Added
- Quiet Desk banner with GitHub Copilot branding and still illustrations that reflect local time and the current enhancement state. No animation.
- A single light/dark toggle at the top right. Your choice is remembered across canvases and sessions; until you choose, the panel follows the system.

### Changed
- Move the version and release-notes link to the footer, and the language picker beside the navigation.

## [0.1.5] - 2026-11-14

### Changed
- Remove the unused canvas icon override and SDK declaration mutation. Copilot's native tab uses the owning plugin's compact SVG logo, the same mechanism as Usage Insights.
- Check the plugin logo's size and canvas ownership instead of treating SDK icon-path propagation as proof of desktop rendering.
- Recommend the cached GitHub marketplace installation. Follow-up diagnostics found that the live local install omitted the logo from desktop session metadata; switching the installation source restored the exact SVG in the same sessions. A new session alone was not a reliable repair.

## [0.1.4] - 2026-11-14

### Changed
- Use the compact SVG for Copilot's plugin logo, matching the Usage Insights manifest setup. Keep the PNG in the panel and canvas SDK metadata. The desktop tab's appearance still needs manual confirmation.

## [0.1.3] - 2026-11-14

### Fixed
- Register the brand icon on the canvas itself so Copilot can display it in the native tab. Keep the icon field when older bundled SDKs omit it, and verify it through discovery and tab-opening events.

## [0.1.2] - 2026-11-14

### Changed
- Labeled navigation and “Write a request” / “Review and send” stages, with visible Enhance, Copy and Send to Copilot actions.
- Larger text and controls, clearer model/context options, keyboard focus, scrollbars and arrow-key navigation for segmented choices.
- More readable History, Models, Rules and Settings; explicit explanations for unavailable sending and optional enhancement without review.
- Updated English, Vietnamese and Chinese interface text. Existing shortcuts, privacy checks and opt-in sending remain in place.

## [0.1.1] - 2026-11-14

### Added
- New monochrome prompt-and-spark icon, declared in Copilot's plugin metadata and shown in the canvas header and favicon.

## [0.1.0] - 2026-11-14

### Added
- Native GitHub Copilot canvas with the existing prompt editor, models, fallback, rules, structures, history, attachments and context preview.
- Session-bound sending, authenticated local transport, durable preferences and session drafts, and Windows-protected API keys.
- Independent Node tests and a bundled extension build.

### Changed
- Send submits a new Copilot message. Busy, blocked, disconnected and unknown sessions refuse it.
- Auto-enhance is an optional session prompt hook, off by default. It can affect prompts typed in Copilot.
- Unsupported terminal, editor and notification features are shown as unavailable. File exports use browser downloads.
- This is the first release line for the Copilot fork. Earlier development history remains in Git.
`;export{e as default};