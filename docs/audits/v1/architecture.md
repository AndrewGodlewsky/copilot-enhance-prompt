# Execution, data and performance diagrams

These diagrams describe **0.12.0 at d25be463**, followed by one explicitly proposed storage design. They are source-reviewed maps, not evidence that every runtime boundary is secure. Finding IDs link the weak points to the [readiness checklist](README.md) and detailed security reports.

## What is downloaded and what executes

```mermaid
flowchart TD
  Repo["Configured repository / marketplace source<br/>Root distribution: source, docs, tests and committed builds"] --> Host["Copilot plugin installation machinery"]
  Host --> Package["Installed repository source<br/>Execution selected by plugin.json"]
  Package --> Extension["extension.mjs<br/>Backend JavaScript + four bundled libraries"]
  Package --> Web["Local web HTML / JS / CSS / image<br/>Frontend libraries bundled at build time"]
  Desktop["User's installed Copilot desktop<br/>SDK + compatible executable"] --> Extension
  Extension --> Server["127.0.0.1 server<br/>Random canvas token, host/origin checks, CSP"]
  Server --> Web
  Extension --> Helper["Child of installed Copilot executable<br/>Empty workspace + temporary SDK config directory"]
  Helper --> Inference["Copilot account model service<br/>Prepared request/context only"]
  Dev["Maintainer only: locked npm installs<br/>TypeScript / esbuild / Vite / tests"] -. "builds committed artifacts" .-> Package
```

The extension runs with the user's OS permissions. Token/origin protection prevents an unrelated website from simply calling the local API; it is not an OS sandbox against another same-user process. The helper's disabled tools/discovery and checked directory/account/model are valuable application controls, not a substitute for the host runtime's security. Normal installation does not run this repository's npm build or download a separate SDK. See the [exact package inventory](distribution-readiness.md#what-users-receive-and-execute).

## End-to-end enhancement

```mermaid
flowchart TD
  Human["Human types/pastes request<br/>Style + Context Level + Effort"] --> Panel["Canvas state<br/>Session draft and explicit attachments"]
  Panel -->|"Enhance click"| Boundary["Authenticated panel request<br/>Snapshot run inputs / reject incompatible model"]
  Boundary --> Context["Context collector<br/>Attached working directory + current privacy/exclusions"]
  Project["Local project<br/>Rules, README, stack, tree, Git, relevant excerpts"] --> Context
  Upload["Completed explicit uploads<br/>Temporary attachment directory"] --> Prepared["Prepared user payload<br/>Request + masked automatic context + attachments"]
  Context --> Prepared
  Context -. "AI-assisted: selector call" .-> Model
  Context -. "AI Test: up to two research calls" .-> Model
  Policy["Enhanced or original prompt set<br/>English policy + style + custom rules/structure"] --> Model
  Prepared --> Model["Copilot model adapter<br/>Account/catalog/reasoning + empty tools checks"]
  Model --> Helper["Isolated helper inference<br/>Stop, reconcile receipts, flush, clean temporary files"]
  Helper --> Review["Review and send<br/>Result editable; original draft retained"]
  Helper --> History["Bounded local prompt history<br/>Only when retention permits"]
  Helper --> Usage["Retained usage receipts<br/>Read by Usage Insights"]
  Review -->|"Copy / download"| Export["Clipboard or Downloads file"]
  Review -->|"Explicit Send or previously enabled auto-send"| Guard["Recheck attached session, activity,<br/>permissions, queue, request identity and cancellation"]
  Guard --> Attached["Enqueue into the attached Copilot session"]
```

Context depth and effort are separate. Effort selects the model/reasoning; it can also affect selector/research inference when no separate selector is configured. It does not automatically increase context budgets. Attachments and typed/custom text are intentionally not automatically secret-masked. The rewriter should treat project text as evidence, but model obedience is not a security guarantee; output remains subject to human review. Automated chat interception is retired.

Confirmed exceptions to the intended diagram: privacy can become stale during file selection and history persistence (finding 2); configured Git filters can execute during collection (1); pending uploads can be absent from the snapshot (12); cancellation can arrive during send checks without preventing enqueue (3). These are fix requirements, not claims that the diagram already enforces every arrow correctly.

## Data lifetime and recipients

```mermaid
flowchart LR
  Input["Request, context, attachments"] --> Copilot["Copilot model processing<br/>Existing account / vendor policies"]
  Input -->|"If saving enabled: draft text and metadata"| Draft["Shared data/state.json<br/>Session-prefixed plaintext state"]
  Input -->|"If saving enabled: original text"| History["Shared prompt history<br/>50 default / 500 UI max + character budget"]
  Input -->|"Explicitly uploaded bytes only"| Temp["Temporary attachment copies<br/>Cleanup triggered by worker activity"]
  Copilot -->|"Result text when saving enabled"| Draft
  Copilot -->|"Result + model/style/project/time when saving enabled"| History
  Copilot --> Journal["Temporary helper journal"]
  Journal --> Filter["Allowlist accounting fields<br/>Deduplicate and flush"]
  Filter --> Receipt["Local usage/session-state<br/>No prompt/file/account text exported"]
  Receipt --> Insights["Usage Insights consumer"]
  Journal -->|"Flush failure"| Recovery["Preserved raw journal<br/>May contain transcript; recovery gap"]
  Meta["Plugin source/ref/version metadata"] --> GitHub["Bounded credential-free GitHub<br/>update metadata requests"]
  Diag["Bounded in-memory diagnostic fields"] -->|"User chooses Copy logs"| Support["Clipboard; user decides where to share"]
```

Preferences have a separate file; rules, models and history share the data store with session state. Draft metadata includes attachment paths and context-item summaries, not attachment bytes or raw automatic excerpts. “Delete everything” currently covers history/configuration/current-session panel state and attachments, not every old session draft, exported downloads, Copilot conversations, or usage receipts. No automatic upload of diagnostics or usage exists in the plugin. Attachment cleanup is activity-triggered, so “one day” is a threshold checked on startup/upload, not a guaranteed timer while the plugin is disabled. The temporary SDK configuration directory does not replace the user's OS HOME; existing account discovery remains available to the runtime.

## Where time and work accumulate

```mermaid
flowchart TD
  Edit["Every draft edit"] --> Save["Queued persistence"]
  Save --> Full["Read + parse + stringify + replace<br/>all accumulated session keys"]
  Full --> Watch["On file change: listeners compare snapshots"]
  Open["Canvas startup persisted atoms"] --> Reads["Many reads of the same shared file"]
  Reads --> Full
  Gather["Preview or enhancement"] --> Enumerate["Fresh enumeration + project documents"]
  Enumerate --> Search["Deep paths: one Git search per keyword"]
  Search --> Excerpts["Bounded excerpts / optional model selection"]
  Excerpts --> Rewrite["Model inference, then accounting cleanup"]
  Hist["History query"] --> Group["Repeated scans per project"]
  Group --> Page["Only 12 visible rows"]
```

Full-file persistence and repeated search are the first optimization targets. Model latency is an additional unmeasured cost in this audit. Pagination bounds rendered rows but not the full history scan. See [measured costs and trade-offs](performance.md).

## Update lifecycle and cancellation hazard

```mermaid
stateDiagram-v2
  [*] --> DueCheck: Canvas opens or manual check
  DueCheck --> Cached: Disabled / not due
  DueCheck --> Resolve: Due and allowed
  Resolve --> Unavailable: Local, pinned, uncertain or unsupported source
  Resolve --> Current: Running and installed match available
  Resolve --> Reload: New version already installed
  Resolve --> Available: New version at configured source
  Available --> Available: Later / view changes
  Available --> Revalidate: Human clicks Update
  Revalidate --> Busy: Active work or duplicate reservation
  Revalidate --> Installing: Identity and source verified; reserve work
  Installing --> Pending: Timeout or connection loss
  Pending --> Verify: Reconcile before any retry
  Installing --> Verify: SDK request returns
  Verify --> Failed: Inventory or provenance mismatch / refusal
  Verify --> Reload: New installed version verified
  Reload --> Current: User restarts supported host and reopens
```

Updates use the attached session's plugin operation, never an agent-callable action or alternate installer after a policy refusal. A request reporting success is insufficient: inventory is re-read. On the previously recorded runtime, restarting Copilot is required; this audit did not rerun a live install/restart. **Finding 5:** cancellation currently releases a work reservation before helper cleanup finishes, so the `Busy` guard can stop protecting that interval. Keep reservations through cleanup and accounting, even when the UI caller has stopped waiting.

## Proposed storage improvement — not implemented

```mermaid
flowchart LR
  Panel["Canvas"] --> Snapshot["One bulk read per store revision"]
  Panel --> Queue["Coalesce draft edits<br/>Flush before close / send / update"]
  Queue --> Session["Only this session's draft/result file"]
  Pref["Shared preferences / rules / models"] --> Snapshot
  History["Shared bounded history<br/>Future archive/index if approved"] --> Snapshot
  Session --> Snapshot
  Session --> Transaction["Atomic replacement + cross-process coordination"]
  Recovery["Owned journal recovery registry"] --> Receipts["Durable usage receipts<br/>Consumer incremental index"]
```

This keeps reopen convenience, history, animation, model choices, receipt preservation and context levels. It requires migration, stale-reader invalidation, concurrency tests and recovery, rather than a new framework. Automatic expiry, a full-history archive and any reduction in AI research are separate user decisions.
