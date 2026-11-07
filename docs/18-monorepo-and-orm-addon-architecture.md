# 18 — Monorepo, Fastify Core, Custom ORM & Addon Architecture

**Status:** Approved target architecture  
**Version:** 1.1  
**Updated:** 2026-11-07

## 1. Purpose

This document defines package ownership and dependency boundaries for RIOTWORKS. It prevents an unstructured monolith, duplicated infrastructure fields, direct database coupling, and addons that reimplement framework capabilities.

The architecture takes inspiration from Odoo's metadata-driven model registry and addon composition, while remaining native TypeScript. It is not a source-code port of Odoo and does not promise Odoo API compatibility.

**Schema rule:** addon authors declare models in code. The ORM reconciles the declared schema programmatically. Hand-written schema migration scripts are not required for ordinary model changes. Explicit typed data-upgrade handlers are reserved for transformations whose meaning cannot be inferred safely.

## 2. Workspace model

Use pnpm workspaces. Add a task runner only when the dependency graph justifies it. Use workspace package references, strict TypeScript, package exports, and deterministic build order.

### Applications

| Path | Responsibility |
|---|---|
| apps/headquarter | Frontend application and operator experience |
| apps/arsy | Fastify backend app and composition root |

Headquarter replaces the generic app name web. All docs, scripts, routes, and workspace references must use Headquarter consistently.

### Packages

| Package | Responsibility | Must not own |
|---|---|---|
| packages/arsy-core | Fastify platform core, plugin lifecycle, runtime context | RIOTWORKS business models |
| packages/orm | Metadata ORM, registry, model/query engine, addon composition | Project/AI business models |
| packages/orm-db | Database runtime, schema diff/reconcile, transactions, unit-of-work, schema history | Provider-specific query logic |
| packages/orm-db-adaptor | Provider-neutral adapter contracts, capabilities, registry | PocketBase SDK imports |
| packages/orm-db-adaptor-pocketbase | Concrete PocketBase data/schema adapter and PB artifact generation | Generic ORM semantics |
| packages/orm-addon-base | Shared base entities, active lifecycle, timestamps, audit | Project or AI-specific entities |
| packages/orm-addon-project | Project domain declarations/services | Reimplementation of base fields/audit |
| packages/orm-addon-intelligent | AI/agent domain declarations/services | Plaintext provider secrets |
| packages/types | Framework-neutral TypeScript primitives and shared types | Runtime framework/database imports |
| packages/contract | API/event runtime schemas and inferred wire types | Persistence and business logic |
| packages/lint | Shared lint/format/TS configs and boundary rules | Runtime code |

Canonical namespace: @riotworks/*.

## 3. Dependency direction

Allowed high-level graph:

- apps/headquarter → contract, types, UI packages only.
- apps/arsy → arsy-core, contract, types, ORM/database packages, installed addons.
- arsy-core → neutral types/contracts where needed.
- orm-addon-* → orm and explicitly declared addon dependencies.
- orm → framework-neutral types and adapter-neutral capability interfaces.
- orm-db → orm-db-adaptor and types.
- orm-db-adaptor-pocketbase → orm-db-adaptor, types, PocketBase SDK.
- contract → types.
- lint → tooling only.

Forbidden:
- Headquarter imports database adapters or PocketBase superuser clients.
- ORM imports business addons.
- Base addon imports Project or Intelligent.
- Addons import another addon's private source.
- Contract imports Fastify or database packages.
- Types imports framework-specific packages.
- Apps import each other's source.
- Cyclic workspace dependencies.

Enforce boundaries through lint rules, package exports, workspace graph checks, and tests.

## 4. ARSY runtime composition

apps/arsy should be thin. Its boot path:

1. Parse and validate environment configuration.
2. Create Fastify through arsy-core.
3. Register platform plugins.
4. Register logging, correlation, security, auth, and validation.
5. Initialize database adapter and ORM.
6. Discover and validate trusted addon manifests.
7. Resolve addon dependency graph.
8. Compose complete model metadata, including BaseEntity.
9. Run schema preflight and produce a deterministic plan.
10. Apply allowed schema synchronization through the controlled schema runner.
11. Run required typed data-upgrade handlers.
12. Verify schema fingerprint and addon readiness.
13. Initialize addon services and routes.
14. Mark readiness only when required dependencies are ready.
15. Listen and gracefully shut down.

Respect Fastify plugin encapsulation. Register decorators before consumers and keep module routes in explicit scopes. Avoid mutable global request context.

**Important:** schema synchronization is a single controlled startup/release task guarded by a distributed/advisory lock. Do not let every ARSY replica race to mutate the same schema.

## 5. packages/arsy-core

Provide:
- createArsyApp().
- Typed ArsyRuntimeContext.
- Plugin registration API and dependency ordering.
- Lifecycle hooks.
- Configuration parser/validator.
- Structured logger and request correlation.
- Standard error mapping.
- Health/readiness hooks.
- Graceful cleanup registry.
- Extension points for route modules and service registration.

Do not create a parallel HTTP framework. Fastify is the HTTP engine.

## 6. ORM architecture

### 6.1 Layers

- Metadata: field definitions, model metadata, constraints, relation metadata.
- Registry: installed addons, model lookup, model extension composition.
- Environment: actor, workspace, permissions, locale, trace ID, adapter and transaction.
- Model API: create, search, read, update, archive, restore, allowed delete.
- Query layer: validated domain/query AST and adapter compilation.
- Lifecycle: validation, before/after hooks, base fields, audit dispatch.
- Schema layer: desired schema snapshot, diff, planning, reconciliation, verification.
- DB boundary: adapter-neutral data operations and declared schema/data capabilities.

### 6.2 Declarative models

Use explicit TypeScript builders or static declarations that produce inspectable metadata. Avoid fragile runtime reflection.

    export const Project = defineModel({
      name: "project.project",
      fields: {
        name: fields.string({ required: true, maxLength: 160 }),
        state: fields.selection({
          values: ["draft", "active", "completed"],
          default: "draft"
        })
      }
    });

The API should support compile-time inference where practical and runtime validation for external payloads.

### 6.3 Model extension

An addon may define a new model or extend an existing model declared by a dependency. The registry composes extensions deterministically and rejects duplicate/incompatible fields, missing dependencies, circular dependencies, and ambiguous overrides.

Do not use uncontrolled runtime monkey-patching or arbitrary code execution.

## 7. Programmatic schema reconciliation

The addon model registry is the source of desired schema. A schema reconciler compares it to the actual adapter schema.

Required steps:
1. Produce a stable desired schema snapshot.
2. Read actual schema and adapter capabilities.
3. Calculate field/model/index/relation differences.
4. Classify each change: SAFE_AUTO, REQUIRES_DATA_UPGRADE, DESTRUCTIVE, or UNSUPPORTED.
5. Produce a previewable plan with affected models and records.
6. Apply safe compatible changes through the adapter.
7. Run required typed data-upgrade handlers.
8. Verify resulting schema.
9. Store fingerprints, plan hash, receipts, and errors.

The process must be idempotent. Reconciliation against an already synchronized schema is a no-op.

Modes:
- plan: report drift only.
- safe: apply safe additive/compatible changes.
- strict: fail on unexpected drift.
- off: no schema writes; health reports drift.

Dev defaults to safe; CI checks plan; production runs one serialized release task with backup/readiness checks. Destructive changes never run automatically.

### Safe automatic changes

Subject to adapter capability:
- Create a new collection/table for a registered model.
- Add nullable fields.
- Add fields with explicit safe defaults.
- Add compatible indexes.
- Add optional relations.
- Update non-breaking metadata.

### Changes requiring explicit handling

- Rename requires renamedFrom or explicit mapping.
- Type/precision change requires conversion function.
- Nullable-to-required requires backfill/default and validation.
- Drop field/model/index is destructive and never automatic.
- Relation cardinality/delete behavior change needs impact analysis.
- Split, merge, or change of business meaning needs a typed data-upgrade handler.

No manual SQL migration files are the default addon workflow. A provider may still require a native deployment artifact; such an artifact is generated from the schema plan.

## 8. Database adapter contract

orm-db-adaptor exposes provider-neutral data and schema operations. It must declare capability support for:
- CRUD and bulk operations.
- Filtering, pagination, sort, projection.
- Relations and expansion.
- Joins.
- Transactions.
- Schema introspection.
- Collection/table create/update.
- Field create/alter/rename/drop.
- Index and unique constraint changes.
- Data type and default support.
- Schema artifact generation/application.
- Realtime.
- Soft delete.
- Optimistic concurrency.
- JSON query operations.

Use explicit capability levels or structured support descriptors. The ORM must ask the adapter before using a feature. Unsupported semantics fail with typed errors, not silent approximations.

## 9. PocketBase adapter boundary

PocketBase is a separate Go service. Its collections are backed by SQLite tables but exposed through PocketBase collection/record APIs. The Node adapter uses the official PocketBase SDK/API from the server side; it is not a SQL driver.

Responsibilities:
- Map ORM models/fields to PB collections/fields.
- Map canonical ORM id, createdAt, and updatedAt to PocketBase's corresponding system fields where compatible.
- Manage custom fields such as active, createdBy, and updatedBy through collection definitions.
- Compile only documented filter operations.
- Respect API rules, auth collection semantics, and read-only View collections.
- Use supported collection operations and PocketBase-native migration engine for schema deployment.
- Keep all superuser credentials server-side.
- Report capability limitations accurately.

PocketBase supports programmatic collection operations. With --automigrate enabled, collection configuration changes made through Dashboard or Web API generate native migration files. Those files live in pb_migrations, can be version-controlled, and are applied by PocketBase on serve or through migrate up. RIOTWORKS should generate/capture these artifacts from its schema plans rather than asking addon authors to hand-write them.

Do not directly mutate PocketBase's internal SQLite tables. Do not claim arbitrary SQL joins or remote SDK transaction guarantees. Relation expansion, filtering, realtime, and schema operations must be capability-gated and tested.

## 10. Addon system

Addons declare:
- technical ID and name;
- semantic version and ORM compatibility;
- dependencies and version ranges;
- model declarations/extensions;
- services and lifecycle hooks;
- permissions/capabilities;
- typed data-upgrade handlers only when needed;
- optional route/module registrations.

Lifecycle:
DISCOVER → VALIDATE → RESOLVE → COMPOSE REGISTRY → PLAN SCHEMA → RECONCILE SAFE CHANGES → RUN DATA UPGRADES → VERIFY → INITIALIZE → READY.

Do not apply changes before dependency validation. Do not dynamically load untrusted addons. Uninstall must not silently delete business data.

## 11. BaseEntity and central AuditTrail

orm-addon-base is required and loaded first.

It centrally composes:
- id.
- active (boolean, default true).
- createdAt.
- updatedAt.
- createdBy.
- updatedBy.
- optional version.
- optional archivedAt / archivedBy.

Business addons do not redeclare these fields. The registry injects/composes them and rejects duplicate declarations.

active is independent of domain workflow state. Deactivation/archive is not hard deletion. Normal search excludes inactive records unless explicitly requested and authorized.

Base addon owns AuditTrail and ORM lifecycle creates events for create, update, archive, restore, permitted delete, and sensitive admin actions. Audit includes model, record ID, action, actor, timestamp, source, request/trace ID, changed fields, safe diff, and reason. Redact secrets and sensitive content.

Use a transaction where supported. For non-transactional adapters, use a durable outbox/reconciliation strategy or fail closed for operations requiring guaranteed audit consistency. Do not claim tamper-proof storage without an actual integrity mechanism.

## 12. Required addons

### orm-addon-base
BaseEntity composition, active/archive/restore, timestamps, actor context, AuditTrail, shared safe mixins, and base schema declaration.

### orm-addon-project
Depends on base. Owns Project, ProjectTask, optional milestones, membership, labels, business constraints, and services. It declares business fields only.

### orm-addon-intelligent
Depends on base. Owns AIProvider, AIModel, ModelCapability, Agent, AgentRole, AgentRun, AgentTask, ToolDefinition, ToolExecution, PromptTemplate, PromptVersion, KnowledgeSource, EvaluationSuite/Run, UsageRecord, CostRecord, and GuardrailPolicy. It stores secret references, not raw provider keys.

## 13. Shared packages

- packages/types: framework-neutral TypeScript primitives and branded IDs.
- packages/contract: canonical runtime request/response/event schemas with inferred TS types.
- packages/lint: shared TypeScript, ESLint, formatting, and package-boundary rules.

No duplicate DTOs between Headquarter and ARSY.

## 14. Security and operations

- No raw secrets in Headquarter, code, logs, or audit diffs.
- Least-privilege adapter credentials.
- Workspace isolation at service and query boundaries.
- Validate files and untrusted source text.
- Imported research/listings/prompts are data, never system instructions.
- Rate limits, bounded retries, idempotency, budget guardrails, and kill switch.
- No ARSY replica races for schema application.
- Backups and restore tests precede destructive changes.
- All external actions have receipts and audit records.

## 15. References

- Fastify encapsulation: https://fastify.dev/docs/latest/Reference/Encapsulation/
- Fastify TypeScript: https://fastify.dev/docs/latest/Reference/TypeScript/
- Odoo ORM models/inheritance: https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html
- PocketBase JavaScript migrations: https://pocketbase.io/docs/js-migrations/
- PocketBase collections: https://pocketbase.io/docs/collections/
- PocketBase JavaScript collection operations: https://pocketbase.io/docs/js-collections/

These references inform design constraints; RIOTWORKS remains its own implementation.
