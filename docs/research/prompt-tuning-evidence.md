# Evidence for prompt rewriting, effort, and project context

Researched on 2026-11-16 against Enhance Prompt 0.11.2. This note separates public evidence, repository behavior, and proposed experiments. It reports no model-quality measurements of its own.

**Keep context selection independent from effort until an evaluation demonstrates a useful interaction.** The strongest initial experiments are a compact rewrite contract, lower reasoning for routine rewrites, and relevant excerpts selected to answer a specific uncertainty. Public evidence does not establish that High should automatically receive more project context. This is a proposed direction for measurement, not a finding that a candidate already beats the current implementation.

## What the existing tiers mean

[The current resolver](../../src/effort.ts) selects both a model and a reasoning setting. Low, Medium, and High are product presets, not three values of a shared provider control. Its recommendations are:

| Preset | Configured recommendation | Evidence and first experiment |
| --- | --- | --- |
| Low | Claude Haiku 5.5, highest supported reasoning | Anthropic recommends starting at medium; xhigh/max need measured quality gains to justify their cost. Compare medium and high with the current resolved highest value. Highest can mean max when the catalog supplies it. A small model at its maximum reasoning is not established as the fastest preset. [Haiku guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5) |
| Medium | GPT-6.1 Sol, high | OpenAI's deployment guidance places routine rewrites at low, and diagnosis, comparison, planning, or code reasoning at medium/high. Compare low and medium against high on the same rewrite cases before changing this recommendation. [Deployment guidance](https://developers.openai.com/api/docs/guides/deployment-checklist) |
| High | Claude Opus 5.5, medium | Anthropic recommends explicitly starting at medium and testing other levels. It says effort names do not represent the same amount of thinking across models. Medium is a defensible starting point, not a measured winner for this plugin. [Opus guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5) |

The provider's model pages identify `claude-haiku-5-5`, `claude-opus-5-5`, and `gpt-6.1-sol`. All three currently document low, medium, high, xhigh, and max. Model names and public API support do not establish entitlement or acceptance in an attached Copilot session. The plugin correctly uses the actual catalog and refuses unavailable assignments. [Claude model IDs](https://platform.claude.com/docs/en/models/overview), [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Sol model](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Copilot resolver](../../src/copilot/models.ts)

For subscription-based experiments outside Copilot, Claude Code documents `--model claude-haiku-5-5`, `--model claude-opus-5-5`, and a per-session `--effort` flag. Its environment overrides and organization caps can change the effective effort. Codex documentation explicitly gives `codex -m gpt-6.1-sol`. Record the effective model/effort and any fallback, not just the requested flags. Such runs are indirect evidence about the plugin because the CLI wrapper, hidden instructions, routing, and accounting can differ. [Claude Code model configuration](https://code.claude.com/docs/en/model-config), [Codex models](https://learn.chatgpt.com/docs/models)

### Observed subscription access on 2026-11-16

The evaluation coordinator's local probes exposed a difference between the public documentation and this account's available route:

- **Codex 0.155.1, authenticated with a ChatGPT subscription:** the available catalog included `gpt-6-sol`, but not `gpt-6.1-sol`. An explicit generation probe for `gpt-6.1-sol` returned HTTP 400, `model_not_found`: “gpt-6.1-sol model is not supported when using Codex with a ChatGPT account.” Any resulting Medium experiment using `gpt-6-sol` must be labeled **Medium proxy (GPT-6 Sol)**. It does not measure the configured GPT-6.1 Sol preset.
- **Claude Code 2.1.325, authenticated through the existing Claude subscription:** an explicit `claude-haiku-5-5` probe at `max` succeeded. The response's `modelUsage` identified `claude-haiku-5-5`, confirming the actual model for that probe. This establishes access and a successful response, not rewrite-quality superiority.

These probes used no Copilot allowance. Their outcomes are runtime observations from this session, not claims about every subscription account or future availability. The assessment must keep the exact-model Haiku evidence and the different-model Medium proxy results separate.

### Observed isolation limits

The CLI experiments use synthetic inputs in temporary working directories, but their wrappers and organization policies remain part of the route. Read-only inspection found three parseable endpoint-policy documents and one parseable server-policy cache: one `PreToolUse` hook, no other hook events, and no policy or authentication helper commands. The inspected credential, account-header, and endpoint override variables were absent. Required telemetry remained enabled. Claude safe mode preserves managed hooks; they must not be bypassed to make a benchmark appear isolated. Stop if a later preflight finds an applicable lifecycle hook or an unverified policy source. Codex also has automatic skill instructions separate from skill-search tools, so disabling search alone does not establish a pristine prompt. [Claude policy behavior](https://code.claude.com/docs/en/cli-reference), [Codex skill settings](https://learn.chatgpt.com/docs/config-file/config-reference)

Subscription authentication does not establish zero dollars charged: enabled usage credits or overage can apply after included allowances. The Claude CLI's API-cost estimate is not an invoice. These experiments do not inspect billing settings or prove what the account was charged. [Claude subscription usage](https://support.claude.com/en/articles/11845131-use-claude-code-with-your-team-or-enterprise-plan), [ChatGPT flexible usage](https://help.openai.com/en/articles/12642688-using-credits-for-flexible-usage-in-chatgpt-personal-plans)

## What the sources support

| Evidence | Finding | Application and limit |
| --- | --- | --- |
| [OpenAI reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices) | Use clear goals, constraints, and delimiters. Generic requests to expose step-by-step reasoning are unnecessary for reasoning models. | Test a short rewrite contract with an explicit final-output requirement. This is provider guidance, not a comparison of this plugin's templates. |
| [Claude prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | Explicit output constraints and relevant, diverse examples help. For large inputs, it recommends separating documents from the query and placing the query after them. | Test examples only for observed errors. Test evidence placement separately; its long-context advice concerns inputs around 20k+ tokens, whereas the plugin's budgets are characters. |
| [Anthropic context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents) | Select a small set of useful context and balance precise guidance against brittle, excessive instructions. | Supports relevance-driven selection and concise evidence. It is applied engineering guidance, not proof that a particular excerpt budget is optimal. |
| [Lost in the Middle, Liu et al.](https://arxiv.org/abs/2307.03172v3) | In multi-document question answering and key-value retrieval, the position of relevant material changes performance; information in the middle can be harder to use. | Include beginning/middle/end placement checks. The 2023 models and tasks differ from these models and prompt rewriting; do not transfer its effect sizes. |
| [GSM-IC, Shi et al.](https://arxiv.org/abs/2302.00093v3) | Adding irrelevant facts reduced arithmetic reasoning accuracy in their experiments. | Include irrelevant but plausible project files and stale logs as distractors. Arithmetic results do not prove that any additional code context is harmful. |
| [RULER, Hsieh et al.](https://arxiv.org/abs/2404.06654v3) | Retrieval of one fact does not fully test long-context use. Multi-hop tracing and aggregation revealed degradation as input length grew. | Test whether the rewrite combines relevant facts from several files without inventing connections. Advertised context capacity is not a quality guarantee; this benchmark does not measure the current trio. |
| [ProTeGi, Pryzant et al.](https://arxiv.org/abs/2305.03495v2) | Error critiques can guide prompt edits and candidate selection rather than relying on unsystematic wording changes. | Use concrete failed cases to propose a small change. Its gains on NLP benchmarks are not expected gains for this plugin. |
| [GEPA, Agrawal et al.](https://arxiv.org/abs/2507.19457v2) | Reflection on execution outcomes guides candidate changes; complementary candidates can be retained rather than chasing one aggregate result. | Keep a candidate that helps difficult cases even if another is best for latency, but require held-out evidence before adding routing complexity. This is inspiration for a modest search, not a requirement to add an optimizer dependency. |
| [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | Evaluations should match the application and combine metrics with calibrated human judgment; outputs vary between runs. | Use task-specific fixtures, repeats, and explicit scoring. A successful mock response or integration test establishes plumbing, not rewrite quality. |
| [OpenAI prompt-optimizer guidance](https://developers.openai.com/api/docs/guides/prompt-optimizer) | Narrow graders and specific feedback matter; optimized prompts can regress on individual inputs. | Optimize independent requirements and review failures, not just an overall preference score. The methodology can be used locally; it does not require adopting the hosted optimizer. |
| [LLM-as-a-judge, Zheng et al.](https://arxiv.org/abs/2306.05685v4) | Judges can exhibit position, verbosity, and self-preference biases, as well as reasoning limitations. | Blind candidate labels, swap pairwise order, and inspect disagreements. A longer or more formal rewrite must not win solely because it looks more complete. |

## Context should answer a need

The existing [context choices](../context-levels.md) already separate Project overview, Relevant code, AI-assisted, and AI Test from effort. Their documented automatic budgets are approximately 12,000, 28,000, and 45,000 characters, with 45,000 also the AI Test maximum. These are upper bounds, not targets to fill, and do not count all explicit inputs or attachments.

The practical hypothesis is that context demand comes from the request: a cross-module migration may need several files even on Low; a precise wording correction may need no project context even on High. More reasoning might improve selection among evidence, but it cannot make irrelevant facts relevant. This is an inference to test, not a provider guarantee.

Compare four controlled context conditions on identical requests:

1. No automatic project context, preserving explicit input.
2. Minimal sufficient evidence: identity plus the facts needed to preserve the request's meaning.
3. The same evidence plus useful cross-file detail that resolves an identified uncertainty.
4. The same evidence plus distractors, stale assertions, or redundant files.

Keep required facts present when testing noise; removing them would confound relevance with absence. Separately test missing evidence, conflicting evidence, redacted/truncated excerpts, and facts split across files. Compare current collection output with these controlled inputs so results address both the rewrite instruction and the collector's choices. Privacy switches, exclusions, masking, and read confinement remain hard constraints at every effort.

The installed SDK declarations expose model capability limits, configurable-reasoning support, supported/default effort values, policy, and billing metadata. They describe what a route permits, not what produces the best rewrite. Inspected local reference: `%LOCALAPPDATA%/Programs/GitHub Copilot/copilot-sdk/types.d.ts`, `ModelCapabilities` and `ModelInfo`. The [plugin catalog](../../src/catalog.ts) currently carries model/reasoning data rather than the full limits. This note proposes no catalog or SDK change. [GitHub SDK compatibility](https://docs.github.com/en/copilot/how-tos/copilot-sdk/troubleshooting/compatibility)

## A bounded hill climb that can support a decision

The following protocol is a proposed experiment design. It is not a completed benchmark.

**Measure the rewrite and its downstream effect separately.** Rewrite checks should cover intent and scope preservation, exact paths/identifiers/quoted literals, unsupported claims, correct English output while preserving user data, explicit uncertainty, and output-only compliance. Hard failures cannot be offset by better style. The decisive task metric is whether the destination agent achieves the original request with fewer mistakes or clarification rounds. A rewrite-only score is a useful screening metric, not proof of better coding outcomes.

**Use three baselines.** Compare the original request, the original request with the same permitted context, and the current production rewrite with that context. Otherwise, an improvement caused by extra evidence can be mistaken for an improvement caused by rewriting. When comparing downstream results, hold the destination model, its tools, repository state, and task budget fixed.

**Separate variables before combining them.** First compare prompt candidates at a fixed model, effort, and context. Then sweep reasoning within each model. Then compare context conditions and the interaction between context and effort. A comparison of current Low/Medium/High alone changes both model and reasoning and cannot say which caused a difference. A simple matrix of selected settings is enough; a full Cartesian sweep is unnecessary before a promising candidate exists.

**Use failures to choose the next edit.** Start from the production prompt and try a few candidates such as: remove repeated boilerplate; explicitly preserve uncertainties instead of turning them into facts; distinguish evidence from instructions; and make output length proportional to the request. Change one conceptual rule per iteration and retain the actual prompt text. Examples should address a repeated error class rather than encode a fixture's answer.

**Hold back unseen cases.** Split by task family or repository, not merely by paraphrase. Optimize on development cases, choose the candidate on validation cases, then evaluate it once on a held-out set. Do not repeatedly inspect the held-out errors and still call that set held out. Include short noncoding requests, precise small fixes, ambiguous requests, cross-file changes, privacy-limited context, instruction conflicts, multilingual literals, and adversarial instructions inside project data.

**Keep the score honest.** Use deterministic checks for exact requirements and evidence-backed human judgments for semantic fidelity. Blind pairwise reviews, allow ties, and randomize answer order. Report per-case wins/losses and hard failures alongside the mean; treat repeated generations of one fixture as repeats, not independent new tasks. Repeat promising comparisons and report uncertainty. A handful of synthetic fixtures is a pilot and cannot establish a broad ranking.

**Track the entire cost of a result.** Record model, requested/effective effort, route, input/context/output lengths, latency, calls, retries, selection/research work, empty responses, and failures. Report median and tail latency, plus input/output/reasoning usage when available. Do not turn provider API prices into claimed subscription or Copilot charges. GitHub exposes per-call usage, accumulated totals, and pricing through different signals; missing usage is not evidence of zero cost. [GitHub usage metrics](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/usage-and-billing)

Predeclare a stopping rule and a small call budget. Prefer the fastest candidate that clears the fidelity gate and does not show a meaningful quality regression. Escalate effort or context on difficult task families only after the measured improvement justifies the added time and usage. Report any exploratory selection as exploratory.

## First hypotheses to accept or reject

| Hypothesis | Evidence that would support adopting it | Failure that would reject it |
| --- | --- | --- |
| A compact shared rewrite contract improves reliability. | Fewer invented requirements and equal or better constraint preservation across tiers. | Concision removes a necessary detail or changes the user's goal. |
| Routine rewriting needs less reasoning than the current Low/Medium presets request. | Lower latency/usage with equivalent held-out fidelity on the same model. | More omitted constraints, literal changes, empty replies, or fabricated assumptions. |
| Relevant context helps independently of tier. | Minimal sufficient context beats no context on project-dependent tasks across multiple tiers. | Added context is copied as an instruction or introduces unrelated scope. |
| High benefits from more context only on evidence-dependent tasks. | Useful cross-file additions improve difficult cases, while distractors and redundant additions do not. | Broadly enlarging context yields no task gain, greater drift, or unacceptable latency. |
| Failure-specific examples help more than generic instruction growth. | Repeated failure classes improve on unseen variants without increasing other hard failures. | The candidate memorizes fixture forms or becomes verbose on simple requests. |

Public research and documentation justify these experiments, but they do not establish a winning preset, an optimal context budget, or a percentage quality gain. Subscription-CLI measurements should be labeled with their actual route; production Copilot generation and downstream task validation remain separate evidence.
