# Effort controls

The request composer will show **Context Level**, **Style**, and **Effort** where the Model picker was. Effort has Low, Medium, and High; Medium is initially selected. The user approved initializing all three assignments from the current model until final defaults are chosen.

Reuse the existing saved profiles and live model lists in Settings. Three independently saved assignments select the rewriting model. This is simpler than introducing another model configuration system and keeps credentials in their existing protected store. Show the selected assignment below the composer controls, with a Settings link. Effort does not change project context, the separate AI file selector, chat auto-enhance, or a provider's internal reasoning setting.

Initialize assignments once, under the existing preferences transaction, from the upgrading canvas session's saved model override or its current enabled profile. Include environment profiles only when environment keys are permitted; chat hooks never initialize composer assignments. Auto uses the first enabled profile; with no configured model, retain Auto so adding a model still works. Never overwrite an existing assignment. A missing or disabled assigned profile must produce an actionable error, not silently select another provider. Existing explicit fallback settings and billing-route restrictions remain in force.

Enter, Shift+Enter and Ctrl/Cmd+Enter in the request textarea will use native editing behavior and never enhance or send. Enhancement requires an explicit button action; keyboard activation of a focused button remains accessible. Ctrl/Cmd+Enter in the result editor may still send that reviewed result. Remove the obsolete composer shortcut action and its hints.

Keep the existing layout, brand, structures, custom instructions, privacy rules, and send consent. Move context/style controls out of Options; keep structure and context preview there. No desktop/browser UI control, paid model calls, new dependencies, tags or releases. Rebuild, test, commit and push to main, reporting the version and commit.
