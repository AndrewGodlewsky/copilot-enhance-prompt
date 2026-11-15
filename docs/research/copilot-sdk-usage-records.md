# Copilot SDK usage records

Investigated on 2026-11-14 for Enhance Prompt 0.2.3. The installed desktop SDK identifies its runtime as `1.0.106-8.unstable.r43566476370.g869eef3` in `cliVersion.d.ts`. SDK references below are relative to `%LOCALAPPDATA%/Programs/GitHub Copilot/copilot-sdk/`.

**Background rewriting still produces usage information. Enhance Prompt currently returns only the rewritten text and deletes its isolated session storage after stopping the helper.** This is separate from GitHub's account-level accounting. The SDK's official billing FAQ says SDK prompts consume the same usage allowance as Copilot CLI prompts. [Enhance adapter](../../src/copilot/models.ts), [SDK billing FAQ](https://github.com/github/copilot-sdk#how-does-billing-work-for-sdk-usage)

## What the installed SDK exposes

| Signal | Available information | Lifetime and source |
| --- | --- | --- |
| `assistant.usage` | Required `model`; optional input, output, cache-read, cache-write, reasoning and speculative-prediction token counts; optional `cost`, `copilotUsage`, `aiCreditsStatus`, provider/model attribution and accounting identity | Live event. `AssistantUsageEvent.ephemeral` is literally `true`; it is not saved to the session event log. `generated/session-events.d.ts:7843–8101`. |
| `assistant.usage.data.copilotUsage` | `totalNanoAiu`, plus optional billing `model` | Per-request usage returned by the Copilot API. `generated/session-events.d.ts:8121–8131`. The separately declared token-detail interface is not a property of this installed `copilotUsage` type. |
| `session.rpc.usage.getMetrics()` | Accumulated token counts, request counts and multiplier costs, optional `totalNanoAiu`, `aiCreditsStatus`, per-model/per-provider/per-agent totals | Experimental session RPC. `generated/rpc.d.ts:41508–41514`; result and model types at `generated/session-events.d.ts:3764–3992`. |
| `session.usage_checkpoint` | `totalNanoAiu`, optional `providerModelMetrics`, optional accounting watermarks | Described as durable aggregate accounting for session resume. `generated/session-events.d.ts:4133–4186`. |
| `session.usage_record` | Internal durable receipt with fields nested under `data.usage`, including token counts and `accounting: { sourceSessionId, sequence, usageId }` | Observed in the fixture below, but absent from the installed public `SessionEvent` union. Generated types do not enumerate every physical journal record. |

`cost` is a model/request multiplier, not a dollar amount or an AI-credit token total. For AI credits, the SDK exposes the Copilot response's `totalNanoAiu`. Availability matters: `aiCreditsStatus` is `complete`, `partial`, or `unavailable`; the latter two describe an incomplete or absent reported subtotal. Missing billing information or numeric zero with unavailable status must not be presented as a free request. Sources: `generated/session-events.d.ts:387–395`, `7886–7930`, `8121–8131`.

GitHub recommends `assistant.usage` for live per-call observations and `session.usage.getMetrics` for session totals. Context-window measurements and account quota answer different questions. [Usage and billing metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing)

## Storage and telemetry switches

- `enableSessionStore: false` disables reads and writes to the **shared cross-session search/retrieval store**. It is not documented as disabling the ordinary session journal. Source: `types.d.ts:2818–2823`.
- `enableSessionTelemetry: false` disables internal session telemetry. Its documentation discusses upload eligibility and host/account policies, and explicitly separates this from OpenTelemetry configuration. It does not describe a billing exemption or a journal-persistence switch. Source: `types.d.ts:2397–2405`.
- `baseDirectory` sets the spawned runtime's `COPILOT_HOME`; `configDirectory` overrides session config/state storage. Empty mode requires explicit persistence. Sources: `types.d.ts:310–333`, `2240–2244`; `index.js:14714–14719`.

Enhance Prompt sets both directories inside an owned temporary directory, disables the two switches above, calls `sendAndWait`, returns `result.data.content`, stops the helper and removes the directory. It does not subscribe to usage events or call `usage.getMetrics`. `sendAndWait` itself returns an assistant-message event, not a usage summary. Sources: [adapter](../../src/copilot/models.ts) at lines 144–163, 189–193 and 201–211; SDK `session.d.ts:181–183`.

### Local fixture evidence

This investigation ran the production helper adapter against the installed runtime with a local external-model fixture, instrumenting only the disposable session and owned temporary directory. The fixture supplied one input token and one output token. Before normal adapter cleanup, validation observed a live `assistant.usage` event and one durable `session.usage_record` inside `home/session-state/<fixture-session>/events.jsonl`. The journal contained no `assistant.usage`; the isolated home contained no `session-store.db`. After the helper stopped, normal adapter cleanup removed the temporary home.

This demonstrates journal persistence with both switches disabled. The fixture was local/BYOK: `aiCreditsStatus` was `unavailable`, with no `copilotUsage`. No paid call, existing session, authentication data or private log was inspected. Validation used [the existing fixture](../../scripts/e2e-copilot-provider.mjs) plus disposable lifecycle instrumentation; it does not establish real Copilot charges.

## Why Usage Insights misses the rewrite

Usage Insights 0.1.63 was inspected at commit `1cca182ae783e9b25983ecd37ee87eb73d3c772b`:

- Its roots are `COPILOT_HOME` or `~/.copilot`, plus configured extra homes. [Settings](https://github.com/AndrewGodlewsky/copilot-usage-insights/blob/1cca182ae783e9b25983ecd37ee87eb73d3c772b/src/node/settings.mjs#L6), [roots](https://github.com/AndrewGodlewsky/copilot-usage-insights/blob/1cca182ae783e9b25983ecd37ee87eb73d3c772b/src/node/canvas-server.mjs#L25)
- It reads `session-state/*/events.jsonl`, falls back to `session-store.db`, and uses `data.db` for session names. It does not obtain account billing totals. [Local scanner](https://github.com/AndrewGodlewsky/copilot-usage-insights/blob/1cca182ae783e9b25983ecd37ee87eb73d3c772b/src/node/copilot-source.mjs#L49)
- Its parser reads `session.usage_record`, deduplicates source-session/usage identities, excludes BYOK/non-Copilot records, and uses `totalNanoAiu` for credits. [Accounting parser](https://github.com/AndrewGodlewsky/copilot-usage-insights/blob/1cca182ae783e9b25983ecd37ee87eb73d3c772b/src/core/copilot.mjs#L10)

Enhance's temporary home is outside those normal roots and is deleted. Its [history schema](../../src/history.ts) keeps prompts, model and time without token/cost fields; [diagnostics](../../src/diagnostics.ts) keeps operation outcomes without accounting. This is a missing retained data source, not a dashboard-refresh problem.

## What is recorded by GitHub

The documented expectation for successful real Copilot-backed rewrites is that they consume the authenticated account's applicable usage allowance. Neither disabling the internal telemetry flag nor deleting local session files is documented as avoiding billing. This follows the SDK billing contract; a real billed rewrite was **not** measured in this investigation. [SDK billing FAQ](https://github.com/github/copilot-sdk#how-does-billing-work-for-sdk-usage)

GitHub documents account consumption under **Copilot settings → Usage**. Individual plans also have **Billing and licensing → AI usage**, including model-level credits and cost. That account view generally cannot attribute credits to exact prompts, sessions or features, so it is not an Enhance Prompt per-rewrite ledger. [Monitoring GitHub AI Credits usage](https://docs.github.com/en/copilot/how-tos/manage-and-track-spending/monitor-ai-usage)

## Recommendation and remaining limits

Unimplemented: preserve allowlisted per-call tokens, credits, provider/model, accounting IDs, availability status and timestamp in a stable usage-only store. Add explicit Usage Insights reader support, deduplication and an Enhance Prompt origin label. Keep helper isolation. Do not copy entire receipts: they include unrelated metadata, including endpoints. Exclude prompts, responses and credentials.

Changing telemetry/storage switches or pointing the dashboard at temporary homes does not solve retention. Deleted past per-call records cannot be reconstructed from rewrite text. Real Copilot charge amounts, billing delay and receipt-format stability remain unverified.
