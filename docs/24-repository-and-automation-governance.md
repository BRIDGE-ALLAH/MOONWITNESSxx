# Repository and Automation Governance

**Status:** Engineering baseline and operational contract  
**Canonical repository:** `BRIDGE-ALLAH/MOONWITNESS`  
**Supersedes:** older hook, local issue-creation, and ad hoc weekly-detection behavior  
**Related authority:** [docs/23 — Repository Audit and Current Execution Plan](./23-repository-audit-and-current-execution-plan.md)

## 1. Why this document exists

The repository had multiple competing automation paths: shell-parallel scripts, commit-time AI calls, version and changelog mutation, local Wiki/Pages generation, scheduled issue creation, duplicate service directories, and partially defined Turbo tasks.

These behaviors made it difficult to answer basic operational questions:

- Which command is the source of truth for validation?
- Does a green check actually mean all checks ran?
- Can a commit unexpectedly rewrite unrelated files?
- Which application or package owns a capability?
- Does a generated local document mean a Wiki or website was published?
- Can a scheduled scan create the same issue repeatedly?

This document gives every responsibility one owner. Automation must be observable, deterministic, idempotent where it writes state, and least-privilege by default.

## 2. Canonical identity and workspace topology

### Repository and package naming

- GitHub repository: `BRIDGE-ALLAH/MOONWITNESS`.
- Root package name: `moonwitness`.
- Product division: RIOTWORKS.
- `@riotworks/*` is the established package namespace for RIOTWORKS-owned modules. It is not the GitHub repository name and must not be used to construct GitHub API paths.
- GitHub owner/repository identity is configured as `BRIDGE-ALLAH/MOONWITNESS`; automation should prefer repository context supplied by GitHub Actions.

### Canonical workspace

| Path | Ownership |
|---|---|
| `apps/headquarter` | Human-facing web application |
| `apps/arsy` | Backend HTTP API and orchestration runtime |
| `packages/*` | Reusable contracts, libraries, adapters, and addon modules |
| `services/*` | Legacy prototypes, excluded from pnpm workspace and runtime ownership |

The pnpm workspace intentionally includes only `apps/*` and `packages/*`. Do not add `services/*` to the workspace as a shortcut. First identify unique behavior, move it to the canonical owner, add tests, and then retire/archive the duplicate implementation.

### Non-overlapping architecture rules

- Headquarter may consume ARSY through public API contracts; it must not import backend implementation source.
- ARSY must not depend on UI packages.
- Domain packages own domain behavior; adapters own provider-specific behavior.
- The ORM owns model metadata and record operations; database adapters own SQL/provider translation.
- Schema reconciliation has one owner and one private ARSY API. Do not add a second migration or schema authority.
- Queue contracts and idempotency belong to the jobs layer; BullMQ is an optional transport adapter, not a second source of business truth.
- ZILL policy decisions and MIZAN financial evidence remain separate bounded contexts.

## 3. Toolchain and package-manager policy

| Tool | Baseline |
|---|---|
| Node.js | 22+ locally; Node.js 24 in CI |
| pnpm | 12.16.1, pinned in root `package.json` |
| Workspace orchestration | Turborepo |
| Formatting | Prettier 3 |
| Unit tests for repository automation | Node.js built-in test runner |

Do not silently upgrade the package manager or lockfile format. A package-manager upgrade is a deliberate toolchain change that includes the manifest, lockfile, CI setup, local instructions, and validation evidence.

### Dependency build-script approvals

pnpm 12 blocks dependency lifecycle/build scripts unless the workspace explicitly approves them. The current allowlist in `pnpm-workspace.yaml` is intentionally narrow:

- `esbuild`
- `msgpackr-extract`
- `sharp`

These are required native/build dependencies in the current Next.js toolchain. Do not set a blanket allow-all option. When a new package requests build-script permission, inspect its maintainer, source, version, purpose, and install behavior first, then add only that exact dependency to the allowlist. CI must fail closed when an unapproved build script is introduced.

### Lockfile integrity

pnpm 12 can write `pnpm-lock.yaml` as a multi-document YAML stream. The first (boot) document records the resolved pnpm version and config dependencies. The last (project) document contains the workspace importer graph and the normal project dependency resolutions. Both documents are intentional; never delete the first document or treat it as an accidental duplicate. The repository audit must inspect the **last** document when checking workspace importers. See the official [pnpm lockfile format documentation](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/lockfile.md).

The supported workflow is:

1. Run `pnpm run lockfile:refresh`, or let the manifest-change workflow run after a push to `main).
2. Review the generated lockfile diff and confirm the project document contains every workspace importer.
3. Verify with `pnpm run lockfile:check` and `pnpm install --frozen-lockfile`.
4. Merge the dedicated lockfile PR; never normalize or hand-edit the two-document stream.

The check script refuses to regenerate the lockfile when it already has staged or unstaged local edits. This preserves local work. Ordinary CI and deployment installs remain frozen.

## 4. Command contract

| Command | Sole responsibility |
|---|---|
| `pnpm dev` | Start workspace packages that define a persistent dev task |
| `pnpm dev:headquarter` | Start Headquarter |
| `pnpm dev:arsy` | Start ARSY |
| `pnpm check:repo` | Read-only workspace and automation audit |
| `pnpm audit:repo` | Write ignored audit artifacts under `.artifacts/` |
| `pnpm format` | Format repository files |
| `pnpm format:check` | Verify formatting |
| `pnpm lint` | Repository structure and formatting gate |
| `pnpm type-check` | Run package-level Turbo type-check tasks |
| `pnpm test` | Run Node.js automation tests |
| `pnpm lockfile:check` | Verify lockfile is reproducible from workspace manifests |
| `pnpm lockfile:refresh` | Deliberately regenerate the pnpm lockfile |
| `pnpm validate:repo` | Run repository integrity, formatting, and automation tests |
| `pnpm validate` | Run repository validation, package type-checks, and builds |

A package-level task must be backed by an actual implementation and test target. Do not add scripts that only print success, delegate unrelated work, or swallow failures. Root scripts must not use uncontrolled shell backgrounding (`&`) to simulate parallel execution; Turbo owns workspace parallelism and exit-code propagation.

The current `lint` command is the repository hygiene/format gate. A full source-code ESLint configuration is not yet established across the workspace; do not describe this command as comprehensive TypeScript linting until that capability is implemented and verified.

## 5. Git hooks

### Pre-commit

The pre-commit hook checks formatting for staged text/config files only. It must:

- run locally and quickly;
- work without network access or external credentials;
- never stage files silently;
- never modify package versions or changelogs;
- never call AI services or create GitHub issues;
- exit non-zero when the check cannot run or a check fails.

### Commit message

The commit-msg hook validates a Conventional Commit subject:

```text
type(scope): imperative summary
```

Examples:

```text
feat(arsy): add readiness endpoint
fix(headquarter): correct locale redirect
chore(ci): pin workflow toolchain
```

The subject must be no longer than 72 characters. AI-generated commit assistance remains a manual opt-in command and is not part of Git hooks or CI.

### No commit-time releases

A normal commit must not bump versions, update release notes, create tags, generate Wiki content, publish Pages, or modify issue state. Those are separate, intentional workflows.

## 6. GitHub Actions ownership

| Workflow | Trigger | Responsibility | Permissions |
|---|---|---|---|
| `ci.yml` | Push, PR, manual | Lockfile integrity and repository validation; optional full workspace gate | `contents: read` |
| `weekly-detection.yml` | Weekly, manual | Read-only audit report and automation tests | `contents: read` |
| `codeql.yml` | Push, PR, weekly | Static security analysis | `contents: read`, `security-events: write`, `actions: read` |
| `pr-labeler.yml` | PR updates | Apply path-based labels | `contents: read`, `pull-requests: write` |
| `refresh-lockfile.yml` | Manifest/workspace/lockfile changes on `main`, manual | Regenerate lockfile and open/update a reviewable PR | `contents: write`, `pull-requests: write` |
| Dependabot | Weekly | Propose dependency and Actions updates | Managed by GitHub |

### CI staging

The repository currently has two different maturity levels:

1. **Repository integrity**: the automation and governance checks are being made deterministic now.
2. **Full workspace quality**: package type-check and build commands are not yet reliable across all apps/packages because manifests, entrypoints, and the lockfile still need Phase 0 repair.

The `full-workspace-quality` CI job is intentionally gated by the repository variable `FULL_QUALITY_CI=true`. Do not enable it until `pnpm install --frozen-lockfile`, `pnpm type-check`, and `pnpm build` pass from a clean checkout. Do not disable a failing check merely to make the badge green.

### Weekly detection is read-only

The weekly audit writes artifacts and a GitHub Actions summary. It does not create issues automatically. A detected problem should become an issue only after it is reviewed, deduplicated, scoped, and assigned an owner. This prevents repeated scheduled scans from flooding the issue tracker.

### Workflow safety

- Pin toolchain versions; use maintained official actions at their documented major version.
- Declare permissions explicitly at workflow or job level.
- Use `GITHUB_TOKEN` with only the required permissions.
- Do not use `if: always()` for a write operation that can create issues or deploy content after a failed validation.
- Avoid secrets for read-only repository checks.
- Use workflow concurrency to cancel redundant CI runs, but never cancel a release or stateful deployment halfway through.
- Upload reports/artifacts on failure so the cause remains inspectable.

## 7. Issue and pull-request governance

- Use issue templates for reproducible bugs and scoped feature proposals.
- Search for an existing issue before creating a new one.
- Keep issue titles actionable and unique; link work to the owning milestone/epic when applicable.
- Use labels to describe type, area, priority, and status; do not invent new labels for every scan.
- A pull request must state scope, evidence, validation, and recovery impact.
- Merge only after all required checks pass and the diff is reviewed.
- Do not claim an issue is resolved merely because code was committed; verify the acceptance criteria and merge state.

Suggested branch names are `feat-*`, `fix-*`, and `chore-*`. The current default PR target is `main`; a future `dev → main` promotion flow requires an actual `dev` branch and matching branch protection before it becomes policy.

## 8. Release, changelog, Wiki, and Pages

### Release management

No release should be created from a pre-commit hook. When package publishing and app deployment boundaries are stable, introduce a release tool such as Changesets with explicit version impact, changelog generation, tags, provenance, and rollback behavior. Until then, version updates are intentional release changes, not side effects of commits.

### Documentation and GitHub Wiki

- `docs/` is canonical.
- The GitHub Wiki is a mirror only when enabled and explicitly published.
- A local `docs/wiki` file does not prove that a GitHub Wiki exists or has been updated.
- Wiki synchronization must be a separate manual/approved workflow with a clear target and authentication.

### GitHub Pages or Vercel

Do not generate fake deployment claims or sitemaps from a commit hook. A publishing workflow is valid only after the target site, source directory, build command, permissions, domain, and deployment status are known. MOONWITNESS app deployment and public narrative/blueprint hosting are separate concerns.

## 9. Secrets and local environment

- `.env.example` contains only safe defaults and empty secret placeholders.
- A local `.env` is ignored by Git.
- CI uses the built-in `GITHUB_TOKEN`; do not create a personal access token secret when the built-in token is sufficient.
- Kilo Gateway credentials are optional and used only by explicitly invoked local AI assistance.
- Local build, audit, formatting, tests, and Git hooks must not require AI or GitHub API credentials.

## 10. Repository protection settings

The connected GitHub credential can push code but does not have repository-administration permission. Consequently, branch protection/rulesets, required status checks, merge queue, and repository secrets cannot be configured from this code change.

Recommended settings to apply with an administrator account:

1. Protect `main`; require pull requests and at least one approval when collaborators are involved.
2. Require the repository-integrity CI status check.
3. Require conversation resolution and dismiss stale approvals after new commits.
4. Block force pushes and branch deletion.
5. Require signed commits only if the local signing setup is documented and adopted.
6. Enable private vulnerability reporting and Dependabot security updates.
7. Allow squash merge; disable merge commits if the project adopts a linear history.
8. Keep GitHub Actions default token permissions read-only; elevate individual workflows only where needed.

Do not configure a rule that requires a status check name that does not exist.

## 11. Phase 0 completion criteria

The repository foundation is complete only when all of these are evidenced from a clean checkout:

- [ ] Root package identity, workspace names, and repo identity are consistent.
- [ ] Every workspace package has a valid manifest, entrypoint, and real scripts.
- [ ] pnpm lockfile importer entries match every workspace package.
- [ ] `pnpm install --frozen-lockfile` succeeds.
- [ ] Root commands use deterministic orchestration and propagate failures.
- [ ] Pre-commit and commit-msg hooks are local, predictable, and tested.
- [ ] CI runs repository integrity and full application quality gates.
- [ ] CodeQL and Dependabot run and report results.
- [ ] Legacy service duplicates are archived/retired after unique behavior is migrated.
- [ ] GitHub branch protection and required checks are configured by an administrator.
- [ ] Release, Wiki, and Pages automation is enabled only when the relevant target is real and verified.

A workflow file existing in Git is not proof that the workflow ran successfully. A passing repository audit is not proof that the application builds. Completion requires actual run logs and clean-checkout evidence.
