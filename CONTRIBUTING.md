# Contributing to MOONWITNESS

This repository is the canonical MOONWITNESS monorepo. RIOTWORKS is a product division inside the ecosystem, so the `@riotworks/*` package scope remains valid; do not rename packages merely to make them match the repository name.

## Before changing code

1. Read [README.md](./README.md) and [docs/23](./docs/23-repository-audit-and-current-execution-plan.md).
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

The current repository audit has identified missing workspace importer entries in `pnpm-lock.yaml`. Before relying on a frozen install, refresh and review the lockfile:

```bash
pnpm run lockfile:refresh
git diff -- pnpm-lock.yaml
pnpm install --frozen-lockfile
```

Do not use `--no-frozen-lockfile` as a routine CI or deployment workaround. The manual GitHub Action **Refresh pnpm lockfile** can also create a reviewable pull request.

## Common commands

| Command                | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `pnpm dev`             | Start all packages with a dev task                                 |
| `pnpm dev:headquarter` | Start Headquarter only                                             |
| `pnpm dev:arsy`        | Start ARSY only                                                    |
| `pnpm check:repo`      | Run the read-only workspace/governance audit                       |
| `pnpm audit:repo`      | Write an audit report to ignored `.artifacts/`                     |
| `pnpm format`          | Format supported repository files                                  |
| `pnpm format:check`    | Verify repository formatting                                       |
| `pnpm test`            | Run Node's built-in automation tests                               |
| `pnpm lockfile:check`  | Detect lockfile drift without overwriting pre-existing local edits |
| `pnpm validate:repo`   | Run repository integrity, format, and automation tests             |
| `pnpm validate`        | Run repository validation, package type-checks, and builds         |

A command is only a reliable quality gate when the affected package actually defines that capability. Do not add placeholder scripts that return success without checking anything.

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

## Developer experience commands

```bash
pnpm devx doctor --json
pnpm devx plan --base=main --json
pnpm devx context --json
pnpm devx collision --plan-file=.moonwitness/agents.json
pnpm devx record --input=.moonwitness/task-result.json
pnpm devx flight verify
pnpm devx context-lease
pnpm devx context-verify --lease=.moonwitness/context-lease.json
```

Phase 24–26 commands are local-first. Flight records are hash-chained local evidence, not signed attestations. Collision forecasts only inspect declared write paths and cannot prove runtime isolation. Context leases detect fingerprint drift/expiry but are not authorization credentials. See [docs/27](./docs/27-dx-frontier-phases-24-26.md) for design, limitations and research.
