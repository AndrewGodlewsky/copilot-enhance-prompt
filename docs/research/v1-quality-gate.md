# Paired prompt-quality gate before v1

**No new model-quality result is claimed.** This release prepares 48 paired inputs in an offline SQLite ledger: eight new synthetic holdout requests × three target tiers × original/enhanced prompt sets. Generation, judging and downstream execution are pending route/budget approval. Existing defaults, context depth and both prompt sets remain unchanged. Track [#31](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/31).

## Why another study

The [earlier study](prompt-evaluation-findings.md) used the original 0.11.2 builder, some experimental additions and a GPT-6 Sol proxy. It found regressions and disputed semantic judgments; it did not establish improvement by the current enhanced prompt set or GPT-6.1 Sol. Literal interpolation tests prove assembly, not model understanding. Repeating the previous visible outputs would not be a new holdout test.

The new public synthetic corpus in `scripts/eval/v1-cases.mjs` covers explanation versus implementation, explicit approval versus Plan first style, exact composed/decomposed Unicode, undecided product choices, delegated choices and explicit behavior exceptions, ambiguous error attribution, context injection, and conflicting custom rules. These eight cases prioritize known failure boundaries; they are not exhaustive coverage of every style, images, retrieval or coding task.

## Prepare without inference

```powershell
node scripts/eval/v1-prepare.mjs .artifacts/v1-paired-prepared
```

Use a new directory; existing output is refused. The command builds both actual production prompt sets with identical request/context for each pair, and freezes exact system/user text, input hashes, synthetic criteria, requested target model/reasoning, plugin version and relevant source hashes in `results.sqlite`. `protocol.json` has a **zero call ceiling** and `executionAuthorized: false`. No provider runner, account credentials or network is used. The ledger cannot claim a generation under that ceiling.

This command only stages inputs. The old `research.mjs run` command prepares its older corpus/candidates and must not be used to regenerate these pairs. After explicit authorization, use a separately reviewed executor reading these exact frozen rows into a new approved run ledger; retain this zero-call preparation and its hash. Do not edit a frozen protocol in place or silently execute through Copilot.

The [prepared protocol manifest](v1-preparation.json) records 48 staged rows and the exact input/source hashes for 0.12.31. All rows were unstarted and the zero-call guard was tested. This is assembly evidence only; it contains no generated model outputs or quality scores.

Target configurations are Haiku 5.5 / Max, GPT-6.1 Sol / High and Opus 5.5 / Medium. These are hypotheses to evaluate, not verified subscription availability or effective reasoning. Record the actual route/version, requested and reported model, reasoning support/attestation and all failures. Unavailable/mismatched targets stay unavailable; no silent GPT proxy. A subscription route still cannot prove Copilot-runtime equivalence.

## Predeclared comparison and scoring

Freeze candidates and source hashes before generating holdout outputs. Interleave each pair with balanced original/enhanced order; record the scheduling seed. Sampling is not made deterministic by that seed. One generation per condition gives 24 pairs and is only a screening study. Do not tune on these outputs; a changed candidate needs new holdout cases and a new protocol.

Use the earlier four 0–2 rubric dimensions: intent/scope/approval, grounding/uncertainty, literal/language preservation, and clarity/proportionality. Keep semantic hard failures separate: unauthorized implementation/destruction, invented decisive facts, erased approvals/constraints, or material literal corruption. Two independent blinded reviewers see only the request, permitted evidence, criteria and output—not set, tier, system instructions, model identity or ordering key. Retain disagreements and adjudication; averages never cancel a hard failure. LLM reviews are not human ground truth and need their own authorized resource budget.

For each output, sum each reviewer's four scores to a 0–8 total, then take the arithmetic mean of the two totals without rounding. Compare these output means within each task/tier pair: enhanced greater than original is a win, equal is a tie, and lower is a loss. Retain both raw ratings, the mean and the paired difference. Missing ratings make the pair incomplete; do not impute a score.

A hard failure is confirmed when both reviewers independently identify the same failure with supporting output/input evidence, or a blinded human adjudicator confirms a disputed flag with a recorded rationale. Reviewer agreement is evidence, not infallible ground truth. Preserve every flag and any adjudicated correction. Unresolved disputes make the tier inconclusive; never drop them or average them away. A new hard failure means a confirmed failure in the enhanced output without the same confirmed failure in its paired original output. Report original failures too. The preparation manifest hashes this method document so later execution must retain these scoring and adjudication rules.

Record every attempted pair, timeout, cancellation, unavailable/model-mismatch result and retry lineage in SQLite. Failed output has no quality score. Report per-tier paired wins/ties/losses and score differences, complete-pair denominators, missing-pair reasons, hard-failure counts, elapsed time, prepared input/output size and reported usage. Aggregate by task; two ratings are not two independent tasks. Do not infer invoice cost from token counts or compare cross-provider latency as solely a model difference.

Screening gate per tier: no new confirmed hard failure, at most one quality loss among eight complete pairs, and at least three wins. Any missing pair makes that tier inconclusive. Passing this small gate only qualifies a candidate for downstream testing; it does not prove superiority or authorize a default change. Report failures even if a different tier looks better.

## Separate subsequent experiments

| Question | Hold fixed | Vary / measure |
| --- | --- | --- |
| Does the prompt set improve rewriting? | Actual model/reasoning and exact prepared evidence | Original/enhanced instructions; paired semantic/literal quality. This is the prepared stage. |
| Does reasoning trade latency for quality? | Prompt set, model and evidence | Only advertised reasoning levels; same task pairs and failure/usage accounting. Requires a separately approved plan. |
| Is more context helpful? | Prompt set, rewrite model/reasoning | Frozen Off/overview/relevant/noisy evidence. Measure provenance and grounding; no automatic effort-to-context mapping. |
| Does AI retrieval help? | Request, source checkout/privacy, rewrite model/set | Actual permitted AI-assisted/AI Test selection versus deterministic context. Record selected paths/excerpts, bounds, extra calls and failures. Replayed context is not retrieval evaluation. |
| Does the destination agent succeed? | Disposable checkout, destination model/tools/budget and verification | Original request versus original-set rewrite versus enhanced-set rewrite, separate fresh sessions. Count prohibited edits as failure for read-only tasks; verify exact edits/tests for implementation and retained uncertainty for plans. Include unsuccessful runs. |

Downstream execution must use synthetic owned repositories and prevent destructive/network/provider side effects. Restore from immutable fixtures, never the owner's project. Approve a separate model/judging/call budget first; 48 rewrite attempts do not include access probes, judges, retries or destination-agent runs. Full v1 claims need broader tasks/repeats and downstream evidence, not only this screen.

## Evidence hygiene and completion

Keep exact synthetic inputs/outputs and SQLite evidence in ignored `.artifacts`; publish sanitized protocol hashes, per-case aggregates, failures and limitations. Never include actual project content, credentials, account login, raw auth output or hidden reasoning. Source fixtures and offline unit tests are committed. Tests verify pair construction, byte-exact literals, fallback selection and the zero-call ledger; they do not score model quality.

Keep #31 open until an authorized route, actual target identities, paired evidence and downstream results meet the declared scope. If target access is absent, report that gate explicitly. Existing **Use enhanced prompts** and independent **Context Level** stay as they are; no new per-model forks or context growth are justified by preparing this study.
