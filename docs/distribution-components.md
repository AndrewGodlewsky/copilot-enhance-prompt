# Distributed components and notices

The installable Git repository includes [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), [runtime-inventory.json](../runtime-inventory.json), and the unchanged original [MIT license](../LICENSE). Keep all three with redistributed packages. The inventory records the actual emitted JavaScript packages, reviewed CSS packages, locked versions/integrities, source and output hashes, and asset hashes. It is a distribution inventory, not a vulnerability scan, signature, legal opinion or general SBOM for the desktop application.

## What is included

- The backend uses bundled `proper-lockfile`, `graceful-fs`, `retry` and `signal-exit`. They ship even though the root manifest declares them as development dependencies.
- The React panel's emitted modules identify its frontend packages. The generator reads full installed LICENSE/COPYING/NOTICE files, including Lucide's ISC notice and its Feather-derived MIT notice. Unused imports/packages are not counted as emitted JavaScript.
- Tailwind's generated styles and `tw-animate-css` are included separately because JavaScript module tracing does not identify CSS package provenance. The build fails when the reviewed CSS import set changes.
- All CSS source files in those two reviewed packages are hashed, including Tailwind's preflight/theme imports. This conservative source set detects CSS edits even when the package version and license remain unchanged; it does not mean each source file is copied verbatim into the panel.
- `web/src/components/ui/` and `web/src/lib/utils.ts` contain modified copied shadcn/ReUI components. Upstream commit `ca58cf4969f27cedb14c8d77b94b379f3cfcb25a` introduced them as React + shadcn/ReUI; `web/components.json` records the shadcn style and ReUI registry. Both MIT notices are retained conservatively because exact per-line upstream versions were not recorded. The files have subsequently been adapted for this plugin.
- No font files are bundled or fetched by the panel. It uses the host/system font stack. Build-only type declarations, compilers and unused package facades are listed separately as `nonEmittedPackages`; this classification does not mean they are risk-free during development.
- Copilot supplies `@github/copilot-sdk`, its extension API, the executable and Node runtime. They are external to this distribution, not downloaded or licensed by this notice generator.

## Copied source license snapshots

The complete texts were retrieved from official repositories on 2026-11-17 and committed under `licenses/`. Builds read these local snapshots without network access. Their hashes are checked with other inputs.

| Component | Official snapshot | Local text |
| --- | --- | --- |
| shadcn/ui | [e62c943 license](https://github.com/shadcn-ui/ui/blob/e62c9435fff729a175f38983dee73b2cb4f6a069/LICENSE.md), copyright 2023 shadcn, MIT | [shadcn.txt](../licenses/shadcn.txt) |
| ReUI | [067aa0d license](https://github.com/keenthemes/reui/blob/067aa0dc7f8bbfec1cd76fc5ad31f842be5f569a/LICENSE.md), copyright 2025 Keenthemes Inc, MIT | [reui.txt](../licenses/reui.txt) |
| react-remove-scroll-bar 2.3.8 | [8ca9ba5 license](https://github.com/theKashey/react-remove-scroll-bar/blob/8ca9ba5ea52de03308fe8ced94f7b159a44d28ff/LICENSE), copyright 2025 Anton Korzunov, MIT | [snapshot](../licenses/react-remove-scroll-bar-2.3.8.txt) |

`react-remove-scroll-bar` 2.3.8 declares MIT and Anton Korzunov as author but omits its license file from the published npm archive. The registry's recorded gitHead (`b3b1287aad81def2e2ae707274b74531b61ddbaf`) was unavailable in the official repository. The explicit version-scoped exception therefore supplies the official current MIT text above, rather than claiming it came from that unavailable historical commit. Future versions must include a license or receive a new reviewed exception. All other emitted npm package notices come from their installed locked archives.

## Art and icons

| Files | Provenance and distribution role |
| --- | --- |
| `assets/icon.svg`, `assets/icon.png`, packaged favicon | Approved green Lift design, introduced in this fork in `f4740eb`; the SVG is the desktop logo. Project-created artwork, not a copied vendor logo. |
| `assets/art/*` | Original project's generated logo/cover design materials, retained with original MIT attribution. History includes `89ec08e` documenting image generation; these are not loaded as panel scripts. |
| Quiet Desk scene in `web/src/quiet-desk.tsx` | Project-authored SVG/CSS implementation of the approved desk concept. See [design decision](superpowers/specs/2026-11-14-quiet-desk-design.md). |
| Word crew implementation and `docs/design/word-crew/*.png` | Project-created stick-figure motion and generated concept images; see [design record](design/word-crew/README.md). Concept PNGs are documentation, not runtime sprite dependencies. |
| `docs/assets/prompt-workflow.svg` | Project architecture illustration generated for this fork; documentation only. |
| Imported interface icons | Lucide React, with its complete ISC/Feather MIT texts in the generated notices. |

Artwork provenance is based on the repository's design records and history; it is not a guarantee about copyright protection of generated images. No third-party stock photograph, remote font service or additional icon font was identified. New copied assets need their source and applicable notice recorded before distribution.

## Build and drift checks

`npm run build` captures backend esbuild inputs with nonzero emitted bytes and frontend chunk modules with nonzero rendered length, then generates the two root files. It verifies installed package versions against the appropriate lock, requires locked integrity, and rejects missing license texts or an unreviewed license expression. It also records source, package license, lock and artifact hashes. Paths are relative; no machine paths, credentials or timestamps enter generated files.

`npm run check` regenerates the inventory/notices in memory and refuses differences, including changed notices, assets, locks or traced source/output. The full test suite checks representative bundled/build-only classification and required copied-source/icon attributions. A source-to-bundle rebuild/diff remains necessary to prove newly imported modules were traced; the later CI issue (#10) makes that repeatable. Neither build nor check fetches licenses, invokes a model or installs packages.

After dependency changes: use both lockfiles, build, inspect inventory and notice changes, review any new license/assets, then run final tests and package checks. Do not hand-edit generated notices. Review new license conditions before extending the allowlist; permissive-license identifiers alone do not replace their full required texts.

Hash entries explicitly say `normalization: lf` for UTF-8 text (CRLF is converted to LF before counting bytes and hashing), or `none` for exact binary bytes. This avoids false differences between Git checkout newline settings. These canonical source/artifact hashes detect drift; they are not exact archive digests or installed-code signatures. A release archive needs its own exact-byte checksum.
