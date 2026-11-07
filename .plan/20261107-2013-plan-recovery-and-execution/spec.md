## Plan Rules (apply during execution)

1. **Preserve unrelated WIP.** Do not revert staged/unstaged changes outside the active task (README content restoration, apps/arsy/package.json removal, prior plan repair) unless the task explicitly requires reconciliation.
2. **Restore truth over templates.** README.md must be restored with original RIOTWORKS content — do not replace with generic Codex framework text.
3. **One canonical owner per capability.** `apps/arsy` is the ARSY app; `@riotworks/ui` must not be in its dependencies per AUD-003.
4. **Entrypoints must exist.** Every `main`/`exports`/script target in a package manifest must point to a real file or a deterministic command that works in the workspace.
5. **No fake green.** Do not use `|| true`, `echo *-skip` as default CI/repo gates unless explicitly marked optional and reported separately.
6. **Evidence before completion.** Record command, exit status, and key output in `report.md`. Label NOT RUN when not executed.
7. **Safety.** No push/deploy/production writes, no branch protection bypass, no destructive git operations. Do not touch unrelated user files.
8. **.plan contract.** Keep `task.md` executable and atomic; update `report.md` with deviations and evidence.

## Technical Specification

### FR-001: README Restoration
- Restore `README.md` with original RIOTWORKS content
- Must include: product thesis, business engines table, applications and packages (target vs current), existing package inventory, planned core packages, product modules, repository documentation, financial truth, documentation status, "NO EMPTY NOISE. MAKE SOMETHING REAL. MOONWITNESS // RIOTWORKS" footer
- Path: `README.md` (repo root)

### FR-002: ARSY UI Dependency Removal
- Remove `@riotworks/ui` from `apps/arsy/package.json` dependencies
- Path: `apps/arsy/package.json`
- Must sync with lockfile after commit

### FR-003: Prior Plan Artifact Repair
- Regenerate `.plan/20261107-1900-plan-repository-maintenance/` with contract-compliant `task.md`
- All five required files must exist: `task.md`, `rule.md`, `spec.md`, `design.md`, `report.md`
- `task.md` must follow global contract: `- [ ]` items, atomic (≤3 files), imperative, exact file paths, acceptance criteria, dependencies, size tag (S/M/L/XL)

### NFR-001: Performance
- Task execution must not introduce runtime dependencies or build steps beyond pnpm workspace operations.

### NFR-002: Maintainability
- All changes must follow existing conventions (Conventional Commits, workspace-relative paths, no cross-layer imports).
