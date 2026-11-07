# Plan Design

## Architecture Decision Records (applicable to this plan)

### ADR-001: README Restoration Priority
**Context:** Repository README has been replaced with generic Codex framework text, losing original RIOTWORKS documentation.
**Decision:** Restore original README.md content as P0 task. Original contains product thesis, business engines, differentiation, applications and packages info, product modules, repository documentation, financial truth, documentation status, and "NO EMPTY NOISE. MAKE SOMETHING REAL. MOONWITNESS // RIOTWORKS" footer.
**Consequences:** Repository documentation integrity restored; users/reviewers see correct project branding and scope.

### ADR-002: Backend-UI Separation
**Context:** `apps/arsy` depends on `@riotworks/ui` which violates architecture rule that backend must not depend on frontend UI.
**Decision:** Remove `@riotworks/ui` from `apps/arsy/package.json` dependencies. Lockfile diff shows this removal was already started but manifest not updated.
**Consequences:** ARSY backend no longer imports UI components; layer separation preserved (UI <- ARSY <- Core).

### ADR-003: Plan Artifact Contract Compliance
**Context:** Prior `.plan/20261107-1900-plan-repository-maintenance` uses `plan.md` instead of contract-mandated `task.md`.
**Decision:** Regenerate prior plan artifacts with correct `task.md` naming and all five required files. This new plan folder follows the global `.plan` contract.
**Consequences:** Plan/Executor can pick up this folder and execute tasks cold; no contract mismatch.

## Module Boundaries (for this plan)

### Task T001 (Restore README)
- **Files affected:** `README.md` (repo root)
- **Imports/exports:** None (standalone documentation file)
- **Dependencies:** None within scope of this task

### Task T002 (Remove UI dep)
- **Files affected:** `apps/arsy/package.json`
- **Imports/exports:** Must not import from `@riotworks/ui` after this change
- **Dependencies:** Must sync lockfile after commit

### Task T003 (Repair prior plan)
- **Files affected:** `.plan/20261107-1900-plan-repository-maintenance/`
- **Imports/exports:** None (local folder repair)
- **Dependencies:** T001, T002 do not block this, but contract compliance requires all prior plans to use `task.md`

## Trade-offs

1. **README restore speed vs. completeness:** Restoring full original README takes time but is necessary for P0 exit criteria. Alternative: restore minimal required sections first, add remainder later.
2. **@riotworks/ui removal timing:** Removing now syncs with lockfile change already in WIP. Delaying risks committing stale dependency.
3. **Prior plan repair scope:** Full regeneration ensures contract compliance. Partial update risks future Plan/Executor failures.

## Open Questions

1. Should the original README be restored via `git show HEAD:README.md` exact copy, or merged with any WIP changes that modified it?
2. After `@riotworks/ui` removal, should `pnpm lockfile:refresh` be run and the diff committed together with the manifest change?
3. Should `.plan/20261107-1900-plan-repository-maintenance` be archived (with evidence) or updated to contract compliance and kept active?
