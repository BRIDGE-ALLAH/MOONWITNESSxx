# 08 — Technical Architecture: Headquarter, ARSY, ORM, and Addons

**Status:** Approved target architecture  
**Version:** 1.1  
**Updated:** 2026-11-07

## 1. Architecture goals

- Modular TypeScript monorepo.
- Headquarter is the frontend; ARSY is the Fastify backend.
- Reusable Fastify platform core.
- Custom Odoo-inspired metadata-driven ORM and addon registry.
- Provider-neutral database contracts.
- PocketBase adapter with truthful capability boundaries.
- Shared base fields and audit trail.
- Provider-agnostic AI runtime.
- Secure asset provenance and financial history.
- Local-first friendly, deployable with Docker Compose.
- No cross-layer leakage or cyclic package dependencies.

## 2. Applications

### apps/headquarter
User-facing frontend and RIOTWORKS command experience. It consumes typed API contracts and does not access ORM, database adapters, PocketBase superuser APIs, or provider secrets directly.

Recommended direction: Next.js App Router, React, TypeScript, Tailwind CSS, and the RIOTWORKS design system.

### apps/arsy
Fastify backend application and composition root. It loads configuration, arsy-core, infrastructure plugins, ORM/database, installed addons, and versioned API routes. It contains wiring and app-specific configuration, not reusable framework internals or duplicate domain models.

## 3. Core package map

### packages/arsy-core
Fastify-based platform core:
- Application factory and typed runtime context.
- Plugin registration and dependency order.
- Lifecycle and graceful shutdown.
- Configuration validation.
- Shared errors and response mapping.
- Request correlation and structured logging.
- Health/readiness support.
- Security plugin extension points.

It is not the business domain layer and does not own Project or Intelligent models.

### packages/orm
Custom TypeScript ORM:
- Field and model metadata.
- Model registry.
- Declarative models and extensions.
- Addon registry and dependency resolver.
- Environment/context.
- Domain/query AST.
- Query capability validation.
- Lifecycle hooks and unit-of-work integration.
- Model-level validation and typed errors.

Inspired by Odoo's modular model/addon patterns; not a source-code fork or compatibility clone.

### packages/orm-db
Database runtime:
- Adapter lifecycle.
- Connection/client management.
- Transaction abstraction.
- Unit-of-work coordination.
- Programmatic schema reconciliation, deterministic schema plans, adapter-specific schema application, and typed data-upgrade coordination.
- Health checks and provider error normalization.

### packages/orm-db-adaptor
Provider-neutral adapter contracts:
- CRUD/query interfaces.
- Adapter capabilities.
- Transaction and schema-management capability declarations, including introspection, create/update collection, add/alter/rename/drop field, index changes, and provider-native artifact generation.
- Adapter factory/registry.
- Query and result contracts.
- Typed unsupported-capability errors.

### packages/orm-db-adaptor-pocketbase
First concrete PocketBase adapter. Uses the official PocketBase JS SDK or documented API from the server side. PocketBase is a separate Go service with collection APIs and SQLite-backed collections; it is not a Node SQL driver.

The adapter must respect collection rules and limitations. It must not invent arbitrary SQL joins or general-purpose transaction guarantees. View collections are read-only. Relation expansion, filtering, realtime, and schema operations must be capability-gated and tested. The ORM compiles addon model metadata into PocketBase collection changes. PocketBase's supported collection operations and native automigrate/migration engine generate versioned schema artifacts; do not mutate internal SQLite tables. Addon authors do not hand-write migration scripts for ordinary field additions.

### packages/orm-addon-base
Automatically installed foundational addon:
- BaseEntity metadata.
- Common id, active, timestamps, and actor fields.
- Active/archive/restore lifecycle.
- Central AuditTrail model and service.
- Shared base mixins and validation.

Business addons must not repeat these fields or implement their own duplicate audit mechanism.

### packages/orm-addon-project
Project domain models and services. Depends on base.

### packages/orm-addon-intelligent
AI/agent domain models and services: provider/model definitions, agents, tasks/runs, tools, prompts, knowledge sources, evaluations, and usage/cost. Depends on base. It should depend on project only where there is a real domain dependency.

### packages/types
Framework-agnostic TypeScript primitives, branded IDs, enums, and shared value types. No Fastify, database, or browser runtime.

### packages/contract
Runtime request/response/event schemas and API contracts. Infer static TypeScript types from the runtime schema source; avoid duplicated DTO definitions.

### packages/lint
Shared lint, format, TypeScript and import-boundary configuration. It is tooling, not a runtime dependency.

## 4. Dependency direction

apps/headquarter → packages/contract, packages/types, UI components only.

apps/arsy → packages/arsy-core, packages/contract, packages/types, ORM/database packages, installed addons.

packages/arsy-core → neutral types and contracts where needed.

packages/orm-addon-* → ORM and declared addon dependencies.

packages/orm → framework-neutral types and neutral adapter capability interfaces.

packages/orm-db → adapter contracts.

packages/orm-db-adaptor-pocketbase → adapter contracts and PocketBase SDK.

packages/contract → shared types.

packages/lint → no runtime imports.

Forbidden:
- Headquarter importing database adapters or PocketBase superuser clients.
- ORM importing business addons.
- Base addon importing Project or Intelligent.
- Addons importing another addon's private source.
- Contracts importing Fastify or DB packages.
- Types importing framework-specific packages.
- Apps importing each other's source.
- Circular package dependencies.

## 5. Fastify runtime

Use supported Fastify v5 APIs and plugin encapsulation. apps/arsy creates the root instance through arsy-core, then registers infrastructure, decorators, hooks, domain services, addon routes, and API routes in deterministic order.

Use schema-based request validation and response serialization. Share request/response definitions through packages/contract. Route handlers should delegate to application services, not contain persistence logic or call provider SDKs directly.

Provide:
- /health/live
- /health/ready
- /api/v1/*
- Central error mapping.
- Request/trace correlation.
- Structured logs.
- Authentication and authorization plugin boundaries.
- Rate limits and CORS/CSRF policies appropriate to deployment.
- Graceful shutdown and resource disposal.

## 6. ORM design

The ORM must provide metadata-driven fields, models, relations, model registration, query/domain expressions, typed CRUD, lifecycle hooks, and addon model extension.

Field families initially include string, text, boolean, integer, float, decimal, date, datetime, JSON, selection, ID, and relations. Decimal/money values must preserve precision.

The ORM validates queries against field metadata and adapter capabilities. No unsafe dynamic query strings. Unsupported semantic operations fail explicitly.

## 7. Database adapter capability model

Each adapter declares support for:
- CRUD and bulk operations.
- Filtering and operators.
- Pagination, sort, projection.
- Relations and expansion.
- Joins.
- Transactions.
- Schema introspection and managed schema operations.
- Unique constraints and indexes.
- Realtime.
- Soft delete.
- Optimistic concurrency.
- JSON queries.

The ORM checks capabilities before running a feature. Adapter tests must verify both supported and rejected behavior.

### PocketBase-specific boundary

PocketBase collections use SQLite tables internally but expose PocketBase collection/record APIs. A remote Node adapter must not pretend it has direct SQL semantics. Do not expose arbitrary SQL, cross-collection joins, or transaction guarantees unless separately implemented through an official verified PocketBase mechanism. View collections are read-only. The ORM schema reconciler compiles addon model declarations into supported PocketBase collection operations. With PocketBase automigrate enabled, collection configuration changes through the Dashboard or Web API generate native migration files; PocketBase also supports programmatic collection operations in its JavaScript migration runtime. Keep generated pb_migrations artifacts in version control and apply them through the PocketBase migration engine. Do not hand-write addon migration scripts for ordinary schema changes and do not mutate internal SQLite tables.

For critical writes that require atomic mutation plus audit, require a transaction-capable path or use a documented durable outbox/reconciliation design. Never silently accept an audit gap.

## 8. Addon runtime

Addons declare manifest, technical name, version, dependencies, model definitions/extensions, optional typed data-upgrade handlers, services, permissions, and optional app integration points. Schema changes are inferred from registered model metadata.

Load sequence:
DISCOVER → VALIDATE → RESOLVE DEPENDENCIES → COMPOSE MODEL REGISTRY → PLAN SCHEMA DIFF → APPLY SAFE SCHEMA SYNC → RUN REQUIRED DATA UPGRADES → VERIFY → READY.

Reject missing/circular dependencies, duplicate model/field declarations, incompatible versions, unsafe extension collisions, and untrusted code. Do not dynamically execute downloaded addon code.

## 9. Shared BaseEntity and audit

The base addon centrally provides:
- id.
- active (boolean, default true).
- createdAt.
- updatedAt.
- createdBy.
- updatedBy.
- version when supported.
- optional archivedAt / archivedBy.

active is independent from a model's business state. Ordinary listings exclude inactive records unless explicitly requested. Deactivation is not a hard delete.

The central AuditTrail records create, update, archive, restore, permitted delete, and sensitive administrative changes. It includes model, record ID, action, actor, timestamp, request/trace ID, source, changed field names, safe before/after diff, and reason/metadata.

The ORM/base addon must create audit records automatically; addons do not reimplement audit code. Redact secrets and sensitive data. Use adapter transactions where available; otherwise require an explicit consistency strategy or fail closed for operations requiring guaranteed audit atomicity.

## 10. Addon responsibilities

- orm-addon-base: shared base mixins/entities/audit.
- orm-addon-project: Project, ProjectTask, milestones/labels/membership where required.
- orm-addon-intelligent: AI provider/model, capability, agent, role, task, run, tool, prompt/version, knowledge source, evaluation, usage, and cost records.

An addon only declares its business-specific fields. Base fields are inherited/composed automatically.

## 11. Runtime and deployment

Use pnpm workspaces and a simple monorepo build graph. A task runner is optional. Keep app and package versions aligned through workspace references and lockfile.

Environment:
- Validated config at startup.
- .env.example contains names and safe placeholders only.
- Secrets stay server-side.
- No credentials in frontend bundles, source control, or logs.

Deployment target is Docker Compose / Coolify-compatible. PocketBase may run as its own service and persistent volume. Ensure backups include PocketBase data, uploaded files, generated pb_migrations artifacts, and required configuration. Verify restore procedures.

## 12. Testing and observability

- Package unit tests.
- ORM registry/model/field/query tests.
- Addon dependency and conflict tests.
- BaseEntity automatic field tests.
- Audit lifecycle/failure tests.
- PocketBase adapter contract and capability tests.
- Fastify injection tests.
- Shared API contract tests.
- Permission and workspace isolation tests.
- Graceful shutdown tests.
- Structured logs and trace IDs for API, jobs, adapter actions, and addon lifecycle.

## 13. Implementation boundary

Headquarter visual prototype can be built independently using mock data. Production backend work proceeds as separate milestones. Never claim a feature is integrated until Headquarter calls a real ARSY endpoint and an integration test proves it.
