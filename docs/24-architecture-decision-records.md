# 24 — Architecture Decision Records: ARSY Platform Foundation

**Status:** Accepted architecture decisions  
**Updated:** 2026-11-07  
**Scope:** ARSY plugin runtime, lifecycle, ORM declarations, System Mode, deployment, provider ownership and public plugin ecosystem.

These ADRs record the current decisions approved for MOONWITNESS. They are architecture constraints for implementation, not claims of completed code. A future change must supersede the relevant ADR explicitly rather than silently contradicting it.

## ADR-001 — Hybrid plugin execution

**Status:** Accepted

**Decision**
- Trusted first-party and explicitly verified plugins may execute in-process.
- Riskier, community or externally supplied plugins execute in an isolated process/service boundary.
- In-process plugins receive only granted ARSY capabilities; they do not receive unrestricted infrastructure access by default.
- Worker Threads are not considered a security sandbox.
- The public ecosystem must not imply that arbitrary packages are safe to load into the API process.

**Consequences**
- Plugin manifests declare permissions, capabilities, compatibility and trust metadata.
- Isolated plugins use versioned RPC contracts and bounded timeouts.
- ORM registry contributions from executable code are restricted to trusted in-process packages.

## ADR-002 — Hybrid plugin lifecycle

**Status:** Accepted

**Decision**
- Safe configuration changes may hot reload when the capability explicitly supports it.
- Credential rotation and connector reinitialization may occur through controlled lifecycle operations.
- Code, dependency, model-registry, schema or incompatible provider changes require a controlled restart/System Mode operation.
- Runtime registry snapshots are immutable after activation.

**Consequences**
- Every plugin capability declares whether its configuration can be hot-applied.
- Lifecycle transitions are observable and auditable.
- No arbitrary live mutation of model classes or registry metadata.

## ADR-003 — Programmatic declaration-based ORM

**Status:** Accepted; supersedes any earlier interpretation of schema-first/code-first ORM.

**Decision**
- Models, fields, relations, constraints, computed behavior and extensions are declared programmatically in TypeScript source code.
- The preferred v1 syntax is a model class with stable static identity and a static field descriptor map.
- No separate manually maintained schema file or schema DSL is introduced as a second source of truth.
- Metadata is normalized from declarations and composed by the ARSY registry.
- Physical SQL schema is a projection of the composed registry.

**Consequences**
- The ORM must inspect declarations without constructing record instances.
- Type inference should derive create/read/update types from field descriptors.
- Property decorators may be optional syntax sugar later, not a second metadata path.
- Prisma/Drizzle or another ORM must not become a parallel model registry.

## ADR-004 — Deterministic model registry and extension

**Status:** Accepted

**Decision**
- Addon/module dependencies, model declarations, inheritance and extensions compose into one deterministic registry per runtime.
- Registry order is derived from validated dependency ordering and explicit extension rules, never filesystem discovery order.
- Field/method conflicts and incompatible overrides fail registry composition.
- Active registry metadata is immutable.

**Consequences**
- Registry snapshots receive stable fingerprints.
- Module enable/disable/upgrade operations run through System Mode.
- Disabling an addon never implies deleting its stored business data.

## ADR-005 — System Mode and Runtime Mode separation

**Status:** Accepted

**Decision**
- System Mode performs trusted package discovery, manifest validation, dependency resolution, registry composition, persistence planning, authorized reconciliation, semantic upgrades, verification and receipt recording.
- Runtime Mode serves API and worker operations against an already verified registry.
- Normal HTTP requests never run schema DDL.
- Schema application is serialized by one deployment/system lock; API replicas do not race to reconcile.

**Consequences**
- System Mode is exposed through explicit CLI/maintenance/operator entry points.
- Runtime readiness depends on registry/database compatibility.
- Interrupted system operations must be recoverable and idempotent.

## ADR-006 — Environment and Recordset as primary runtime APIs

**Status:** Accepted

**Decision**
- `env` is the scoped execution context for transaction, principal, workspace/tenant, optional company, permissions, locale/timezone, trace metadata and approved services.
- `recordset` is a typed collection bound to one model and one Environment, with predictable empty/single/multiple semantics and batch operations.
- Explicit `env.models` access is the foundational model access API.
- Static/class convenience APIs may exist only as wrappers that preserve Environment and transaction semantics.

**Consequences**
- Recordsets cannot be mixed across incompatible tenants, registries, principals or transactions.
- Relation access, batch reads/writes and prefetch must enforce the same access policies.
- Model methods must not bypass ARSY capabilities through raw database access.

## ADR-007 — SQLite System Database and PostgreSQL Business Database

**Status:** Accepted

**Decision**
- SQLite is the ARSY System Database for control-plane state, plugin/module installation state, system settings, registry fingerprints/snapshots, synchronization receipts and system audit.
- PostgreSQL is the primary Business Database for durable business records and concurrent application transactions.
- Redis is runtime infrastructure, not durable business storage or model-definition source of truth.
- Local disk and S3-compatible storage own file bytes; business records own attachment metadata.
- Telegram is a connector, not a database provider.
- libSQL may be evaluated as an optional lightweight business-data profile, but does not replace the SQLite System Database role or PostgreSQL production default.

**Consequences**
- SQLite writes are serialized; WAL, busy timeout, persistent volume, backup and integrity checks are required.
- Do not use shared network storage as a multi-writer SQLite cluster.
- Do not assume a distributed transaction between SQLite and PostgreSQL.
- Cross-boundary operations require explicit orchestration and idempotent recovery.

## ADR-008 — Safe programmatic schema reconciliation

**Status:** Accepted

**Decision**
- Desired persistence state is generated from the composed TypeScript model registry.
- ARSY produces deterministic plan, reconcile, verify and status operations.
- Additive safe changes may be applied automatically under policy.
- Destructive changes, type narrowing, relation semantic changes, drops and data transformations require explicit operator approval and recovery readiness.
- Removing a declaration or disabling a module never silently drops data.
- Semantic data upgrades use versioned TypeScript handlers owned by the module.

**Consequences**
- Schema plans and receipts are stored in the System Database.
- Provider adapters own physical introspection and DDL.
- Routine hand-authored SQL migration files are not required for ordinary additive changes.
- Every apply operation is serialized, auditable and recoverable.

## ADR-009 — Single-VPS-first deployment

**Status:** Accepted

**Decision**
- The first deployment target is one VPS.
- API and Worker may be separate processes/deployment units on that VPS.
- Architecture boundaries must not assume one process forever; stateful coordination and provider contracts remain explicit.
- Multi-node deployment is a later expansion after backup, locking, observability and recovery behavior are proven.

**Consequences**
- SQLite System Database remains single-writer and local-volume backed.
- Redis may coordinate API/Worker processes where needed.
- Do not introduce distributed complexity before a concrete scaling requirement exists.

## ADR-010 — Public plugin ecosystem with trust controls

**Status:** Accepted

**Decision**
- The long-term plugin ecosystem is public.
- Package distribution requires publisher identity, signatures/digests, provenance, compatibility metadata, permission declarations and revocation/quarantine controls.
- Least privilege is the default; wildcard permissions are not granted by default.
- Community plugins are isolated by default.
- Only trusted verified in-process plugins may contribute executable TypeScript model declarations to the main registry.

**Consequences**
- Marketplace publication and plugin installation are separate trust decisions.
- Plugin upgrades and disablement preserve owned data unless an explicit approved data-retention operation says otherwise.
- Public distribution is not a reason to weaken runtime isolation.

## ADR-011 — No Odoo API compatibility promise

**Status:** Accepted

**Decision**
- Odoo is a design reference for module registry, declarations, inheritance/extensions, environment, recordsets and mixins.
- ARSY is a TypeScript-native design and does not promise API compatibility, database compatibility, or drop-in addon compatibility with Odoo.

**Consequences**
- Adopt concepts where useful; redesign APIs around TypeScript typing, explicit transactions, tenant isolation and capability contracts.
- Documentation must distinguish inspiration from compatibility.

## ADR-012 — SQLite/PostgreSQL provider capability boundaries

**Status:** Accepted

**Decision**
- Shared ORM semantics are limited to an explicitly tested portable capability subset.
- Provider-specific features such as advanced locking, JSON operators, partial indexes, full-text search and generated columns are capability-gated.
- Unsupported operations fail explicitly rather than silently degrading.

**Consequences**
- Adapter contract tests run against each supported provider.
- A provider switch is a data export/import and verification exercise, not a connection-string change.
