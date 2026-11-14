# Changes

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
