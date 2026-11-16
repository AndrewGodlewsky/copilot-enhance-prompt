# Copilot plugin update research

Checked **2026-11-15**. This note records public contracts and repository evidence; it does not establish which management calls the installed desktop permits an extension to make. No plugin installation, update, reload, or user-setting mutation was performed for this research.

## This distribution

- Plugin: `enhance-prompt`; observed manifest version: `0.10.10`. The version lives in [plugin.json](../plugin.json).
- Marketplace: `copilot-enhance-prompt`. Its [catalog](../.github/plugin/marketplace.json) advertises `enhance-prompt` with `source: "./"`, meaning the plugin comes from this marketplace repository's root. The catalog does not declare a separate plugin version, repository, or pin.
- Origin: `https://github.com/AndrewGodlewsky/copilot-enhance-prompt.git`; published default branch: `main`, confirmed through GitHub's repository API and the local `origin/HEAD`. The documented install uses this repository as its marketplace. Built extension and panel files are committed. [Repository metadata](https://api.github.com/repos/AndrewGodlewsky/copilot-enhance-prompt), [installation instructions](../README.md#download-and-install).

**Conclusion:** distribution is through repository content and its manifest, so a GitHub Release is not required for this installation route. A releases feed would not describe this project's update channel. Marketplace identity comes from the catalog's name, separately from both repository and plugin names. [GitHub marketplace reference](https://docs.github.com/en/copilot/reference/plugin-and-marketplace-reference#marketplace-catalog).

## Verified public behavior

The CLI provides `copilot plugin update NAME`; marketplace catalog refresh is a separate operation. `plugin list --json` returns an array containing `name`, optional `marketplace`/`version`/`installedFrom`, `enabled`, and `source`. Marketplace registration accepts `owner/repo#ref`. Catalog plugin sources can be relative paths or GitHub/Git objects; object sources support `ref` and a full 40-character `sha` pin. A commit pin is stable across branch/tag moves. Local-directory marketplace plugins load live; changed files take effect after `/restart` or a new session, without an update command. The interactive dashboard can indicate newer upstream versions. [GitHub CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).

Custom marketplaces can opt into session-start updates through user or managed `extraKnownMarketplaces` entries with `autoUpdate: true`. Repository-level opt-in is ignored. **SDK and server sessions do not perform this auto-update.** Managed policy controls conflicting entries. `settings.json` stores user settings; `config.json` is runtime-managed state. These facts do not establish desktop background update behavior. [GitHub configuration reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference).

`--plugin-dir` loads explicit, process-scoped plugins, distinct from persistent marketplace installs. The SDK documents `session.rpc.plugins.list()` for inspection. `COPILOT_PLUGIN_DIR_ONLY=true` suppresses ambient discovery for isolated runs; it is not an update mechanism. [GitHub SDK plugin-directory guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/plugin-directories).

## Public SDK contract, not installed-runtime proof

The generated TypeScript contract at commit `cf045793958ce674259c557f7769788f94ee20c9` defines:

- `plugins.update({name})`, accepting a name or `plugin@marketplace`; the result contains optional `previousVersion`/`newVersion` and `skillsInstalled`.
- Global inventory and session inventory separately. Session management uses that session's account, working directory, and retained policy.
- `installedFrom` as the marketplace directory for live local records; `rootPath` as the optional installed-content directory. They are different fields.
- `source` currently marks built-ins, otherwise is absent. `verifiedSource` describes direct GitHub installs pinned to a commit; it is absent for marketplace, local, and unpinned installs.
- Marketplace `source` as human-readable text, not a structured repository/ref contract. Opaque plugin `id` is not a mutation argument.
- Session plugin reload can relaunch subprocess extensions by default.

These experimental declarations do not demonstrate that an extension-owned connection may update or reload itself. [Pinned SDK RPC source](https://github.com/github/copilot-sdk/blob/cf045793958ce674259c557f7769788f94ee20c9/nodejs/src/generated/rpc.ts).

## Implementation implications and remaining checks

These are recommendations derived from the contracts above, not additional runtime guarantees:

| Installation evidence | Appropriate update treatment |
| --- | --- |
| Confirmed canonical GitHub marketplace, default branch | Compare against the manifest on its confirmed branch; target `enhance-prompt@copilot-enhance-prompt` only. |
| Explicit branch, tag, or commit pin | Preserve that selection. Do not compare with `main` and silently replace it. A resolved commit alone does not prove whether the user selected a moving branch or a fixed pin. |
| Local marketplace or `--plugin-dir` | Describe local/development status; do not install the canonical GitHub copy over it. |
| Fork, different marketplace source, or same-name collision | Preserve the source. Matching plugin/marketplace names do not establish canonical provenance. |
| Missing or ambiguous provenance | Report that update support cannot be verified; do not guess a repository or mutation target. |

The installed SDK declarations and disposable runtime checks must establish the extension connection's permission for list/update/reload, actual inventory fields, ref visibility, policy-denial behavior, and whether catalog refresh is needed before updating. Type availability alone is insufficient. A successful update response also does not prove the currently executing extension or open canvas has loaded new code.

Keep background checks read-only and bounded. Require the human UI action for installation, retain the runtime's policy and permission decisions, and do not answer permission requests or substitute an agent-facing canvas action for that human action. These boundaries follow this repository's [behavioral invariants](../AGENTS.md). Self-reload remains unverified; prefer an accurate restart/reopen instruction until desktop lifecycle behavior is established.
