# Maintainer checks and dependency monitoring

AndrewGodlewsky owns advisory triage and release review. Review GitHub security alerts, private vulnerability reports and failed scheduled audits at least weekly; prioritize a reachable runtime vulnerability or credential/privacy issue as soon as it is reported. These are maintainer procedures, not a guaranteed response SLA. Keep public issues free of credentials and private prompt content; follow the [security policy and recovery guidance](../SECURITY.md). Private reporting is enabled; verify security-alert notification subscriptions and delivery as the owner (pending #11). Do not test delivery by publishing fake advisories.

## Automated checks

The **Verify / Windows clean build** workflow runs for main pushes, pull requests and manual dispatch. It uses `windows-2025`, Node 24.22.1 and npm 12.0.2, installs both lockfiles, runs typecheck, builds, runs the complete tests after the build, then package and generated-file checks. `check-generated.mjs` rejects modified, staged, removed and untracked files under both generated output directories and the runtime inventory/notices. A green package check alone is not a source-to-bundle proof: the clean rebuild plus generated diff supplies that check.

Both workflows use pinned action commits, read-only repository contents permissions and checkout without persisted credentials. They use `pull_request`, never privileged `pull_request_target`, and have no repository secrets, model account, desktop runtime, publishing command, automatic merge or release creation. Dependency lifecycle/build scripts still execute in the disposable builder; review lockfile and action-pin changes as code. No shared dependency cache is restored.

The **Dependency audit** workflow checks both complete lockfiles every Monday at 13:23 UTC, on relevant changes and on manual dispatch. It includes development dependencies because some are bundled at runtime. High/critical advisories fail the job; lower severities remain visible for review. Network/registry failures also fail rather than claiming a clean audit. npm sends dependency metadata to its configured registry; no user prompts, project files or credentials are supplied. Audit finds known published advisories, not every defect or compromised dependency.

Dependabot checks npm `/`, npm `/web` and pinned GitHub Actions weekly, with at most five open version-update PRs per ecosystem and the maintainer assigned. Security-update PRs are also enabled. Nothing merges or publishes automatically. Dependency PRs often need a regenerated bundle/inventory commit before Verify can pass; a maintainer must inspect those changes.

## Repository settings observed on 2026-11-17

These facts were read with the authenticated GitHub API, rather than inferred from files:

| Setting | Verified state |
| --- | --- |
| Repository visibility / default branch | Public / `main` |
| Actions | Enabled; repository policy allows all actions, does not globally require SHA pins |
| Workflow default token | Read-only; workflow approval of PR reviews disabled |
| Dependency vulnerability alerts | Were disabled; enabled and rechecked for this issue |
| Automated security fixes | Were disabled; enabled, not paused |
| Secret scanning / push protection | Enabled before this change |
| Branch protection / rulesets | Main unprotected; no rulesets returned |

Workflow files pin their own dependencies despite the broader repository policy. CI reports status but is **not currently an enforced merge/push gate**. Branch enforcement remains an owner policy decision: requiring PRs/checks would alter this project's authorized direct-to-main workflow. No protection or bypass rule was invented. The API account had repository admin permission; no plan limitation prevented the checks/settings above. Hosted runner availability and service outages can still delay jobs.

## Release procedure

1. Update the version/changelog and inspect dependency, license and source changes.
2. Run the repository-required local checks and applicable disposable runtime fixtures. Real account and visual evidence remain separate.
3. Commit the reviewed build, inventory and notices; push without force. Wait for Verify on that exact main commit and review audit findings before publishing its preview release.
4. Release notes identify the commit and validation. Never treat a mutable branch, tag or generated source hash as a signature. Exact archive checksums and the minimal stable-package policy are addressed separately in #33/#35.
5. A failed job is work to investigate, not permission to skip verification. Update pins/Node/npm deliberately; keep the documented supported desktop/runtime matrix separate from this Node-only build job.

For releases from 0.12.15, generate the optional runtime ZIP from the exact green committed SHA using `node scripts/runtime-package.mjs <sha> .artifacts/packages`. Attach the ZIP, `.sha256` and `.json` contents report together; do not replace an existing artifact silently. Record the measured package/source byte counts in release evidence. [Package and channel policy](runtime-package.md) explains why the ordinary marketplace source stays unchanged. This is an additional release asset, not an automated publication step or a signed artifact.

The workflows publish nothing and do not automatically create tags. Use [GitHub workflow security guidance](https://docs.github.com/en/actions/reference/security/secure-use) and [Dependabot configuration reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) when changing them. Official action pins were resolved from `actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0 on the date above.
