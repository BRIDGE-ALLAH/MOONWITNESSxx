# Repository Code Quality Audit Specification

## Requirements (FR/NFR)

### FR-001: Repository Buildability
- pnpm install --frozen-lockfile must succeed from a clean checkout
- pnpm build must complete without errors
- pnpm type-check must pass for all packages
- pnpm lint must pass for all packages

### FR-002: Package Manifest Consistency
- Every workspace package must have a valid package.json with real main, xports, and scripts fields
- All @riotworks/* workspace references must resolve correctly
- Lockfile importer entries must match every workspace package manifest

### FR-003: Headquarter Manifest Correctness
- @riotworks/headquarter package must accurately describe its runtime (Next.js, not Fastify)
- Scripts must use Next.js commands (
ext dev, 
ext build, 
ext start)
- No Fastify CLI scripts in headquarter package

### FR-004: ARSY Core Implementation
- @riotworks/arsy-core must have a real source entrypoint at src/index.ts
- Must export a Fastify plugin/lifecycle factory
- Must not import UI packages unnecessarily

### FR-005: ARSY Backend Dependency Graph
- @riotworks/arsy must NOT depend on @riotworks/ui
- Remove @riotworks/ui from arsy's dependencies
- ARSY should only depend on arsy-core and production dependencies

### FR-006: Duplicate Service Retirement
- services/arsy must be identified as duplicate of pps/arsy
- Unique useful behavior extracted and migrated to apps/arsy
- services/arsy should be archived/removed after verification

### FR-007: Root Workspace Scripts
- Root package.json scripts must use deterministic Turbo task orchestration
- No uncontrolled shell backgrounding (&) in root scripts
- All scripts must propagate failures correctly

### FR-008: Pre-commit Hook Integrity
- .husky/pre-commit must not call network AI services
- Must not mutate package versions or changelogs
- Must exit non-zero when checks fail

### FR-009: Commit Message Validation
- .husky/commit-msg must validate Conventional Commit subjects
- Subject format: 	ype(scope): imperative summary
- Maximum 72 characters
- Must accept: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

### FR-010: Weekly Workflow Validation
- .github/workflows/weekly-detection.yml must have valid YAML syntax
- Must reference correct working directory (repository root)
- Must not use 
pm cache for pnpm workflows
- Must generate report before publishing

### FR-011: Auto-Detection Repository Awareness
- scripts/auto-detect.js must be repository-aware (not hardcode REPO='RIOTWORKS')
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
- Root packageManager: pnpm@12.16.1 is pinned and authoritative
- Node.js version: >=20 locally, Node.js 24 in CI
- Package versions follow semver, no unconstrained ranges in lockfile

### Script Contract
- Scripts must follow deterministic patterns
- All scripts must have clear input/output contracts
- Error handling must be explicit and propagate failures correctly
- No silent failure suppression

### Manifest Contract
- Every package.json must have valid main, xports, and scripts fields
- @riotworks/* references must resolve correctly
- Lockfile must be authoritative for dependency versions
- Scripts must point to real source/config files

### Compliance Matrix
| Requirement | Status | Evidence |
|-------------|--------|----------|
| FR-001: Buildability | ☐ Pass / ☐ Fail |  |
| FR-002: Manifest Consistency | ☐ Pass / ☐ Fail |  |
| FR-003: Headquarter Correctness | ☐ Pass / ☐ Fail |  |
| FR-004: ARSY Core Implementation | ☐ Pass / ☐ Fail |  |
| FR-005: ARSY Dependency Graph | ☐ Pass / ☐ Fail |  |
| FR-006: Duplicate Service Retirement | ☐ Pass / ☐ Fail |  |
| FR-007: Root Scripts | ☐ Pass / ☐ Fail |  |
| FR-008: Pre-commit Integrity | ☐ Pass / ☐ Fail |  |
| FR-009: Commit Validation | ☐ Pass / ☐ Fail |  |
| FR-010: Weekly Workflow | ☐ Pass / ☐ Fail |  |
| FR-011: Auto-Detect Awareness | ☐ Pass / ☐ Fail |  |
| NFR-001: Performance | ☐ Pass / ☐ Fail |  |
| NFR-002: Maintainability | ☐ Pass / ☐ Fail |  |
