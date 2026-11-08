# 15 — Roadmap & Acceptance Criteria

**Status:** Current execution baseline | **Version:** 2.0 | **Updated:** 2026-11-07

> **Authority:** docs/23-repository-audit-and-current-execution-plan.md is the current-state inventory and detailed execution plan. This roadmap is its concise milestone index. Older phase descriptions are superseded.

## 1. Delivery principles

- Build from actual repository state; do not assume target packages exist.
- Keep main buildable at every milestone.
- Fix P0 repository structure/tooling before adding major product features.
- One owner per capability; no duplicate app/service implementations.
- A feature is complete only with implementation, tests, security behavior, failure handling, documentation and CI evidence.
- No production claims from mock/demo data or scaffolding.

## 2. Revised phases

| Phase | Focus | Key deliverables | Exit criteria |
|---|---|---|---|
| 0 | Repository alignment | Correct app manifests, workspace graph, scripts, CI, hooks, workflows, duplicate service cleanup | Frozen install, build, lint, typecheck and tests reproducible from root |
| 1 | Headquarter | Real Next.js package, responsive shell, design tokens, /id and /en, typed API client, explicit demo mode | Next build/typecheck; no dead controls or false live data |
| 2 | ARSY Core + contracts | Contract schemas, types, Fastify factory/lifecycle, config, errors, logs, health/readiness, shutdown | Fastify injection and API contract tests pass |
| 3 | ORM kernel | Metadata, fields, registry, addon graph, inheritance/extension, persistent/abstract/transient models, domain AST, recordsets | Deterministic composition and conflict/cycle tests pass |
| 4 | DB runtime + adapters | Unit-of-work, transaction, provider contract, libSQL, PostgreSQL, schema reconciler and receipts | Shared provider suite, idempotency, drift, recovery and capability tests pass |
| 5 | Base Platform | Required core/identity/security/workspace/audit/events; staged optional capabilities and mixins | Actor attribution, ACL/record rules, workspace isolation and audit atomicity pass |
| 6 | Business addons | Project and Intelligent domains; ZILL policy and MIZAN ledger boundaries | No duplicated base fields/security/audit/job ownership |
| 7 | Commercial vertical slice | Signal → evidence → opportunity → product → ZILL → listing package → MIZAN | One real product flow is traceable and financially reconcilable |
| 8 | Jobs and automation | Queue-independent contracts, outbox, one transport, optional apps/worker, retries/idempotency/approval | Replay/recovery/budget/policy tests pass |
| 9 | Production readiness | Threat model, backup/restore, observability, deployment, performance, accessibility, release/runbooks | Operational readiness review passes |

## 3. BaseEntity and Base Platform contract

Every persisted model receives exactly five ORM-managed fields:
- id
- createdAt
- createdById
- updatedAt
- updatedById

The ORM injects these exactly once. Actor values are derived from trusted server-side execution context. Archive, soft delete, active/enabled, revision, owner, workspace and company are not universal BaseEntity fields.

The full 17-manifest Odoo-inspired Base Platform catalog is defined in docs/22. Implementation order is staged in docs/23; do not implement all optional modules before the first business workflow needs them.

## 4. Database and schema contract

- PostgreSQL is the production target; libSQL/SQLite is local/embedded/single-node.
- PocketBase is excluded from v1 to avoid a second identity/API/schema authority.
- Kysely is private to SQL adapters; the custom ORM is the only model registry.
- TypeScript addon declarations are the desired schema source.
- ARSY private schema API plans/reconciles through the chosen adapter.
- Routine model changes do not require handwritten migration files.
- Semantic data transformations use typed handlers; destructive changes require explicit approval, backup and recovery.
- Provider switching requires export/import and verification, not only changing connection configuration.

## 5. Application boundaries

- apps/headquarter is Next.js frontend only.
- apps/arsy is the sole Fastify HTTP backend/composition root.
- packages/arsy-core owns reusable Fastify lifecycle, not business models.
- Optional apps/worker is a future deployable worker process.
- packages/jobs owns queue-independent job contracts; a transport adapter owns BullMQ/Redis specifics.
- No services/arsy or services/queue duplicate implementations.

## 6. Business acceptance

Opportunity scores cite dated evidence and confidence. Products have a clear buyer/job/differentiation. Rights/licenses/AI disclosures are recorded. Channel eligibility/fees are verified. Revenue, fees, pending/settled, refunds, payouts and costs are distinct. Net contribution reconciles to evidence. No fabricated traffic, orders, reviews or sales.

## 7. Design acceptance

MOONWITNESS master identity per docs/01, docs/10, and docs/12; route-appropriate Observatory, Archive, and Signal skins per docs/11 and docs/13; consistent semantic status/evidence meanings; original illustration and asset provenance; accessible data/forms; responsive and keyboard use; rendered contrast review; and reduced motion. RIOTWORKS remains the product and operating division subordinate to the MOONWITNESS master brand. Avoid generic SaaS drift, decorative HUD noise, and unbounded poster styling.

## 8. Definition of done

A feature is complete only when user problem, domain state, ownership, permissions, failure behavior, tests, audit/logs, docs, and visible states are covered. Scaffolding/placeholders are not done.
