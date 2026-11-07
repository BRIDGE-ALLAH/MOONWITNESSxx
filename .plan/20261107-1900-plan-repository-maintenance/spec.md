# Repository Maintenance Specification

## Requirements (FR/NFR)

### FR-001: Repository Buildability
- `pnpm install --frozen-lockfile` must succeed from a clean checkout
- `pnpm build` must complete without errors
- `pnpm type-check` must pass for all packages
- `pnpm lint` must pass for all packages

### FR-002: Package Manifest Consistency
- Every workspace package must have a valid `package.json` with real `main`, `exports`, and `scripts` fields
- All `@riotworks/*` workspace references must resolve correctly
- Lockfile importer entries must match every workspace package manifest

### FR-003: Headquarter Manifest Correctness
- `@riotworks/headquarter` package must accurately describe its runtime (Next.js, not Fastify)
- Scripts must use Next.js commands (`next dev`, `next build`, `next start`)
- No Fastify CLI scripts in headquarter package

### FR-004: ARSY Core Implementation
- `@riotworks/arsy-core` must have a real source entrypoint at `src/index.ts`
- Must export a Fastify plugin/lifecycle factory
- Must not import UI packages unnecessarily

### FR-005: ARSY Backend Dependency Graph
- `@riotworks/arsy` must NOT depend on `@riotworks/ui`
- Remove `@riotworks/ui` from arsy's dependencies
- ARSY should only depend on arsy-core and production dependencies

### FR-006: Duplicate Service Retirement
- `services/arsy` must be identified as duplicate of `apps/arsy`
- Unique useful behavior extracted and migrated to apps/arsy
- services/arsy should be archived/removed after verification

### FR-007: Root Workspace Scripts
- Root `package.json` scripts must use deterministic Turbo task orchestration
- No uncontrolled shell backgrounding (`&`) in root scripts
- All scripts must propagate failures correctly

### FR-008: Pre-commit Hook Integrity
- `.husky/pre-commit` must not call network AI services
- Must not mutate package versions or changelogs
- Must exit non-zero when checks fail

### FR-009: Commit Message Validation
- `.husky/commit-msg` must validate Conventional Commit subjects
- Subject format: `type(scope): imperative summary`
- Maximum 72 characters
- Must accept: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

### FR-010: Weekly Workflow Validation
- `.github/workflows/weekly-detection.yml` must have valid YAML syntax
- Must reference correct working directory (repository root)
- Must not use `npm cache` for pnpm workflows
- Must generate report before publishing

### FR-011: Auto-Detection Repository Awareness
- `scripts/auto-detect.js` must be repository-aware (not hardcode REPO='RIOTWORKS')
- Must deduplicate findings (never create issue spam)
- Must pass syntax and fixture tests before execution

### NFR-001: Performance
- Pre-commit hooks must complete in under 30 seconds
- Root scripts must be fast and deterministic
- CI jobs must complete within reasonable timeouts

### NFR-002: Maintainability
- All new scripts and configs must follow existing patterns
- Documentation must be updated when behavior changes
- No duplicate implementations without explicit architecture decision

## Data Contracts

### Package Version Policy
- Root `packageManager: pnpm@12.16.1` is pinned and authoritative
- Node.js version: >=20 locally, Node.js 24 in CI
- Package versions follow semver, no unconstrained ranges in lockfile

### Script Contract
- All `scripts/*.mjs` files must export functions or be executable
- No script may silently swallow errors with `|| true` at the CI gate level
- Scripts must work without network access or external credentials

### CI Contract
- Repository integrity CI must run on every push and PR
- CodeQL and Dependabot must run and report results
- Full workspace quality CI is gated by `FULL_QUALITY_CI=true` env var
- Must not disable failing checks to make badges green

## API Contracts

### Headquarter API Client
- Headquarter (Next.js) must call ARSY through typed contracts
- Must not import backend implementation source from ARSY
- API clients must be generated from ARSY contract schemas

### ARSY Contract Wire Types
- ARSY must generate OpenAPI output from contract schemas
- Contract schemas must define request/response shapes
- Types must be framework-neutral (packages/types)

## State Transitions

### Package States
- **Planned**: Documented in docs/ but no source code
- **Implemented**: Has source entrypoint and scripts pass
- **Deprecated**: Marked for retirement, unique behavior migrated
- **Archived**: Removed from tracked tree

### Repository States
- **P0 Exit**: Clean install, build, lint, typecheck and tests work from root
- **P1 Exit**: Headquarter shell functional, ARSY core/contracts working
- **P2 Exit**: ORM kernel with deterministic composition and tests
- **Complete**: All phases executed as per roadmap

## Error Scenarios

### E-001: Lockfile Drift
- Symptom: `pnpm install --frozen-lockfile` fails
- Cause: Staged/unstaged manifest edits not reflected in lockfile
- Fix: Run `pnpm run lockfile:refresh`, review diff, commit both

### E-002: Package Manifest Mismatch
- Symptom: `pnpm type-check` fails with "Cannot find module"
- Cause: Package `main` field points to non-existent file
- Fix: Create the entrypoint file or update `main` field

### E-003: Duplicate Dependency
- Symptom: Two packages implement same capability
- Cause: Missing ownership decision or architecture gap
- Fix: Retire duplicate, keep canonical owner, migrate unique behavior

### E-004: Workflow YAML Errors
- Symptom: GitHub Actions fail to run or report incorrect results
- Cause: Malformed YAML, wrong directory references, wrong package manager
- Fix: Rewrite workflow from repository root, validate YAML expressions

### E-005: Hardcoded Repository Path
- Symptom: Automation references RIOTWORKS instead of MOONWITNESS
- Cause: Scripts not made repository-aware
- Fix: Use repository metadata/env with MOONWITNESS as default

## Acceptance Criteria

The Phase 0 exit criteria are:
- [ ] Root package identity, workspace names, and repo identity are consistent
- [ ] Every workspace package has a valid manifest, entrypoint, and real scripts
- [ ] pnpm lockfile importer entries match every workspace package
- [ ] `pnpm install --frozen-lockfile` succeeds
- [ ] Root commands use deterministic orchestration and propagate failures
- [ ] Pre-commit and commit-msg hooks are local, predictable, and tested
- [ ] CI runs repository integrity and full application quality gates
- [ ] CodeQL and Dependabot run and report results
- [ ] Legacy service duplicates are archived/retired after unique behavior is migrated
- [ ] GitHub branch protection and required checks are configured by an administrator
- [ ] Release, Wiki, and Pages automation is enabled only when the relevant target is real and verified
