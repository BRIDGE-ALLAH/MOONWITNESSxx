# MOONWITNESS Governance — Execution TODO

**Repository:** `BRIDGE-ALLAH/MOONWITNESS`  
**Baseline:** `main@9164e43a078c6fdcd36b6486aef9ebdcbaa8d0e4`  
**Branch:** `chore/governance-phase-0-1`  
**Approach:** programmatic checks + Markdown contracts; no parallel schema framework.

> Checkboxes are evidence-driven. Code committed without a clean-checkout CI run is implemented but not verified.

## Delivery rules

- GitHub Issues remain the official backlog; this file is the ordered phase ledger.
- Every task has an owner, dependency, output, acceptance criteria, and evidence.
- Preserve user data and unrelated work. No force-push, hidden mutation, or production operation.
- Use feature branch + reviewable PR; merge only after CI and review.
- Record PASS, FAIL, NOT RUN, or BLOCKED; file existence alone is not proof.

## Phase 0 — Stabilize repository foundation

**Goal:** identity, toolchain, root commands, lockfile, and CI are deterministic. **Owner:** maintainers. **Exit:** clean checkout audit, frozen install, format, tests, CI pass.

### P0.1 Identity/toolchain

- [x] Root package identity `moonwitness`; preserve `@riotworks/*`.
- [x] Node engine aligned to Node 22+.
- [x] pnpm engine aligned to pinned `12.16.1`.
- [x] Replace workspace build allowlist placeholders with explicit booleans.
- [x] Verify clean install with pinned pnpm 12.16.1. **Evidence:** Repository CI run `42395045245` — frozen lockfile and install pass.

### P0.2 Root command contract

- [x] Real Prettier `format` and `format:check`; remove recursion.
- [x] Add Node built-in `test` and canonical `type-check`.
- [x] Preserve `typecheck` compatibility alias.
- [x] Fix `validate:repo` and root command composition.
- [x] Remove shell backgrounding from aggregate scripts.
- [x] Invoke lockfile checker through `pnpm exec`.
- [ ] Execute root commands and verify failing fixtures propagate non-zero exit. **Evidence:** output + exit codes.

### P0.3 Lockfile

- [x] Check mode is frozen/read-only and cannot rewrite lockfile.
- [x] Refresh is explicit and refuses pre-existing lockfile edits.
- [x] Refresh lockfile for all workspace manifests, including `apps/arsy` `pg` dependency (generated with pinned pnpm 12.16.1; bot commit `c450ee5`).
- [x] Verify importer parity, lockfile check, and frozen install. **Evidence:** Repository CI run `42395045245`.

### P0.4 CI/local

- [x] Match push filters to slash branches: `feat/**`, `fix/**`, `chore/**`, `docs/**`, `refactor/**`.
- [x] Keep audit, lockfile check, frozen install, validation observable.
- [x] Verify CI triggers on `chore/governance-phase-0-1` (push run observed).
- [ ] Verify repository integrity job reaches all steps and passes.
- [ ] Verify CodeQL/Dependabot remain healthy.
- [ ] Administrator applies main ruleset/required checks. **Evidence:** ruleset readback + test PR.

### P0.5 Acceptance

- [x] `pnpm run check:repo`, `pnpm run format:check`, `pnpm test` pass in Repository CI run `42395045245`.
- [x] `pnpm install --frozen-lockfile` passes from clean checkout in Repository CI run `42395045245`.
- [ ] Full workspace type-check/build only after package scripts/entrypoints are real.
- [ ] Review diff, secrets, changed-file scope; record CI SHA/URL.

**Status:** audit passes. Lockfile was regenerated with pinned pnpm 12.16.1 and committed by the one-time branch-scoped action; CI frozen-check/install validation and administrator rules remain open.

## Phase 1 — Governance authority and rule contracts

**Goal:** one authority; every hard rule has an owner and enforcement path. **Dependencies:** Phase 0 identity/commands. **Exit:** owner-reviewed contracts and rule-to-enforcement map.

### P1.1 Authority

- [x] Create canonical `governance/README.md`.
- [x] Define precedence: safety → governance/contracts → architecture docs → agent rules → mission prompts → contributor guide → enforcement.
- [x] Keep this file as phase ledger, not second issue tracker.
- [x] Reconcile `AGENTS.md`, `GOAL.txt`, `MASTER-PROMPT`, and Copilot instructions; Codex plugin-specific instructions still require review.

### P1.2 Contract catalogue

- [x] Define Owner, Scope, Rules, Allowed, Forbidden, Enforcement, Acceptance evidence, Exceptions.
- [x] Add Identity, Repository/Architecture, GitHub, Automation, Installation, Security contracts.
- [x] Add Architecture, API, and Data contracts against docs/08, docs/09, docs/13, docs/18, and docs/21.
- [ ] Review contracts with owning app/package maintainers.

### P1.3 Rule ownership/exceptions

- [x] Define one owner per contract and rule hierarchy.
- [x] Define exception approver, reason, scope, expiry, compensating control.
- [x] Define advisory/local/CI/repository/operational enforcement levels.
- [ ] Map every MUST/MUST NOT rule to a test, workflow, GitHub setting, or manual approval.
- [ ] Create decision records for unresolved architecture, automation, and deployment conflicts.

### P1.4 Documentation reconciliation

- [x] Align `AGENTS.md`, `GOAL.txt`, `MASTER-PROMPT`, and Copilot instructions with hierarchy; Codex plugin-specific instructions still require review.
- [ ] Remove stale duplicated governance claims without deleting historical architecture decisions.
- [x] Link docs/24 to the canonical index and align CONTRIBUTING branch names with slash convention.
- [ ] Verify links, command names, package names, and workflow triggers.

### P1.5 Acceptance

- [ ] Review contracts with owners.
- [ ] Confirm every hard rule has one source + enforcement route.
- [ ] Verify no schema/manifest duplication.
- [ ] Run audit, format, and automation tests; record exceptions and owners.

**Status:** authority and six contract families (identity, repository, GitHub, automation, installation, security) plus architecture/API/data contracts are drafted; agent instructions and Codex automation plugin are reconciled. Enforcement mapping, owner review, and final acceptance remain open. CI audit passes; lockfile gate still fails due stale workspace importers and `pg`.

## Phase 2 — Programmatic Governance Engine

**Goal:** deterministic objective enforcement, not a generic schema platform. **Dependencies:** Phase 0 + Phase 1.

- [ ] Choose canonical tooling owner; avoid second root toolchain.
- [ ] Implement `governance check`, `doctor`, `report`.
- [ ] Check identity, manifests, unique names, entrypoints, workspace topology.
- [ ] Validate dependency graph (no app-to-app, package-to-app, backend-to-UI edges).
- [ ] Check ownership/public entrypoints and agent instruction precedence.
- [ ] Check workflow permissions, triggers, concurrency, action pinning.
- [ ] Generate contract-to-enforcement coverage report.
- [ ] Add positive/negative fixtures and actionable deterministic output.
- [ ] Gate critical invariants in CI; warnings stay advisory until approved.
- [ ] Document CLI output and exit codes.

**Acceptance:** offline CLI, tests for pass/fail fixtures, no mutation during check/report.

## Phase 3 — GitHub governance and automation

- [ ] Protect `main`: PR required, required CI, conversation resolution, stale approval dismissal, no force-push/deletion.
- [ ] Set review policy for collaborator/access model.
- [ ] Require only stable status checks that actually run.
- [ ] Align PR/issue templates, labels, branch names.
- [ ] Add changed-package validation after dependency graph is proven.
- [ ] Review trigger, permission, secret, concurrency, artifact retention for every workflow.
- [ ] Add deduplication and bounded retries to state-writing automation.
- [ ] Keep scheduled detection read-only; reviewed issue creation only.
- [ ] Require approval for dependency refresh, releases, migrations, deployment.
- [ ] Test push, PR, manual, scheduled, cancel, failure paths.

**Acceptance:** main blocks invalid changes; scheduled jobs are idempotent; writes are least-privilege and reviewable.

## Phase 4 — Automatic developer installer

**Goal:** safe repeatable developer setup. **Deliverables:** `install.sh`, `install.ps1`, shared Node bootstrap.

- [ ] Define supported OS/architecture and prerequisites.
- [ ] Define minimal, Headquarter, ARSY, full-dev profiles.
- [ ] Detect OS, architecture, Node, pnpm, Git, profile-specific Docker/services.
- [ ] Implement `install`, `doctor`, `repair`, `update`, `verify`, `uninstall`.
- [ ] Frozen lockfile by default; refresh explicit.
- [ ] Copy `.env.example` only if `.env` absent; never overwrite secrets.
- [ ] Install hooks without AI credentials.
- [ ] Test shell quoting, executable bits, PowerShell, interrupted runs.
- [ ] Test idempotency (two installs, no unintended diff).
- [ ] Secret-safe diagnostics and actionable remediation.
- [ ] Define rollback and generated-file ownership.
- [ ] Add Linux/macOS/Windows CI smoke tests; document offline/proxy/integrity behavior.

**Acceptance:** idempotent install, read-only doctor, scoped repair, accurate verify, user files/secrets preserved.

## Phase 5 — Runtime and deployment lifecycle

- [ ] Define dev/test/staging/production profiles.
- [ ] Define service readiness and health endpoints.
- [ ] Define database connectivity and backup verification.
- [ ] Define migration plan, explicit approval, locking, rollback/forward-fix.
- [ ] Prevent installer from running production migrations/deletion automatically.
- [ ] Define graceful startup/shutdown and deployment pre/postflight.
- [ ] Add recovery runbooks and test DB outage, partial startup, migration failure, interrupted deploy, rollback.

**Acceptance:** observable lifecycle, approved migrations, tested recovery.

## Phase 6 — Continuous governance and safe remediation

- [ ] Schedule read-only compliance reports with bounded retention.
- [ ] Detect lockfile, ownership, dependency-boundary, workflow-permission, and docs drift.
- [ ] Deduplicate by rule ID + path + normalized evidence.
- [ ] Track severity, owner, first/last seen, age without issue spam.
- [ ] Propose safe mechanical fixes as reviewable PRs.
- [ ] Require human approval for architecture/data/security/major deps/deployment.
- [ ] Publish health trends, thresholds, suppression expiry, escalation owner.

**Acceptance:** idempotent scans, reproducible reports, reviewable remediation, no auto-merge of high-risk changes.

## Definition of done for every phase

1. Deliverables in canonical owner path; 2. owner review; 3. positive/negative tests; 4. clean-checkout commands; 5. CI evidence; 6. consistent docs/agent guidance; 7. owned exceptions/blockers; 8. no unrelated changes/secrets.
