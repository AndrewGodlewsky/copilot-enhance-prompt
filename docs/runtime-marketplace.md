# Runtime-only marketplace preview

The owner approved preparation of this channel on 2026-11-17. `runtime-preview` is a separate generated branch of this repository, with the same `copilot-enhance-prompt` marketplace and `enhance-prompt` plugin identity. It contains the verified runtime package, `.github/plugin/marketplace.json` and `channel.json`. It has no source-tree ancestry, npm dependencies, build scripts or separate Copilot SDK/runtime. `main` remains the ordinary source marketplace. Existing installations are never redirected automatically.

This is a preview channel for validation, not a declaration of stable v1. The explicit branch choice is mutable; published source tags/full commits remain pinned. Forks and custom branches retain their own provenance. No archive, retention or model setting changes accompany the switch. The green Lift icon and license notices are byte-identical to the source release.

## Maintainer preparation and publication

Keep source changes and release notes on `main`. After its exact commit passes the required build/tests/generated checks and hosted Verify:

```powershell
# First publication only: no previous channel parent.
node scripts/runtime-marketplace.mjs SOURCE_COMMIT .artifacts/channel-candidate
# Later publications: fetch and supply the current remote channel tip.
git fetch origin runtime-preview
node scripts/runtime-marketplace.mjs SOURCE_COMMIT .artifacts/channel-next FETCH_HEAD
```

These commands are alternatives, not a sequence for the first release. Output directories must be new. For a fork, supply its owner/repository as the fourth argument; use `-` for an absent previous parent. The builder reads only committed files through the existing validated runtime packager. It checks the catalog's identity/root source, records exact file hashes and source commit in `channel.json`, then creates an unreachable Git commit using a separate temporary index. It neither moves a branch nor pushes, installs or evaluates package code. A failed attempt may leave unreachable Git objects for Git's normal maintenance; never manually delete shared objects.

The first commit is an independent root. Later commits have exactly one runtime-channel parent and must increase the semantic version. Previous history is checked for the same channel/repository and declared regular runtime files; source merges, arbitrary parent branches, extra development files and same-version replacement are refused. History beyond 1,000 releases requires explicit maintainer review. No source branch, working-tree file or ordinary Git index is changed.

Inspect `channel-report.json`: source commit, candidate commit, parent, version, file hashes/counts and uncompressed source/package bytes. Then publish **that candidate commit**, using an ordinary non-force push:

```powershell
git push origin CANDIDATE_COMMIT:refs/heads/runtime-preview
```

If the remote moved, stop, fetch its new tip and rebuild the candidate. Never force-push, merge `main` into the runtime branch or hand-edit runtime files. The branch has no build workflow; source CI plus explicit publication is the gate. Hashes and Git identity are not artifact signatures, and the branch is not immutable. Stable promotion/protection/attestation and desktop acceptance remain separate release gates. Future source releases need their own explicit channel publication; pushing `main` alone does not update this channel.

## Explicit opt-in and migration

This is optional preview preparation. For ordinary use, keep the existing marketplace while native acceptance remains pending. A new disposable installation can select `AndrewGodlewsky/copilot-enhance-prompt#runtime-preview` as its marketplace source, then install `enhance-prompt@copilot-enhance-prompt` through Copilot.

On the tested runtime, adding that source over an existing same-name marketplace fails with “already registered.” Removing a marketplace while its plugin is installed also refuses without force. There is no verified in-place repoint command. An explicit migration therefore requires unregistering this installation and re-registering its marketplace. The [official CLI reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference) documents the underlying operations and policy restrictions.

For an owner-approved trial, finish work and wait for **Saved**, retain a private backup according to your organization's policy, and inspect the installed source first. Use the desktop-compatible executable and actual desktop profile, never the isolated model-helper profile. These steps apply only to the ordinary installation of this repository, not a fork, pin, managed entry or different marketplace. Run each command only if the preceding one succeeds:

```powershell
copilot plugin list --json
copilot plugin uninstall enhance-prompt@copilot-enhance-prompt
copilot plugin marketplace remove copilot-enhance-prompt
copilot plugin marketplace add AndrewGodlewsky/copilot-enhance-prompt#runtime-preview
copilot plugin install enhance-prompt@copilot-enhance-prompt
```

Stop on policy refusal or unexpected dependents. Do not use `--force`, edit Copilot's internal configuration, remove another plugin or bypass policy. The script used for testing performs this only in disposable profiles; it is not a user-data migration utility. Fully quit/reopen Copilot and reopen the same session. Check the installed/footer version, green icon, acknowledged draft/result, attachments, history, rules and settings before continuing. These native checks are still pending. An ordinary update/reopen can leave an old backend loaded; no live reload is claimed.

Plugin data is stored separately from package files. Synthetic migration tests verify retained bytes, not every native crash or backup/recovery scenario. Returning to `main` uses the same explicit source-switch procedure only after maintainer review of version/storage/security compatibility; do not blindly downgrade. No automatic rollback or cleanup is implemented.

## Verification and limits

`runtime-marketplace.test.mjs` checks an independent history root, exact allowed package/catalog bytes, source/index isolation, fork identity, monotonic successors and rejection of source ancestry/catalog redirects. Existing updater tests continue to cover custom refs, forks, pins, provenance changes and policy refusals.

`e2e-runtime-marketplace.mjs` uses the installed SDK with account authentication disabled and owned profiles. A private Git URL rewrite redirects only its fixture Git requests to an owned repository while exercising Copilot's actual GitHub-source parser. It tests fresh branch installation, refusal of implicit replacement, explicit reinstall, selected-branch metadata and an attached-session update. Exact cache files, drafts/results/history/rules/models/preferences, attached fixture bytes, production-recorded synthetic usage and an unrelated fixture plugin are checked. The later version bump is metadata-only, not a new-runtime/hot-reload claim. No inference is sent. The [sanitized fixture observation](audits/v1/runtime-marketplace-observation.json) records version, file counts and source hashes; its small synthetic source tree is not a measurement of the full repository.

The retained-data fixture uses the extension's normal data directory under the isolated runtime's `LOCALAPPDATA`, including its `usage` child. Native restoration still needs the manual check above.

After publication, `node scripts/e2e-runtime-marketplace.mjs --published-source SOURCE_COMMIT` opts into a real public GitHub download in another disposable profile. Before running the extension fixture, it independently derives the expected manifest and payload hashes from that trusted local source commit using the validated packager. It rejects downloaded content even when an altered payload and its accompanying marker agree with one another. It then checks actual inventory/update metadata, exact cache files, and the built canvas/context/privacy/sending fixture. It still uses no real account or paid model and does not control desktop UI.

Runtime evidence uses Windows x64 / Node 24.22.1 / Copilot SDK/CLI `1.0.106-8.unstable.r43566476370.g869eef3`. File counts and byte sizes are uncompressed payload measurements, not Git/network-transfer benchmarks. Old marketplace cache objects may remain after migration; the plugin never prunes them. Native icon enrichment, activation, saved-data behavior, managed-account policy and stable-channel guarantees remain unverified.
