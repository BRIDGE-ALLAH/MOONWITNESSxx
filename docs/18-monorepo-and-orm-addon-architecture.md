# 18 — Monorepo, Fastify Core, Custom ORM & Addon Architecture

**Status:** Approved target architecture | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Canonical decisions
One Fastify backend (ARSY), one custom TypeScript metadata ORM, one provider-neutral DB contract, PostgreSQL/libSQL providers, Kysely internal to adapters, code-first schema reconciliation through private ARSY API, minimal BaseEntity, opt-in mixins. PostgreSQL is production recommendation; libSQL is lightweight/single-node. PocketBase is not a v1 persistence provider.

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
| packages/orm-db-adaptor-libsql | libSQL client, SQLite mapping, introspection, DDL, Kysely dialect | ORM metadata |
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
orm-db-adaptor defines CRUD/query/schema contracts, snapshots, transaction interface, capabilities, type mapping, errors, registry. libSQL adapter owns libSQL client, SQLite mapping/introspection/DDL/Kysely libSQL dialect. PostgreSQL adapter owns pg pool, type mapping/catalog introspection/DDL/Kysely PostgreSQL dialect. Kysely is private to adapters, never owns model registry/domain semantics/BaseEntity. Do not add Drizzle as second ORM.

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
BaseEntity contains id, createdAt, updatedAt only. Optional mixins: OwnershipAttribution (createdBy/updatedBy), Archiveable (archivedAt/archivedBy), Versioned, Toggleable (active/enabled only if meaningful), SoftDeletable (deletedAt). Domain status, enablement, archive, deletion differ. AuditTrail is one shared service/model; SQL mutation + audit share transaction; external effects use outbox.

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
