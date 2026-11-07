# Repository Maintenance Design

## Architecture Decision Records

### ADR-001: Repository Topology
**Status**: Accepted
**Context**: The repository had competing service directories (services/) alongside apps/ and packages/
**Decision**: pnpm workspace includes only apps/* and packages/*. services/ is excluded intentionally.
**Consequences**: 
  - Canonical apps are headquarter (Next.js) and arsy (Fastify)
  - No second app topology can be silently activated
  - Duplicate service code must be retired after extracting useful behavior

### ADR-002: Package Ownership
**Status**: Accepted
**Context**: Multiple packages had unclear ownership or duplicate functionality
**Decision**: 
  - @riotworks/arsy-core: Fastify platform core (no business models or SQL)
  - @riotworks/arsy: Fastify API composition root (only public/private HTTP API)
  - @riotworks/headquarter: Next.js frontend (browser state, API client)
  - @riotworks/ui: Shared component library (buttons, badges, etc.)
  - No UI dependency in backend (ARSY must not depend on UI)
**Consequences**: 
  - Clear boundaries between frontend, backend, and shared libraries
  - No cross-layer imports without explicit architecture decision

### ADR-003: BaseEntity Composition
**Status**: Accepted
**Context**: Docs 08/15/18/19/21 contained historical three-field BaseEntity text
**Decision**: Authoritative BaseEntity has exactly five fields: id, createdAt, createdById, updatedAt, updatedById
**Consequences**: 
  - ORM composes BaseEntity exactly once
  - Actor IDs come from trusted execution context, not client payloads
  - System/bootstrap/import actors are explicit principals or documented null-provenance
  - No active, archive, soft-delete, version on every model by default

### ADR-004: Queue and Event Decision
**Status**: Accepted
**Context**: BullMQ prototype duplicated queue/service concerns with inconsistent APIs
**Decision**: 
  - Define one queue port and typed job contracts (packages/jobs)
  - Choose one transport adapter (BullMQ optional, not canonical)
  - Business state remains in domain records, not in queue
  - Outbox pattern for reliable dispatch from committed transactions
**Consequences**: 
  - No both services/queue and packages/bullmq as separate implementations
  - Queue messages carry stable IDs, tenant context, actor/source, correlation ID, idempotency key

### ADR-005: Database Provider Decision
**Status**: Accepted
**Context**: Multiple database providers were mentioned without clear primary
**Decision**: 
  - PostgreSQL is the production target
  - libSQL/SQLite is the local/embedded/single-node profile
  - PocketBase is not part of v1 (avoid duplicate auth, BaseModel, API, schema authorities)
  - Kysely is private SQL-adapter infrastructure, not the ORM or addon API
**Consequences**: 
  - Schema changes serialized and recorded with fingerprints/receipts
  - Safe additive changes may auto-apply
  - Semantic data transforms use typed programmatic handlers
  - Destructive changes require explicit approval, backup, and recovery plan

## Module Boundaries

### Headquarter (Next.js)
- Responsibility: Human-facing web application, browser state, API client
- Never imports: DB credentials, direct ORM access, business models
- Allows imports from: @riotworks/ui (components), @riotworks/arsy (API contracts)
- Never exports to: backend services, database adapters

### ARSY (Fastify)
- Responsibility: Backend HTTP API and orchestration runtime
- May consume: @riotworks/arsy-core (platform), @riotworks/contract (wire types)
- Must NOT import from: @riotworks/ui, @riotworks/headquarter source
- Exports: Public HTTP API routes, application composition, authn/authz

### ARSY Core (Utilities)
- Responsibility: Reusable Fastify lifecycle/plugins/config/logging/health
- No business models or SQL
- Exports: Plugin factory, config validation, error types, health checks
- Allows imports from: @riotworks/types (framework-neutral)

### Types (Framework-Neutral)
- Responsibility: Shared TypeScript types used across packages
- Exports: BaseEntity interface, contract types, API wire types
- Must NOT import from: Any runtime or UI package

### Contract
- Responsibility: Runtime request/response/event contracts and exports
- Defines: API wire shapes, validation schemas, OpenAPI output
- Allows imports from: @riotworks/types
- Must NOT import from: Any business logic package

### UI
- Responsibility: Shared component library (button, badge, card, separator, utilities)
- Exports: React components, design tokens, responsive utilities
- Allows imports from: None (primitives only)
- Must NOT import from: @riotworks/arsy or @riotworks/headquarter

## Design Principles

1. Clear layer separation: UI <- ARSY <- Core; never backwards direction
2. Single source of truth: docs/ is canonical; code implements docs
3. Typed contracts: All inter-package communication goes through typed schemas
4. Fail-fast: Scripts and checks must fail early and clearly
5. Deterministic: Builds, installs, and checks must be reproducible
6. No duplication: One canonical owner per capability; retire duplicates

## Trade-offs and Open Questions

1. BullMQ vs. simple job queue: Maintaining BullMQ as optional adapter vs. using simpler transport. Decision: define contracts first, choose adapter later when real workflow needs async execution.

2. Full ORM vs. lightweight query layer: Implementing full ORM kernel immediately vs. starting with typed queries. Decision: Phase 3 ORM kernel is small and test-first; can expand later.

3. All base addons at once vs. staged implementation: Creating 17 npm packages immediately vs. foundation first, then opt-in mixins. Decision: foundation required first (core, identity, security, workspace, audit, events), then opt-in as needed.

4. Schema migration approach: Routine handwritten migration files vs. TypeScript model declarations as desired schema. Decision: TypeScript model declarations are desired schema; ARSY's private schema API plans/reconciles through selected adapter.

## Chosen Alternatives with Rationale

1. Turbo over raw shell parallelism: Turbo owns task graph with correct exit-code propagation; raw `&` backgrounding loses failure information.

2. Changesets at release time vs. commit-time version bumps: Release-time versioning is intentional; commit-time version mutations are prohibited in pre-commit and CI.

3. Documentation-first approach: docs/ is source of truth; code implements documented requirements. This ensures alignment but requires discipline to keep docs updated.

4. One transport adapter vs. multiple: Maintaining both services/queue and packages/bullmq creates inconsistency. Decision: define contracts first, select one adapter when real workflow needs emerge.

## Open Questions

1. When should BullMQ be retained as the transport adapter? Only when a real workflow needs asynchronous execution with idempotency, bounded retries, leases, dead-letter handling, budgets, and observability.

2. What is the exact ORM addon foundation minimum viable set? The audit identifies 6 required foundation addons (core, identity, security, workspace, audit, events), but the exact API surface is still being refined.

3. How should workspace auto-detection handle deduplication? The auto-detect script must create at most one issue per stable fingerprint, update/reopen existing issues, and never create duplicates every week.

4. What exactly constitutes "full workspace quality" CI? The gate is `FULL_QUALITY_CI=true`, but the exact set of passing checks (type-check across all packages, build across all apps, integration tests) needs definition.

5. Should the GitHub Wiki be published? Only when enabled and explicitly published through a verified workflow with clear target and authentication.
