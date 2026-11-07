# 08 — Technical Architecture: Headquarter, ARSY, ORM & Providers

**Status:** Approved target architecture | **Version:** 1.4 | **Updated:** 2026-11-07

## 1. Canonical decisions

MOONWITNESS is the canonical repository. RIOTWORKS is a product/business division within it. The platform has one canonical backend application (ARSY), one TypeScript-native declaration-based ORM, one provider-neutral persistence contract, and explicit infrastructure/connector boundaries.

- Model definitions are programmatic TypeScript declarations inside addon/module code. There is no separate manually maintained schema file or second schema language.
- ARSY composes declarations into a deterministic model registry during **System Mode**. Runtime metadata is derived from code; it is not an independently edited source of truth.
- **SQLite is the ARSY System Database** for control-plane state, module/plugin installation state, registry fingerprints/snapshots, system configuration, and system audit. Its single-writer constraint is respected.
- **PostgreSQL is the primary Business Database** for durable business records and concurrent application workloads.
- Redis is shared runtime infrastructure for cache, coordination, locks, and queue transport where required. It is not durable business storage or the canonical model registry.
- Local disk and S3-compatible object storage own binary objects; business databases own attachment metadata and access policy.
- Telegram and similar services are connectors, not database providers.
- Kysely is private query/dialect infrastructure inside SQL adapters, not a second ORM.
- PocketBase is not part of the v1 persistence architecture.
- Schema synchronization is programmatic and controlled by ARSY System Mode. Normal requests and Runtime Mode never perform schema DDL.

libSQL may be evaluated as an optional lightweight business-data provider for a deliberate local/single-node profile. It does not replace the SQLite System Database contract or PostgreSQL's production Business Database role.

## 2. Applications and runtime ownership

- **Headquarter:** Next.js frontend and operator experience. It consumes versioned ARSY contracts and never connects directly to databases or receives database credentials.
- **ARSY:** Fastify API and application composition root. It loads configuration, authentication/authorization, provider capabilities, ORM registry, trusted modules, application services, routes, and private operator APIs.
- **Worker:** optional future deployable app with its own lifecycle. It consumes jobs/events and invokes application services; it does not duplicate business logic.
- **ARSY Core:** reusable Fastify lifecycle, configuration, logging, errors, correlation, health/readiness, and shutdown primitives. It does not own business models or SQL dialects.

## 3. Package ownership

| Package | Owns | Must not own |
|---|---|---|
| apps/headquarter | Next.js UI, browser state, ARSY API client | DB connections, ORM access, DB credentials |
| apps/arsy | Fastify composition, routes, application services | Duplicate core internals or direct Headquarter concerns |
| packages/arsy-core | Fastify lifecycle/plugins, runtime context, logging, errors, health | Business models or SQL |
| packages/orm | Declarations, field metadata, registry, inheritance/extensions, domains, env/recordset contracts | SQL dialect, connections, physical DDL |
| packages/orm-db | Transactions, unit-of-work, schema planning/reconciliation, ledger, upgrade orchestration | Provider-specific SQL syntax or business fields |
| packages/orm-db-adaptor | Provider-neutral persistence contracts and capability negotiation | Concrete drivers |
| packages/orm-db-adaptor-sqlite | SQLite System Database mapping, introspection, DDL and query execution | Business addon declarations |
| packages/orm-db-adaptor-postgres | PostgreSQL Business Database pool, mapping, introspection, DDL and query execution | ORM declarations |
| packages/orm-addon-base | Independently declared foundational addons | Project/AI business fields |
| packages/orm-addon-project | Project domain models and services | Generic persistence/security/audit infrastructure |
| packages/orm-addon-intelligent | AI/agent domain models and services | Plaintext provider secrets |
| packages/types | Framework/database-neutral primitives | Framework/database runtime |
| packages/contract | Runtime API schemas and inferred wire types | Persistence logic |

Keep the repository package spelling `adaptor` consistently where existing paths use it.

## 4. Dependency direction

Headquarter → contract/types/UI. ARSY → ARSY Core, contract, types, ORM/database runtime, providers, and enabled trusted addons. Addons → ORM and declared addon dependencies. ORM → neutral types/interfaces. ORM DB runtime → provider-neutral adapter contract. Concrete adapters → adapter contract, Kysely (if selected), and their own driver.

Forbidden dependencies:
- Headquarter → database drivers, credentials, schema-admin privileges, or direct ORM runtime.
- Addons → Kysely builders, raw SQL, or concrete database drivers.
- ORM → concrete providers.
- Provider adapters → business addon classes.
- Private cross-addon imports, app-to-app source imports, and circular dependencies.

## 5. Programmatic declaration-based ORM

The ORM follows Odoo's useful architectural ideas—model registry, module dependencies, extension, recordsets, environment/context, and reusable abstract mixins—without cloning Odoo or promising API compatibility.

The canonical v1 declaration is TypeScript source code. Preferred shape:

```ts
import { Model, fields } from "@riotworks/orm";

export class Customer extends Model {
  static modelName = "crm.customer";
  static module = "crm";

  static fields = {
    name: fields.Char({ required: true, maxLength: 160 }),
    email: fields.Char({ index: true }),
    active: fields.Boolean({ default: true }),
    creditLimit: fields.Decimal({ precision: 18, scale: 2 }),
    companyId: fields.ManyToOne("res.company", {
      onDelete: "restrict",
    }),
  };
}
```

The declaration remains in the model/module source; it is not a separate schema file. The ORM normalizes declarations into immutable metadata. Property decorators may be considered later as optional syntax sugar, but must normalize to the same metadata contract and are not required for v1.

ORM responsibilities:
- model/field/relation metadata and persistent/abstract/transient model kinds;
- deterministic addon/module registry, inheritance and extension composition;
- constraints, defaults, computed/related/translated fields;
- safe domain/query AST and typed CRUD/recordsets;
- lifecycle hooks, validation, environment/context, cache/prefetch;
- integration with ACL, record rules, field policies and tenant scope.

ORM does not own connections, SQL dialects, physical DDL, or provider-specific query compilation. Kysely may be used internally by SQL adapters only. Do not introduce Prisma, Drizzle, or another ORM as a parallel model registry or desired-schema authority.

### Environment and recordsets

`env` is the scoped execution context: transaction/unit-of-work, authenticated principal, workspace/tenant, optional company, permissions, locale/timezone, trace/request metadata, and approved ARSY service capabilities.

`recordset` is the typed collection facade for one model and one environment. It has predictable empty/single/multiple behavior, batch operations, relation access, and controlled prefetch. Recordsets from different tenants, registries, principals, or transactions cannot be mixed implicitly.

Prefer explicit `env.models` access as the foundational API. Static/class convenience methods may be added later but must delegate to the active environment and must not hide transaction or security context.

## 6. System Mode and Runtime Mode

**System Mode** is an explicit install/upgrade/reconciliation lifecycle, not a request middleware.

1. Initialize the SQLite System Database and core configuration.
2. Discover installed trusted packages and validate signatures, manifests, compatibility, and permissions.
3. Resolve addon/module dependency graph.
4. Register model declarations and compose the deterministic registry.
5. Inject BaseEntity metadata exactly once and validate fields, relations, extensions, policies, and conflicts.
6. Generate a registry fingerprint and desired persistence snapshot.
7. Compare desired state with actual database state and produce a deterministic plan.
8. Apply only permitted changes under a serialized system/deployment lock.
9. Run approved typed semantic upgrade handlers when required.
10. Verify persistence state and record an immutable synchronization receipt.
11. Activate Runtime Mode with the verified registry.

**Runtime Mode** serves API requests and worker jobs using an already-built, verified, immutable registry. It executes model operations and transactions; it does not discover arbitrary code or run schema DDL. API replicas must not race to reconcile schema on startup. Readiness becomes maintenance/degraded/incompatible when installed registry and required database state disagree.

## 7. Database and infrastructure providers

| Capability | Primary responsibility | Notes |
|---|---|---|
| SQLite | ARSY System Database | Control-plane state; one serialized writer; persistent local volume; backup/integrity checks |
| PostgreSQL | Business Database | Primary durable business records; concurrent API/worker transactions |
| Redis | Runtime infrastructure | Shared cache, locks, coordination, queue transport; not authoritative business storage |
| Local disk | Local file staging | Temporary/local persistence only unless an explicit durable deployment policy exists |
| S3-compatible storage / Cloudflare R2 | Object storage | Durable binary objects; database stores object key, checksum, metadata, access policy |
| Telegram | Connector | Bot/webhook/notification/file-transfer integration; never a database abstraction |

SQLite and PostgreSQL have distinct ownership. Do not assume a distributed transaction across them. Cross-boundary work uses explicit orchestration, idempotency, and outbox patterns where appropriate.

## 8. Programmatic schema reconciliation

Trusted TypeScript declarations are the only desired model/schema source. The registry produces a normalized desired persistence snapshot. The reconciler introspects actual schema, calculates a deterministic plan, classifies risk, applies permitted provider-native operations, verifies results, and records receipts.

- Additive, deterministic, non-destructive changes may be eligible for automatic application.
- Destructive changes, type narrowing, relation semantic changes, data transformations, and drops require explicit operator approval and recovery readiness.
- Removing a declaration or disabling an addon never silently drops stored tables/columns/data.
- Semantic data upgrades use versioned TypeScript handlers owned by the module; no routine handwritten SQL migration-file workflow is required.
- Schema writes run in one serialized System Mode/release process, not every API/Worker replica.

Private operator API contract:
- `POST /internal/admin/schema/plan` — read-only deterministic plan.
- `POST /internal/admin/schema/reconcile` — authorize and apply permitted changes.
- `POST /internal/admin/schema/verify` — verify actual state.
- `GET /internal/admin/schema/status` — fingerprints, drift, last receipt and lock status.

The adapter executes provider-native DDL through its own database connection. This is not a claim that SQLite and PostgreSQL expose a common REST schema endpoint. Require deployment/operator identity and least-privilege credentials. Normal Headquarter sessions cannot mutate schema.

## 9. BaseEntity and audit

Every persisted model receives exactly five ORM-managed fields: `id`, `createdAt`, `createdById`, `updatedAt`, and `updatedById`. Actor attribution comes from trusted server-side Environment context, never an untrusted client payload. Bootstrap/import/system actors must be explicit or have documented null provenance.

Do not universally add active/enabled, archive, soft-delete, revision, workspace/company scope, owner, display name, or arbitrary metadata. Those remain explicit mixins or owning-addon fields.

AuditEvent is separate from BaseEntity actor metadata. Required audit writes for a business mutation share its PostgreSQL transaction. External side effects use a transactional outbox.

## 10. Security, runtime and testing

Fastify routes delegate to application services. ORM models are not automatically public HTTP APIs. Enforce model ACL, record rules, field policies, tenant scope, and relation traversal checks on every supported operation. Secrets live in a secret manager; records store references only. Audit/logging redact secrets and sensitive payloads.

Provide health/readiness, versioned contracts, private schema operations, structured logs, request correlation, centralized validation/errors, graceful shutdown, backups, and restore drills. Test provider capabilities, transactions, audit atomicity, schema idempotency/drift/recovery, tenant isolation, and plugin trust boundaries.

## 11. Canonical references and status

- Detailed Base Platform and ORM capability matrix: `docs/22-base-platform-and-orm-capability-blueprint.md`.
- Actual repository inventory, gaps, and execution order: `docs/23-repository-audit-and-current-execution-plan.md`.
- Odoo reference concepts: https://www.odoo.com/documentation/master/developer/reference/backend/orm.html
- Kysely (adapter-internal only): https://kysely.dev/docs/getting-started

This document describes the approved target architecture, not a claim that the ORM, database runtime, or addons are already implemented.

## 12. Glossary

- **Model:** named business/system record type declared in TypeScript.
- **Field:** typed property descriptor contributing metadata and runtime behavior to a model.
- **Module:** installable business capability with a manifest, dependencies, declarations, services and policies.
- **Addon:** a versioned unit contributing one or more modules or extensions.
- **Plugin:** installable package/integration unit with trust level, permissions, lifecycle and one or more capabilities.
- **Provider:** infrastructure implementation of a capability such as database, cache, object storage or queue.
- **Registry:** immutable runtime composition of enabled module declarations and extensions.
- **Environment (`env`):** scoped execution context containing identity, tenant, transaction, policy and service access.
- **Recordset:** typed collection of model records bound to one Environment.
- **System Mode:** controlled discovery, composition, installation, upgrade and reconciliation lifecycle.
- **Runtime Mode:** normal API/worker execution against a verified registry.
- **Schema Plan:** deterministic proposed physical database changes derived from the registry.
- **Upgrade Handler:** versioned TypeScript transformation for semantic data changes.
