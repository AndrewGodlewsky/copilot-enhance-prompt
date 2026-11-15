# Chat auto-enhance retirement and recovery

The Copilot-only change removes every automatic rewrite or append operation on prompts entered directly into Copilot chat. The owner wanted a GitHub Copilot desktop plugin whose models all come from Copilot, without separate provider APIs, local model servers or subscription CLIs. The former chat hook's short deadline supported direct API models but could not use the background Copilot helper. After clarifying that this was separate from **Send to Copilot**, the owner approved retiring the whole chat-auto section and requested this recovery note in case the change should be reconsidered.

Manual **Enhance**, reviewed **Send to Copilot**, and the separately enabled **Enhance and send** action remain. Copilot models, effort assignments, AI-assisted selection, AI Test, rules, context/privacy controls, usage accounting, issue links and Show Logs remain. Completion notifications and periodic feedback solicitation were also removed; the issue links are still user initiated.

## Recoverable source

The last complete implementation before retirement is commit [`d466c96c99a75bf9ec7491fc660fded3b7f11283`](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/commit/d466c96c99a75bf9ec7491fc660fded3b7f11283), version **0.6.1**. Read files at that commit with `git show <commit>:<path>` or browse its tree. Paths below describe that historical implementation and are not current runtime entry points.

| Historical path | Responsibility |
| --- | --- |
| `com.github.copilot/hooks/hooks.json` | Registered the `userPromptTransformed` command hook with a five-second host limit |
| `src/copilot/hook-entry.ts`, `src/copilot/hook.ts` | Started the command, checked eligibility, bounded execution and returned a transformed prompt |
| `src/worker.ts` | Rules append mode, AI rewrite mode, static context, history and last-outcome reporting |
| `src/copilot/sent.ts` | Short-lived session/text hash to bypass a second enhancement for canvas sends |
| `src/defaults.ts`, `src/protocol.ts`, `src/panel/`, `web/src/sections.tsx` | Defaults, requests/events, controls and outcome display |
| `src/models.ts`, `src/llm.ts` | Hook model selection and direct API execution |
| `src/copilot/hook.test.ts`, `src/auto-enhance.test.ts`, `scripts/e2e.mjs` | Unit and installed-runtime coverage of transformation, bypass and pass-through behavior |
| `docs/auto-enhance.md`, `docs/prompt-workflow.md` | The original explanation, detailed flow and timing limits |

The hook was **off by default**. Its saved preferences were `autoEnhanceMode` (`off`, `rules`, `ai`), `autoEnhanceAppend`, `autoEnhanceMinLength` (default 8), and `autoEnhanceContext` (default true). The saved model configuration also had `hookProfileId`; `hook.last`, hook events and `panel:hookLast` exposed recent outcomes.

Migration keeps inactive saved `autoEnhance*` preferences for recovery. They are not exposed or writable through current settings, and no active hook or enhancement path reads them. There is no packaged hook registration. Retired external profiles are filtered out and encrypted `apiKey.*` entries are erased, preserving unrelated data. A saved effort assignment to a removed external profile stays unavailable until the user explicitly replaces it; migration does not silently choose a Copilot model.

## What the old hook did

The runtime supplied the original user text, its transformed text with runtime-added context, the session ID and working directory. **Rules** appended dedicated text without calling a model. **AI** built a rewrite request with applicable rules and optional static project context, using enabled direct API profiles only. It did not use Copilot helpers, subscription CLIs, canvas attachments, Relevant code selection, AI-assisted selection or AI Test research.

The AI path had an approximately two-second budget: the worker allowed 1.7 seconds minus setup time, the command had a 4.5-second outer deadline, and the host allowed five seconds. Key retrieval could add wall-clock time outside individual model timers. This timing was the reason the existing implementation could not simply switch to the disposable Copilot helper.

The hook returned `modifiedTransformedPrompt` for the same turn; it never sent another message. The model received changed text while the visible chat retained the original user message. A unique original-text span was replaced and surrounding runtime context was preserved byte for byte. Disabled, short, subagent, panel-originated, ambiguous, failed, empty or timed-out requests passed through unchanged.

Registering an SDK prompt callback stalled extension startup on both installed runtimes tested during the original migration. The config-file command hook worked in the installed-runtime fixture. The ordinary `userPromptSubmitted` command hook ignored rewrite output and could not substitute for `userPromptTransformed`. These are historical observations about the tested runtime versions, not assumptions to carry into a future SDK.

## If the feature is reconsidered

Use the recoverable commit as a reference for selective reimplementation. Rolling the whole plugin back would also discard later fixes, privacy changes and unrelated features. Recheck the installed SDK declarations, runtime behavior and hook timing first. A future Copilot-only design needs an explicitly approved latency and account/usage model; bringing back direct APIs would change the current product scope.

Preserve these requirements when evaluating a replacement:

- Keep automatic chat transformation off by default and require explicit user enablement. Explain that model-facing text and visible chat text can differ.
- Preserve runtime-added context exactly; leave uncertain matches, errors, timeouts, cancellations and unsupported input unchanged.
- Prevent recursion for canvas sends and subagent work. A hook must never call Send, answer permissions or turn an agent action into consent.
- Recheck privacy before reads, resolve the runtime's actual local project, constrain paths, apply exclusions and mask recognized secrets before trimming.
- Bound the entire operation and preserve account checks, tool isolation, cancellation and usage accounting if a Copilot helper is introduced.
- Test a disposable installed-runtime session with a local fixture before any owner-authorized account-backed evaluation. Revalidate SDK callback behavior instead of assuming the old startup failure persists.

Historical changelog entries and planning records remain as records of the earlier releases. Current user instructions are in the [README](../README.md), [Models](models.md) and [Settings](settings.md).
