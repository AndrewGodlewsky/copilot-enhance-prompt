# Enhanced and original prompts

**Settings → Prompt preferences → Use enhanced prompts** selects the rewrite instructions. It is checked by default for new and existing installations. Uncheck it to use the original 0.11.2 prompt builder; check it again to try the revised instructions. The preference is saved across sessions and applies to the next enhancement. An enhancement already running keeps the set it started with, including fallback attempts.

Both sets support all nine styles, custom instructions, saved rules and structures, agent adaptation, English output, and preservation of literal user content. Changing the preference does not rewrite saved prompts or history, clear drafts or attachments, change model/reasoning assignments, change context collection, or enable sending.

The enhanced set addresses the failure classes identified in the [research](research/prompt-evaluation-findings.md):

- Keep already-approved actions approved. Plan first stops for approval only when the current request does not already ask for implementation.
- Keep read-only work read-only, including temporary logging or edits that would later be reverted.
- Distinguish observed facts from hypotheses, partial excerpts from complete files, and changing an existing object from creating or deleting it.
- Preserve open decisions and whether the user reserved or delegated a choice. Do not turn an unknown into a fixed requirement.
- Use relevant evidence without copying unrelated context or repeating workflow requirements. A style supplies emphasis and structure within the current request's scope.

These are revised instructions for users to try, not a claim of proven model-quality improvement. The rejected compact and open-choice research candidates are not used. The new set needs live output review; deterministic tests establish selection, persistence, payload construction and compatibility, not model obedience. No Copilot allowance is used by the automated tests.

The [v1 paired evaluation gate](research/v1-quality-gate.md) prepares new held-out comparisons of both actual prompt sets without making model calls. Its live trials and downstream outcomes remain pending; preparation alone does not establish a better default.

## Implementation boundary

The existing `src/prompts.ts` remains the original implementation. `src/prompt-sets.ts` owns the separate enhanced policy and nine style definitions, and chooses a builder using the worker's saved `useEnhancedPrompts` setting. Request/context serialization and literal content are shared unchanged. The research runner continues to use the original builder so its historical baseline stays reproducible.

A separate set was chosen because it lets users compare revisions and immediately restore the original instructions. Appending another rule to the old prompt would retain the contradictory Plan first instructions identified in the research. No per-model prompt forks or automatic context expansion are introduced: the study did not establish a benefit for them.
