# Ultra Plan — Recovery and Execution

## Phase 0: Repository State Reconciliation

- [ ] P0: Restore README.md with original RIOTWORKS content (UR-F001 from review). AC: README contains original "MOONWITNESS // RIOTWORKS" branding, product thesis, business engines, differentiation, apps and packages info, product modules, repository documentation, financial truth, documentation status, and "NO EMPTY NOISE. MAKE SOMETHING REAL." footer. 
- [ ] P1: Remove `@riotworks/ui` from `apps/arsy/package.json` dependencies (UR-F002 from review). AC: `apps/arsy/package.json` no longer lists `@riotworks/ui` in dependencies; lockfile confirmed consistent.
- [ ] P2: Regenerate/repair prior `.plan/20261107-1900-plan-repository-maintenance` artifacts with contract-compliant `task.md` naming (UR-F003 from review). AC: Prior plan folder contains `task.md` (not `plan.md`), all five required files present, contract compliance verified.
- [ ] P3: Run root validation commands to verify P0/P1 fixes do not break build (optional deferred). AC: `pnpm install --frozen-lockfile` succeeds or fails with clear evidence; `pnpm run validate:repo` reports state.

## Phase 1: Immediate WIP Resolution

### Task T001 — Restore README.md
**Files affected:** `README.md`
**Dependencies:** None
**Acceptance Criteria:** README.md contains original RIOTWORKS content with all sections: product thesis, business engines, applications and packages (target vs current), existing package inventory, planned core packages, product modules, repository documentation, financial truth, documentation status, and "NO EMPTY NOISE. MAKE SOMETHING REAL. MOONWITNESS // RIOTWORKS" footer.
**Evidence:** git show HEAD:README.md used as reference; restored content must match original exactly or be verified diff.

### Task T002 — Remove @riotworks/ui from ARSY dependencies
**Files affected:** `apps/arsy/package.json`
**Dependencies:** T001 (README restore does not block this)
**Acceptance Criteria:** `apps/arsy/package.json` no longer lists `@riotworks/ui` in the `dependencies` object. Lockfile may need refresh after commit.
**Evidence:** `git diff apps/arsy/package.json` shows removal; `pnpm lockfile:check` or `pnpm install --frozen-lockfile` result.

### Task T003 — Repair prior plan artifacts
**Files affected:** `.plan/20261107-1900-plan-repository-maintenance/` 
**Dependencies:** T001, T002 (parallel OK)
**Acceptance Criteria:** Folder contains `task.md` (not `plan.md`), and all five required files: `task.md`, `rule.md`, `spec.md`, `design.md`, `report.md`. `task.md` follows contract: `- [ ]` items, atomic (≤3 files), imperative, exact file paths, acceptance criteria, dependencies, size tag.
**Evidence:** File listing; `task.md` content inspection against contract.

## Phase 2: Execution Order & Dependencies

**Order:** T001 → T002 → T003 (T003 can run in parallel after T001 starts, but T002 and T003 should complete before plan handoff)

**Blockers:** None for T001 and T002. T003 requires the prior plan folder to exist (it does).

## Phase 3: Verification Sweep

After all tasks complete:
1. Run `git status --short` — verify only expected files modified
2. Run `git diff --stat` — verify changes are T001, T002, T003 scoped
3. Review `report.md` has evidence for each task
4. Set plan status to COMPLETE

## Phase 4: Final Report

Populate `report.md`:
- Task completion checklist with [x]/[ ] for T001, T002, T003
- Summary of what was actually restored/changed
- Deviations from original plan (if any)
- Verification evidence (commands, exit codes, outputs)
- Remaining risks (e.g., full build/type/check still needs clean tree)
- Follow-up: run `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm type-check` on clean tree
- Sign-off
