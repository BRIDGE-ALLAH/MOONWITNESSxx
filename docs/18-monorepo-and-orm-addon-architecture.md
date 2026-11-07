# 18 — Monorepo, Fastify Core, Custom ORM & Addon Architecture

**Status:** Approved target architecture | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Canonical decisions
One Fastify backend (ARSY), one custom TypeScript declaration-based ORM, one provider-neutral DB adapter SPI, SQLite for the System Database, PostgreSQL for the Business Database, Kysely internal to SQL adapters, and programmatic reconciliation through private ARSY System Mode. PocketBase is not a v1 persistence provider.

## 2. Workspace and package map
Use pnpm, strict TypeScript, explicit exports, deterministic build order.

| Package | Responsibility | Must not own |
|---|---|---|
| apps/headquarter | Frontend/operator experience | DB connection |
| apps/arsy | Fastify backend/composition root | Duplicated framework internals |
| packages/arsy-core | Fastify lifecycle/plugins/context | Business models |
| packages/orm | Metadata, registry, domain/query API | SQL driver or physical DDL |
| packages/orm-db | Connections, transactions, unit-of-work, schema reconcile, ledger | SQL dialect/domain models |
| packages/orm-db-adaptor | Provider-neutral query/schema contract and capabilities | Concrete drivers |
| packages/orm-db-adaptor-postgres | PostgreSQL pool, mapping, introspection, DDL, Kysely dialect | ORM metadata |
| packages/orm-db-adaptor-sqlite | SQLite System Database connection, mapping, introspection, DDL and system-store operations | ORM metadata or PostgreSQL business persistence |
| packages/orm-addon-base | BaseEntity, optional mixins, AuditTrail | Project/AI fields |
| packages/orm-addon-project | Project domain | Generic base/audit |
| packages/orm-addon-intelligent | AI/agent domain | Raw provider credentials |
| packages/types | Framework-neutral primitives | Framework/database runtime |
| packages/contract | Runtime wire schemas/inferred types | Persistence |
| packages/lint | Tooling and boundaries | Runtime code |

## 3. Dependency direction
Headquarter → contract/types/UI. ARSY → arsy-core, contract, types, ORM/database, trusted addons. Addons → ORM and declared dependencies. ORM → neutral types/interfaces. orm-db → adapter contract/types. SQL adaptors → adapter contract/Kysely/own driver. Base addon → ORM.
Forbidden: Headquarter imports DB credentials/drivers/schema admin; addons import Kysely/raw SQL; ORM imports concrete providers; Base imports business addons; private cross-addon imports; app-to-app source imports; cycles.

## 4. ARSY composition
Validate config → Fastify → logging/security/correlation → selected DB adapter → ORM/trusted addons → model/BaseEntity composition → schema preflight → one release/setup reconcile → verify → services/routes → ready. Normal replicas verify but do not mutate schema. One serialized release runner applies schema.

## 5. ORM responsibilities
ORM owns model/field metadata, registry/extension, validation, relations, portable query AST, typed model operations, lifecycle, environment/context, capability validation. It does not own SQL, Kysely builders, connections, provider catalogs, or DDL.

## 6. Database runtime
orm-db owns adapter lifecycle, transaction/unit-of-work, schema policy/plan/locks/ledger, data-upgrade checkpoints, drift verification, error normalization, cleanup. It does not own model definitions, SQL syntax, addon transformations.

## 7. Adapters
orm-db-adaptor defines provider-neutral connection/transaction/query/schema contracts, snapshots and capability negotiation. SQLite adapter owns the SQLite System Database connection, mapping, introspection and DDL. PostgreSQL adapter owns the PostgreSQL Business Database pool, mapping, catalog introspection and DDL. Kysely is private to concrete adapters, never owns model registry/domain semantics/BaseEntity. Do not add Drizzle as a second ORM.

## 8. Programmatic schema control
Desired schema comes from trusted TypeScript models; orm-db owns reconciliation; selected adapter owns physical introspection/DDL.
Private ARSY API:
- POST /internal/admin/schema/plan
- POST /internal/admin/schema/reconcile
- POST /internal/admin/schema/verify
- GET /internal/admin/schema/status
Require deployment/operator identity. No arbitrary SQL/user schema. CLI, CI, deployment, HTTP call one SchemaReconciliationService. Adapter applies DDL over its DB connection. This is programmatic sync without handwritten files; physical operations still execute in DB engine.

## 9. Addon contract
Addons declare ID/version/compatibility/dependencies/models/extensions/services/hooks/permissions and optional typed data-upgrade handlers. No routine schema change list. Lifecycle: DISCOVER → VALIDATE → RESOLVE → COMPOSE → PLAN → SAFE RECONCILE → DATA UPGRADE IF REQUIRED → VERIFY → INITIALIZE → READY. Disable/uninstall never silently drops data/tables.

## 10. BaseEntity and mixins
BaseEntity contains exactly id, createdAt, createdById, updatedAt and updatedById. Actor attribution is injected once by the ORM from trusted execution context. Optional mixins: OwnershipAttribution (owner/assignee, not creator), Archiveable (archivedAt/archivedBy), Versioned, Toggleable (active/enabled only if meaningful), SoftDeletable (deletedAt), WorkspaceScoped and CompanyScoped. Domain status, enablement, archive, deletion, ownership and tenant scope differ. AuditEvent is a separate shared append-oriented model/service; SQL mutation + required audit insert share a transaction; external effects use outbox.

## 11. Security and operations
Trusted code only. Server-side least-privilege credentials; separate schema-apply privilege if possible. Enforce tenant/workspace scope. No secrets in records/logs/audit. Bounded retries/timeouts/idempotency. Backups/restore before destructive plans. Preserve unowned objects. Never sync from every ARSY worker.

## 12. Tests
Addon dependency/cycles, model extension/collisions, BaseEntity once, mixins, cross-provider CRUD/relations/constraints/transactions/audit, capability failures, schema determinism/idempotency/locking/recovery, export/import, Fastify/API contracts.

## 13. Project addon
Owns Project, ProjectTask, ProjectMilestone, ProjectMembership, ProjectLabel where required; project-specific fields/services only.

## 14. Intelligent addon
Owns AIProvider, AIModel, ModelCapability, Agent, AgentRole, AgentRun, AgentTask, ToolDefinition, ToolExecution, PromptTemplate, PromptVersion, KnowledgeSource, EvaluationSuite/Run, UsageRecord, CostRecord, GuardrailPolicy. Store references to secrets, never raw keys.

## 15. References
- Kysely: https://kysely.dev/docs/getting-started
- Kysely libSQL dialect: https://github.com/tursodatabase/kysely-libsql
- libSQL: https://github.com/tursodatabase/libsql
- PocketBase BaseModel compatibility reference: https://pkg.go.dev/github.com/pocketbase/pocketbase/models#BaseModel


## 16. v1.3 base platform and ORM target (supersedes earlier short description)
BaseEntity contains id, createdAt, createdById, updatedAt and updatedById. packages/orm-addon-base is one source/release package containing independent addon manifests for core, identity, security, workspace, optional company, audit, events, optional communication/activity, attachment, sequence, settings, localization, transient, import-export, optional integration and taxonomy. The ORM target includes persistent/abstract/transient models, computed/related/translated fields, deterministic extension, domains, recordsets, cache/prefetch, ACL/record rules and field policies. See docs/22 for the canonical ownership/dependency matrix.


## 17. Repository topology reconciliation (authoritative with docs/23)
The canonical workspace globs are apps/* and packages/*. Do not add services/* to pnpm workspace. apps/headquarter is the Next.js frontend; apps/arsy is the only Fastify HTTP backend. An independently deployed worker, if justified, is apps/worker. The tracked services/arsy and services/queue are legacy/stranded duplicates and must be retired only after unique behavior is reviewed.

The repository audit is a dated snapshot, not a timeless inventory. The follow-up inspection in docs/23 section 12 supersedes outdated package-level observations in earlier audit sections. In particular, packages/arsy-core now has a source entrypoint, while its type/build/dependency contract and its integration with apps/arsy still require verification and repair. apps/headquarter currently has Next.js/React dependencies; its lint configuration and quality scripts still require validation. Do not repeat old statements that the Headquarter manifest is a Fastify manifest or that arsy-core has no source entrypoint.

The target package list is not an implementation inventory. packages/orm, orm-db, SQL adapters and ORM addons remain planned until source, tests, typecheck/build evidence exist. docs/23 lists the current inventory and remaining P0 work.

Queue ownership: packages/jobs defines queue-neutral job contracts and idempotency; a future jobs adapter owns BullMQ/Redis specifics. Do not keep a second services/queue service. Do not make Redis/BullMQ mandatory for the first product slice unless asynchronous execution is actually required. The outbox/business record is the source of truth, not the queue transport.

## 18. Programmatic declarations and execution modes
The canonical model definition is a TypeScript declaration inside addon/module source code. The v1 preferred form is a class with static model identity and a static fields descriptor map. This is programmatic declaration, not a separate manually maintained schema file. The ORM normalizes the declarations into immutable metadata and composes them into a deterministic registry.

The detailed declaration, field, relation, Environment, Recordset, System Mode, Runtime Mode, reconciliation and security contract is maintained in docs/22. docs/08 is the architecture overview; docs/22 is the capability blueprint. No document may introduce a second schema/model source of truth.

System Mode discovers trusted packages, resolves modules, composes/validates the registry, produces a deterministic persistence plan, applies authorized changes under a serialized lock, verifies the result, and records a receipt. Runtime Mode serves requests against a verified immutable registry and never performs schema DDL. A normal request must not trigger System Mode.

`env` carries trusted principal, workspace/tenant, company scope, transaction, permissions, locale/timezone, trace context and approved services. `recordset` is the typed collection API bound to one Environment, with consistent empty/single/multiple semantics and batch operations. Prefer explicit `env.models` access as the foundation; convenience class APIs must not hide context or transaction boundaries.

## 19. Database ownership clarification
SQLite is the ARSY System Database for control-plane state: installed plugin/module state, settings, registry fingerprints/snapshots, synchronization receipts and system audit. Its single-writer constraint requires serialized writes and a persistent local volume. PostgreSQL is the primary Business Database for durable business records and concurrent application transactions.

Redis is runtime infrastructure, not authoritative business storage. Disk/S3-compatible storage owns file bytes; business records own attachment metadata. Telegram is a connector, not a database provider. libSQL may be evaluated as an optional lightweight business-data profile, but it does not replace the SQLite System Database role or PostgreSQL production business role.

These provider roles supersede older shorthand in this document that grouped PostgreSQL/libSQL as interchangeable database profiles.


## 20. Decision record
Accepted foundation decisions are recorded in `docs/24-architecture-decision-records.md` (ADR-001–ADR-012). When this document and an ADR diverge, update the relevant ADR and this architecture contract together; do not leave competing provider or ORM definitions.


## 21. Phase 1 package contracts

The initial public contract surfaces and dependency boundaries are documented in [docs/25-phase-1-package-contracts.md](25-phase-1-package-contracts.md). The new packages `@riotworks/orm`, `@riotworks/orm-db-adaptor` and `@riotworks/orm-db` currently contain initial TypeScript contract definitions only. They do not yet implement model declaration factories, registry composition, driver adapters, transaction orchestration or schema reconciliation.

The SQLite adapter package name is `orm-db-adaptor-sqlite`; it is intentionally distinct from any optional libSQL business-data profile. Concrete adapters and base addon packages must be added only with real driver-backed or addon-backed entrypoints and tests, not empty scaffolding.
