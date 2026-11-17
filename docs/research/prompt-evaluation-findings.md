# Prompt and context evaluation — 16 November 2026

**Keep effort and context depth independent. Do not replace the shared prompt or change production defaults on the strength of this pilot.** We found measurable weaknesses and tested possible remedies, but no candidate established a reliable improvement across the configured Low, Medium and High presets. The strongest follow-up is preserving task boundaries and already-given approval, keeping uncertain facts and open decisions unresolved, and retrieving better source excerpts.

This is research against **Enhance Prompt 0.11.2**, source commit `396e8841e647d27a04e905bfbc67a5f56f22f704`. Production prompts, settings, models, UI and package assets remain unchanged. The experiment used subscription-authenticated Claude Code and Codex, with **zero Copilot model calls**. It does not establish the behavior or billing of the Copilot runtime.

The [results appendix](prompt-evaluation-results.md) gives per-case measurements and generation IDs. The local SQLite database at `.artifacts/prompt-eval-2026-11-16/results.sqlite` retains exact synthetic inputs/outputs, input hashes, configurations, usage, timing, failed attempts, independent reviews and experiment decisions. It is intentionally excluded from Git. The [runner guide](prompt-evaluation-runner.md) explains reproduction; [the protocol](prompt-evaluation-design.md), [code audit](prompt-context-pipeline-audit.md) and [primary-source research](prompt-tuning-evidence.md) provide the supporting detail.

## What was tested

Twelve invented requests cover all nine styles, with six tuning cases and six holdout cases. They exercise small edits, bug diagnosis, open product choices, plan/review authorization, explicit implementation approval, style/request conflicts, literal Unicode preservation, custom structure and thin context. Four frozen context variants compare request-only input, project overview, relevant excerpts, and the same excerpts with one unrelated file. This replays prepared input; it does not execute the live AI-assisted or AI Test retrieval loops.

| Product tier represented | Actual research route | Requested reasoning | Limit |
| --- | --- | --- | --- |
| Low | Claude Code, `claude-haiku-5-5` | Max baseline; Medium and High alternatives | Returned model usage confirms the model; effective reasoning is not independently attested |
| Medium proxy | Codex, `gpt-6-sol` | High baseline; Low alternative | `gpt-6.1-sol` was rejected by this ChatGPT account; this is a different model |
| High | Claude Code, `claude-opus-5-5` | Medium | Returned model usage confirms the model; effective reasoning is not independently attested |

Runtime versions were Claude Code **2.1.325**, Codex CLI **0.155.1**, Node **24.22.1** and SQLite **3.53.4**. Claude was authenticated through the existing first-party subscription; Codex through ChatGPT. Four preliminary generation probes established access, including the failed GPT-6.1 Sol probe. Their summaries are separate from the quality experiment.

Two subagents independently scored each successful generation on intent/scope/approval, evidence/uncertainty, detail/language preservation and clarity/proportionality, each 0–2. The reported 0–8 score is the mean of those two ratings, **not a task-success percentage**. Critical scope, approval, literal or factual failures were recorded separately; a high average cannot cancel them. Literal checks are deterministic but do not establish semantic correctness.

Model identities and system instructions were hidden from judges. Tuning packet filenames exposed the broad “baseline”/“compact” phase, so that portion was only partially blinded. Later packets used opaque names; holdout packets mixed control and treatment outputs in opaque order. Reviewers shared the same rubric and host-agent environment, and their underlying runtime model identifier was not supplied. They are independent judgments, not independent human ground truth. Disagreements remain visible as “any reviewer” versus “unanimous” failure flags.

A third subagent independently examined three borderline cases: two fallback choices for filter state and a rounding fix generalized to other half-cent values. It classified all three as ambiguous, not established material scope violations. Original scores and flags were retained rather than replaced after seeing the results. In the appendix, a “hard flag” means a reviewer flagged it; it is not a verified downstream failure. These disputed cases are `context-t05-ambiguous-feature-high-off`, `reasoning-high-t05-ambiguous-feature-low` and `holdout-treatment-h01-refactor-with-exception-low`.

## Hill-climb decisions

The study ceiling was fixed at 116 generation attempts, plus four access probes, with no harness-level automatic retry. It completed 114 study attempts: 111 successful outputs and three timeouts. Each successful output received two independent assessments, totaling 222. This ceiling covered CLI generation attempts, not the host subagents' research/review turns; those additional turns were not counted as CLI calls or given a separate usage total. Internal CLI retries can make additional provider requests, so these counts are not an invoice or underlying HTTP request total. Each generation had a 150-second deadline. Failed calls remain in the database and outside the quality-score denominator. This research cutoff differs from the production helper and panel deadlines; these are test timeouts, not observed plugin failures. Scheduling was seeded, but model sampling was not; each condition has one generation per case. These results screen hypotheses rather than estimate stable model rankings.

1. **Measure the production prompt.** On the six tuning cases, baseline mean scores were 7.25/8 for Haiku/Max, 8.00 for the GPT-6 Sol/High proxy and 6.42 for Opus/Medium. Their median generation times were approximately 89.9, 13.1 and 8.2 seconds. Different CLI wrappers prevent a clean cross-model comparison. One Opus output prescribed memory-only persistence when the user had left persistence undecided; both reviewers flagged it.
2. **Try a shorter shared contract.** This preserved the existing style, larger-task policy, custom-rule handling and English-output suffix. It reduced the median prepared input from 8,165 to 5,414 characters on the tuning set. It failed: Haiku had 0 wins/3 ties/3 losses and a new hard failure; GPT had 0/5/1; Opus had 1/3/2. We rejected it and did not test it on holdout or ship it.
3. **Target the observed decision-making error.** A small addition to the original Opus prompt explicitly kept undecided product choices open, including temporary defaults and assumptions. It removed the observed tuning failure and improved mean score by 0.75, but had 2 wins/2 ties/2 losses. That misses the predeclared allowance of at most one loss. It advanced only as an exploratory holdout test, not an accepted improvement.
4. **Vary reasoning without changing the prompt or context.** Haiku/Medium was much faster on three tuning cases, but introduced a unanimous hard factual failure: it asserted which request produced an error that the user had not attributed. Haiku/High also reduced time but had two quality losses and a disputed scope failure. GPT-6 Sol/Low tied High on all three tuning cases. We froze High for the Haiku exploratory comparison, Low for the GPT proxy and the decision-boundary addition for Opus before generating any holdout output. No subsequent prompt edits were made from holdout results.

The narrow Opus addition and Haiku alternatives did **not** pass the full tuning acceptance gate. Holdout results therefore cannot retroactively turn them into proven winners. GPT's lower reasoning is an efficiency hypothesis, not a quality win, and is measured on a proxy model.

## What held up on unseen outputs

All six holdout requests were run with fresh baseline and treatment generations. Controls and treatments were interleaved. Scores below use only pairs where both outputs succeeded; timeouts are reported separately, never scored as zero.

| Comparison | Scored pairs | Wins / ties / losses | Mean score change /8 | Study timeouts, baseline / treatment | Median seconds, baseline / treatment |
| --- | ---: | --- | ---: | --- | --- |
| Haiku Max → High, same production prompt | 4 of 6 | 1 / 2 / 1 | 0.00 | 2 / 0 | 97.8 / 8.9 |
| GPT-6 Sol High → Low, same production prompt | 6 of 6 | 0 / 6 / 0 | 0.00 | 0 / 0 | 13.3 / 6.7 |
| Opus Medium, production prompt → open-choice addition | 6 of 6 | 2 / 1 / 3 | −1.08 | 0 / 0 | 10.9 / 10.1 |

Latency medians include all successful outputs in each condition. Haiku's two sides therefore contain different case sets; these medians are not a paired speedup estimate. Its High treatment also had a disputed rounding-scope flag on a case whose Max control timed out, so the four scored pairs do not settle that tradeoff. The GPT proxy's lower reasoning matched quality case by case, including the same serious approval error; equal scores do not mean all outputs were correct. The Opus addition regressed on holdout and should not be adopted.

The recorded usage counters help interpret the reasoning experiments. They do not show money charged, and their meanings differ between providers. These are medians over successful holdout outputs; timeout usage is unknown. Claude's reasoning column is `output_tokens_details.thinking_tokens`; Codex's is `reasoning_output_tokens`. Both output columns use the reported `output_tokens`, which includes more than the visible final text.

| Configuration | Successful outputs | Median reported output tokens | Median reported reasoning tokens |
| --- | ---: | ---: | ---: |
| Haiku / Max / baseline | 4 | 23,223 | 22,609.5 |
| Haiku / High / same prompt | 6 | 1,554.5 | 972 |
| GPT-6 Sol / High / baseline | 6 | 580 | 397.5 |
| GPT-6 Sol / Low / same prompt | 6 | 183 | 0 |
| Opus / Medium / baseline | 6 | 905.5 | 127 |
| Opus / Medium / open-choice addition | 6 | 886 | 116 |

Haiku's high reasoning usage at the Max request is consistent with its observed latency; the small study does not establish a reliable quota or speed saving. A zero reported reasoning count is a counter value, not proof of no internal computation. No hidden reasoning text was retained.

The held-out failures provide more useful direction than the overall means:

- **Approval was lost.** Both GPT proxy reasoning settings turned an explicitly approved implementation and staging migration into a plan followed by another approval gate (`h05-explicit-approval`). The current Plan first template says to stop and wait, then says to preserve explicit implementation approval. Those instructions are in tension; this is a plausible contributor, not a proven causal explanation. Resolve the precedence clearly and test it across every style. See [prompt assembly](../../src/prompts.ts#L167).
- **Read-only became “leave no edits behind.”** Both Opus prompt variants permitted temporary logging or edits despite “Do not change anything yet” (`h06-thin-context`). Reverting an edit afterward does not satisfy that boundary.
- **A schema operation was invented.** The Opus addition turned making an existing column nullable into adding a column, with a rollback that drops it (`h05-explicit-approval`). This was prompt text only; no migration or other downstream action ran. It demonstrates why an average score must not conceal an unsupported operation.
- **Specific instructions can already work.** All six holdout custom-format outputs preserved the requested headings, identifiers, numeric value and Unicode comment and received 8/8 (`h04-custom-format-data`). Do not replace precise user instructions with generic workflow requirements.

Across the full study, all **111 successful outputs passed the literal checks**. Reviewers nevertheless flagged material semantic problems in 15 outputs (13 flagged by both). These totals combine different experiments and include the three independently adjudicated ambiguous cases; they are diagnostic counts, not a production failure rate. The raw evidence and per-case appendix allow each flag to be inspected.

## Context findings

The same evidence should not automatically grow because a user selects High. A precise one-file edit can need little project context; an uncertain cross-module investigation can need several relevant files on any model. Public guidance favors clear constraints and relevant evidence, but does not establish this plugin's optimal context budgets. [Anthropic context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents), [OpenAI reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning-best-practices).

Our controlled context comparison used three request-rich tasks on each model configuration. The GPT proxy scored 8/8 in all four variants; median generation time rose from 13.6 seconds without context to 16.9 with the distractor. The other configurations had variable scores and scope/factual failures across variants. There was no consistent quality gain from adding more material. One noisy Haiku/Max generation timed out; a single timeout cannot establish that the distractor caused it, and the surviving outputs' average must not hide that failure.

These tasks are too small to conclude that context is unnecessary, that AI-assisted selection has no value, or that High never benefits from additional evidence. They show that additional context is not an automatic quality improvement on these cases. The “noisy” condition added only one small irrelevant file; it is not a long-context stress test.

The code audit found a real interaction worth preserving in future experiments: **AI-assisted normally uses the selected effort model for selection, and AI Test uses it for research and rewriting.** Changing effort can therefore change the evidence collected, not just rewrite quality. An explicitly configured selector and fallback profiles can change the actual model again. This study froze final context to avoid confusing those effects.

## Reproducible retrieval observations

The [offline probes](../../scripts/eval/context-probes.mjs) call the production functions with synthetic data; their results are also in SQLite.

| Observation | What it means | Suggested next change to evaluate |
| --- | --- | --- |
| Three natural-language Chinese, Japanese and Vietnamese requests yielded no search keywords; English text and explicit paths produced terms | Some valid Unicode requests cannot drive the current keyword retrieval well; other context can still be collected | Preserve useful Unicode terms and evaluate query expansion in an already AI-assisted path; do not assume a Unicode regex alone can translate into English identifiers |
| A file with relevant hits at lines 50 and 100 and long lines retained only lines 46–50 under the excerpt allowance | Finding the right file does not guarantee the relevant evidence survives | Distribute a fixed excerpt budget across distinct hit ranges and definitions/callers |
| A 1,500-character budget produced 1,518 content characters | The trim marker makes the limit approximate | Include marker overhead in accounting; this is a small bookkeeping issue, not evidence of poor model output |

Keep exclusion, confinement, redaction and explicit-attachment rules unchanged. The context probe and existing pipeline tests verify deterministic behavior; they do not prove live retrieval recall or model resistance to malicious files.

## Recommended next work

1. **Keep one shared rewrite policy and independent Context Level selection.** There is no measured basis here for three different system prompts or larger automatic context budgets at High.
2. **Prioritize task boundaries, then uncertainty.** Make explicit current approval take precedence over a style's default stopping point, and preserve read-only requests without temporary-edit exceptions. Test these alongside open decisions, observed-versus-inferred facts and existing-versus-new schema operations. The narrow open-choice addition fixed its motivating failure but regressed on holdout; do not adopt it as tested.
3. **Improve excerpt selection before increasing budgets.** Prioritize relevant hit coverage, relevant rules and source evidence. Evaluate the actual collector on synthetic multi-file projects, then replay the same collected evidence across models to separate retrieval from rewriting.
4. **Treat lower reasoning as a latency option to validate, not an automatic default change.** The current Low preset requests the highest supported reasoning, so it is not necessarily the quickest. Haiku's faster alternatives showed regressions. The GPT proxy has a promising efficiency result, but GPT-6.1 Sol remains untested.
5. **Measure downstream task completion before claiming better coding results.** Compare the original request, original request plus the same permitted context, and the rewritten prompt on disposable projects with fixed destination-agent settings. That experiment was not run here.

## Limits and verification

All model input supplied by the harness was synthetic. The CLI processes used empty temporary working directories, disabled tools and ephemeral/no-persistence options. Local policy inspection found no non-tool lifecycle hooks; one managed PreToolUse hook was present and no tools were exposed. Required telemetry was retained. Managed policy, CLI system/skill instructions, reasoning caps, cache behavior and model backend drift may still differ from Copilot. In particular, Codex JSONL did not attest its resolved model, and neither route independently attested the effective reasoning level. The [isolation review](prompt-tuning-evidence.md) details these limits.

Subscription authentication does not prove zero monetary overage. CLI API-price estimates were recorded as estimates only; no actual subscription or Copilot charge is inferred. This study made no Copilot inference requests and changed no account, plugin installation or model entitlement.

The sample has six holdout cases, one output per condition, no independent human scoring, no downstream execution and no multimodal attachment test. Public holdout inputs were authored and readable before the experiment; their outputs were withheld until the final candidates were frozen. Tuning baselines were reused for context/reasoning comparisons, while holdout controls and treatments were freshly interleaved. There is no confidence claim, population-wide ranking or guaranteed speedup.

Repository verification passed: `npm run typecheck`, `npm run build`, the post-build full suite (**367 tests**), and `npm run check`. Rebuilding produced no changes to the committed extension/web assets. The 20 added offline tests exercise the corpus, construction, budget/resume rules, evidence persistence, review validation, subscription environment and read-only report output; none invokes a model. The earlier 86-test context/prompt audit also passed; a conditional Windows file-symlink branch was not exercised because file links could not be created.

No desktop or browser UI was controlled. Production Copilot parity, true runtime billing, downstream success and broader/repeated sampling remain unverified. No visual check is required for these research-only changes.
