# MOONWITNESS Governance

**Canonical index** for repository policy, rule ownership, architecture boundaries, GitHub controls, automation, installation, and operational lifecycle.

## Authority and precedence

1. Approved security and safety constraints.
2. This index and the applicable contract under `contracts/`.
3. Canonical product and technical architecture decisions in `docs/`.
4. Root/nested `AGENTS.md`: concise execution guidance derived from higher-level contracts.
5. `GOAL.txt`, `MASTER-PROMPT`, Copilot/Codex instructions: mission and task routing only; they cannot override contracts.
6. `CONTRIBUTING.md`: contributor workflow and examples.
7. Hooks, GitHub Actions, and governance CLI: executable enforcement, not policy authorship.

Same-level conflicts require an explicit decision and owner. Never silently select one conflicting document.

## Single sources of truth

- Repository identity: `BRIDGE-ALLAH/MOONWITNESS`; root package: `moonwitness`; division: RIOTWORKS; internal package namespace: `@riotworks/*`.
- `governance/` owns governance policy/contracts; `docs/` owns product and technical architecture.
- GitHub Issues are the official backlog; PRs are the review/integration record. [todo.md](./todo.md) is the execution ledger, not a second issue tracker.
- Code is implementation truth. Architecture docs express intended design until code/tests prove implementation.
- Generated reports are evidence, not policy or proof of deployment.

## Contract catalogue

Use [the contract standard](./contracts/README.md) for required fields and change control.

| Contract     | Canonical file                                 | Scope                                                                |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| Identity     | [identity.md](./contracts/identity.md)         | Repository, product, division, package naming                        |
| Repository   | [repository.md](./contracts/repository.md)     | Workspace topology, commands, ownership, dependency direction        |
| Architecture | [architecture.md](./contracts/architecture.md) | Headquarter, ARSY, ORM, addons, provider boundaries                  |
| API          | [api.md](./contracts/api.md)                   | Typed Headquarter↔ARSY contracts and private control-plane APIs      |
| Data         | [data.md](./contracts/data.md)                 | BaseEntity, AuditTrail, provider portability, money/time, provenance |
| GitHub       | [github.md](./contracts/github.md)             | Branches, PRs, Actions, rulesets, review lifecycle                   |
| Automation   | [automation.md](./contracts/automation.md)     | Triggers, owners, permissions, idempotency, side effects             |
| Installation | [installation.md](./contracts/installation.md) | Installer/bootstrap, repair, update, uninstall, safety               |
| Security     | [security.md](./contracts/security.md)         | Secrets, supply chain, CI permissions, risky operations              |

## Rule-to-enforcement map

| Rule family                                           | Current enforcement                                     | State                                             |
| ----------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Root identity and required commands                   | `scripts/repo-audit.mjs` + CI audit                     | Implemented                                       |
| Workspace package manifests and names                 | `scripts/repo-audit.mjs`                                | Implemented                                       |
| Lockfile/dependency reproducibility                   | `scripts/check-lockfile.mjs` + frozen CI install        | Implemented                                       |
| App/package dependency direction                      | Governance Engine dependency/import checks              | CI active; owner review pending                   |
| API compatibility and internal endpoint authorization | Contract tests and API boundary checks                  | Planned Phase 2/3                                 |
| GitHub workflow permissions and branch rules          | Governance Engine workflow scan + administrator ruleset | Partial; ruleset requires administrator           |
| Scheduled detection idempotency                       | Weekly detection workflow + read-only permissions       | Existing; deeper tests Phase 3                    |
| Installer safety/idempotency                          | Node + shell/PowerShell tests                           | Phase 4 implemented; full rerun test open         |
| Production migration/deployment approval              | Human approval + runtime gates                          | Phase 5 local-dev gates; production controls open |

See the [detailed rule-to-enforcement register](./enforcement.md) for individual rule IDs, enforcement routes, and honest maturity states. The [Governance Engine](./engine.md) provides offline `check`, `doctor`, and `report` commands. A rule marked planned is not yet enforced. Do not describe a future check as active until its test and CI evidence exist.

## Enforcement levels

| Level       | Meaning                   | Example                                 |
| ----------- | ------------------------- | --------------------------------------- |
| Advisory    | Guidance, non-blocking    | Early design recommendation             |
| Local       | Fast offline guard        | Formatting, commit subject              |
| CI          | Reproducible push/PR gate | Identity, workspace, lockfile, tests    |
| Repository  | GitHub server-side        | Protected main, required checks         |
| Operational | Runtime/deployment        | Readiness, migration approval, rollback |

A local hook is not branch protection. Green CI is not production readiness. A missing or unavailable required check is not a pass.

## Change and exception lifecycle

Identify owner → link issue → state acceptance/security/recovery → implement and test → local checks → CI clean checkout → review/verify target branch. Exceptions record approver, scope, reason, expiry/review date, and compensating control.

Execution plan and acceptance ledger: [todo.md](./todo.md).
