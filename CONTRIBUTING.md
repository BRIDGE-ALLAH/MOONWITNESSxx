# Contributing to MOONWITNESS

This repository is the canonical MOONWITNESS monorepo. RIOTWORKS is a product division inside the ecosystem, so the `@riotworks/*` package scope remains valid; do not rename packages merely to make them match the repository name.

## Before changing code

1. Read [README.md](./README.md), [MASTER-PROMPT](./MASTER-PROMPT), and [docs/23](./docs/23-repository-audit-and-current-execution-plan.md).
2. Read [docs/24 — Repository and Automation Governance](./docs/24-repository-and-automation-governance.md).
3. Identify the single owning app or package. Do not create a second owner for an existing capability.
4. Check open issues and pull requests before starting duplicate work.
5. Preserve unrelated local changes. Never force-push or rewrite shared history.

## Workspace boundaries

- `apps/headquarter`: human-facing web application.
- `apps/arsy`: backend HTTP application and orchestration API.
- `packages/*`: reusable libraries, contracts, adapters, and addons.
- `services/*`: legacy prototypes, intentionally excluded from the pnpm workspace. Do not import them into runtime code or add them to workspace globs without an explicit architecture decision.

Keep backend packages independent from UI packages. Keep queue transport, database providers, schema reconciliation, and domain ownership separate.

## Toolchain

- Node.js 22 or newer; CI currently uses Node.js 24.
- pnpm 12.16.1, pinned in the root `package.json`.
- Use the committed pnpm lockfile as the dependency source of truth.

pnpm 12 uses a two-document lockfile: the first boot document records the package-manager/config dependency state, while the last document contains the real workspace dependency graph. Both are intentional. When a manifest changes, refresh and review the project lockfile:

```bash
pnpm run lockfile:refresh
git diff -- pnpm-lock.yaml
pnpm install --frozen-lockfile
```

Do not use `--no-frozen-lockfile` as a routine CI or deployment workaround. The **Refresh pnpm lockfile** workflow runs after manifest/workspace changes on `main` and can also be triggered manually. After a regenerated lockfile passes a frozen install, it pushes a lockfile-only bot commit without force-pushing and dispatches CI for the new commit.

## Local Git hooks

After `pnpm install`, the root `prepare` script configures `core.hooksPath=.husky` for the local checkout. It does not run in CI. A pre-existing custom `core.hooksPath` is preserved rather than overwritten.

## Common commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start all packages with a dev task |
| `pnpm dev:headquarter` | Start Headquarter only |
| `pnpm dev:arsy` | Start ARSY only |
| `pnpm check:repo` | Run the read-only workspace/governance audit |
| `pnpm audit:repo` | Write an audit report to ignored `.artifacts/` |
| `pnpm format` | Format modified, staged, and untracked supported files |
| `pnpm format:check` | Verify formatting for changed files only |
| `pnpm test` | Run Node's built-in automation tests |
| `pnpm lockfile:check` | Detect lockfile drift without overwriting pre-existing local edits |
| `pnpm validate:repo` | Run repository integrity, format, and automation tests |
| `pnpm validate` | Run repository validation, package type-checks, and builds |

A command is only a reliable quality gate when the affected package actually defines that capability. Do not add placeholder scripts that return success without checking anything. Formatting is intentionally changed-files-only: the current legacy prototype tree has not received a mass-formatting rewrite. The pnpm lockfile is excluded because pnpm owns its serialization.

## Branches, commits, and pull requests

Use short-lived branches with one of these prefixes:

- `feat-*` for a new capability.
- `fix-*` for a defect.
- `chore-*` for tooling, documentation, refactoring, and maintenance.

The current default integration target is `main`. Do not assume a `dev` branch exists; if a protected `dev` branch is introduced later, update this policy and CI targets together.

Use Conventional Commit subjects, for example:

```text
feat(arsy): add readiness endpoint
fix(headquarter): correct locale redirect
chore(ci): pin workflow toolchain
```

Keep the subject at or below 72 characters. Git hooks validate formatting for staged text/config files and commit subject syntax. Hooks must stay local, fast, deterministic, and offline.

Every pull request must explain:
- the user or system problem being solved;
- the owning app/package and boundaries affected;
- tests and validation actually run;
- data, security, migration, rollback, and deployment risks;
- linked issue or an explicit reason no issue is required.

Prefer small, reviewable pull requests. Do not bundle unrelated architecture changes.

## Releases and changelog

Commits must never bump versions or rewrite `CHANGELOG.md`. Release notes and version changes happen only in an explicit release process after package ownership, compatibility, and release artifacts are defined. Until then, keep versions stable and record implementation status in the relevant docs/issues.

## Documentation and automation

- `docs/` is the source of truth.
- A GitHub Wiki is an optional published mirror, not a second source of truth. Only sync it through an explicit, verified publish action.
- GitHub Pages or Vercel publication must have a real deployment target and successful deployment evidence. Local sitemap/index generation is not publication.
- Repository audits are read-only. They must not create repetitive issues, alter versions, or mutate application data.
- GitHub Actions must use least-privilege `GITHUB_TOKEN` permissions. Never put personal tokens or API secrets in committed files.
- Local AI commit assistance is optional and must never be part of pre-commit or CI.

See [docs/24](./docs/24-repository-and-automation-governance.md) for the complete automation ownership and escalation rules.
