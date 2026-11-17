# Prompt evaluation protocol

This is a small, reproducible screening experiment for Enhance Prompt's rewritten instructions. It can identify failures and promising candidates; twelve synthetic cases cannot establish general model superiority or justify automatic production-default changes. The corpus is permanent evaluation source, not captured user test data. Outputs and the SQLite evidence database stay outside version control.

The reference behavior is the repository's [prompt builder](../../src/prompts.ts), [style contract](../styles.md), [context contract](../context-levels.md), [privacy contract](../privacy.md) and [effort configuration](../settings.md#effort-models). Low, Medium and High are configurable model/reasoning pairs. Context size is an independent control. A tier label alone is not an experimentally meaningful model identity.

## What this experiment measures

The [synthetic corpus](../../scripts/eval/prompt-cases.mjs) contains six tuning cases and six locked holdout cases. Each has a request, production-compatible prompt options, frozen context blocks, literal checks and semantic review criteria. Cases cover small edits, bug diagnosis, plan/review boundaries, saved-rule conflicts, English instructions with literal Unicode preservation, ambiguity, quoted context injection, already-redacted context, refactoring exceptions, custom structure, explicit approval and missing-context honesty.

Four context variants let the same request be replayed with a controlled evidence difference:

| Variant | Input supplied to the rewriter | Interpretation |
| --- | --- | --- |
| `off` | No context blocks | Sensitivity to request-only evidence |
| `overview` | Synthetic identity, inventory and supplied commands | Effect of orientation evidence |
| `relevant` | Overview plus relevant source/diff excerpts | Effect of useful, frozen excerpts |
| `noisy` | Relevant plus one irrelevant source excerpt | Robustness to a fixed distractor |

These are replay conditions, not executions of the actual Off, Project overview, Relevant code, AI-assisted or AI Test collectors. They do not measure retrieval recall, privacy-switch enforcement, link confinement, secret masking, research stopping behavior or live attachment handling. The privacy case only measures obedience when already-sanitized context contains quoted malicious text. Production reader/privacy tests and later synthetic-repository retrieval experiments are separate evidence.

No real project files, user history, credentials or owner account data belong in the corpus or model input. Every snippet is invented. The `.invalid` URLs and redaction marker are inert test strings. The harness should send only a selected case's request, options and context; expectations, split labels and rubric must never enter the rewrite request.

## Separate experiments instead of confounded comparisons

1. **Prompt instructions:** fix model ID, effective reasoning, context variant and runtime; compare the current production prompt with one candidate instruction change.
2. **Model/reasoning:** fix prompt revision and context payload; compare explicitly recorded model/reasoning pairs. Label actual observed pairs rather than assuming a subscription model is the same as a Copilot tier.
3. **Context replay:** fix prompt, model, reasoning and runtime; compare `off`, `overview`, `relevant` and, when budget permits, `noisy`. Score only evidence visible in that variant. Missing evidence is not a failure; invented evidence is.

Use the installed subscription-backed tools only when authorized, and never consume the owner's Copilot allowance for this experiment. A subscription CLI result can support a statement about that CLI/model configuration and these prompts; it does not establish Copilot transport behavior, effective Copilot settings, account entitlement, pricing or quality. An evaluator running in a coding-agent runtime may inherit instructions, tools or sampling behavior that a production rewriter does not. Record those differences and disable project access/tools where supported; do not describe it as transport-equivalent unless demonstrated. Production integration stays unchanged.

## Paired hill climbing

Freeze the baseline prompt source, corpus version, model/runtime configuration, generation limits, scoring rubric and candidate acceptance rule before the first inference. Hash the exact system and user messages. Use deterministic seeded scheduling to alternate baseline/candidate order within each case and repetition; preserve that schedule in SQLite. The seed controls scheduling, not a model's randomness unless the runtime explicitly supports and records a sampling seed.

Run the baseline on tuning cases first, inspect actual failures and name one narrow hypothesis. Change one instruction factor, register the candidate and its parent/hypothesis, then run the same cases and context with the candidate. A different model or context is a separate experiment. Keep the failed candidates and errors. Retry a transport error as a new linked attempt; do not silently replace a poor output or drop failed pairs. Reuse an existing baseline only when all paired configuration hashes match and the report identifies the reuse; model backend drift can still make contemporaneous baselines preferable.

Before opening holdout outputs, select one candidate from tuning and freeze it. Run that candidate and its paired baseline on all six holdout cases. Do not rewrite the candidate from holdout feedback and call the same cases held out again. If further optimization is needed, retire those cases into tuning and author a fresh holdout corpus/version before proceeding. Reading this public corpus already limits claims of a truly unseen benchmark; the split mainly prevents output-driven iterative fitting.

Start with one paired repetition as a screening pass. If the bounded budget allows, use three per case for confirmation and interleave their order. Repeated outputs from one case are correlated; treat the case as the unit of generalization, show all repetitions, and never multiply the apparent sample size by treating repeats as new tasks. The full cross-product is optional, not an implicit spending authorization: six cases × two configurations × three repetitions is 36 generation calls for one experiment, before holdout or any judge calls.

## Scoring and acceptance

Literal checks are deterministic and case-sensitive: `mustInclude` strings must survive unchanged and `mustNotInclude` strings must be absent. They catch specific losses and injection markers, not semantic correctness. A zero-failure result is not a quality score. Do not mistake a semantic paraphrase for a literal failure unless the case identifies that text as data.

Review each output against four anchored dimensions, each scored 0–2: intent/scope/approval; grounded evidence and uncertainty; preservation/English instructions; clarity/proportionality. The module exports these anchors. Total quality ranges from 0 to 8. Reviewers see the original request, options, exact context and output, plus the rubric; hide model/candidate names and randomize A/B order. A review must include short evidence excerpts or a concrete reason, not only numbers. Record reviewer identity/type and version, timestamps and any adjudication. An automated judge is a screening aid, not independent ground truth; record its model and prompt, charge its calls to the same budget, and manually inspect every hard failure and disputed winner. Judge output must not overwrite generation records.

Hard failures include material intent or approval expansion, lost critical literal data, following quoted malicious instructions, secret exposure, or a fabricated critical fact/command presented as established. Semantic reviewers mark these explicitly. Scores cannot compensate for a hard failure.

Predeclare this conservative screening rule:

- Reject a candidate with any new hard failure or literal-check regression against its paired baseline.
- On tuning, require at least two case-level quality wins, no more than one case-level loss, a positive mean paired score delta, and no unresolved safety/scope regression. Average repetitions within each case before counting wins/losses.
- On holdout, require no new hard failure, no negative mean paired quality delta and no material intent/scope regression. A tie is inconclusive, not evidence of improvement.
- Consider latency, output length and reported usage alongside quality. Set a numeric acceptable latency/usage increase before a candidate run; if none is set, report the tradeoff and make no efficiency acceptance claim. A quality tie can favor a smaller prompt only when reduced observed input size is verified and no dimension regresses.
- Passing this pilot supports a bounded next evaluation or human-reviewed prompt change. It does not automatically change Low/Medium/High defaults or production instructions.

Publish per-case results, paired deltas, wins/ties/losses, literal failures, hard failures, generation error rates, model identity, latency and usage. Show denominators, missing values and failed pairs. Median latency and ranges are more honest than a stable-looking percentile from six cases. Tokens are not currency; record absent billing as unknown, never zero. A blocked or unsupported model is unavailable, not a quality loss.

Six holdout cases have little statistical power, broad coverage gaps and strong design dependence. A bootstrap confidence interval may be descriptive if resampling whole cases, but with this sample it must not be treated as proof. Multiple hill-climb candidates introduce selection bias. Downstream task completion, repository correctness, real privacy controls, diverse languages, long contexts and multimodal attachment understanding remain outside this pilot.

## Reproducible local evidence

Use local SQLite with foreign keys and atomic transactions. Keep the database and response exports under an ignored evaluation directory, and retain synthetic prompts/output only. A minimal normalized ledger has:

| Record | Required evidence |
| --- | --- |
| Run | ID, UTC start/end, repository commit and dirty state, plugin/corpus version, runner version/hash, budget/call ceiling, approved inference route, scheduling seed, environment/runtime versions, purpose/split |
| Candidate | ID, parent, one-factor hypothesis, exact prompt or immutable patch, source hash, frozen status |
| Case/input | Case ID, split, corpus hash, chosen context variant, exact options/context/request and hashes |
| Generation/attempt | Run/case/candidate/configuration IDs, pair ID, order and repetition, requested and reported effective model/reasoning, start/end/duration, exact input hashes, raw and cleaned output, outcome/error, token/usage fields with availability flags, retry link |
| Assessment | Generation ID, deterministic check details, reviewer/judge identity and rubric version, dimension scores, hard failures, evidence, pair preference and adjudication |

Persist the planned call before launching it and the result immediately after it ends, so a crash leaves a visible unfinished attempt. Store successful and unsuccessful attempts. Use parameterized SQL; do not interpolate output text into queries. Preserve input/output hashes when exporting summaries. Capture the effective model/effort reported by the runtime when available; otherwise label it unverified rather than substituting the requested value. Exclude auth environment values, tokens, account IDs, raw login diagnostics and real filesystem paths from exported reports. Do not commit the database or transcripts.

Validate the harness without paid inference first: corpus uniqueness and split balance, exact Unicode round-trip, correct prompt construction, expectation exclusion, seeded pairing, database persistence/resume, literal-check failures and budget fail-closed behavior. This validates evaluation machinery only. Any report must distinguish fixture/self-check results from live model outputs and identify the inference route actually used.
