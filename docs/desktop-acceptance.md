# Desktop acceptance before v1

This is the owner-run gate for [#29](https://github.com/AndrewGodlewsky/copilot-enhance-prompt/issues/29). **Every native/account result below is pending.** Automated fixtures exercise separate boundaries; they do not establish that this desktop matrix passed. Use one candidate version/commit throughout and repeat affected checks after a fix.

## Record the environment

Copy this into a private test record; share only non-sensitive results:

```text
Date / tester:
Plugin running version / commit:
Installed version / source / channel:
Copilot desktop version / SDK-runtime version (if known):
OS / screen scale / canvas widths tested:
Account class: personal / organization-managed (no login or token)
Enabled model IDs / advertised reasoning choices (no credentials):
Assistive technology / version, if used:
Row ID: pass / fail / blocked / not run — observed result and safe evidence
```

The automated baseline is Windows x64, Node 24.22.1, installed SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3`. Desktop executable metadata was 1.4.2; no native rendering was verified. Fixtures use synthetic accounts and loopback inference. Other desktop/runtime/platform versions are unverified, not implicitly supported. VS Code is outside scope.

## Safe setup

Use a disposable desktop profile/project if the host offers one. Otherwise use an empty synthetic project and clearly labeled test drafts without deleting existing content. Do not change organization policy, sign out another user's session, corrupt saved files, terminate the app during real work, or uninstall unrelated plugins. Stop if isolation is uncertain. Use Settings and model discovery without clicking Enhance/Test/Send for no-inference checks. Rows marked **allowance** require a separately accepted budget and may make multiple model calls; none have been authorized or performed by the agent for this gate.

## Matrix

All rows start **Not run**. Record the observed result, not only a checkmark.

| ID | Owner action | Expected result / pass criterion |
| --- | --- | --- |
| I1 | Fresh ordinary marketplace install in a disposable profile; open a new session/canvas. | Correct version, green Lift tab icon, readable loading states, no npm/runtime download requested. Record source/identity. Local ZIP is a separate unsupported-auto-update mode; do not substitute it as evidence for marketplace success. |
| I2 | With an older supported test installation, retain synthetic draft/result/attachment and settings; update using the notice or Settings. | Running/installed/available versions are distinct; update verifies disk state, then gives activation instructions. Reopen/new session/restart only as instructed; record which action actually loads the new version and preserves saved data. Do not downgrade a live install to create this case. |
| I3 | Open two canvases; check updates, use Later, then open Release history from the footer. | No duplicate installation, no auto-install, dismissal is version-specific; manual English release notes remain available. First durable-marker baseline can be quiet. A later release should attempt What's new once across the shared data folder. |
| A1 | Personal account: Models → check connection and inspect each effort's model/reasoning. | Requested choices match catalog availability. Unsupported recommended models remain actionable, never silently substituted. Connected means account/catalog checks, not successful generation. No model Test needed. |
| A2 | With a separately provisioned managed test account, repeat A1 and observe a policy-denied case. | Record allowed and denied results independently of personal success. Stop on policy refusal; no alternate provider or permission bypass. Managed authentication is still gate #30. Never alter a real organization's policy just for this test. |
| W1 | Type a synthetic Unicode request and press Enter; change context/style/effort, attach a harmless text file and image. | Enter adds a newline; controls stay clear; upload pending/error state prevents enhancement, cancel excludes only its file. Clear removes draft, attachment references and reviewed result without changing history. |
| W2 | **Allowance:** with a supported effort, Enhance a small synthetic request; inspect/revise the result, Copy, Save a file. | English rewrite preserves literal paths/quotes/Unicode; source text is restored after animation; clipboard contains chosen result; download success identifies the Downloads destination when known. Nothing is sent merely by enhancing/copying/downloading. |
| W3 | **Allowance:** explicitly send a harmless reviewed result to an idle test session; repeat with that session busy or awaiting permission. | Idle send reaches only the attached test session. Busy/permission/queue uncertainty blocks sending without answering permissions. Keep auto-send off unless testing its explicit opt-in separately. |
| W4 | **Allowance:** cancel a rewrite; separately close its canvas while running. | No late result is sent; work stops or remains visibly guarded during cleanup. Reopen shows retained acknowledged draft. Update cannot begin during helper cleanup. Actual cancellation timing may vary. |
| D1 | Rapidly type a long draft; wait for Saved, close/reopen; repeat in another session. | Latest acknowledged text/result/attachments restore to their own sessions. Saving is not a promise that every keystroke is durable. Record any save error and Retry outcome. |
| D2 | In a disposable test only, type then immediately use the native close control before Saved. | Record whether the final edit survived. Native close has no confirmed blocking flush handshake; this row is an evidence gate for #14, not an unconditional preservation promise. Do not force failure by modifying real storage. |
| D3 | Search/filter/sort History across synthetic projects; expand entries, switch Original/Enhanced, reuse/copy/delete/Undo. | Full project identity is discoverable; Copy enhanced prompt matches its label; Reuse never sends. Undo expires after one minute and backend restart; tab hiding must not imply a longer recovery promise. |
| D4 | Change a test rule/structure/profile; give two items identical names. | Actions identify the intended row, save persists, cancellation leaves saved content unchanged; no cross-project rule leakage. |
| R1 | With test work idle, temporarily disconnect networking, check updates manually, and restore networking. | Normal editing remains usable; manual error is useful, automatic check stays quiet. Network loss alone does not prove local canvas SSE reconnection. |
| R2 | During a safe planned Copilot restart, reopen the test canvas and inspect retained state; if a connection banner appears, follow Retry/reopen. | Invalid canvas identity asks to reopen; no old command/send is replayed. Do not kill a real backend to manufacture this case. Lazy-section/stream failure injection is covered by automated fixtures; record only native failures actually observed. |
| U1 | Drag narrow → medium → full-screen; repeat dark/light and Small/Medium/Large text, plus 200% zoom when available. | No inaccessible clipped controls, horizontal page overflow or overlapping actions. Review/result text remains readable; sidebar collapse, dialogs, long project names and tooltips work. Record actual widths or screenshots, without private content. |
| U2 | Keyboard-only: navigate dropdowns/dialogs/menus/history/recovery, Escape, Tab/Shift+Tab. | Visible focus, sensible order, focus returns to trigger, no traps, all actions operable; outer request card has no unwanted highlight. |
| U3 | Screen reader: inspect labels, duplicated item actions, progress, save/connection/errors and completion. | Numeric progress is announced correctly, unknown progress is not falsely precise, labels disambiguate rows, changes announce without excessive repetition. Record actual AT; static ARIA tests do not prove this. |
| U4 | Reduced-motion enabled; inspect the long scrollable request animation during **allowance** W2. | Motion preference respected, visible text/characters stay inside the box, no hidden-input edits or layout jump, words are set down before figures leave. Do not infer frame rate from CPU-only tests. |
| S1 | Follow the [pause/recovery guide](../SECURITY.md) in a disposable setup: disable, restart, re-enable. | Disabled plugin does not start; acknowledged data persists; updated fixed version can reactivate. Confirm private security report notifications separately without posting a public vulnerability. |
| C1 | **Allowance:** after one successful rewrite and any context calls, refresh Usage Insights. | Separate helper sessions appear under Enhanced Prompt; recorded usage matches available runtime receipts. Unknown/delayed charges are reported as such, not zero. Do not infer invoice accuracy from synthetic tests. |

## Completion rules

Keep #29 open until required rows have observed results or an explicit owner-approved unsupported scope. Keep #30 and #31 separate: a personal rewrite does not prove managed policy or prompt quality. File reproducible failures using synthetic steps and a sanitized Show Logs report; do not paste raw helper journals, tokens, private prompts or filesystem paths. Existing owner observations from older builds are useful history but are not a pass for this candidate.

The [backlog ledger](audits/v1/backlog-progress.md), [runtime package evidence](runtime-package.md), [canvas recovery limits](canvas-recovery.md), [item accessibility checks](item-action-accessibility.md), and [retention/privacy guide](privacy.md) record automated coverage and known limits. After owner testing, append the environment and row results in #29; link failures instead of erasing them after a retest.
