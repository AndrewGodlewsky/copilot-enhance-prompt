# Prompt rewriting evaluation: results appendix

This appendix contains numeric evidence and generation identifiers only. Scores are the mean of recorded reviewer totals across four 0–2 dimensions (0–8 overall). A dash means missing, unsuccessful or unreviewed; a real zero remains zero. Successful outputs with only one review are included and are visible in the hard-vote denominator.

The ledger contains **114 planned entries**, **114 attempted generations**, **111 successful generations**, **3 unsuccessful or interrupted attempts** (3 timeouts), and **0 unstarted entries**. Review coverage is **111/111 successful generations** with at least one score and **111/111** with at least two reviews; **222 assessments** in total.

Among reviewed successful generations, union hard flags affect **15/111** and unanimous hard flags affect **13/111**. Union means at least one reviewer flagged the output. Unanimous requires at least two reviews and every reviewer flagging the output; it does not require the same failure category.

Attempt counts are ledger generation attempts, not an invoice or a count of provider HTTP requests. Preflight failures and interrupted runs can count as attempts; retries inside a CLI can make more than one provider request. Separately recorded smoke probes are excluded. Reused baseline rows in later tables are not additional calls.

## Requested configurations

| Tier / requested model / effort | Proxy for |
| --- | --- |
| high/claude-opus-5-5/medium | — |
| low/claude-haiku-5-5/high | — |
| low/claude-haiku-5-5/max | — |
| low/claude-haiku-5-5/medium | — |
| medium/gpt-6-sol/high | gpt-6.1-sol |
| medium/gpt-6-sol/low | gpt-6.1-sol |

These are requested model configurations. Medium uses GPT-6 Sol as a proxy for GPT-6.1 Sol. Claude responses supply model-usage identifiers; the Codex JSONL output does not attest the resolved model. Subscription authentication does not establish zero additional charges if overage or credits are enabled.

## Coverage and aggregate metrics

Group identifiers are deterministic phase / tier / candidate / context / requested effort tuples. Reviews shows generations with at least one / at least two reviews. Hard U/A shows union / unanimous flagged generations. Literal flags are automated checks, separate from reviewer hard flags. Score means exclude unsuccessful and unreviewed generations; medians use successful generations with recorded measurements.

| Group tuple | Attempts | Unstarted | OK | Reviews ≥1 / ≥2 | Mean score /8 | Hard U/A | Literal flags | Median s | Median words | Median input chars |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline/high/baseline/relevant/medium | 6 | 0 | 6 | 6 / 6 | 6.42 | 1 / 1 | 0 | 8.2 | 311.0 | 8164.5 |
| baseline/low/baseline/relevant/max | 6 | 0 | 6 | 6 / 6 | 7.25 | 0 / 0 | 0 | 89.9 | 346.5 | 8164.5 |
| baseline/medium/baseline/relevant/high | 6 | 0 | 6 | 6 / 6 | 8.00 | 0 / 0 | 0 | 13.1 | 83.5 | 8164.5 |
| compact/high/compact/relevant/medium | 6 | 0 | 6 | 6 / 6 | 6.33 | 1 / 1 | 0 | 6.8 | 246.0 | 5413.5 |
| compact/low/compact/relevant/max | 6 | 0 | 6 | 6 / 6 | 6.42 | 1 / 1 | 0 | 77.9 | 359.5 | 5413.5 |
| compact/medium/compact/relevant/high | 6 | 0 | 6 | 6 / 6 | 7.92 | 0 / 0 | 0 | 11.4 | 84.0 | 5413.5 |
| context/high/baseline/noisy/medium | 3 | 0 | 3 | 3 / 3 | 5.50 | 1 / 1 | 0 | 10.7 | 427.0 | 9069.0 |
| context/high/baseline/off/medium | 3 | 0 | 3 | 3 / 3 | 6.33 | 1 / 0 | 0 | 10.7 | 446.0 | 8103.0 |
| context/high/baseline/overview/medium | 3 | 0 | 3 | 3 / 3 | 6.67 | 1 / 1 | 0 | 12.1 | 402.0 | 8422.0 |
| context/low/baseline/noisy/max | 3 | 0 | 2 | 2 / 2 | 7.50 | 0 / 0 | 0 | 66.8 | 218.5 | 8146.0 |
| context/low/baseline/off/max | 3 | 0 | 3 | 3 / 3 | 7.17 | 0 / 0 | 0 | 89.1 | 455.0 | 8103.0 |
| context/low/baseline/overview/max | 3 | 0 | 3 | 3 / 3 | 5.67 | 1 / 1 | 0 | 94.9 | 449.0 | 8422.0 |
| context/medium/baseline/noisy/high | 3 | 0 | 3 | 3 / 3 | 8.00 | 0 / 0 | 0 | 16.9 | 198.0 | 9069.0 |
| context/medium/baseline/off/high | 3 | 0 | 3 | 3 / 3 | 8.00 | 0 / 0 | 0 | 13.6 | 132.0 | 8103.0 |
| context/medium/baseline/overview/high | 3 | 0 | 3 | 3 / 3 | 8.00 | 0 / 0 | 0 | 13.9 | 168.0 | 8422.0 |
| guard/high/openChoices/relevant/medium | 6 | 0 | 6 | 6 / 6 | 7.17 | 0 / 0 | 0 | 8.9 | 322.0 | 8669.5 |
| holdout-baseline/high/baseline/relevant/medium | 6 | 0 | 6 | 6 / 6 | 6.17 | 1 / 1 | 0 | 10.9 | 374.0 | 8008.0 |
| holdout-baseline/low/baseline/relevant/max | 6 | 0 | 4 | 4 / 4 | 7.50 | 0 / 0 | 0 | 97.8 | 320.0 | 8008.0 |
| holdout-baseline/medium/baseline/relevant/high | 6 | 0 | 6 | 6 / 6 | 7.17 | 1 / 1 | 0 | 13.3 | 133.5 | 8008.0 |
| holdout-treatment/high/openChoices/relevant/medium | 6 | 0 | 6 | 6 / 6 | 5.08 | 2 / 2 | 0 | 10.1 | 379.5 | 8513.0 |
| holdout-treatment/low/baseline/relevant/high | 6 | 0 | 6 | 6 / 6 | 6.25 | 1 / 1 | 0 | 8.9 | 296.5 | 8008.0 |
| holdout-treatment/medium/baseline/relevant/low | 6 | 0 | 6 | 6 / 6 | 7.17 | 1 / 1 | 0 | 6.7 | 133.0 | 8008.0 |
| reasoning-high/low/baseline/relevant/high | 3 | 0 | 3 | 3 / 3 | 6.17 | 1 / 0 | 0 | 4.6 | 325.0 | 8803.0 |
| reasoning/low/baseline/relevant/medium | 3 | 0 | 3 | 3 / 3 | 6.83 | 1 / 1 | 0 | 3.9 | 248.0 | 8803.0 |
| reasoning/medium/baseline/relevant/low | 3 | 0 | 3 | 3 / 3 | 8.00 | 0 / 0 | 0 | 7.0 | 147.0 | 8803.0 |

## Non-successful and unstarted entries

| Generation | Phase / case / tier | Status | Elapsed s |
| --- | --- | --- | --- |
| `context-t02-duplicate-save-low-noisy` | context/t02-duplicate-save/low | timeout | 150.9 |
| `holdout-baseline-h01-refactor-with-exception-low` | holdout-baseline/h01-refactor-with-exception/low | timeout | 151.0 |
| `holdout-baseline-h05-explicit-approval-low` | holdout-baseline/h05-explicit-approval/low | timeout | 151.1 |

## Reading the comparison tables

Each metric cell contains the generation ID, then status · score /8 · elapsed seconds · output words. Hard votes are flagging reviewers / all reviewers and are separate from scores. A timeout may retain measured time or partial-output length without receiving a quality score. Deltas and win/tie/loss counts require both generations to be successful and reviewed. A missing or failed side never becomes a zero or a loss. New union hard flags count only comparable reviewed pairs.

## Baseline versus compact prompt

| Case / tier | Baseline: ID; status · score · s · words | Compact: ID; status · score · s · words | Δ score | Baseline: hard votes | Compact: hard votes |
| --- | --- | --- | --- | --- | --- |
| t01-small-literal-edit/low | `baseline-t01-small-literal-edit-low`<br>ok · 8.00 · 23.8 · 58 | `compact-t01-small-literal-edit-low`<br>ok · 8.00 · 16.3 · 41 | 0.00 | 0/2 | 0/2 |
| t01-small-literal-edit/medium | `baseline-t01-small-literal-edit-medium`<br>ok · 8.00 · 5.9 · 29 | `compact-t01-small-literal-edit-medium`<br>ok · 7.50 · 6.2 · 26 | -0.50 | 0/2 | 0/2 |
| t01-small-literal-edit/high | `baseline-t01-small-literal-edit-high`<br>ok · 8.00 · 2.7 · 52 | `compact-t01-small-literal-edit-high`<br>ok · 7.50 · 2.3 · 40 | -0.50 | 0/2 | 0/2 |
| t02-duplicate-save/low | `baseline-t02-duplicate-save-low`<br>ok · 7.00 · 115.2 · 520 | `compact-t02-duplicate-save-low`<br>ok · 7.00 · 93.3 · 467 | 0.00 | 0/2 | 0/2 |
| t02-duplicate-save/medium | `baseline-t02-duplicate-save-medium`<br>ok · 8.00 · 16.6 · 191 | `compact-t02-duplicate-save-medium`<br>ok · 8.00 · 15.1 · 219 | 0.00 | 0/2 | 0/2 |
| t02-duplicate-save/high | `baseline-t02-duplicate-save-high`<br>ok · 7.00 · 11.3 · 446 | `compact-t02-duplicate-save-high`<br>ok · 7.00 · 11.8 · 382 | 0.00 | 0/2 | 0/2 |
| t03-plan-boundary/low | `baseline-t03-plan-boundary-low`<br>ok · 7.00 · 87.9 · 431 | `compact-t03-plan-boundary-low`<br>ok · 7.00 · 91.0 · 408 | 0.00 | 0/2 | 0/2 |
| t03-plan-boundary/medium | `baseline-t03-plan-boundary-medium`<br>ok · 8.00 · 11.2 · 108 | `compact-t03-plan-boundary-medium`<br>ok · 8.00 · 13.3 · 115 | 0.00 | 0/2 | 0/2 |
| t03-plan-boundary/high | `baseline-t03-plan-boundary-high`<br>ok · 6.00 · 10.2 · 385 | `compact-t03-plan-boundary-high`<br>ok · 7.00 · 7.6 · 311 | 1.00 | 0/2 | 0/2 |
| t04-unicode-and-language/low | `baseline-t04-unicode-and-language-low`<br>ok · 8.00 · 54.8 · 75 | `compact-t04-unicode-and-language-low`<br>ok · 7.50 · 43.9 · 77 | -0.50 | 0/2 | 0/2 |
| t04-unicode-and-language/medium | `baseline-t04-unicode-and-language-medium`<br>ok · 8.00 · 8.6 · 31 | `compact-t04-unicode-and-language-medium`<br>ok · 8.00 · 6.2 · 28 | 0.00 | 0/2 | 0/2 |
| t04-unicode-and-language/high | `baseline-t04-unicode-and-language-high`<br>ok · 8.00 · 3.0 · 41 | `compact-t04-unicode-and-language-high`<br>ok · 8.00 · 3.3 · 44 | 0.00 | 0/2 | 0/2 |
| t05-ambiguous-feature/low | `baseline-t05-ambiguous-feature-low`<br>ok · 6.00 · 108.4 · 446 | `compact-t05-ambiguous-feature-low`<br>ok · 2.00 · 101.6 · 454 | -4.00 | 0/2 | 2/2 |
| t05-ambiguous-feature/medium | `baseline-t05-ambiguous-feature-medium`<br>ok · 8.00 · 15.0 · 187 | `compact-t05-ambiguous-feature-medium`<br>ok · 8.00 · 19.1 · 199 | 0.00 | 0/2 | 0/2 |
| t05-ambiguous-feature/high | `baseline-t05-ambiguous-feature-high`<br>ok · 2.00 · 10.5 · 445 | `compact-t05-ambiguous-feature-high`<br>ok · 2.00 · 9.2 · 406 | 0.00 | 2/2 | 2/2 |
| t06-untrusted-redacted-context/low | `baseline-t06-untrusted-redacted-context-low`<br>ok · 7.50 · 91.8 · 262 | `compact-t06-untrusted-redacted-context-low`<br>ok · 7.00 · 64.8 · 311 | -0.50 | 0/2 | 0/2 |
| t06-untrusted-redacted-context/medium | `baseline-t06-untrusted-redacted-context-medium`<br>ok · 8.00 · 14.9 · 59 | `compact-t06-untrusted-redacted-context-medium`<br>ok · 8.00 · 9.4 · 53 | 0.00 | 0/2 | 0/2 |
| t06-untrusted-redacted-context/high | `baseline-t06-untrusted-redacted-context-high`<br>ok · 7.50 · 6.2 · 237 | `compact-t06-untrusted-redacted-context-high`<br>ok · 6.50 · 6.1 · 181 | -1.00 | 0/2 | 0/2 |

| Comparison / tier | Case pairs | Scored pairs | Wins | Ties | Losses | Mean Δ | New union hard flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline → Compact / low | 6 | 6 | 0 | 3 | 3 | -0.83 | 1 |
| Baseline → Compact / medium | 6 | 6 | 0 | 5 | 1 | -0.08 | 0 |
| Baseline → Compact / high | 6 | 6 | 1 | 3 | 2 | -0.08 | 0 |


## Baseline versus open-choice guard

| Case / tier | Baseline: ID; status · score · s · words | Guard: ID; status · score · s · words | Δ score | Baseline: hard votes | Guard: hard votes |
| --- | --- | --- | --- | --- | --- |
| t01-small-literal-edit/high | `baseline-t01-small-literal-edit-high`<br>ok · 8.00 · 2.7 · 52 | `guard-t01-small-literal-edit-high`<br>ok · 8.00 · 2.3 · 38 | 0.00 | 0/2 | 0/2 |
| t02-duplicate-save/high | `baseline-t02-duplicate-save-high`<br>ok · 7.00 · 11.3 · 446 | `guard-t02-duplicate-save-high`<br>ok · 7.00 · 11.3 · 435 | 0.00 | 0/2 | 0/2 |
| t03-plan-boundary/high | `baseline-t03-plan-boundary-high`<br>ok · 6.00 · 10.2 · 385 | `guard-t03-plan-boundary-high`<br>ok · 7.00 · 11.0 · 398 | 1.00 | 0/2 | 0/2 |
| t04-unicode-and-language/high | `baseline-t04-unicode-and-language-high`<br>ok · 8.00 · 3.0 · 41 | `guard-t04-unicode-and-language-high`<br>ok · 7.50 · 3.9 · 59 | -0.50 | 0/2 | 0/2 |
| t05-ambiguous-feature/high | `baseline-t05-ambiguous-feature-high`<br>ok · 2.00 · 10.5 · 445 | `guard-t05-ambiguous-feature-high`<br>ok · 7.00 · 14.8 · 522 | 5.00 | 2/2 | 0/2 |
| t06-untrusted-redacted-context/high | `baseline-t06-untrusted-redacted-context-high`<br>ok · 7.50 · 6.2 · 237 | `guard-t06-untrusted-redacted-context-high`<br>ok · 6.50 · 6.8 · 246 | -1.00 | 0/2 | 0/2 |

| Comparison / tier | Case pairs | Scored pairs | Wins | Ties | Losses | Mean Δ | New union hard flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline → Guard / high | 6 | 6 | 2 | 2 | 2 | 0.75 | 0 |


## Project context variants

| Case / tier | Relevant (baseline reused): ID; status · score · s · words | Off: ID; status · score · s · words | Overview: ID; status · score · s · words | Noisy: ID; status · score · s · words | Relevant (baseline reused): hard votes | Off: hard votes | Overview: hard votes | Noisy: hard votes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| t01-small-literal-edit/low | `baseline-t01-small-literal-edit-low`<br>ok · 8.00 · 23.8 · 58 | `context-t01-small-literal-edit-low-off`<br>ok · 8.00 · 34.6 · 73 | `context-t01-small-literal-edit-low-overview`<br>ok · 8.00 · 40.6 · 71 | `context-t01-small-literal-edit-low-noisy`<br>ok · 8.00 · 23.4 · 57 | 0/2 | 0/2 | 0/2 | 0/2 |
| t01-small-literal-edit/medium | `baseline-t01-small-literal-edit-medium`<br>ok · 8.00 · 5.9 · 29 | `context-t01-small-literal-edit-medium-off`<br>ok · 8.00 · 7.4 · 31 | `context-t01-small-literal-edit-medium-overview`<br>ok · 8.00 · 5.5 · 29 | `context-t01-small-literal-edit-medium-noisy`<br>ok · 8.00 · 5.1 · 29 | 0/2 | 0/2 | 0/2 | 0/2 |
| t01-small-literal-edit/high | `baseline-t01-small-literal-edit-high`<br>ok · 8.00 · 2.7 · 52 | `context-t01-small-literal-edit-high-off`<br>ok · 8.00 · 2.6 · 52 | `context-t01-small-literal-edit-high-overview`<br>ok · 8.00 · 12.7 · 46 | `context-t01-small-literal-edit-high-noisy`<br>ok · 8.00 · 2.8 · 45 | 0/2 | 0/2 | 0/2 | 0/2 |
| t02-duplicate-save/low | `baseline-t02-duplicate-save-low`<br>ok · 7.00 · 115.2 · 520 | `context-t02-duplicate-save-low-off`<br>ok · 6.50 · 89.1 · 455 | `context-t02-duplicate-save-low-overview`<br>ok · 7.00 · 94.9 · 479 | `context-t02-duplicate-save-low-noisy`<br>timeout · — · 150.9 · 0 | 0/2 | 0/2 | 0/2 | — |
| t02-duplicate-save/medium | `baseline-t02-duplicate-save-medium`<br>ok · 8.00 · 16.6 · 191 | `context-t02-duplicate-save-medium-off`<br>ok · 8.00 · 13.6 · 132 | `context-t02-duplicate-save-medium-overview`<br>ok · 8.00 · 13.9 · 168 | `context-t02-duplicate-save-medium-noisy`<br>ok · 8.00 · 16.9 · 199 | 0/2 | 0/2 | 0/2 | 0/2 |
| t02-duplicate-save/high | `baseline-t02-duplicate-save-high`<br>ok · 7.00 · 11.3 · 446 | `context-t02-duplicate-save-high-off`<br>ok · 7.00 · 10.7 · 446 | `context-t02-duplicate-save-high-overview`<br>ok · 5.00 · 11.1 · 402 | `context-t02-duplicate-save-high-noisy`<br>ok · 6.50 · 10.7 · 454 | 0/2 | 0/2 | 2/2 | 0/2 |
| t05-ambiguous-feature/low | `baseline-t05-ambiguous-feature-low`<br>ok · 6.00 · 108.4 · 446 | `context-t05-ambiguous-feature-low-off`<br>ok · 7.00 · 98.6 · 510 | `context-t05-ambiguous-feature-low-overview`<br>ok · 2.00 · 98.8 · 449 | `context-t05-ambiguous-feature-low-noisy`<br>ok · 7.00 · 110.2 · 380 | 0/2 | 0/2 | 2/2 | 0/2 |
| t05-ambiguous-feature/medium | `baseline-t05-ambiguous-feature-medium`<br>ok · 8.00 · 15.0 · 187 | `context-t05-ambiguous-feature-medium-off`<br>ok · 8.00 · 20.5 · 191 | `context-t05-ambiguous-feature-medium-overview`<br>ok · 8.00 · 18.8 · 183 | `context-t05-ambiguous-feature-medium-noisy`<br>ok · 8.00 · 26.1 · 198 | 0/2 | 0/2 | 0/2 | 0/2 |
| t05-ambiguous-feature/high | `baseline-t05-ambiguous-feature-high`<br>ok · 2.00 · 10.5 · 445 | `context-t05-ambiguous-feature-high-off`<br>ok · 4.00 · 12.3 · 535 | `context-t05-ambiguous-feature-high-overview`<br>ok · 7.00 · 12.1 · 486 | `context-t05-ambiguous-feature-high-noisy`<br>ok · 2.00 · 12.8 · 427 | 2/2 | 1/2 | 0/2 | 2/2 |

| Comparison / tier | Case pairs | Scored pairs | Wins | Ties | Losses | Mean Δ | New union hard flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Relevant (baseline reused) → Off / low | 3 | 3 | 1 | 1 | 1 | 0.17 | 0 |
| Relevant (baseline reused) → Off / medium | 3 | 3 | 0 | 3 | 0 | 0.00 | 0 |
| Relevant (baseline reused) → Off / high | 3 | 3 | 1 | 2 | 0 | 0.67 | 0 |
| Relevant (baseline reused) → Overview / low | 3 | 3 | 0 | 2 | 1 | -1.33 | 1 |
| Relevant (baseline reused) → Overview / medium | 3 | 3 | 0 | 3 | 0 | 0.00 | 0 |
| Relevant (baseline reused) → Overview / high | 3 | 3 | 1 | 1 | 1 | 1.00 | 1 |
| Relevant (baseline reused) → Noisy / low | 3 | 2 | 1 | 1 | 0 | 0.50 | 0 |
| Relevant (baseline reused) → Noisy / medium | 3 | 3 | 0 | 3 | 0 | 0.00 | 0 |
| Relevant (baseline reused) → Noisy / high | 3 | 3 | 0 | 2 | 1 | -0.17 | 0 |


## Reasoning effort within the same model

| Case / tier | Baseline effort: ID; status · score · s · words | Lower effort: ID; status · score · s · words | Haiku high effort: ID; status · score · s · words | Baseline effort: hard votes | Lower effort: hard votes | Haiku high effort: hard votes |
| --- | --- | --- | --- | --- | --- | --- |
| t01-small-literal-edit/low | `baseline-t01-small-literal-edit-low`<br>ok · 8.00 · 23.8 · 58 | `reasoning-t01-small-literal-edit-low`<br>ok · 7.00 · 2.4 · 60 | `reasoning-high-t01-small-literal-edit-low`<br>ok · 8.00 · 2.0 · 55 | 0/2 | 0/2 | 0/2 |
| t01-small-literal-edit/medium | `baseline-t01-small-literal-edit-medium`<br>ok · 8.00 · 5.9 · 29 | `reasoning-t01-small-literal-edit-medium`<br>ok · 8.00 · 4.2 · 29 | — | 0/2 | 0/2 | — |
| t02-duplicate-save/low | `baseline-t02-duplicate-save-low`<br>ok · 7.00 · 115.2 · 520 | `reasoning-t02-duplicate-save-low`<br>ok · 6.00 · 3.9 · 248 | `reasoning-high-t02-duplicate-save-low`<br>ok · 6.50 · 4.6 · 325 | 0/2 | 2/2 | 0/2 |
| t02-duplicate-save/medium | `baseline-t02-duplicate-save-medium`<br>ok · 8.00 · 16.6 · 191 | `reasoning-t02-duplicate-save-medium`<br>ok · 8.00 · 7.0 · 147 | — | 0/2 | 0/2 | — |
| t05-ambiguous-feature/low | `baseline-t05-ambiguous-feature-low`<br>ok · 6.00 · 108.4 · 446 | `reasoning-t05-ambiguous-feature-low`<br>ok · 7.50 · 4.3 · 269 | `reasoning-high-t05-ambiguous-feature-low`<br>ok · 4.00 · 14.2 · 416 | 0/2 | 0/2 | 1/2 |
| t05-ambiguous-feature/medium | `baseline-t05-ambiguous-feature-medium`<br>ok · 8.00 · 15.0 · 187 | `reasoning-t05-ambiguous-feature-medium`<br>ok · 8.00 · 7.8 · 207 | — | 0/2 | 0/2 | — |

| Comparison / tier | Case pairs | Scored pairs | Wins | Ties | Losses | Mean Δ | New union hard flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline effort → Lower effort / low | 3 | 3 | 1 | 0 | 2 | -0.17 | 1 |
| Baseline effort → Lower effort / medium | 3 | 3 | 0 | 3 | 0 | 0.00 | 0 |
| Baseline effort → Haiku high effort / low | 3 | 3 | 0 | 1 | 2 | -0.83 | 1 |


## Holdout baseline versus selected treatment

| Case / tier | Holdout baseline: ID; status · score · s · words | Holdout treatment: ID; status · score · s · words | Δ score | Holdout baseline: hard votes | Holdout treatment: hard votes |
| --- | --- | --- | --- | --- | --- |
| h01-refactor-with-exception/low | `holdout-baseline-h01-refactor-with-exception-low`<br>timeout · — · 151.0 · 0 | `holdout-treatment-h01-refactor-with-exception-low`<br>ok · 2.00 · 23.3 · 435 | — | — | 2/2 |
| h01-refactor-with-exception/medium | `holdout-baseline-h01-refactor-with-exception-medium`<br>ok · 8.00 · 16.0 · 181 | `holdout-treatment-h01-refactor-with-exception-medium`<br>ok · 8.00 · 7.4 · 185 | 0.00 | 0/2 | 0/2 |
| h01-refactor-with-exception/high | `holdout-baseline-h01-refactor-with-exception-high`<br>ok · 7.00 · 11.8 · 447 | `holdout-treatment-h01-refactor-with-exception-high`<br>ok · 6.00 · 13.1 · 500 | -1.00 | 0/2 | 0/2 |
| h02-review-boundary/low | `holdout-baseline-h02-review-boundary-low`<br>ok · 7.50 · 117.5 · 336 | `holdout-treatment-h02-review-boundary-low`<br>ok · 7.50 · 13.0 · 290 | 0.00 | 0/2 | 0/2 |
| h02-review-boundary/medium | `holdout-baseline-h02-review-boundary-medium`<br>ok · 8.00 · 10.7 · 119 | `holdout-treatment-h02-review-boundary-medium`<br>ok · 8.00 · 6.7 · 116 | 0.00 | 0/2 | 0/2 |
| h02-review-boundary/high | `holdout-baseline-h02-review-boundary-high`<br>ok · 6.00 · 10.8 · 407 | `holdout-treatment-h02-review-boundary-high`<br>ok · 7.00 · 10.9 · 406 | 1.00 | 0/2 | 0/2 |
| h03-explanation-through-feature-style/low | `holdout-baseline-h03-explanation-through-feature-style-low`<br>ok · 7.00 · 149.7 · 359 | `holdout-treatment-h03-explanation-through-feature-style-low`<br>ok · 8.00 · 3.5 · 204 | 1.00 | 0/2 | 0/2 |
| h03-explanation-through-feature-style/medium | `holdout-baseline-h03-explanation-through-feature-style-medium`<br>ok · 8.00 · 13.0 · 148 | `holdout-treatment-h03-explanation-through-feature-style-medium`<br>ok · 8.00 · 5.8 · 145 | 0.00 | 0/2 | 0/2 |
| h03-explanation-through-feature-style/high | `holdout-baseline-h03-explanation-through-feature-style-high`<br>ok · 7.00 · 11.0 · 341 | `holdout-treatment-h03-explanation-through-feature-style-high`<br>ok · 5.50 · 9.2 · 349 | -1.50 | 0/2 | 0/2 |
| h04-custom-format-data/low | `holdout-baseline-h04-custom-format-data-low`<br>ok · 8.00 · 58.6 · 124 | `holdout-treatment-h04-custom-format-data-low`<br>ok · 8.00 · 2.2 · 85 | 0.00 | 0/2 | 0/2 |
| h04-custom-format-data/medium | `holdout-baseline-h04-custom-format-data-medium`<br>ok · 8.00 · 9.6 · 50 | `holdout-treatment-h04-custom-format-data-medium`<br>ok · 8.00 · 4.4 · 47 | 0.00 | 0/2 | 0/2 |
| h04-custom-format-data/high | `holdout-baseline-h04-custom-format-data-high`<br>ok · 8.00 · 4.2 · 88 | `holdout-treatment-h04-custom-format-data-high`<br>ok · 8.00 · 3.7 · 93 | 0.00 | 0/2 | 0/2 |
| h05-explicit-approval/low | `holdout-baseline-h05-explicit-approval-low`<br>timeout · — · 151.1 · 0 | `holdout-treatment-h05-explicit-approval-low`<br>ok · 5.50 · 19.8 · 567 | — | — | 0/2 |
| h05-explicit-approval/medium | `holdout-baseline-h05-explicit-approval-medium`<br>ok · 3.00 · 17.7 · 226 | `holdout-treatment-h05-explicit-approval-medium`<br>ok · 3.00 · 8.0 · 200 | 0.00 | 2/2 | 2/2 |
| h05-explicit-approval/high | `holdout-baseline-h05-explicit-approval-high`<br>ok · 7.00 · 14.1 · 533 | `holdout-treatment-h05-explicit-approval-high`<br>ok · 1.00 · 17.0 · 472 | -6.00 | 0/2 | 2/2 |
| h06-thin-context/low | `holdout-baseline-h06-thin-context-low`<br>ok · 7.50 · 78.0 · 304 | `holdout-treatment-h06-thin-context-low`<br>ok · 6.50 · 4.7 · 303 | -1.00 | 0/2 | 0/2 |
| h06-thin-context/medium | `holdout-baseline-h06-thin-context-medium`<br>ok · 8.00 · 13.6 · 117 | `holdout-treatment-h06-thin-context-medium`<br>ok · 8.00 · 6.8 · 121 | 0.00 | 0/2 | 0/2 |
| h06-thin-context/high | `holdout-baseline-h06-thin-context-high`<br>ok · 2.00 · 7.1 · 275 | `holdout-treatment-h06-thin-context-high`<br>ok · 3.00 · 9.3 · 353 | 1.00 | 2/2 | 2/2 |

| Comparison / tier | Case pairs | Scored pairs | Wins | Ties | Losses | Mean Δ | New union hard flags |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Holdout baseline → Holdout treatment / low | 6 | 4 | 1 | 2 | 1 | 0.00 | 0 |
| Holdout baseline → Holdout treatment / medium | 6 | 6 | 0 | 6 | 0 | 0.00 | 0 |
| Holdout baseline → Holdout treatment / high | 6 | 6 | 2 | 1 | 3 | -1.08 | 1 |


## Limits of these measurements

These are descriptive results from a small synthetic corpus, with one generation per recorded configuration and no confidence or statistical-significance claim. Reviewer votes measure rewriting quality, not downstream coding success. Reviewer disagreement and unreviewed outputs remain visible. Tuning choices were selected after seeing tuning results; holdout comparisons should be interpreted separately.

Latency includes CLI startup and service conditions, and concurrent execution can affect it. Input characters and output words are size measures, not token charges. Provider usage formats and caching differ; this appendix does not infer missing token counts or costs. Subscription CLIs, wrapper prompts, managed policies and telemetry differ from the production Copilot runtime, so these results are indirect evidence for production behavior.
