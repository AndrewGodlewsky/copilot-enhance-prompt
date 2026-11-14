# Optional prompt hook

Auto-enhance is off by default. The packaged `userPromptTransformed` command hook changes the text Copilot's model receives. The chat timeline still shows the original message. This affects user-entered prompts in sessions where the plugin is enabled.

- Off: preserve the prompt.
- Rules: append the text in Prompt preferences, unless already present.
- AI: use an enabled API model with a two-second budget. CLI models are excluded because startup can exceed that budget. Failure, timeout or an empty rewrite preserves the original prompt.

Prompts enhanced and sent by this panel bypass the hook through a short-lived hash scoped to the session. Context reads follow the same privacy switches as manual enhancement and use the working directory supplied by the runtime. The Settings tab reports its session's most recent outcome.

The hook replaces a single recognizable occurrence of the original prompt while preserving surrounding context. If the original is absent or appears multiple times, it leaves the entire message unchanged. Subagent prompts are skipped. A five-second process limit bounds all work; the AI request has its own two-second budget. Managed hook policies can prevent execution.

The SDK callback hook stalled startup on both installed runtimes during validation. The config-file transformed hook was verified with the installed runtime and a local model fixture. The ordinary command `userPromptSubmitted` hook cannot substitute for it: its rewrite output is ignored. See [GitHub's hook reference](https://docs.github.com/en/copilot/reference/hooks-reference#userprompttransformed).
