# Repository Maintenance Plan

## Phase 0: Repository Alignment and Deterministic Tooling

- [ ] P0: Repair root CI/workspace and package manifests (AUD-001 through AUD-007, AUD-010, AUD-014, AUD-021)
- [ ] P0: Resolve duplicate ARSY/queue code and update stale repo automation target (AUD-004, AUD-005, AUD-009, AUD-012, AUD-013)
- [ ] P1: Normalize docs 08/15/18/19/21 BaseEntity statements and make docs/23 the canonical plan (AUD-017)
- [ ] P1: Finish Headquarter shell and ARSY core/contracts (Phases 1-2)
- [ ] P2: Implement ORM kernel and schema adapters (Phases 3-4)
- [ ] P2: Implement required base addon foundation, not all optional modules at once (Phase 5)
- [ ] P3: Business addons, commercial slice, then automation (Phases 6-8)

## Phase 1: Headquarter Foundation

1. Correct Next.js package manifest and dependencies
2. Establish route/layout, theme, responsive shell, locale /id and /en, and API client boundary
3. Implement design tokens and reusable UI primitives from docs/10-12
4. Replace demo-only labels/copy that contradict current architecture
5. Add explicit mock/demo data provider with no false live claims

Exit: Next build and typecheck pass; responsive shell has no dead controls; demo/live data is clearly distinguished.

## Phase 2: ARSY Core and Contracts

1. Implement packages/contract runtime schemas and generated/inferred wire types
2. Implement framework-neutral packages/types
3. Implement packages/arsy-core factory, plugin lifecycle, config validation, errors, logging, correlation, health/readiness and shutdown
4. Make apps/arsy the only Fastify composition root
5. Add versioned API routes, schema validation, injection tests and OpenAPI output

Exit: ARSY starts/stops cleanly; health/readiness and contract tests pass; Headquarter calls ARSY through typed contracts.

## Phase 3: ORM Kernel (small, test-first)

1. Add package manifest/build/test contract for packages/orm
2. Implement typed model/field metadata and deterministic registry
3. Implement addon manifest dependency graph, cycle detection, conflict reporting and extension ordering
4. Implement persistent/abstract/transient model kinds
5. Implement BaseEntity composition exactly once
6. Add typed scalar/relation constraints and portable query/domain AST
7. Implement record operations, lifecycle and request environment

Exit: Deterministic composition, conflict/cycle tests, BaseEntity tests and adapter-independent model tests pass.

## Phase 4: Database Runtime and Schema API

1. Implement provider-neutral adapter contracts and capability registry
2. Implement orm-db transaction/unit-of-work/schema reconciler/ledger
3. Implement libSQL adapter first for fast local feedback
4. Implement PostgreSQL adapter against the same contract suite
5. Implement plan/safe/strict/off modes, serialization lock, receipts, drift checks and recovery
6. Add typed data-upgrade handler interface; no routine handwritten migration files

Exit: Shared provider contract tests, transaction/audit tests, schema idempotency/drift/recovery tests pass.

## Phase 5: Base Platform (staged)

1. Required foundation addons: core, identity, security, workspace, audit, events
2. Add opt-in mixins: ownership, archive, soft-delete, toggle, version, workspace scope, company scope
3. Add settings, attachment, sequence and transient when required by first product workflow
4. Add communication, activity, integration, import/export, localization and taxonomy as independent capabilities when a real use case requires them

Exit: Model ownership, dependency graph, permissions, record rules, workspace isolation and audit consistency tested.

## Phase 6: RIOTWORKS Business Addons

1. Project addon only for actual product/project planning needs
2. Intelligent addon for providers/models/agents/runs/tools/prompts/evaluations/usage/cost
3. ZILL policy services remain a distinct policy boundary
4. MIZAN financial ledger remains append-oriented and evidence-backed

Exit: Business models do not duplicate base fields, security, audit, jobs or notifications.

## Phase 7: First End-to-End Commercial Slice

1. Evidence-backed signal capture
2. Opportunity score with source/date/confidence
3. Product brief and original asset creation
4. ZILL rights/provenance/quality gate
5. Manual marketplace-ready listing package
6. MIZAN costs/revenue/refund/payout reconciliation

Exit: One real product can move through the complete workflow with auditable records; no fabricated marketplace API, sales or traffic.

## Phase 8: Jobs and Safe Automation

1. Define queue-independent job contracts and outbox dispatch
2. Select one transport only when required
3. Add apps/worker only when separate worker scaling/lifecycle is justified
4. Implement idempotency, bounded retries, leases, dead-letter handling, budgets, approvals and observability

Exit: Retry/replay/recovery tests pass; jobs cannot bypass ZILL or authorization.

## Phase 9: Production Readiness and Expansion

Security review, threat model, backup/restore drills, observability, deployment profile, rate limits, secret handling, marketplace policy verification, accessibility, load/concurrency tests, release process, and operational runbooks.

## Canonical Target Architecture

- **Topology**: apps/headquarter (Next.js UI), apps/arsy (Fastify API), packages/* (libraries)
- **No services/***: pnpm workspace includes only apps/* and packages/*
- **Ownership rules**: Headquarter consumes ARSY through public API; ARSY must not depend on UI
- **Queue decision**: Define job contracts first; choose one transport adapter later; avoid BullMQ as second source of business truth
- **BaseEntity**: exactly id, createdAt, createdById, updatedAt, updatedById
- **Database**: PostgreSQL production, libSQL/SQLite local, no PocketBase
- **ORM**: Kysely is private infrastructure, not the ORM or addon API
