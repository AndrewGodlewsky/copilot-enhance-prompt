# Running the subscription research harness

This is an opt-in research tool, separate from the shipped Copilot plugin. It uses invented requests and source excerpts from [the corpus](../../scripts/eval/prompt-cases.mjs). It never imports the production Copilot model adapter or reads saved prompts. The production prompt builders supply the baseline. [The protocol](prompt-evaluation-design.md) explains the scoring and limits; [the findings](prompt-evaluation-findings.md) record the completed experiment.

Normal `npm test` runs only injected model stubs and temporary SQLite fixtures. Live generation requires an explicit `ENHANCE_SUBSCRIPTION_EVAL=1` environment setting and a plan. Get the account owner's authorization for that route and allowance first. The November 2026 study specifically prohibited Copilot calls and authorized the existing subscriptions.

## Runtime and account checks

Use Node 24 with `node:sqlite`, the existing `claude` and `codex` executables on PATH, and subscription logins. The adapter resolves executables instead of downloading dependencies or installing a runtime. Claude must report first-party `claude.ai` authentication; Codex must report ChatGPT authentication. API credential/endpoint overrides are removed from child environments. Failure does not fall back to another provider or model.

Before a live batch, inspect the installed CLI help and effective policy **without exporting credentials, account identifiers or command bodies**. Confirm the selected model is available, tool access is disabled, and no lifecycle hook or authentication helper can execute unexpectedly. Stop when policy is incompatible or unknown; do not disable required managed controls. These are experimental CLIs, so the adapter is not a general isolation sandbox. Required telemetry remains in place. Empty working directories, disabled tools, ephemeral sessions and suppressed project discovery reduce ambient input; managed instructions and CLI system/skill behavior may remain. See the [observed isolation limits](prompt-tuning-evidence.md).

Subscription authentication does not prove a run has no monetary charge: an account may have overage enabled. Report provider quota/overage as unknown unless independently verified. Claude's `total_cost_usd` is an API-price estimate, not a subscription invoice. Never infer Copilot pricing from it.

## Files and commands

Keep live evidence in an ignored directory, for example `.artifacts/prompt-eval-2026-11-16/`. Do not commit databases, transcripts, account diagnostics or owner data. The reusable synthetic corpus, experiment instructions and offline tests are versioned source.

A protocol JSON must include an integer `callCeiling` and should record the production source commit, plugin/corpus versions and hashes, CLI configurations, selection rule, schedule seed, authorized route and limitations. Initialize it once:

```powershell
node scripts/eval/research.mjs init .artifacts/my-study protocol.json
```

A plan contains a `generations` array and optional registered `candidates`. Every generation has an immutable ID, phase, caseId, tier, candidate and context. `config` may override reasoning for a controlled comparison. Use only corpus IDs and frozen context variants. Example shape:

```json
{
  "generations": [
    {
      "id": "baseline-t01-low-r1",
      "phase": "baseline",
      "caseId": "t01-small-literal-edit",
      "tier": "low",
      "candidate": "baseline",
      "context": "relevant"
    }
  ]
}
```

Model configurations are explicit in [research.mjs](../../scripts/eval/research.mjs); the Medium configuration is labeled as a GPT-6 Sol proxy. They are not live Copilot defaults or availability guarantees. Experimental prompt transformations live in [candidates.mjs](../../scripts/eval/candidates.mjs), outside `src/`.

```powershell
$env:ENHANCE_SUBSCRIPTION_EVAL = '1'
node scripts/eval/research.mjs run .artifacts/my-study plan.json
Remove-Item Env:ENHANCE_SUBSCRIPTION_EVAL
```

Each plan runs at most three concurrent calls with 150-second generation deadlines. Each call first rechecks subscription authentication. Planned input is persisted before invocation, and successful results, failures and timeouts remain in the ledger. Interrupted and completed IDs are not silently retried. Create an explicitly linked new ID for an authorized retry, retaining the failed record. Do not launch overlapping plans if a study-wide concurrency limit is required. One study's call ceiling covers all claimed generations, including failed attempts; external smoke probes must be recorded separately.

## Evidence and review

The SQLite database has `study`, `generation` and `review` tables. Generation rows retain the original synthetic fixture, exact system/user inputs, SHA-256 input hashes, requested configuration, reported model identity when available, output, timing, usage and literal checks. The November study also uses `observation` for offline probes, availability checks and candidate decisions. Authentication output and hidden reasoning are not retained.

Export a randomized review packet using a JSON file containing `{"phase":"baseline"}`:

```powershell
node scripts/eval/research.mjs export .artifacts/my-study phase.json
node scripts/eval/research.mjs import .artifacts/my-study reviewer-assessments.json
node scripts/eval/summarize.mjs .artifacts/my-study
node scripts/eval/context-probes.mjs
```

Give independent reviewers opaque packet filenames and hide model/treatment identities and system instructions. Review all successful outputs against the visible request, context and four rubric dimensions. Failed generations have no quality score. Importing a review requires four integer scores from 0 to 2, explicit hard-failure notes and a concrete reason. The same reviewer cannot overwrite a previous assessment. Resolve important disagreements or report them; an LLM score is not human ground truth.

Aggregate by task, not by treating every rating as an independent example. Preserve all rejected candidates. Use holdout outputs once after freezing candidates; a public synthetic split prevents output-driven tuning but is not a secret benchmark. Model/backend randomness is not controlled by the scheduling seed. Run downstream task evaluations separately before claiming a rewrite improves coding success.

No production model defaults, context settings or generated plugin assets are changed by this research tool.
