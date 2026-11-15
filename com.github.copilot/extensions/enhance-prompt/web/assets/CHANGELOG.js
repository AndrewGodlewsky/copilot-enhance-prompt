var e=`# Changes

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