# Runtime-only packaging and channel decision

The ordinary marketplace still selects the repository root (`./`). Version 0.12.15 adds an optional release ZIP, not a new default source or installer. Its allowlist contains `plugin.json`, the approved `assets/icon.svg`, the compiled extension and adjacent web assets, `LICENSE`, complete `THIRD_PARTY_NOTICES.md`, `runtime-inventory.json`, `CHANGELOG.md` and `INSTALL.md`.

Source/tests, evaluation and audit data, development dependencies/locks/configuration, design drafts, most documentation, and the duplicate `src/web-dist` are omitted. The source remains available at the exact commit in the contents report. No SDK, runtime executable or npm install is added. The distribution inventory retains source/build references for auditing; those references are not claims that the corresponding development files are in the ZIP.

## Reproduce and inspect

After the normal verified build is committed:

```sh
node scripts/runtime-package.mjs HEAD .artifacts/packages
```

Requires the existing Node/Git build environment and a ZIP-capable `tar` (the tested Windows system tool). It uses only a committed Git tree; uncommitted files cannot enter it. It validates manifest/inventory identity, SemVer, every runtime artifact hash, notices, paths and regular-file modes. New registered components require allowlist review. It then creates a Git ZIP, lists and extracts that archive in an owned temporary directory, and verifies every exact byte against the committed blobs. This catches Git export attributes that omit or rewrite required files. It publishes nothing and refuses to overwrite existing outputs.

The ZIP filename includes version and commit prefix. Its `.sha256` file hashes the exact archive. The companion `.json` records full commit, exact per-file hashes, archive bytes, runtime bytes, complete source-tree bytes/file count and omitted count. Compare `packageBytes / sourceBytes` for uncompressed contents, not network transfer. Git compression, clone strategy, history and caches can change actual download size. Repeated generation from the same fixture commit/toolchain yields identical bytes. Cross-version Git/ZIP reproducibility is not established; preserve and compare the published checksum rather than regenerating with arbitrary tools.

These checks detect stale/changed contents, not malicious approved source, compromised build inputs, forged release permissions or a compromised publisher. There is no artifact signature or attestation yet. Existing runtime-inventory text hashes normalize CRLF; the archive report hashes raw bytes. A reviewed commit and green CI remain prerequisites.

## Verified and pending

`runtime-package.test.mjs` covers repeatable bytes, exact extracted contents, omitted development files, working-tree isolation, overwrite refusal, missing notices, stale inventory, linked files and export-attribute omissions. Existing updater tests cover fork/ref/pin/source behavior, which is unchanged by these artifacts.

`e2e-runtime-package.mjs` copies the current build into a disposable Git tree, creates/extracts the ZIP, installs it using the desktop-compatible CLI into a new `COPILOT_HOME`, and compares every installed file. It loads that cached package through the existing built-extension fixture: canvas registration/ownership, HTTP assets, theme persistence, context/privacy, provider rejection, diagnostics and guarded sending to a synthetic session pass without paid inference. A later synthetic manifest-version update verifies Copilot's copy/inventory behavior and preserved separate synthetic draft/result/preferences. That metadata bump is not evidence of a newly built runtime or hot reload; the separate `e2e-updates.mjs` exercises two real fixture-code versions and restart behavior.

Tested: Windows x64, Node 24.22.1, Copilot SDK/runtime `1.0.106-8.unstable.r43566476370.g869eef3`. The green icon's exact file and canvas owner identity are verified; desktop icon enrichment/rendering remains a manual check. The owner has previously seen local marketplace icon differences, so the ordinary GitHub marketplace remains recommended. No live installation is changed.

## Channel choices before v1

| Choice | Benefit | Cost / evidence still needed |
| --- | --- | --- |
| Current root marketplace on its configured branch | Existing installation identity and in-plugin update path continue working | Includes development files; mutable source cannot bind an update to exact reviewed bytes. |
| Optional runtime ZIP (implemented) | Small, inspectable snapshot with exact archive/file hashes | Manual local installation; no online update provenance. Direct installs are deprecated by the tested runtime. |
| Runtime-only published branch or repository | Potentially smaller managed installations with normal host updates | Needs an explicitly selected source, migration, fork/ref tests and real cache/transfer measurement. A subdirectory alone may still fetch the whole repository. No automatic repointing. |
| Version-pinned marketplace source | Explicit reviewed snapshot selected by user/admin | A tag is not inherently immutable; protect published tags or use a full commit. The plugin deliberately cannot update pins. Every upgrade needs an explicit pin change. |

Recommendation during preview: keep the ordinary channel and offer the optional ZIP for inspection/manual trials. Before stable v1, choose the managed small-package channel and immutable-release/attestation policy, then test migration in a disposable installation and confirm desktop branding/drafts. Issue #33 remains open for that owner decision and manual evidence. No branch, fork, pin, marketplace identity or local-install update policy is silently changed.
