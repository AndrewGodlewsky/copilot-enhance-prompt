var e=`# Changes

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