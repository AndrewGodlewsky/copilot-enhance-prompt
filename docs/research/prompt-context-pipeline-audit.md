# Prompt and context pipeline audit

Audited on 2026-11-16 against plugin **0.11.2**, source commit `396e8841e647d27a04e905bfbc67a5f56f22f704`. This is research for an evaluation program, not a production tuning change. The evidence below comes from repository source, offline fixtures, and deterministic function probes. No account-backed generation, user settings, private project data, credentials, or UI were accessed.

The central evaluation distinction is **fixed-input rewriting versus end-to-end evidence gathering**. Low, Medium, and High select a model/reasoning pair independently of the context setting. However, AI-assisted normally uses that pair to select files, and AI Test uses it to request additional evidence. Comparing effort at either level can therefore change both the rewriter and its input. Fallback can change the actual model again. A useful results database must retain the actual payload and model attempts, not only the UI labels. These are code facts, not evidence that one effort or context level produces better prompts. [Worker routing](../../src/worker.ts#L271-L335), [fallback](../../src/models.ts#L84-L115).

## Exact rewrite construction

The worker trims the original request, resolves the effort/model and context level, loads project-scoped saved rules, gathers automatic context, optionally runs AI Test research, builds the system prompt, loads explicit attachments, and finally rewrites. Attachments are therefore available to the final rewrite but not to AI-assisted selection or AI Test research. The selector receives the original request and paths; research receives the original request and gathered evidence, without the final style/custom/rule/structure system prompt. [Control flow](../../src/worker.ts#L265-L383).

The replacement system prompt consists of these parts, in order:

| Part | Construction and priority |
| --- | --- |
| Shared base | Preserve request type, scope, concrete details and reasons; ground facts; label search results as likely relevant; leave unknown product decisions open; match output length to task size; name only one or two relevant verification commands; request evidence. The destination agent has the project even when the rewriter receives no context. |
| Style intent | One of General, Concise, Detailed spec, Bug fix, New feature, Refactor, Code review, Plan first, or Custom only. Empty Custom only falls back to General. |
| Shape | The selected style's headings, or the selected saved structure's headings. Structures replace headings, not style purpose. Empty headings may be omitted; questions go under an existing heading. |
| Larger-implementation instructions | Included for General, Detailed spec, Bug fix, New feature and Refactor. The model decides whether the task is sufficiently large and actually asks for implementation. For large implementation tasks it is told to include two exact completion/retry sentences, scope limits and reporting expectations. Small edits should receive none of these additions. |
| Target-agent hint | Derived from the gathered agent item when adaptation is enabled. Off context has no gathered agent item, so it also has no hint. |
| Custom instructions | Appended with “follow them.” |
| Saved rules | Appended with “always follow them; they win over the shape above.” |
| Plan/review boundary | Appended only for these styles, after saved rules. Saved material cannot authorize implementation; explicit implementation scope already approved in the current request must be preserved. |
| English output policy | Appended last. Authored final instructions/headings must be English. Code, identifiers, paths, URLs, quoted text, errors and user data remain verbatim, including Unicode. Other custom rules apply within the task boundary. |

Sources: [base and implementation text](../../src/prompts.ts#L33-L64), [style definitions](../../src/prompts.ts#L66-L102), [agent hints](../../src/prompts.ts#L105-L135), [assembly and structure rules](../../src/prompts.ts#L140-L179), [worker hint selection](../../src/worker.ts#L340-L347).

The user message puts gathered evidence first and the original request last:

```text
<project_context>
<item kind="..." label="..." note="...">
literal context content
</item>
...
</project_context>

<request>
trimmed original request
</request>

Rewrite the request above into the final prompt.
```

The context wrapper is omitted when empty. Label/note attributes are escaped; body text and request text are preserved literally. Explicit image/path blocks follow this message. This delimiter design is an evaluation surface: a repository file can contain delimiter-looking strings, but the code alone does not establish whether a model follows them. AI Test's research system explicitly calls requests, files and search results untrusted data; the final rewrite system does not include that same explicit data-boundary rule. [Serialization](../../src/prompts.ts#L182-L191), [attachment placement](../../src/worker.ts#L350-L365), [research protocol](../../src/context/research.ts#L17-L24).

The final answer is cleaned by removing a limited set of preambles, an outer code fence, and outer request/prompt tags. Missing attachment paths are appended mechanically. There is no semantic validator for intent preservation, English compliance, invented scope, omitted details, or factual grounding. A nonempty successful model response can therefore pass the transport path while still being a poor rewrite. [Cleanup](../../src/prompts.ts#L194-L203), [path repair](../../src/worker.ts#L204-L207), [final result](../../src/worker.ts#L385-L394), [nonempty check](../../src/copilot/models.ts#L240-L245).

## Context levels and actual limits

These limits count JavaScript string characters, not model tokens. They apply to automatic context item contents, not the entire system/user request, wrappers, saved instructions, or attachments. [Budgets](../../src/context/index.ts#L26-L28), [budget fitting](../../src/context/index.ts#L568-L588), [attachments added afterward](../../src/worker.ts#L355-L365).

| UI choice / stored value | Automatic content | Nominal character allowance | Extra model calls before rewriting |
| --- | --- | ---: | --- |
| Off / `off` | None; saved rewrite instructions and explicit attachments still apply | 0 | 0 |
| Basic (saved) / `basic` | Project identity/branch and target agent | 1,000 | 0 |
| Project overview / `standard` | Identity, supported root rule files, README digest, stack/commands, compact file tree, configured extra files | 12,000 | 0 |
| Relevant code / `deep` | Overview plus Git status, six commits, bounded diff, up to six source snippets | 28,000 | 0 |
| AI-assisted / `max` | Same sources, larger diff/snippets, up to ten files with AI choices first | 45,000 | Normally 1 selector call; fallback may add attempts |
| AI Test / `ai-test` | Initial Relevant code, then bounded model-requested reads/searches | Initial 28,000; merged 45,000 | 0–2 research calls; no research fallback |

Sources: [labels](../../src/presets.ts#L61-L76), [gather stages](../../src/context/index.ts#L291-L384), [Git and snippet limits](../../src/context/index.ts#L419-L527), [research limits](../../src/context/research.ts#L11-L14).

Production disables terminal output, other-agent sessions, agent activity, editor-save events and file opening. Generic worker tests that exercise these features do not establish their availability in the Copilot canvas. Disabling project-file access reduces Standard and higher to Basic. Preview makes no AI selection/research calls, and enhancement gathers static context fresh, so preview is not an exact frozen inference payload. [Unsupported capabilities](../../src/capabilities.ts#L1-L2), [production enforcement](../../src/copilot/services.ts#L65-L80), [privacy level reduction](../../src/worker.ts#L234-L236), [preview](../../src/worker.ts#L603-L624), [fresh collection](../../src/context/index.ts#L337-L340).

### Overview construction

- Rule files and README share 9,000 characters. Configured extra files come first, then root `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot/Cursor/Windsurf/Cline rules and `CONTRIBUTING.md`, then up to four `.cursor/rules` entries. Each rule/extra is capped at 4,000 characters. The README receives only remaining room, up to 3,500. Later rules or README may be absent when earlier extras/rules consume the allowance. Nested `AGENTS.md` files and `.github/instructions/*.instructions.md` are not automatically added by this root-rule list. [Static gather](../../src/context/index.ts#L252-L282), [rule ordering and caps](../../src/context/instructions.ts#L6-L14), [reader](../../src/context/instructions.ts#L53-L81).
- README digest keeps its introduction and headings matching setup, development, tests, build, architecture and related English keywords. Heading matching and truncation are deterministic, not semantic summarization. [Digest](../../src/context/instructions.ts#L17-L50).
- Stack detection inspects top-level manifests, up to 30 dependency names and 25 script entries; commands are clipped to 120 characters. Some ecosystem checks are conventional suggestions inferred from file presence, such as `go test ./...`, `cargo test`, or `mvn test`, rather than commands copied verbatim from project instructions. Monorepo child manifests are not all scanned. [Stack detection](../../src/context/stack.ts#L7-L30), [top-level filtering and ecosystems](../../src/context/stack.ts#L63-L114).
- The tree is a two-level directory-count summary plus top-level files, limited to 70 lines. It is not a full source inventory. Git inventory permits up to 50,000 paths; filesystem walking permits 8,000 files through depth six and skips configured noisy/hidden directories. [Tree/walk](../../src/context/files.ts#L120-L170), [Git inventory](../../src/context/git.ts#L160-L162).

### Local retrieval and snippets

At Deep and above, keyword extraction keeps at most 12 terms. Explicit paths/backticks/dotted symbols have greater weights than ordinary words. The implementation uses ASCII-oriented word/identifier patterns, with English and Vietnamese stopwords. Only the first eight terms of length at least four are searched in file contents. Path score, content-hit rarity, and changed-file bonuses determine ranking; fixtures/generated/localization paths and unrequested tests are downweighted. Prose outside `docs/` does not compete as a relevant code snippet. [Extraction/scoring](../../src/context/relevance.ts#L4-L117), [candidate filtering](../../src/context/index.ts#L406-L413), [search inputs](../../src/context/index.ts#L463-L493).

Git-backed content search is literal, case-insensitive, includes eligible untracked files and has per-process size/time limits. If Git is unavailable/disabled or exclusions make its arguments too large, a local scan visits likely paths first and stops at 300 files, 4 MB or 1.5 seconds. A limited local scan adds a note; Git helper output may be a useful partial prefix. An empty result is not exhaustive proof of absence. [Route choice](../../src/context/index.ts#L471-L488), [local scan](../../src/context/search.ts#L4-L30), [Git helper](../../src/context/git.ts#L19-L42), [Git grep](../../src/context/git.ts#L165-L212).

Ordinary source reads refuse files over 200,000 bytes rather than reading a prefix. Snippets include the first six hit windows, four lines before and two after each hit, or the first 40 lines when there are no hits. Each source line is cut to 240 characters. Deep/AI Test allocate about 1,400 characters per selected file; Max uses 1,800. Windows are emitted in file order and later windows may lose the budget competition. Secret masking runs before snippet selection. [Read and snippet implementation](../../src/context/files.ts#L173-L224), [per-file limits](../../src/context/index.ts#L513-L527).

Git diff is uncommitted `HEAD` diff with two context lines, clipped at 5,000 characters for Deep/AI Test or 9,000 for Max, plus its stat. It is not a request-relevant hunk selection algorithm. [Diff collection](../../src/context/index.ts#L419-L455), [diff implementation](../../src/context/git.ts#L118-L157).

### AI-assisted and AI Test

AI-assisted supplies up to 600 permitted paths, with the top 150 locally scored paths first. Its model chooses up to eight exact paths. Valid AI paths are placed before local choices, and the combined result is limited to ten. The model does not see file contents during selection and still receives the same keyword-centered snippets afterward. Invalid or ordinary failed selection falls back to local choices; accounting/reasoning failures stop the run. [Picker prompt and parser](../../src/worker.ts#L166-L190), [selection/merge](../../src/context/index.ts#L495-L510).

AI Test begins with Deep evidence. Each research round receives a JSON object containing the original request, a path inventory, the currently merged excerpts, and previous read/search feedback. Inventory is capped at 600 paths/16,000 characters, prioritizing initially selected file paths. Each response may request three ranges and two literal searches. There are at most two rounds, eight added excerpts, 80 lines/4,000 characters per excerpt, and 16,000 added characters. Exact repeated ranges/searches are suppressed; overlapping ranges are not semantically deduplicated. Explicit reads run before searches. Searches append windows for the first three matching files. [Research loop](../../src/context/research.ts#L89-L181).

Research uses the selected effort's first model and reasoning with no fallback. It has at most 45 seconds or half the remaining run budget. Ordinary failure, timeout or malformed JSON retains existing evidence and continues; privacy/accounting/reasoning failures stop the run. The final rewriter sees actual excerpts, not a model-authored research summary. [Worker allocation](../../src/worker.ts#L321-L338), [termination/merge](../../src/context/research.ts#L184-L199).

### Ordering, privacy and explicit inputs

Global automatic-context priority is identity, rules, stack, source files, Git, terminal, tree, activity/saves, other-agent material. This means increasing context can change which low-priority items survive. The final partly fitting item is prefix-trimmed only if over 400 characters remain; its trim marker can make the result slightly exceed the nominal allowance. [Budget algorithm](../../src/context/index.ts#L568-L588).

Sensitive names, exclusions, binary paths and links escaping the project are refused. Policy applies to resolved aliases and unchecked paths. Automatically gathered secrets are masked before shortening. These constraints should remain fixed during quality experiments. [File policy](../../src/context/files.ts#L11-L104), [read confinement](../../src/context/files.ts#L173-L192), [pipeline regression tests](../../src/context/pipeline.test.ts#L47-L57).

Explicit text attachments use about 20,000 characters each, split 60% beginning / 40% end with a marker. They are prepended after automatic budget fitting. Up to four recognized images of at most 5 MiB receive image payloads; larger/extra images and binary files may be represented by path only. Final output paths are repaired if omitted. These distinct inputs need their own evaluation strata and size fields. [Attachment excerpt/read](../../src/attachments.ts#L105-L144), [image limits](../../src/image-limits.ts#L1-L5), [worker assembly](../../src/worker.ts#L348-L387).

## Effort, fallback and runtime confounders

The source's recommended assignments are Low = Claude Haiku 5.5 with highest advertised supported reasoning; Medium = GPT-6.1 Sol/high; High = Claude Opus 5.5/medium. These are code recommendations, not a live catalog observation or a validated quality ranking. Users can assign different catalog models/reasoning. “High” is therefore not a universal reasoning setting, token budget, or output length instruction. [Effort definitions/resolution](../../src/effort.ts#L6-L59).

An explicitly configured selector keeps its own model defaults. Otherwise AI-assisted shares the selected effort pair. AI Test always uses the rewriting pair. Fallback profiles follow saved order; only the first attempt gets the requested reasoning override. Accounting and reasoning validation failures stop instead of silently falling back. [Selector routing](../../src/worker.ts#L280-L291), [attempt reasoning/error handling](../../src/models.ts#L84-L139).

The normal setting is 60 seconds per nonfinal attempt. A final candidate can use the remaining chain deadline. Single-request runs have approximately 115 seconds total; resumable panel runs have 300 seconds, with cancellation/orphan ownership rules. A Copilot helper also has its own 180-second overall abort timer. Model initialization, catalog/auth checks, generation and cleanup contribute to observed latency. Report latency by stage, not as inference speed alone. [Run limits](../../src/worker.ts#L35-L49), [defaults](../../src/defaults.ts#L17-L20), [chain deadlines](../../src/models.ts#L88-L106), [helper timer](../../src/copilot/models.ts#L152-L164).

The production helper starts in an empty temporary workspace, replaces its system message, exposes no tools and disables instruction, skills, extension, memory and retrieval discovery. It checks account/catalog identity, selected model, selected reasoning and vision support before generation. No temperature, seed, output-token cap or completion-length parameter is set by this adapter. Fresh helpers and backend behavior remain part of the experiment. [Helper configuration/checks](../../src/copilot/models.ts#L182-L241).

## Offline observations from this audit

The following deterministic probes exercised exported functions without model calls. They demonstrate implementation behavior, not output-quality outcomes.

| Probe | Observed result | Interpretation |
| --- | --- | --- |
| System prompt character count, Copilot hint, no custom rules/structure | General 7,676; Concise 6,132; Detailed 7,866; Bug fix 7,957; Feature 7,834; Refactor 8,006; Review 6,350; Plan 6,261 | Most requests pay substantial fixed instruction overhead. Character count is not token count or a quality score. |
| Custom only | Empty custom instructions: 7,676 characters (General fallback). With `Keep concrete details.`: 5,882 | Store effective style and exact system text, not just requested style. |
| Keyword extraction | `修复登录按钮`, `ログインボタンを修正`, and `Sửa nút đăng nhập` each yield no keywords. `Fix the login button` yields `button`, `login`. | Some non-English requests without paths/ASCII identifiers cannot drive keyword search. This does not prove their rewrites are worse. |
| Two snippet hits, long source lines | For hits at lines 50 and 100 and a 1,400-character allowance, only lines 46–50 survive | Correct candidate-file retrieval does not guarantee inclusion of the relevant later evidence. |
| Fit 900-character rules + 1,000-character file into 1,500 | Result has 1,518 content characters due to trim marker | Budgets are approximate content caps. Measure serialized payload size separately. |
| Context body with fake closing/opening tags | Delimiter-looking text remains literal in the serialized message | Add a benign canary robustness case. No model exploit was tested. |

The multilingual probe used JavaScript Unicode escapes to avoid PowerShell pipe encoding altering the test input. System lengths were measured with `buildSystemPrompt({ style, agent: 'copilot' }).length`.

The keyword, snippet and budget observations are reproducible with `node scripts/eval/context-probes.mjs`, or by importing `runContextProbes()` from [the offline probe module](../../scripts/eval/context-probes.mjs). Its JSON records synthetic fixture parameters and observations without assigning quality scores. It writes one synthetic snippet fixture in a new temporary directory, deletes that exact file and directory without recursive deletion, and makes no inference calls. The companion test checks fixture integrity, JSON serialization and repeatability without requiring the present retrieval limitations to persist.

## Testable tuning candidates

These are **hypotheses to evaluate**, not recommended production defaults. Each candidate should be a separately versioned treatment with paired cases, repeated model samples, and a held-out set. Retain mandatory privacy, English, scope, attachment and model-accounting behavior.

| Candidate | Code-backed reason to test | Comparison and failure cases |
| --- | --- | --- |
| Shorter shared instructions | The baseline is roughly 6–8k characters before the request/context | Same semantic rules in compact wording versus current text. Measure literal-detail recall, invented requirements, small-task length, latency and cost. Include one-line edits and dense multi-step tasks. |
| Compact larger-task policy | The current policy conditionally demands exact completion/retry sentences and extensive workflow/reporting prose | Equivalent concise policy versus current policy. Detect scope inflation, unnecessary permission gates, blanket retry behavior and small-task boilerplate. Keep plan/review boundaries fixed. |
| Explicit evidence/data boundary | Research has an untrusted-data instruction; final rewriting uses raw body delimiters | Add a clear source-data boundary or stronger serialization while keeping content constant. Use harmless contradictory comments, quoted instructions and delimiter canaries; also test preservation of legitimate quoted user requests. |
| Relevant evidence placement | Context precedes request; priority sorting can move/drop lower-ranked sources | Hold the exact evidence constant and vary order/grouping. Measure grounded facts and whether irrelevant instructions dominate. Do not change retrieval and ordering in the same treatment. |
| More useful snippet windows | First-six-hit, first-file-order windows and line clipping can omit later definitions | Evaluate targeted definition/caller windows or diversity among hit clusters at equal payload size. Include imports mentioning the symbol before its definition and long lines. |
| Language-aware retrieval | ASCII-oriented extraction can yield no terms for otherwise meaningful requests | Compare deterministic multilingual extraction or a separately costed query-generation stage. Use equivalent English/non-English requests with and without explicit symbols. Score retrieval recall before rewrite quality. |
| Rules/README budget allocation | Configured extras and early rule files can consume the common 9k allowance | At equal total size, compare task-relevant selection or reserved allocations. Include many long rule files, a critical late rule, nested module instructions and README verification commands. |
| Bounded-research utility | AI Test adds calls and evidence but has strict scan/time/range limits | Compare Deep, Max and AI Test end-to-end, then replay their frozen final context on the same rewriter. Track useful new evidence, duplication, partial termination and marginal quality per request/time. |
| Long-file strategy | Selected files over 200k bytes are silently unreadable to the snippet reader | Compare safe bounded range access in an experimental harness; never bypass confinement or masking. Include a target definition near the beginning, middle and end. |

For every style, include boundary cases: investigation that must remain investigation; review/plan with a saved “always implement” rule; current-task implementation approval that must survive; a tiny task under Detailed spec; custom non-English headings; unknown project commands; no automatic context despite a real destination project; preserved numbers/errors/paths/Unicode; image-only requirements; omitted attachment paths; and irrelevant but plausible changed files. These directly exercise instructions and branches already present in [prompt policy](../../src/prompts.ts#L33-L179), [attachments](../../src/worker.ts#L348-L387), and [relevance scoring](../../src/context/relevance.ts#L86-L117).

## Fields the evaluation database needs

Retain source commit, plugin version, fixture/case ID, original request, expected intent and concrete details, requested/effective style, rules/custom instructions/structure, requested/effective context level, privacy/exclusion policy, exact final system/user payload or content-addressed artifact, context item order/content/provenance, per-stage truncation, actual model ID, requested/applied reasoning, selector/research model IDs, all attempts, fallback outcome, research stop reason, timestamps/stage durations, and runtime/catalog snapshot provenance. Store usage receipts per selection/research/rewrite stage where available rather than treating one UI enhancement as one inference request. [Attempt metadata](../../src/models.ts#L23-L39), [research summary](../../src/context/research.ts#L196-L199), [usage recording](../../src/copilot/models.ts#L192-L207), [receipt reconciliation](../../src/copilot/models.ts#L258-L268).

Separate three result types: deterministic assembly/retrieval checks, judged rewrite quality, and downstream agent-task outcomes. The existing tests provide evidence for the first category. They do not establish that a prettier, longer, or judge-preferred rewrite improves the destination agent's completion rate. Fixed-context comparisons should pin the model/reasoning and disable or separately label fallback; product-realistic comparisons should preserve fallback and report its actual outcomes.

## Verification and limits

Executed locally:

```text
node --test --test-timeout=300000 src/prompts.test.ts src/styles.test.ts src/effort.test.ts src/reasoning.test.ts src/models.test.ts src/context/context.test.ts src/context/pipeline.test.ts src/context/research.test.ts src/copilot/models.test.ts
```

Result: **86 passed, 0 failed**, approximately 4.0 seconds. These use local synthetic fixtures/mocks. Windows directory-junction checks ran; the conditional file-symlink branch reported that this system refused to create file links, so that branch was not exercised despite the test's passing status. [Conditional branch](../../src/context/context.test.ts#L117-L147).

Prompt/style tests primarily assert instruction strings and mock request routing, not generated output behavior. Existing worker tests separately cover fallback, reasoning propagation and timing, but the worker test file was not part of this bounded run. No paid/live inference, full build/check, installed-runtime end-to-end run, UI validation, or downstream agent execution was performed. Production files, version, release notes and generated bundles are unchanged. This research artifact was not committed or pushed by the audit subtask; integration belongs to the parent task.
