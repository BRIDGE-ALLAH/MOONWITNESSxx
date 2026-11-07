# 08 — Technical Architecture: Headquarter, ARSY, ORM & SQL Providers

**Status:** Approved target architecture | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Canonical decisions
RIOTWORKS uses one backend (ARSY), one metadata-driven ORM, one provider-neutral database contract, and relational SQL providers.
- PostgreSQL is the recommended production provider.
- libSQL is the lightweight SQLite-compatible provider for local, embedded, and single-node profiles.
- Kysely is an internal query/dialect tool inside SQL adapters, not a second ORM.
- RIOTWORKS ORM remains the only model registry, addon system, and desired-schema source.
- PocketBase is not part of the v1 persistence architecture.
- Schema changes use code-first model declarations and ARSY's private programmatic schema API; routine hand-authored migration files are not required.

## 2. Applications
Headquarter is the frontend and operator experience. It consumes typed ARSY contracts and never connects directly to databases or receives database credentials.
ARSY is the Fastify application/composition root. It loads configuration, security, selected database adapter, ORM, trusted addons, services, routes, and private operations APIs.

## 3. Package ownership
| Package | Owns | Must not own |
|---|---|---|
| packages/arsy-core | Fastify lifecycle, plugins, runtime context, logging, errors, health | Business models or SQL |
| packages/orm | Model metadata, registry, addon composition, domain/query AST, typed model API, lifecycle | SQL dialect, connections, physical DDL |
| packages/orm-db | Connections, transactions, unit-of-work, schema reconciliation, schema ledger, data-upgrade coordination | Provider SQL or domain fields |
| packages/orm-db-adaptor | Provider-neutral CRUD/query/schema contracts, capabilities, registry | Concrete drivers |
| packages/orm-db-adaptor-libsql | libSQL connection, SQLite mapping, introspection, DDL, query execution | ORM declarations |
| packages/orm-db-adaptor-postgres | PostgreSQL pool, mapping, introspection, DDL, query execution | ORM declarations |
| packages/orm-addon-base | Minimal BaseEntity, optional lifecycle mixins, AuditTrail | Universal business fields |
| packages/orm-addon-project | Project models and services | Persistence/audit infrastructure |
| packages/orm-addon-intelligent | AI/agent models and services | Plaintext provider secrets |
| packages/types | Framework-neutral primitives | Framework/database runtime |
| packages/contract | Runtime API schemas and inferred wire types | Persistence logic |
| packages/lint | Tooling and import boundaries | Runtime code |

Keep repository package spelling "adaptor" consistently.

## 4. Dependency direction
Headquarter → contract/types/UI. ARSY → arsy-core, contract, types, ORM/database packages, installed addons. Addons → ORM and declared addon dependencies. ORM → neutral types/interfaces. orm-db → adapter contract/types. Concrete SQL adapters → adapter contract, Kysely, own driver. Base addon → ORM only.
Forbidden: Headquarter importing DB drivers, credentials, schema-admin privileges; addons importing Kysely/raw SQL; ORM importing concrete providers; private cross-addon imports; app-to-app source imports; circular dependencies.

## 5. ORM and query responsibilities
ORM owns metadata, registry, extension composition, validation, relations, domain/query AST, typed CRUD, lifecycle, environment/context, capability checks. It does not own raw SQL, connections, provider catalogs, physical DDL, or SQL compilation. SQL adapters use Kysely internally; Kysely types/instances never leak into addon APIs. Do not introduce Drizzle or another ORM as a parallel schema/model authority.

## 6. Database providers
PostgreSQL: recommended for production concurrent agents/workers, ledger writes, reporting, multiple ARSY processes, and multi-instance deployment.
libSQL: local quickstart, embedded/self-hosted single-node profiles, demos, and low-write workloads. It retains SQLite's single-writer constraint; a remote URL does not turn it into PostgreSQL.
Policy: PostgreSQL production default; libSQL lightweight local/single-node; CI runs shared contract tests against both; capability differences are declared and tested. Same model API does not imply identical concurrency or performance. Changing connection string does not move data.

## 7. Programmatic schema reconciliation
Trusted TypeScript addon models are the only desired-schema source. The reconciler introspects actual schema, calculates a deterministic plan, classifies changes, applies permitted safe DDL through the adapter, verifies results, and records receipts.
SQLite/libSQL and PostgreSQL do not expose one universal REST schema API. ARSY exposes a private control-plane API; the adapter applies provider-native schema operations through its DB connection. This removes routine handwritten migration files, not physical DDL.

## 8. Private schema operations API
- POST /internal/admin/schema/plan — read-only plan.
- POST /internal/admin/schema/reconcile — apply permitted safe changes.
- POST /internal/admin/schema/verify — verify desired/actual schema.
- GET /internal/admin/schema/status — fingerprints, last run, lock, drift.
Require deployment/operator service identity and least privilege. Normal Headquarter sessions cannot mutate schema. CLI, CI, release job, and HTTP entry point call the same SchemaReconciliationService. Apply schema once in a serialized setup/release task, never from every ARSY replica or ordinary request.

## 9. BaseEntity and audit
The authoritative BaseEntity contains exactly id, createdAt, createdById, updatedAt and updatedById. For v1 SQL providers ARSY generates UUID IDs; adapters normalize libSQL TEXT and PostgreSQL UUID to the same opaque string contract. createdAt/updatedAt are UTC instants; createdById/updatedById reference the canonical principal and are set only from trusted server context.
Ownership attribution beyond creator/updater, archive, version, soft delete, toggleable active/enabled, workspace scope and company scope remain explicit opt-in mixins or addon fields. Business state is domain-owned; do not inject universal active.
AuditEvent is a separate append-oriented audit model/service, not a replacement for BaseEntity actor metadata. SQL business mutation and required audit insert share one transaction. External side effects use a transactional outbox.

## 10. Runtime, security, testing
Fastify routes delegate to application services. Provide health/readiness, versioned APIs, private schema operations, structured logs, request correlation, centralized validation/errors, graceful shutdown. Keep DB credentials server-side; separate runtime and schema-apply privileges where possible. Preserve unowned tables. Require backup/restore validation before destructive changes. Test both adapters for CRUD, relations, constraints, transactions, audit atomicity, schema sync, drift, recovery, and capability differences.

This is a target architecture contract, not a claim that packages already exist.


## 10. v1.3 base-platform clarification (supersedes older minimal summaries)
BaseEntity is not the complete base platform. The universal persisted metadata is id, createdAt, createdById, updatedAt and updatedById. The source package packages/orm-addon-base contains independently declared manifests for base.core, identity, security, workspace, optional company, audit, events, optional communication/activity, attachment, sequence, settings, localization, transient, import-export, optional integration and taxonomy. The ORM target includes persistent/abstract/transient models, computed/related/translated fields, deterministic extension, domain AST, recordsets, prefetch/cache, ACL/record rules and field policies. docs/22 is canonical where earlier sections are less detailed.


## 11. Current repository implementation status
The canonical repository snapshot and implementation gaps are recorded in docs/23. The tracked code currently has thin Headquarter and ARSY prototypes and several utility packages. ORM, orm-db, SQL adapters and Base Platform addons are not implemented. apps/headquarter package metadata and apps/arsy/arsy-core dependency wiring require repair before feature development. Treat docs/23 as the authoritative execution plan.
