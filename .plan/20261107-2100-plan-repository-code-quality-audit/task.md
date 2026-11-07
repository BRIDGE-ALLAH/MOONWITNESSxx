# Repository Code Quality Audit

## Phase 0: Initial Assessment and Tooling

- [ ] P0: Audit all package manifests and verify `@riotworks/*` workspace references resolve correctly (AUD-021)
- [ ] P0: Verify pre-commit hooks don't call network AI services or mutate versions (AUD-016, AUD-017)
- [ ] P0: Check `.husky/pre-commit` and `.husky/commit-msg` for Conventional Commit validation (AUD-008, AUD-009)
- [ ] P0: Validate weekly workflow YAML syntax and correct directory references (AUD-014)
- [ ] P0: Ensure root package.json scripts use deterministic Turbo task orchestration (AUD-024)

## Phase 1: Package Manifest Integrity

1. Verify every workspace package has valid `package.json` with real `main`, `exports`, and `scripts` fields
2. Confirm all `@riotworks/*` workspace references resolve correctly
3. Check lockfile importer entries match every workspace package manifest
4. Audit `@riotworks/headquarter` package - must correctly describe its runtime (Next.js, not Fastify) (AUD-001)
5. Verify `@riotworks/arsy-core` has real source entrypoint at `src/index.ts` (AUD-002)

## Phase 2: Dependency Graph Validation

1. Ensure `@riotworks/arsy` does NOT depend on `@riotworks/ui` (AUD-003)
2. Identify `services/arsy` as duplicate of `apps/arsy` and extract unique useful behavior (AUD-004)
3. Prevent `services/*` from being added to pnpm workspace globs (AUD-005)
4. Review all package main, exports, and scripts against actual tracked files (AUD-021)

## Phase 3: Code Quality and Documentation

1. Normalize docs BaseEntity statements and make docs/23 the canonical plan (AUD-017)
2. Finish Headquarter shell and ARSY core/contracts (Phases 1-2)
3. Implement ORM kernel and schema adapters (Phases 3-4)
4. Normalize documentation 08/15/18/19/21 BaseEntity statements
5. Make docs/23 the canonical plan

## Phase 4: Pre-commit and Commit Hygiene

1. Ensure pre-commit hooks are local, deterministic, and fast (no network calls, AI services, version bumps, or changelog mutations) (AUD-005)
2. Verify commit messages follow Conventional Commits format: `type(scope): imperative summary` max 72 characters (AUD-006)
3. Check that package scripts are deterministic and fail-fast
4. Confirm documentation is the source of truth - docs/ is canonical; GitHub Wiki is mirror only when published through verified workflow (AUD-009)
5. Ensure release versioning and changelog generation happen only at release time (AUD-010)

Exit: All AUD items verified; package manifests consistent; dependency graph correct; pre-commit hooks valid; commit messages valid; documentation canonical.
