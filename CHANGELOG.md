# Changes

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
