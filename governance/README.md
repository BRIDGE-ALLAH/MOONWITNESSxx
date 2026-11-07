# MOONWITNESS Governance

**Canonical index** for repository engineering, architecture boundaries, contracts, GitHub controls, automation, installation, and operational lifecycle.

## Authority and precedence

1. Approved security and safety constraints.
2. This governance index and applicable rule contracts below.
3. Canonical product/technical architecture decisions in `docs/`.
4. Root/nested `AGENTS.md`: concise execution guidance derived from higher-level contracts.
5. `GOAL.txt`, `MASTER-PROMPT`, Copilot/Codex instructions: mission and task routing only; they cannot override contracts.
6. `CONTRIBUTING.md`: contributor workflow and examples.
7. Hooks, GitHub Actions, and governance CLI: executable enforcement, not policy authorship.

Same-level conflicts require an explicit decision and owner. Never silently select one conflicting document.

## Single sources of truth

- Repository: `BRIDGE-ALLAH/MOONWITNESS`; root package: `moonwitness`; division: RIOTWORKS; internal package namespace: `@riotworks/*`.
- `governance/` owns governance policy/contracts; `docs/` owns product and technical architecture.
- GitHub Issues are the official backlog; PRs are the review/integration record. [todo.md](./todo.md) is the execution ledger, not a second issue tracker.
- Code is implementation truth. Architecture docs express intended design until code/tests prove implementation.
- Generated reports are evidence, not policy or proof of deployment.

## Contract format

Every contract states **Owner**, **Scope**, **Rules**, **Allowed**, **Forbidden**, **Enforcement**, **Acceptance evidence**, and **Exceptions**. Use MUST/MUST NOT for hard invariants, SHOULD for defaults, MAY for optional behavior.

Contracts are Markdown with small programmatic checks where objective enforcement is possible. Do not add JSON/YAML schema layers or a second declarative framework merely to restate rules. Checks must be deterministic, testable, actionable, and read-only unless a separately named write command is explicitly approved.

## Rule contracts

### Identity

**Owner:** repository maintainers. **Scope:** root/workspace manifests, GitHub refs, environment examples.

- Canonical repository MUST be `BRIDGE-ALLAH/MOONWITNESS`; root package MUST be `moonwitness`.
- RIOTWORKS is a division, not repository identity. Internal packages MAY use `@riotworks/*`.
- Automation prefers GitHub Actions repository context; local tools may use explicit env configuration.
- Forbidden: using `riotworks` as root identity, building GitHub API paths from package scope, mass-renaming package namespace to match repository name.
- **Enforcement/evidence:** repository audit, unique workspace package names, `pnpm run check:repo`.
- **Exceptions:** maintainer approval, migration plan, scope, expiry.

### Repository and architecture boundaries

**Owner:** repository maintainers and owning app/package teams. **Scope:** workspace, manifests, dependency graph.

- `apps/headquarter` owns the human-facing app; `apps/arsy` owns backend HTTP/orchestration.
- `packages/*` owns reusable libraries/contracts/adapters; `services/*` remains excluded until duplicate ownership is reconciled.
- Packages MUST NOT import application implementation. Headquarter consumes ARSY through public API contracts. ARSY MUST NOT depend on UI packages.
- Root commands MUST be deterministic and propagate failure. Placeholder success scripts and shell backgrounding as orchestration are forbidden.
- **Enforcement/evidence:** repo audit, frozen lockfile, dependency graph checks, tests, clean install.
- **Exceptions:** both affected owners approve a scoped, tested exception with review date.

### GitHub governance

**Owner:** repository maintainers. **Scope:** branches, PRs, Actions, rulesets.

- `main` is canonical; short-lived branches SHOULD use `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`.
- PRs target `main` unless a documented integration branch is active/protected. PRs state problem, ownership, acceptance, validation, security/data impact, recovery.
- Required checks MUST match stable real check names. Actions use least privilege; read-only jobs use `contents: read`.
- Forbidden: force-push as routine, auto-merge of unreviewed architecture/security/data/dependency changes, assuming workflow existence means branch protection.
- **Enforcement/evidence:** CI, PR template, GitHub ruleset readback and test PR.
- **Exceptions:** administrator approval with scope, reason, compensating control, expiry.

### Automation

**Owner:** repository maintainers; each workflow has one operational owner. **Scope:** scripts, hooks, Actions, scheduled jobs.

- Every automation has one owner, trigger, responsibility, and side-effect boundary.
- Read-only is default. Writes require explicit intent, least privilege, idempotency, deduplication, observable result, and retry behavior.
- Scheduled detection reports findings; it MUST NOT flood Issues. Hooks stay local/offline and do not mutate versions, changelogs, production data, or architecture state.
- AI assistance is opt-in and never required by CI/hooks. Required checks fail closed.
- **Enforcement/evidence:** workflow permissions/concurrency, automation tests, repo audit, reviewed write path.
- **Exceptions:** owner + maintainer approval, scope, expiry, rollback.

### Installation and bootstrap

**Owner:** repository maintainers; runtime setup belongs to target app. **Scope:** future `install.sh`, `install.ps1`, Node bootstrap.

- Installer MUST be idempotent, version-aware, observable, and safe to rerun. Shell entrypoints delegate shared behavior to one Node implementation where practical.
- Detect OS/architecture, Node, pnpm, Git, and selected-profile services. Separate preflight, dependencies, env, hooks, validation, startup.
- Preserve existing `.env` and user files; copy template only if absent. Never print secrets or run unverified `curl | bash`.
- Provide `install`, `doctor`, `repair`, `update`, `verify`, `uninstall`. Production migrations/deletion/deployment require explicit approval and recovery plan.
- **Enforcement/evidence:** Node tests, shell/PowerShell smoke tests, two-run idempotency, secret-safe diagnostics.
- **Exceptions:** system owner approval + backup/recovery plan.

### Security

**Owner:** repository maintainers and runtime owners. **Scope:** dependencies, credentials, CI, artifacts, installer/deployment.

- Secrets live in approved stores or ignored env files; examples contain placeholders only.
- Workflows use least privilege and pinned toolchains. Dependencies are reviewable and lockfile-checked.
- Logs/artifacts redact credentials. Production destructive operations require approval, backup, recovery.
- **Enforcement/evidence:** CodeQL, Dependabot, secret scanning, workflow review, installer tests.
- **Exceptions:** maintainer approval, exposure statement, compensating controls, expiry.

## Rule-to-enforcement map

| Rule family                                  | Canonical rule          | Current enforcement                                              | State                                                           |
| -------------------------------------------- | ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Root identity and required commands          | Identity / Repository   | `scripts/repo-audit.mjs` + CI audit                              | Implemented; CI audit passes                                    |
| Workspace manifests and package names        | Repository              | `scripts/repo-audit.mjs`                                         | Implemented; dependency pre-index is order-independent          |
| Lockfile and dependency reproducibility      | Repository / Security   | `scripts/check-lockfile.mjs` + frozen CI install                 | Implemented; current lockfile is stale and gate correctly fails |
| App/package dependency direction             | Repository              | Governance Engine graph validation                               | Planned in Phase 2                                              |
| GitHub workflow permissions and branch rules | GitHub / Automation     | Workflow declarations + administrator ruleset                    | Partial; ruleset requires administrator                         |
| Read-only scheduled detection                | Automation              | `.github/workflows/weekly-detection.yml` + read-only permissions | Existing workflow; test idempotency in Phase 3                  |
| Installer safety/idempotency                 | Installation / Security | Node + shell/PowerShell tests                                    | Planned in Phase 4                                              |
| Production migration/deployment approval     | Installation / Security | Human approval and runtime gates                                 | Planned in Phase 5                                              |

A rule family marked planned is not yet enforced. Do not describe a future check as active until its test and CI evidence exist.

## Enforcement levels

| Level       | Meaning                   | Example                                 |
| ----------- | ------------------------- | --------------------------------------- |
| Advisory    | Guidance, non-blocking    | Early design recommendation             |
| Local       | Fast offline guard        | Formatting, commit subject              |
| CI          | Reproducible push/PR gate | Identity, workspace, lockfile, tests    |
| Repository  | GitHub server-side        | Protected main, required checks         |
| Operational | Runtime/deployment        | Readiness, migration approval, rollback |

A local hook is not branch protection. Green CI is not production readiness. A missing/unavailable required check is not a pass.

## Change and exception lifecycle

Identify owner → link issue → state acceptance/security/recovery → implement and test → local checks → CI clean checkout → review/verify target branch. Exceptions record approver, scope, reason, expiry/review date, and compensating control.

Execution plan and acceptance ledger: [todo.md](./todo.md).
