# MOONWITNESS Governance — Execution TODO

**Repository:** `BRIDGE-ALLAH/MOONWITNESS`  
**Baseline:** `main@efb80d91cac0d0eeab52f2d2edd0b049c476fadb`  
**Branch:** `chore/governance-phase-0-1-final`  
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
- [x] Verify clean install with pinned pnpm 12.16.1. **Evidence:** [Repository CI run `42397034583`](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42397034583) — frozen lockfile and install pass on the rebased PR head.

### P0.2 Root command contract

- [x] Real Prettier `format` and `format:check`; remove recursion.
- [x] Add Node built-in `test` and canonical `type-check`.
- [x] Preserve `typecheck` compatibility alias.
- [x] Fix `validate:repo` and root command composition.
- [x] Remove shell backgrounding from aggregate scripts.
- [x] Invoke lockfile checker through `pnpm exec`.
- [x] Expose real `check:commit` and `check:staged` commands; align Codex plugin references.
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
- [x] Verify repository integrity job reaches all steps and passes. **Evidence:** [run `42397034583`](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42397034583).
- [x] Verify CodeQL succeeds on the branch (`42395737398`).
- [ ] Verify Dependabot alerts/update automation remain enabled and healthy.
- [ ] Administrator applies main ruleset/required checks. **Evidence:** ruleset readback + test PR.

### P0.5 Acceptance

- [x] `pnpm run check:repo`, `pnpm run format:check`, `pnpm test` pass in Repository CI run `42395045245`.
- [x] `pnpm install --frozen-lockfile` passes from clean checkout in Repository CI run `42395045245`.
- [x] Asset integrity: asset package, shared UI, Headquarter type-check, production build, SVG validation, and asset registry tests pass on [run `42397034583`](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42397034583). The previously missing ARSY Deck fixture modules are now present in current `main` and retained in the rebased PR.
- [ ] Full workspace type-check/build: **NOT RUN** because repository variable `FULL_QUALITY_CI` is not enabled; the dedicated Asset integrity gate did pass.
- [x] Review changed-file scope and CI evidence; current PR head: `4f41b8d77a6da739146ebdc4cf1eb90619d69e63`.

**Latest verified status (2026-11-07):** The clean rebased PR is [#37](https://github.com/BRIDGE-ALLAH/MOONWITNESS/pull/37), based directly on current `main` at `efb80d91cac0d0eeab52f2d2edd0b049c476fadb`. On PR head `4f41b8d77a6da739146ebdc4cf1eb90619d69e63`, Repository integrity and Asset integrity both pass in [run `42397034583`](https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42397034583): audit, frozen lockfile, install, formatting, tests, asset/UI/Headquarter type-check, Headquarter production build, SVG validation, and asset registry tests. The Full workspace quality job is skipped because `FULL_QUALITY_CI` is not enabled. CodeQL passed on the preceding rebased head; the current-head CodeQL run is pending.

**Remaining Phase 0 gates:** negative-exit fixture coverage for every root command; Dependabot health verification; administrator-managed `main` ruleset and required-check readback; optional full-workspace quality run. Branch protection API readback is unavailable to the current GitHub integration.

## Phase 1 — Governance authority and rule contracts

**Goal:** one authority; every hard rule has an owner and enforcement path. **Dependencies:** Phase 0 identity/commands. **Exit:** owner-reviewed contracts and rule-to-enforcement map.

### P1.1 Authority

- [x] Create canonical `governance/README.md`.
- [x] Define precedence: safety → governance/contracts → architecture docs → agent rules → mission prompts → contributor guide → enforcement.
- [x] Keep this file as phase ledger, not second issue tracker.
- [x] Reconcile `AGENTS.md`, `GOAL.txt`, `MASTER-PROMPT`, Copilot instructions, and Codex automation plugin README/manifest.

### P1.2 Contract catalogue

- [x] Define Owner, Scope, Rules, Allowed, Forbidden, Enforcement, Acceptance evidence, Exceptions.
- [x] Add separate Identity, Repository, Architecture, API, Data, GitHub, Automation, Installation, and Security contract files.
- [x] Add Architecture, API, and Data contracts against docs/08, docs/09, docs/13, docs/18, and docs/21.
- [ ] Review contracts with owning app/package maintainers.

### P1.3 Rule ownership/exceptions

- [x] Define one owner per contract and rule hierarchy.
- [x] Define exception approver, reason, scope, expiry, compensating control.
- [x] Define advisory/local/CI/repository/operational enforcement levels.
- [x] Map every normative contract rule to an enforcement route and honest maturity state in [enforcement.md](./enforcement.md); distinguish active, partial, human-review, administrator-pending, and planned controls.
- [ ] Create decision records for unresolved architecture, automation, and deployment conflicts.

### P1.4 Documentation reconciliation

- [x] Align `AGENTS.md`, `GOAL.txt`, `MASTER-PROMPT`, Copilot instructions, and Codex automation plugin with hierarchy.
- [ ] Remove stale duplicated governance claims without deleting historical architecture decisions.
- [x] Link docs/24 to the canonical index and align CONTRIBUTING branch names with slash convention.
- [ ] Verify links, command names, package names, and workflow triggers.

### P1.5 Acceptance

- [ ] Review contracts with owners.
- [x] Confirm every hard rule has one canonical contract source + a rule-level enforcement route in [enforcement.md](./enforcement.md).
- [ ] Verify no schema/manifest duplication.
- [ ] Run audit, format, and automation tests; record exceptions and owners.

**Status:** canonical index, nine separate contracts, detailed rule-ID enforcement register, agent/Codex instruction reconciliation, and initial CI checks are implemented. Owner review, rule-by-rule enforcement mapping, decision records, and final acceptance remain open. Repository integrity passes; the separate Headquarter Asset integrity job remains blocked by missing local modules.

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
