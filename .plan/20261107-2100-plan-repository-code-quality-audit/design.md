# Repository Code Quality Audit Design

## Architecture Overview

This plan follows the MoonWitness/RiotWorks repository architecture conventions:

### Package Structure
- **packages/headquarter**: Next.js application shell (must not mix with Fastify)
- **packages/arsy-core**: Core ARSY Fastify plugin/lifecycle factory
- **packages/arsy**: ARSY HTTP backend (must NOT depend on @riotworks/ui)
- **apps/arsy**: Canonical ARSY HTTP backend (services/arsy is duplicate to be retired)
- **services/arsy**: Duplicate - will be archived after behavior extraction

### Dependency Direction
`
packages/headquarter → Next.js framework
packages/arsy-core → Fastify plugin framework
packages/arsy ← packages/arsy-core (production deps only)
packages/arsy -@riotworks/ui (must NOT import UI)
apps/arsy ← packages/arsy-core (canonical backend)
services/arsy → apps/arsy (behavior extraction)
`

### Key Boundaries
1. **Headquarter/Next.js boundary**: Must use Next.js commands exclusively (next dev, next build, next start)
2. **ARSY dependency boundary**: arsy must not depend on @riotworks/ui - only arsy-core and production deps
3. **Canonical ownership**: apps/arsy is the single canonical ARSY HTTP backend
4. **Workspace manifest boundary**: All @riotworks/* references must resolve correctly in lockfile

### Design Decisions
- **Rule AUD-001 compliance**: Headquarter package.json must explicitly state Next.js runtime, not Fastify
- **Rule AUD-003 compliance**: Remove @riotworks/ui from arsy dependencies if present
- **Rule AUD-004 compliance**: Identify services/arsy as duplicate, extract unique behavior to apps/arsy
- **Rule AUD-021 compliance**: Audit all package manifests against actual tracked files

### State Transitions
- **Current state**: Repository with mixed Fastify/Next.js manifests, duplicate services/arsy
- **Target state**: Clean dependency graph with correct runtime declarations, single canonical ARSY backend
- **Migration**: Extract useful behavior from services/arsy → apps/arsy, retire services/arsy

### Error Scenarios
1. Fastify scripts in headquarter package → violate AUD-001, require migration to Next.js commands
2. @riotworks/ui in arsy dependencies → violate AUD-003, must be removed
3. services/arsy duplicate → violate AUD-004, must be retired after extraction
4. Non-deterministic pre-commit hooks → violate AUD-005, must be made local/fast/deterministic

### Acceptance Criteria
- All package manifests correctly declare their runtime (Next.js vs Fastify)
- @riotworks/ui removed from arsy dependency graph
- services/arsy behavior extracted and migrated to apps/arsy
- services/rsy archived/removed after verification
- All pre-commit hooks are local, deterministic, and fast
- All commit messages follow Conventional Commits format
- Weekly workflow YAML is valid and references correct directory
- Auto-detect script is repository-aware (not hardcoded)
