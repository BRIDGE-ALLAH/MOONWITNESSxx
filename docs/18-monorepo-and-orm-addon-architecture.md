# 18 — Monorepo, Fastify Core, Custom ORM & Addon Architecture

**Status:** Approved target architecture  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Purpose

This document establishes package ownership and dependency boundaries for the RIOTWORKS monorepo. It prevents an unstructured monolith, duplicated infrastructure fields, direct database coupling, and addons that reimplement the same capabilities.

The architecture borrows ideas from Odoo's modular model registry and addon composition, while remaining native TypeScript. It is not a port of Odoo and does not promise Odoo API compatibility.

## 2. Workspace model

Recommended workspace: pnpm workspaces with TypeScript project references where they improve build isolation. A task runner can be added when the dependency graph justifies it.

### Applications

| Path | Responsibility |
|---|---|
| apps/headquarter | Frontend application and operator experience |
| apps/arsy | Fastify backend app and composition root |

headquarter replaces the old generic frontend app name web. All docs, scripts, routes, and workspace references must use Headquarter consistently.

### Packages

| Package | Responsibility | Must not own |
|---|---|---|
| packages/arsy-core | Fastify platform core, plugin lifecycle, runtime context | RIOTWORKS business models |
| packages/orm | Metadata ORM, registry, model and query engine, addon composition | Specific Project/AI business models |
| packages/orm-db | DB lifecycle, unit-of-work, transaction and migration orchestration | Provider-specific query logic |
| packages/orm-db-adaptor | Provider-neutral adapter contracts, capabilities, registry | PocketBase SDK imports |
| packages/orm-db-adaptor-pocketbase | Concrete PocketBase implementation | Generic ORM semantics |
| packages/orm-addon-base | Shared base entities, active lifecycle, audit | Project or AI-specific entities |
| packages/orm-addon-project | Project domain | Reimplementation of base fields/audit |
| packages/orm-addon-intelligent | AI/agent domain | Secret storage or provider credentials in plaintext |
| packages/types | Framework-neutral TS primitives and shared types | Runtime validation, Fastify or DB types |
| packages/contract | API/event runtime schemas and inferred wire types | Persistence and business logic |
| packages/lint | Shared lint/format/TS configs and boundary rules | Runtime code |

Canonical package namespace: @riotworks/*. Keep names and directory paths consistent.

## 3. Dependency graph

Allowed high-level graph:

- apps/headquarter → @riotworks/contract, @riotworks/types, UI components.
- apps/arsy → @riotworks/arsy-core, @riotworks/contract, @riotworks/types, ORM/database packages, installed addons.
- @riotworks/arsy-core → neutral types and contracts where needed.
- @riotworks/orm-addon-* → @riotworks/orm and declared addon dependencies.
- @riotworks/orm → framework-neutral types and neutral adapter capability interfaces.
- @riotworks/orm-db → @riotworks/orm-db-adaptor, types.
- @riotworks/orm-db-adaptor-pocketbase → @riotworks/orm-db-adaptor, types, PocketBase SDK.
- @riotworks/contract → @riotworks/types.
- @riotworks/lint → tooling only.

Forbidden:
- Headquarter imports database adapters or PocketBase superuser clients.
- ORM imports business addons.
- Base addon imports Project or Intelligent.
- Addons import another addon's private files.
- Contract imports Fastify or DB packages.
- Types imports framework-specific packages.
- Apps import each other's source.
- Circular package dependencies.

Enforce with lint rules, workspace graph checks, package exports, and tests.

## 4. ARSY runtime composition

apps/arsy should be thin. Its boot path:

1. Parse and validate environment configuration.
2. Create the Fastify instance through arsy-core.
3. Register platform plugins.
4. Register logging, correlation, security, auth, and validation.
5. Initialize database adapter and ORM.
6. Discover and validate trusted addon manifests.
7. Resolve addon dependency graph.
8. Register model metadata/extensions.
9. Apply approved migrations.
10. Initialize addon services.
11. Register application modules/routes.
12. Mark readiness only when required dependencies are ready.
13. Listen.
14. Gracefully drain and close on shutdown.

Respect Fastify's plugin encapsulation. Register decorators before consumers and keep module routes in explicit scopes. Avoid using mutable global request context.

## 5. packages/arsy-core

Provide:
- createArsyApp().
- Typed ArsyRuntimeContext.
- Plugin registration API.
- Lifecycle hooks and dependency order.
- Configuration parser/validator.
- Structured logger and request correlation.
- Standard error mapping.
- Health and readiness hooks.
- Graceful cleanup registry.
- Extension points for module routes and service registration.

Do not create a parallel HTTP framework. Fastify is the HTTP engine.

## 6. ORM architecture

### 6.1 Layers

- **Metadata:** field definitions, model metadata, constraints, relation metadata.
- **Registry:** installed addons, model lookup, model extension composition.
- **Environment:** actor, workspace, permissions, locale, trace ID, adapter and transaction.
- **Model API:** create, search, read, update, archive, restore, allowed delete.
- **Query layer:** validated domain/query AST and adapter compilation.
- **Lifecycle:** validation, before/after hooks, base fields, audit event dispatch.
- **DB boundary:** adapter-neutral operations and declared capabilities.

### 6.2 Declarative definitions

Use explicit TypeScript builders or static declarations that produce inspectable metadata. Avoid depending on fragile runtime reflection.

Example shape:

    defineModel({
      name: "project.project",
      fields: {
        name: fields.string({ required: true }),
        state: fields.selection({
          values: ["draft", "active", "completed"],
          default: "draft"
        })
      }
    });

The exact API must support compile-time inference where practical and runtime validation for external payloads.

### 6.3 Relations

Support relation metadata for belongs-to, has-many, and many-to-many. The ORM relation API must check adapter capability before running joins, eager loads, or relation expansion. Do not promise transparent SQL-like behavior on adapters that expose only HTTP collection APIs.

### 6.4 Query domain

Represent filter conditions as a typed AST with known operators. Validate:
- field exists.
- operator supports the field type.
- value has correct shape.
- user is authorized.
- adapter supports requested semantics.

Compile using safe parameterization or provider-safe filter encoding. Never string-concatenate untrusted values.

### 6.5 Model extension

An addon may:
- define a new model;
- extend an existing model with new fields/constraints/hooks;
- define a new model derived from a registered abstract/base model.

Conflicts must be deterministic. Require explicit extension priority or reject conflicting overrides. Do not use arbitrary runtime monkey-patching.

## 7. Database adapter and PocketBase boundary

orm-db-adaptor defines capability-driven provider contracts. At minimum expose typed support for CRUD, filters, pagination, sort, projection, relations, joins, transactions, schema introspection, migrations, constraints, indexes, realtime, soft delete, optimistic concurrency, and JSON operators.

PocketBase adapter:
- Uses the official server-side PocketBase JS SDK or documented API.
- Connects to a separate PocketBase server.
- Keeps superuser access entirely server-side.
- Maps registered ORM models to PocketBase collections and fields through explicit configuration.
- Compiles only supported filter operations to documented PocketBase filters.
- Honors collection API rules and auth collection semantics.
- Treats View collections as read-only.
- Uses PocketBase-supported migration/deployment tooling for schema.
- Does not directly write to PocketBase's internal SQLite tables.
- Does not claim arbitrary SQL joins or remote SDK transaction guarantees.
- Declares realtime support only when implemented and tested.
- Throws UnsupportedCapabilityError for unsupported features.

A PocketBase adapter is useful for a lightweight, collection-backed persistence path. It is not automatically the right store for every transactional workload. Preserve adapter neutrality so a PostgreSQL adapter can be added for strong transactions, complex reporting, and relational workloads if validation shows it is needed.

## 8. Addon manifest and lifecycle

Manifest contains:
- name / technical ID.
- version.
- description.
- engine compatibility.
- dependencies with version ranges.
- models and extensions.
- migrations.
- services.
- permission declarations.
- optional route/module integration.
- install/upgrade/uninstall hooks with restricted scope.

Install sequence:
DISCOVER → VALIDATE → RESOLVE → REGISTER → MIGRATE → INITIALIZE → READY.

Uninstall must never silently delete business data. Migrations must be ordered, versioned, auditable, and backed up. Do not auto-execute untrusted code downloaded from an addon marketplace.

## 9. Central BaseEntity model

orm-addon-base is a required system addon and is loaded first.

All persisted models receive central base metadata:
- id.
- active (boolean, default true).
- createdAt.
- updatedAt.
- createdBy.
- updatedBy.
- optional version.
- optional archivedAt / archivedBy.

active is independent of domain status such as Project state. Default user-facing searches exclude inactive rows; explicit authorized queries can include them. Archive/restore is centralized. Hard delete is separately restricted.

Do not redeclare those fields in other addons. The registry should inject/compose shared metadata and reject duplicates.

## 10. Central AuditTrail

The base addon owns a shared audit event model/service and the ORM lifecycle invokes it automatically.

Audit events cover create, update, archive, restore, permitted delete, and sensitive admin actions. Store model, record ID, action, actor, time, source, request/trace ID, changed fields, safe diff, and reason/metadata.

Do not store raw credentials, tokens, private keys, or sensitive content in audit diffs. Audit operations need access control and append-only application behavior. Use transactions where supported. For non-transactional adapters, explicitly implement an outbox/reconciliation strategy or block operations requiring atomicity. No false "tamper-proof" claim.

## 11. Addon package definitions

### orm-addon-base
- Required root addon.
- BaseEntity metadata and model composition.
- Active/archive/restore lifecycle.
- timestamps and actor context.
- centralized AuditTrail.
- common safe mixins.

### orm-addon-project
- Depends on base.
- Project, ProjectTask, optional Milestone, membership, labels.
- Own fields only; no base field duplication.

### orm-addon-intelligent
- Depends on base.
- AIProvider, AIModel, capability, Agent, AgentRole, AgentRun, AgentTask, ToolDefinition, ToolExecution, PromptTemplate, PromptVersion, KnowledgeSource, EvaluationSuite/Run, UsageRecord, CostRecord, GuardrailPolicy.
- Secret values live in secret management; ORM stores only safe references and metadata.

## 12. Shared types and contracts

packages/types contains stable, framework-neutral types and branded IDs.

packages/contract contains the canonical runtime schemas for API request/response/events. Infer TS types from those schemas. Fastify uses the schemas for validation/serialization; Headquarter uses inferred types and API client helpers. Avoid duplicate interfaces drifting across frontend and backend.

packages/lint contains common TypeScript, ESLint, formatting, and boundary rules.

## 13. Security and operational behavior

- No raw secret in Headquarter, code, logs, or audit diffs.
- Least-privilege adapter credentials.
- Workspace/tenant isolation at service and query boundaries.
- Validate file uploads and untrusted source text.
- Treat imported research, marketplace listings, and prompts as untrusted data, never system instructions.
- Rate limit external integrations.
- Bounded retries and idempotency.
- Kill switch for channels and workflows.
- Approval for first publication, spending, price changes outside policy, payout/account/tax changes, legal declarations, and irreversible actions.

## 14. References

- Fastify plugin architecture and encapsulation: https://fastify.dev/docs/latest/Reference/Encapsulation/
- Fastify TypeScript: https://fastify.dev/docs/latest/Reference/TypeScript/
- Odoo ORM models and model inheritance: https://www.odoo.com/documentation/19.0/developer/reference/backend/orm.html
- PocketBase collections: https://pocketbase.io/docs/collections/
- PocketBase usage and server-side integration guidance: https://pocketbase.io/docs/how-to-use/

References provide design inspiration and implementation constraints; RIOTWORKS remains its own implementation.
