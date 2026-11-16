# Recommended Copilot models and reasoning

Researched November 15, 2026. Provider documentation supports **GPT-6.1 Sol at High** and **Claude Opus 5.5 at Medium**. Those settings can be recommended defaults, but an actual rewrite still requires the model and reasoning level to be advertised by the authenticated Copilot catalog and confirmed by the installed runtime.

| Enhance Prompt preset | Requested model | Requested reasoning | Provider evidence |
| --- | --- | --- | --- |
| Low | Claude Haiku 5.5 | Highest level advertised by Copilot | Anthropic documents five levels through `max`; choose from the Copilot catalog, which may expose fewer levels. [Anthropic effort guide](https://platform.claude.com/docs/en/build-with-claude/effort) |
| Medium | GPT-6.1 Sol | `high` | OpenAI explicitly lists `high` among this model's supported levels. [GPT-6.1 Sol model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol) |
| High | Claude Opus 5.5 | `medium` | Anthropic documents `medium` as the model's default and supports all five effort levels. [Opus 5.5 overview](https://platform.claude.com/docs/en/models/opus-5-5/overview), [effort guide](https://platform.claude.com/docs/en/build-with-claude/effort) |

The OpenAI model page states: "`reasoning.effort` supports `low`, `medium` (default), `high`, `xhigh`, and `max`." This establishes provider support for Sol High, rather than requiring an inference from another GPT model. [Exact source](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

Opus 5.5 uses adaptive thinking at every effort level. Anthropic says thinking cannot be disabled; `medium` controls its depth without disabling it. These are Claude API properties, not proof of a particular Copilot session's effective setting. [Opus 5.5 changes](https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5)

## GitHub availability depends on the account and client

GitHub's launch notices identify the eligible plans and explicitly include both Copilot CLI and the GitHub Copilot app among supported clients:

| Model | Plans listed by GitHub | Source |
| --- | --- | --- |
| Claude Haiku 5.5 | Pro, Pro+, Max, Business, Enterprise | [October 7, 2026 announcement](https://github.blog/changelog/2026-10-07-claude-haiku-5-5-in-github-copilot/) |
| GPT-6.1 Sol | Pro+, Max, Business, Enterprise | [September 29, 2026 announcement](https://github.blog/changelog/2026-09-29-gpt-6-1-sol-in-github-copilot/) |
| Claude Opus 5.5 | Pro+, Max, Business, Enterprise | [September 22, 2026 announcement](https://github.blog/changelog/2026-09-22-claude-opus-5-5-is-now-available-in-github-copilot/) |

The Sol and Opus notices do not list Pro. Both also describe gradual rollout and organization model policies, so plan eligibility alone does not establish access. GitHub's current model reference says availability depends on the plan and client. Its configurable-reasoning guidance names VS Code, Copilot CLI, and Copilot cloud agent; it does not establish an unconditional desktop extension guarantee. [GitHub model reference](https://docs.github.com/en/copilot/reference/ai-models/supported-models)

The read-only catalog check during this implementation found neither Sol 6.1 nor Opus 5.5 in the raw session catalog or normalized client catalog; Terra 6.1 and Sonnet 5.5 were present. This is consistent with the documented Pro restrictions, but it does not identify the account's subscription. No billing page, credentials, or private account state was inspected for this research. The missing entries prevent live verification of these two requested models on that account.

## The installed SDK supplies the runtime contract

The installed `copilot-sdk/types.d.ts` was inspected under `%LOCALAPPDATA%/Programs/GitHub Copilot/`:

- `ReasoningEffort` is a model-defined string, with supported values discovered through `client.listModels()` (lines 1879-1883).
- `SessionConfig.reasoningEffort` is valid only when the model advertises reasoning support (lines 2200-2205).
- `ModelCapabilities.supports.reasoningEffort`, `ModelInfo.supportedReasoningEfforts`, and `ModelInfo.defaultReasoningEffort` describe support and defaults (lines 3437-3442 and 3492-3495).

Enhance Prompt must therefore retain its catalog checks and verify the helper session's effective model and effort before generation. Provider documentation must not add unavailable models or reasoning levels to a user's catalog. The current adapter handles the session RPC's raw reasoning metadata as well as the SDK's normalized form. [Copilot model adapter](../src/copilot/models.ts)

## What verification can establish

An isolated local HTTP fixture with the installed SDK/runtime can check that Sol High and Opus Medium reach session configuration, survive effective-setting verification, and appear in the generated provider request. It can also check rejection when a model or effort is unavailable. The fixture supplies synthetic model responses and cannot establish entitlement, real provider acceptance, output quality, or live billing behavior. [Installed-runtime fixture test](../scripts/e2e-copilot-provider.mjs)

This research used public primary sources and installed declarations; it made no model inference requests and controlled no desktop UI. Actual Copilot generation with Sol High and Opus Medium remains unverified until an eligible account advertises both models and completes those requests. Documentation alone cannot guarantee that outcome.

## Implementation verification for 0.10.3

- Restored Sol / High and Opus / Medium in the shared preset definitions. Explicit model and reasoning selections remain unchanged.
- Typecheck, production build and package checks passed. The final post-build suite passed all 325 tests, including unavailable premium models stopping before any model call and successful explicit selection of Terra / High and Sonnet / Medium.
- The installed-runtime local HTTP fixture passed both restored presets through the production resolver and helper. It checked the actual outgoing model IDs and reasoning values, applied-setting verification, retained usage and cleanup. Its account and model metadata were synthetic; no paid provider was contacted.
- Manual desktop checks and generation through an eligible Copilot account remain outstanding. Neither fixture success nor documented provider support is presented as paid end-to-end verification.
