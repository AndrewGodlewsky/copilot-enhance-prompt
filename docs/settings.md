# Settings

All preferences live inside the canvas. Prompt preferences includes default style, context and output language, custom instructions, extra context files, exclusions, model timeout, history limit and the text appended by Rules auto-enhance. Model fallback is configured in Models.

Privacy switches are checked by the worker on every preview, enhancement and prompt hook. Unsupported controls are disabled in both the UI and backend.

“Send right after enhancing” is off by default and needs its explanation dialog. Once enabled, Ctrl+Enter or the second Enhance button may send an unread result. The panel checks the original session, project and input, cancellation, and whether Copilot is idle. Closing the panel, editing the prompt or changing the destination prevents automatic sending.

Normal Send always submits a new Copilot message. There is no paste-without-Enter mode. The plugin checks immediately before sending, then uses Copilot's queue; if activity starts during that small gap, the message waits instead of becoming an immediate interjection.

The optional [auto-enhance hook](auto-enhance.md) can affect prompts entered directly into Copilot. Keep it off to preserve exact wording.
