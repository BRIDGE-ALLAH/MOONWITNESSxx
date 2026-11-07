# MOONWITNESS — ARSY ORM & System Mode Implementation TODO

> **Status:** Proposed implementation backlog  
> **Scope:** Programmatic declaration-based ORM, Odoo-inspired model system, ARSY System Mode, persistence synchronization, and the minimum foundations required to ship them safely.  
> **Baseline:** Repository audit in `docs/23-repository-audit-and-current-execution-plan.md`; ORM capability target in `docs/22-base-platform-and-orm-capability-blueprint.md`.  
> **Important:** This file is a task plan, not evidence that any item is implemented. Check an item only after code, tests, typecheck/build evidence, and relevant documentation are present.

---

## 0. Architecture contract — decisions to preserve

These rules govern every task below. A task must not silently change them.

### 0.1 ORM philosophy

- [ ] **Programmatic declaration is the canonical model definition.** Models, fields, relations, constraints, computed behavior, and extensions are declared in TypeScript source code.
- [ ] Do not introduce a separate hand-maintained schema language/file as a second source of truth.
- [ ] Do not introduce Prisma, Drizzle, or another ORM as a parallel model registry.
- [ ] Runtime metadata is derived from trusted code declarations and composed by the ARSY registry.
- [ ] Physical SQL schema is a persistence representation of the composed model registry, not the canonical model definition.
- [ ] Keep SQL dialects, database connections, physical DDL, and SQL compilation outside the ORM package.
- [ ] Kysely may be used internally by SQL adapters only. Its types and instances must not leak into addon/model APIs.

### 0.2 Declaration API direction

The first implementation should standardize one TypeScript-native declaration style. Preferred initial shape:

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

- [x] Confirm this static declaration map as the v1 canonical syntax because it is explicit, introspectable, and avoids relying on JavaScript instance-field initialization.
- [x] Keep the declaration inside the model class/module source; it is not a separate schema file or database-first workflow.
- [ ] Add TypeScript inference so field declarations determine create, update, read, and relation types.
- [ ] Consider property-decorator syntax only as optional ergonomic sugar after the canonical registry works. It must normalize into the same metadata contract and must not create a second declaration system.
- [ ] Do not make property decorators or experimental TypeScript compiler flags a prerequisite for v1.

### 0.3 Model and module semantics

- [ ] Model identity is a stable technical name such as `crm.customer`, not a TypeScript class name.
- [ ] Support persistent, abstract, and transient model kinds.
- [ ] Support extending an existing model, defining a new model from an abstract base, and explicit relation-backed composition.
- [ ] Resolve addon/module dependencies and model extensions deterministically.
- [ ] Reject ambiguous field collisions, incompatible overrides, dependency cycles, and undeclared cross-addon imports.
- [ ] Do not rely on arbitrary runtime monkey-patching.
- [ ] Model classes and registry metadata are immutable after a runtime registry is activated.

### 0.4 Runtime API direction

- [ ] `env` is the scoped execution context: transaction, principal, tenant/workspace, company, locale/timezone, permissions, trace/request metadata, and service access.
- [ ] `recordset` is a typed collection facade with consistent empty/single/multiple behavior and batch operations.
- [ ] Model methods operate on recordsets where that improves vectorization and avoids one-record-at-a-time N+1 behavior.
- [ ] Prefer explicit `env.models` access as the foundational API; static/class convenience methods may delegate to the active environment but must not hide transaction or tenant context.
- [ ] No model method may bypass access policies by using a raw adapter connection.

### 0.5 System Mode and Runtime Mode

- [ ] **System Mode** discovers trusted packages, validates manifests, resolves module dependencies, composes the model registry, validates metadata, plans persistence changes, applies approved changes, and records an installation/synchronization receipt.
- [ ] **Runtime Mode** serves requests and executes model operations using an already-built, verified, immutable registry.
- [ ] Normal HTTP requests must never trigger schema reconciliation.
- [ ] API replicas must not race to apply schema changes on startup.
- [ ] System Mode operations must be serialized by a deployment/system lock.
- [ ] Runtime readiness must fail or enter a clearly defined maintenance/degraded state when the installed registry and required database state are incompatible.

### 0.6 Persistence and provider boundaries

- [ ] SQLite is the System Database/control-plane store for plugin/module installation state, system configuration, registry snapshots/fingerprints, synchronization receipts, and system audit.
- [ ] PostgreSQL is the primary Business Database for application/business records.
- [ ] Redis is shared runtime infrastructure (cache, coordination, locks, queue transport as configured), not the source of truth for model definitions or business records.
- [ ] Local disk and S3-compatible object storage handle files; file metadata belongs to the owning business model/database.
- [ ] Telegram and similar integrations are connectors, not database providers.
- [ ] Keep system database and business database ownership separate. Do not assume a distributed transaction exists between SQLite and PostgreSQL.
- [ ] Reconcile older docs that describe libSQL as the only lightweight/system provider with the approved SQLite control-plane decision before implementation.

### 0.7 Change safety

- [ ] Additive, deterministic, non-destructive changes may be eligible for automated application.
- [ ] Destructive changes, narrowing types, dropping fields/tables, changing relation semantics, or transforming existing business data require an explicit plan and operator approval.
- [ ] Never drop a column/table just because a declaration disappeared or an addon was disabled.
- [ ] Semantic data upgrades use versioned TypeScript upgrade handlers, not a routine hand-authored SQL migration-file workflow.
- [ ] Every applied system change has a plan, lock, actor, code/registry fingerprint, result, and recovery information.

---

## 1. Phase 0 — Align architecture documents and repository baseline

### 1.1 Resolve conflicting architecture statements

- [x] Review `docs/08-technical-architecture.md`, `docs/18-monorepo-and-orm-addon-architecture.md`, `docs/22-base-platform-and-orm-capability-blueprint.md`, and `docs/23-repository-audit-and-current-execution-plan.md`.
- [x] Update docs/08 so its ORM description explicitly says programmatic TypeScript model declarations + composed registry + System Mode; avoid wording that implies a separate schema-first workflow.
- [x] Update docs/08 provider roles to distinguish SQLite System Database from PostgreSQL Business Database.
- [x] Keep docs/22 as the detailed ORM capability contract; link to it from the architecture overview.
- [x] Keep docs/23 as the authoritative repository implementation inventory; do not mark planned packages as implemented.
- [x] Record approved decisions as ADRs: declaration-based ORM, registry composition, System/Runtime Mode, environment/recordset, safe reconciliation, system/business DB split, and external plugin execution boundary.
- [x] Add a glossary for Model, Field, Module, Addon, Plugin, Provider, Registry, Environment, Recordset, System Mode, Runtime Mode, Schema Plan, and Upgrade Handler.
- [x] Document which Odoo concepts are adopted and which are intentionally redesigned for TypeScript; do not promise Odoo API compatibility.

**Acceptance criteria**
- [ ] No canonical document describes a separate manually maintained schema file as the model source of truth.
- [ ] Provider responsibilities are consistent across docs.
- [ ] The repository audit remains explicit about what is not implemented.
- [ ] Every architecture decision has one canonical home and cross-links rather than contradictory duplicated definitions.

### 1.2 Repair the monorepo before ORM feature work

- [x] Fix the Headquarter package identity/scripts/dependencies so its Next.js source and package manifest agree.
- [~] `packages/arsy-core` now has a source entrypoint, but `apps/arsy` still does not compose through it; define and verify that integration before marking complete.
- [x] Remove the UI package from the ARSY backend dependency graph.
- [x] Confirm `apps/arsy` as the only canonical HTTP backend application.
- [ ] Review the duplicate `services/arsy` and `services/queue` code; extract useful behavior, then retire duplicates deliberately.
- [~] Repair root pnpm/Turbo scripts and package task dependencies; root scripts are corrected, but full task graph verification remains.
- [~] Ensure lint, typecheck, test, and build commands are deterministic and fail-fast; initial lint/root test wiring is prepared, but the full matrix is not yet verified.
- [ ] Establish package naming convention consistently, including the existing `adaptor` spelling if retained.
- [~] Add/verify root `.gitignore`, `.dockerignore`, environment examples, and package export conventions; `.dockerignore` is added, remaining paths/exports still need verification.
- [ ] Add CI checks for install, lint, typecheck, unit tests, and build on the canonical workspace.
- [ ] Capture a clean baseline report before creating ORM packages.

**Acceptance criteria**
- [ ] A clean checkout can install dependencies and run the documented verification commands.
- [ ] No package imports a missing entrypoint.
- [ ] No duplicate ARSY/queue runtime is accidentally included in the workspace.
- [ ] CI reports actual failures rather than masking them.

---

## 2. Phase 1 — Define package boundaries and public contracts

Create only packages with real ownership and entrypoints. Avoid empty placeholder packages.

### 2.1 Target package responsibilities

- [~] `packages/orm`: public metadata contracts and workspace manifest/export map exist; deterministic composer added in `src/registry.ts`. Phase 2 declaration/field runtime, tests and deep immutability remain.
- [~] `packages/orm-db-adaptor`: provider-neutral SPI and workspace manifest/export map exist; contract tests, provider adapters and consumer verification remain.
- [~] `packages/orm-db`: UnitOfWork, planner/reconciler, receipt/store, risk policy and semantic UpgradeHandler contracts plus workspace manifest exist; orchestration implementation and tests remain.
- [ ] `packages/orm-db-adaptor-postgres`: implement PostgreSQL pool/driver integration, type mapping, introspection, DDL and query execution after SPI verification.
- [ ] `packages/orm-db-adaptor-sqlite`: approved package name for the SQLite System Database adapter; implement connection lifecycle, mapping, introspection, DDL and system-store operations after SPI verification.
- [ ] `packages/arsy-core`: ARSY application lifecycle, plugin composition, runtime context, logging, health, and service container.
- [ ] `packages/orm-addon-base`: independently installable base addon manifests and their models/services/policies.
- [ ] Keep `packages/types` framework/database-neutral.
- [ ] Keep `packages/contract` for API/event wire contracts, not ORM persistence definitions.

### 2.2 Define contracts before implementation

- [x] Define `ModelConstructor`, `ModelDefinition`, `ModelKind`, `FieldDefinition`, `RelationDefinition`, `MixinDefinition`, and `ModelExtensionDefinition` shapes.
- [x] Define separate `AddonManifest` and `ModuleManifest` contracts in `@riotworks/orm`.
- [x] Define package/module IDs, semantic versions, compatibility ranges, dependencies, conflicts, capabilities and public entrypoint metadata in the initial manifest contracts.
- [x] Define `RegistrySnapshot` shape and implement deterministic addon/module ordering, composition and SHA-256 fingerprint in `packages/orm/src/registry.ts`; automated tests and deep immutability verification remain.
- [x] Define provider capability vocabulary and explicit `requireCapabilities` rejection in `@riotworks/orm-db-adaptor`.
- [~] Define initial ORM declaration/registry/access/validation/provider error codes; concurrency and reconciliation error taxonomy remain.
- [~] Add explicit package export maps for the three ORM/persistence packages; addon-facing API/internal boundary enforcement and export consumer fixture remain.
- [~] Add explicit export maps for `@riotworks/orm`, `@riotworks/orm-db-adaptor`, and `@riotworks/orm-db`; dependency-direction lint rules remain.

**Acceptance criteria**
- [ ] Contracts compile independently of Fastify and concrete SQL drivers.
- [ ] ORM package does not import PostgreSQL, SQLite, Redis, or Kysely.
- [ ] SQL adapters do not import business addon model classes.
- [ ] A minimal example addon can compile against only documented public exports.

---

## 3. Phase 2 — Programmatic model declaration and field engine

### 3.1 Model declaration foundation

- [ ] Implement `Model`, `AbstractModel`, and `TransientModel` base abstractions.
- [ ] Implement stable technical model names and model metadata.
- [ ] Implement the canonical static `fields` declaration map.
- [ ] Implement declaration normalization into immutable metadata descriptors.
- [ ] Ensure declaration extraction never depends on constructing a business model instance.
- [ ] Ensure TypeScript types infer create/read/update payloads from field declarations.
- [ ] Add compile-time and runtime checks for duplicate model names and invalid declarations.
- [ ] Define persistent versus abstract versus transient storage behavior.
- [ ] Define whether a model may be abstract and extended by multiple modules without creating a physical table.
- [ ] Add examples for a simple model, an abstract mixin, a transient wizard, and a relation-bearing model.

### 3.2 Scalar field descriptors

- [ ] Implement Char with length/normalization/validation options.
- [ ] Implement Text.
- [ ] Implement Boolean.
- [ ] Implement Integer.
- [ ] Implement Float with explicit precision semantics.
- [ ] Implement Decimal with precision/scale and decimal-safe serialization; never silently use binary floating-point for money.
- [ ] Implement Date, DateTime, and Time with explicit timezone/UTC rules.
- [ ] Implement UUID/opaque string identity mapping.
- [ ] Implement JSON with typed value validation and documented provider limits.
- [ ] Implement Selection with stable stored values and labels kept separate from persistence values.
- [ ] Implement Binary as attachment/object-storage reference semantics; do not store arbitrary large blobs in business rows by default.
- [ ] Define nullability separately from requiredness and default values.
- [ ] Define readonly, copy, index, unique, default, validation, and field-level policy metadata.
- [ ] Define serialization/deserialization and API exposure rules for each field type.

### 3.3 Relation fields

- [ ] Implement ManyToOne with inverse metadata, on-delete policy, and referential validation.
- [ ] Implement OneToMany as an inverse relation, not a duplicated independent column.
- [ ] Implement ManyToMany with explicit relation-table metadata and deterministic naming.
- [ ] Validate relation target existence during registry composition.
- [ ] Validate inverse-field consistency and relation cardinality.
- [ ] Define relation traversal security: related records must still pass their own access rules.
- [ ] Define relation prefetch and batch-loading behavior.
- [ ] Test restrict, cascade, set-null, and other supported deletion semantics per provider capability.

### 3.4 Computed, related, and translated fields

- [ ] Define computed field metadata: compute handler, dependency list, stored/non-stored mode.
- [ ] Build a dependency graph and reject cycles at registry build time.
- [ ] Implement deterministic recompute scheduling for stored computed fields.
- [ ] Implement inverse/search handlers only when explicitly declared and supported.
- [ ] Implement related fields with validated relation paths and access checks.
- [ ] Define translated field storage, fallback locale, and cache invalidation.
- [ ] Ensure computed/related/translated fields cannot bypass field-level permissions.
- [ ] Add tests for dependency changes, recursion, invalid paths, and stale cache prevention.

### 3.5 Constraints and validation

- [ ] Implement field validators and model-level validation hooks.
- [ ] Implement unique and check constraint declarations.
- [ ] Distinguish application validation from provider-enforced constraints.
- [ ] Normalize provider constraint errors into stable ORM error codes.
- [ ] Ensure validation runs consistently for single and batch writes.
- [ ] Ensure security checks run before exposing validation details that could leak protected data.

**Acceptance criteria**
- [ ] A model can be declared entirely in TypeScript and registered without a schema file.
- [ ] Declaration metadata is immutable and deterministic.
- [ ] Type inference works for create, update, read, and relation fields.
- [ ] Invalid declarations fail before Runtime Mode becomes ready.
- [ ] Scalar/relation/compute tests run without requiring a live database where possible.

---

## 4. Phase 3 — Module registry, inheritance, and deterministic composition

### 4.1 Addon/module manifests

- [ ] Implement addon manifest validation.
- [ ] Implement module manifest validation.
- [ ] Resolve required and optional dependencies.
- [ ] Detect missing dependencies, incompatible versions, conflicts, and dependency cycles.
- [ ] Define module install/upgrade/disable states.
- [ ] Define package trust level and signature/provenance verification hooks.
- [ ] Separate package identity from installed plugin instance identity.
- [ ] Ensure disabling a module does not delete its stored business data.

### 4.2 Registry build

- [ ] Discover trusted model declarations from enabled modules.
- [ ] Build a deterministic dependency graph and topological order.
- [ ] Compose base model metadata and extension contributions.
- [ ] Inject BaseEntity metadata exactly once into persisted models.
- [ ] Resolve model inheritance and explicit mixin composition.
- [ ] Validate field names, types, overrides, relation targets, method signatures, and policy compatibility.
- [ ] Reject ambiguous collisions instead of relying on load order.
- [ ] Generate a stable registry fingerprint from normalized declarations and package versions.
- [ ] Persist the active registry snapshot/fingerprint in SQLite System Database.
- [ ] Keep the actual code declaration as the source of truth; registry snapshots are reproducible operational records.
- [ ] Make activated registry snapshots immutable for the lifetime of the process.

### 4.3 Inheritance and extension semantics

- [ ] Support extending an existing model with additive fields and explicit method contributions.
- [ ] Support creating a new model from an abstract model contract.
- [ ] Support explicit relation-backed composition/delegation.
- [ ] Define override rules and explicit override markers for fields and methods.
- [ ] Define deterministic method resolution and a safe super/next-extension chain.
- [ ] Define extension ordering using module dependency order and explicit priority only where necessary.
- [ ] Prevent arbitrary monkey-patching of active model classes.
- [ ] Test two or more addons extending the same model.
- [ ] Test conflicting fields, conflicting methods, invalid override types, and dependency order changes.
- [ ] Document the difference between model extension, classical inheritance, mixin composition, and relation-backed delegation.

**Acceptance criteria**
- [ ] The same set of packages produces the same registry fingerprint across clean runs.
- [ ] Conflicts are explicit, actionable errors.
- [ ] Extension behavior does not depend on filesystem discovery order.
- [ ] The registry cannot be mutated after activation.

---

## 5. Phase 4 — Environment, recordsets, and model operations

### 5.1 Environment (`env`)

- [~] Implement immutable/scoped `Environment` with server-trusted context snapshot and guarded derivation; UnitOfWork/permission service integration remains.
- [ ] Include transaction/unit-of-work handle.
- [ ] Include authenticated principal/service identity.
- [ ] Include trusted workspace/tenant context.
- [ ] Include optional company context and allowed-company set.
- [ ] Include locale, timezone, and relevant formatting context.
- [ ] Include permission evaluator and field-policy context.
- [ ] Include request/trace/correlation metadata.
- [ ] Include access to approved ARSY services/providers through capability interfaces.
- [~] Implement safe locale/timezone/company derivation without changing principal, tenant or allowed-company grants.
- [~] Prevent principal, tenant and allowed-company escalation through `env.derive()`; trusted construction and permission-provider enforcement remain.
- [ ] Ensure nested environment changes cannot silently escape transaction boundaries.

### 5.2 Recordset

- [~] Implement typed recordset identity: model + environment + ordered identities; CRUD identity map and policy-aware loader remain.
- [ ] Define stable behavior for empty, one-record, and multi-record recordsets.
- [ ] Implement iteration and explicit conversion to plain DTOs.
- [ ] Implement field reads and writes with access checks.
- [ ] Implement batch create, update, and delete operations.
- [ ] Implement filtering/mapping helpers only where semantics are clear and do not hide database round-trips.
- [ ] Implement relation access through the current environment.
- [ ] Implement recordset union/intersection/difference only if identity and environment compatibility are enforced.
- [ ] Prevent mixing recordsets from different tenants, principals, registries, or transactions without an explicit safe conversion.
- [ ] Document lazy versus eager access and avoid surprising implicit network/database I/O.

### 5.3 Model access and CRUD

- [ ] Implement `env.models.get(modelName)` with typed model resolution where possible.
- [ ] Implement create, browse/get, search, searchRead, count, update/write, and delete/unlink.
- [ ] Implement explicit pagination, stable ordering, and maximum page sizes.
- [ ] Implement batch reads and predictable empty-result behavior.
- [ ] Implement default value resolution from trusted server context.
- [ ] Ensure createdById/updatedById are set from trusted env principal, never client payload.
- [ ] Keep class/static convenience APIs thin wrappers over env-based APIs.
- [ ] Do not expose unrestricted model CRUD as public HTTP endpoints automatically.

### 5.4 Domain/query AST

- [ ] Implement typed domain AST for equality, inequality, comparisons, membership, null checks, and supported text operators.
- [ ] Implement nested AND/OR/NOT composition.
- [ ] Validate referenced fields and relation paths against the active registry.
- [ ] Reject string evaluation, raw SQL fragments, and arbitrary user-supplied expressions.
- [ ] Define safe sorting and pagination AST.
- [ ] Define grouping/aggregation contracts and capability checks.
- [ ] Compile AST only inside database adapters.
- [ ] Add query complexity limits and guardrails against unbounded scans.
- [ ] Test equivalent semantics against SQLite and PostgreSQL where the feature is in the portable subset.

### 5.5 Identity map, prefetch, and cache

- [ ] Implement transaction/request-scoped identity map.
- [ ] Implement batch prefetch for declared relations and common field access patterns.
- [ ] Implement deterministic cache invalidation after create/update/delete.
- [ ] Keep process-local memory cache separate from shared Redis cache.
- [ ] Ensure cached data is scoped by tenant, principal/policy context, registry fingerprint, and locale where relevant.
- [ ] Prevent stale permission decisions from surviving policy changes.
- [ ] Add query-count tests to detect N+1 regressions.
- [ ] Define explicit behavior for cache bypass and consistency-sensitive reads.

**Acceptance criteria**
- [ ] CRUD and search operations require an explicit Environment.
- [ ] Recordsets cannot cross tenant or transaction boundaries accidentally.
- [ ] Batch operations do not degrade into per-record queries for supported operations.
- [ ] Access checks apply to direct reads, searches, writes, deletes, and relation traversal.
- [ ] Query AST is safe and adapter-neutral.

---

## 6. Phase 5 — Unit of Work, database adapters, and transaction semantics

### 6.1 Provider-neutral adapter contract

- [ ] Define connection, transaction, CRUD, query execution, introspection, and schema-operation interfaces.
- [ ] Define provider capability declarations for JSON, indexes, constraints, transactions, locking, returning, and other non-portable features.
- [ ] Define transaction isolation expectations and unsupported-operation errors.
- [ ] Define normalized scalar, decimal, date/time, UUID, and JSON mapping.
- [ ] Keep provider-specific types internal to adapters.
- [ ] Create reusable adapter contract tests.

### 6.2 Unit of Work

- [~] Implement adapter-backed transaction-scoped UnitOfWorkFactory and commit/rollback helper; adapter integration and lifecycle hooks remain.
- [ ] Track pending creates, updates, and deletes where required by ORM semantics.
- [ ] Define flush/commit/rollback behavior.
- [ ] Ensure lifecycle hooks run in deterministic order.
- [ ] Ensure audit writes required by a business mutation share the same PostgreSQL transaction.
- [ ] Ensure external effects use outbox/event delivery rather than being sent inside a database transaction.
- [ ] Define nested transaction/savepoint behavior by provider capability.
- [ ] Define optimistic concurrency behavior for Versioned models.
- [ ] Test rollback after validation, hook, constraint, and provider failures.

### 6.3 PostgreSQL Business Database

- [ ] Implement PostgreSQL adapter and connection lifecycle.
- [ ] Implement safe pool configuration and graceful shutdown.
- [ ] Implement PostgreSQL type mapping and schema introspection.
- [ ] Implement CRUD/query AST compilation through internal Kysely usage.
- [ ] Implement relation constraints and indexes.
- [ ] Implement transaction and locking behavior.
- [ ] Add integration tests against a real PostgreSQL service in CI.
- [ ] Keep schema-apply credentials separate from ordinary runtime credentials where practical.

### 6.4 SQLite System Database

- [ ] Implement SQLite connection lifecycle for system/control-plane data.
- [ ] Enable and verify WAL mode where appropriate.
- [ ] Configure busy timeout and serialized write ownership.
- [ ] Define backup/restore and integrity-check operations.
- [ ] Store plugin/module install state, settings, registry fingerprints/snapshots, synchronization receipts, and system audit.
- [ ] Do not store business-domain records in the System Database by default.
- [ ] Do not use a shared network filesystem as a multi-writer SQLite cluster.
- [ ] Test restart recovery, interrupted writes, backup restore, and lock contention.

**Acceptance criteria**
- [ ] ORM behavior is tested through adapter contracts, not coupled to a driver.
- [ ] PostgreSQL business transactions and SQLite system transactions have explicit ownership.
- [ ] Rollback and concurrency semantics are documented and tested.
- [ ] Provider capability gaps fail loudly rather than silently changing behavior.

---

## 7. Phase 6 — System Mode and programmatic schema reconciliation

### 7.1 System Mode lifecycle

- [ ] Define explicit System Mode entry points: CLI/maintenance command and private operator API.
- [ ] Implement startup sequence: load core config → initialize System Database → discover trusted packages → validate manifests/signatures → resolve modules → compose registry → validate model metadata → compare installed fingerprint → plan required changes → apply authorized changes → verify → persist receipt → activate Runtime Mode.
- [ ] Ensure API and Worker processes do not independently run competing schema apply operations.
- [ ] Implement distributed/process lock appropriate for the single-VPS first deployment and future multi-process operation.
- [ ] Define crash recovery if System Mode stops during an apply.
- [ ] Define behavior when PostgreSQL is unavailable while SQLite control-plane diagnostics remain available.
- [ ] Define readiness states: ready, initializing, maintenance, degraded, incompatible, and failed.
- [ ] Ensure Runtime Mode only loads a verified registry snapshot compatible with installed database state.

### 7.2 Schema plan/reconcile/verify

- [ ] Implement desired physical schema generation from composed model metadata.
- [ ] Implement provider introspection for actual schema.
- [ ] Implement deterministic diff/plan generation.
- [ ] Classify changes: additive-safe, compatible alteration, data migration required, destructive, unsupported.
- [ ] Implement dry-run plan output with affected models/fields/indexes/constraints and risk classification.
- [ ] Implement explicit approval token/actor for risky operations.
- [ ] Implement serialized apply with lock and idempotency.
- [ ] Implement post-apply verification and drift detection.
- [ ] Persist plan, registry fingerprint, actor, timestamps, adapter version, outcome, and recovery reference in System Database.
- [ ] Preserve tables/columns/indexes not owned by the ORM.
- [ ] Never drop data automatically when a model/field/addon is removed or disabled.
- [ ] Define rollback/restore strategy; do not claim every DDL operation is transactionally reversible across providers.

### 7.3 Typed semantic upgrade handlers

- [ ] Define versioned TypeScript upgrade handlers owned by the module that owns the data.
- [ ] Separate physical DDL from semantic data transformation.
- [ ] Define handler identity, source/target module version, idempotency, checkpointing, progress, and failure state.
- [ ] Require dry-run/estimate for large or risky transformations where possible.
- [ ] Ensure handlers run under a controlled System Mode environment with explicit permissions.
- [ ] Ensure interrupted handlers can resume safely or stop with a clear recovery path.
- [ ] Prohibit arbitrary third-party upgrade code from running without package trust/signature verification.
- [ ] Test upgrade replay, interruption, rollback/compensation, and partial completion.

### 7.4 Private operator API and CLI

- [ ] Implement private schema plan endpoint.
- [ ] Implement private schema reconcile endpoint with explicit authorization.
- [ ] Implement private schema verify endpoint.
- [ ] Implement system status/drift endpoint.
- [ ] Implement CLI commands for system status, plan, apply/reconcile, verify, module list, module install, module upgrade, and module disable.
- [ ] Make CLI and private API call the same System Mode services; no duplicated implementation.
- [ ] Restrict endpoints to deployment/operator identities and network policy.
- [ ] Ensure Headquarter normal user sessions cannot mutate database schema.
- [ ] Redact secrets and sensitive values from plan/status/log output.

**Acceptance criteria**
- [ ] A clean installation can bootstrap System Database and install the first module set.
- [ ] Re-running System Mode with no declaration changes is idempotent and produces no unnecessary DDL.
- [ ] Normal Runtime Mode never applies DDL.
- [ ] Destructive changes are blocked without explicit approval and recovery readiness.
- [ ] An interrupted System Mode run can be diagnosed and safely resumed or recovered.

---

## 8. Phase 7 — Security, tenant isolation, and audit integration

- [ ] Implement model-level ACL checks.
- [ ] Implement record-rule evaluation with safe domain composition.
- [ ] Implement field-level read/write policies.
- [ ] Enforce deny-by-default for unknown model/operation combinations.
- [ ] Derive workspace/tenant identity from authenticated server-side context and membership.
- [ ] Implement WorkspaceScoped behavior as an explicit mixin, not a universal implicit field.
- [ ] Implement CompanyScoped separately from WorkspaceScoped.
- [ ] Validate cross-workspace and cross-company relations.
- [ ] Apply access rules to search, count, aggregation, batch operations, computed fields, and relation traversal.
- [ ] Ensure computed fields cannot reveal protected source fields.
- [ ] Ensure cache keys and identity map respect tenant/principal/policy scope.
- [ ] Implement audit events for security-sensitive and configured business mutations.
- [ ] Redact passwords, tokens, secret references, and sensitive payloads from logs/audit diffs.
- [ ] Test IDOR, tenant escape, relation traversal leaks, unauthorized field writes, and batch-operation bypasses.

**Acceptance criteria**
- [ ] Tenant isolation tests pass for reads, writes, searches, relations, aggregates, and background jobs.
- [ ] Client-supplied actor/tenant/company IDs cannot override trusted Environment context.
- [ ] Audit records are transactionally consistent with required business mutations.
- [ ] No cache or computed-field path leaks data across security boundaries.

---

## 9. Phase 8 — Base platform addons (staged, not big-bang)

Implement the package as independently declared addon manifests. Do not implement all addons before the ORM is proven.

### 9.1 First foundation slice

- [ ] `base.core`: BaseEntity injection, principal abstraction, common value objects and validation.
- [ ] Ensure persisted models receive exactly: `id`, `createdAt`, `createdById`, `updatedAt`, `updatedById`.
- [ ] Keep active/enabled, archive, soft delete, revision, workspace/company scope, and owner as explicit opt-in mixins.
- [ ] `base.identity`: User, UserIdentity, AuthSession, ServiceAccount, invitation/account lifecycle metadata.
- [ ] `base.security`: Group, Role, Permission, ModelAccess, RecordRule, FieldPolicy, RoleBinding, policy evaluator.
- [ ] `base.workspace`: Workspace, WorkspaceMembership, WorkspaceInvitation, WorkspacePreference, tenant context.
- [ ] `base.audit`: AuditEvent, actor/source/request attribution, safe diff and retention contracts.
- [ ] `base.events`: event envelope, outbox, inbox, delivery receipt, idempotency.

### 9.2 Next required-by-workflow addons

- [ ] `base.settings`: typed settings and secret references; never plaintext secret storage.
- [ ] `base.attachment`: attachment metadata, object key, checksum, MIME/size validation, access and retention.
- [ ] `base.sequence`: concurrency-safe human-readable reference allocation separate from primary key.
- [ ] `base.transient`: temporary model semantics, TTL and cleanup.

### 9.3 Optional addons — implement only when a real workflow requires them

- [ ] `base.company`: legal/company hierarchy and membership; independent from workspace tenancy.
- [ ] `base.communication`: messages, threads, followers/subscriptions, notifications and delivery attempts.
- [ ] `base.activity`: human task/follow-up, assignment, due date and completion.
- [ ] `base.localization`: locale, timezone, currency/country/unit references and formatting.
- [ ] `base.import-export`: jobs, mapping, validation reports and checkpoints.
- [ ] `base.integration`: external connection metadata, webhook endpoint/delivery, signature and idempotency services.
- [ ] `base.taxonomy`: shared tags/categories only when truly cross-domain.

### 9.4 Explicit semantic boundaries

- [ ] Keep AuditEvent distinct from DomainEvent.
- [ ] Keep Outbox/Inbox distinct from queue job state.
- [ ] Keep chatter/message history distinct from audit history.
- [ ] Keep Activity (human follow-up) distinct from Background Job (machine execution).
- [ ] Keep Notification intent/delivery distinct from event transport.
- [ ] Keep attachment metadata in business DB and binary bytes in configured object storage.
- [ ] Keep provider credentials in secret storage; model records store references only.

---

## 10. Phase 9 — Mixins and advanced model behavior

- [ ] Implement mixin manifest and dependency resolution.
- [ ] Implement OwnershipAttribution.
- [ ] Implement Archiveable with archive/restore semantics.
- [ ] Implement SoftDeletable with retention/restore semantics.
- [ ] Implement Toggleable independently from business status.
- [ ] Implement Versioned with optimistic concurrency.
- [ ] Implement WorkspaceScoped with mandatory record scope.
- [ ] Implement CompanyScoped with allowed-company checks.
- [ ] Implement ParentTree with cycle protection and hierarchy operators.
- [ ] Implement ChatterEnabled only with communication addon installed.
- [ ] Implement ActivityEnabled only with activity addon installed.
- [ ] Implement AttachmentEnabled only with attachment addon installed.
- [ ] Implement SequenceAssigned only with sequence addon installed.
- [ ] Implement Translatable only with localization support installed.
- [ ] Implement CustomMetadata only with typed validation, policy, and indexing semantics.
- [ ] Reject incompatible mixin combinations and duplicate field contributions.
- [ ] Ensure each mixin includes behavior, policy, lifecycle semantics, and tests—not just columns.

---

## 11. Phase 10 — Plugin ecosystem and ORM extension trust boundary

- [ ] Define plugin package versus installed plugin instance.
- [ ] Define trusted in-process plugin class and isolated/external plugin class.
- [ ] Require signature, publisher identity, package digest, provenance, compatibility, and revocation checks for public ecosystem packages.
- [ ] Define capability/permission manifests and least-privilege grants.
- [ ] Permit trusted in-process modules to contribute TypeScript model declarations to System Mode registry composition.
- [ ] Do not load arbitrary community plugin code into the ARSY API process by default.
- [ ] Define isolated plugin RPC contracts for external plugins.
- [ ] Define whether isolated plugins may publish declarative model metadata; if supported later, treat it as a restricted declarative contract, not executable code injection.
- [ ] Define data ownership and database boundary for isolated plugins.
- [ ] Define upgrade/disable behavior that preserves existing data.
- [ ] Ensure plugin hot reload is limited to safe configuration/lifecycle changes; code/dependency/model-registry changes require controlled restart/System Mode.
- [ ] Test revoked signatures, incompatible versions, missing permissions, malicious metadata, and RPC timeout/failure.

**Acceptance criteria**
- [ ] A plugin cannot obtain arbitrary database or filesystem access merely by being installed.
- [ ] Only approved trusted packages can extend the in-process ORM registry.
- [ ] Isolated plugins cannot bypass model ACLs or tenant boundaries.
- [ ] Plugin disablement does not implicitly delete business data.

---

## 12. Phase 11 — ARSY integration and process lifecycle

- [ ] Implement ARSY core lifecycle and dependency injection.
- [ ] Integrate System Mode as an explicit maintenance/setup service.
- [ ] Integrate Runtime Mode with Fastify through controlled application services.
- [ ] Keep routes thin: parse/validate contract → authorize → call service → serialize DTO.
- [ ] Add health, readiness, liveness, version, and registry fingerprint endpoints with safe exposure.
- [ ] Ensure Headquarter calls ARSY contracts only and never connects directly to SQLite/PostgreSQL.
- [ ] Define API and Worker process boot behavior against the same verified registry fingerprint.
- [ ] Ensure Worker jobs carry trusted tenant/principal context and revalidate permissions as required.
- [ ] Implement graceful shutdown: stop accepting work, drain requests/jobs, close transactions, close pools, release locks.
- [ ] Add structured logs and correlation IDs across API, worker, System Mode, and provider operations.
- [ ] Ensure errors do not expose SQL, secrets, filesystem paths, or internal stack traces to clients.

---

## 13. Phase 12 — Test strategy and quality gates

### 13.1 Unit tests

- [ ] Field descriptor defaults, validation, serialization, and type inference.
- [ ] Declaration normalization and metadata immutability.
- [ ] Model registry ordering, fingerprints, and conflict detection.
- [ ] Module dependency graph and cycle detection.
- [ ] Inheritance, mixin composition, and method resolution.
- [ ] Environment scoping and context derivation.
- [ ] Recordset empty/single/multiple behavior and batch semantics.
- [ ] Domain AST validation and query complexity limits.
- [ ] Computed-field dependency graph and cycle detection.
- [ ] Access policy and record-rule evaluation.
- [ ] System Mode plan classification and idempotency.

### 13.2 Adapter integration tests

- [ ] PostgreSQL CRUD, relation, index, constraint, transaction, rollback, and locking tests.
- [ ] SQLite System Database persistence, WAL/locking, integrity, backup/restore, and recovery tests.
- [ ] Portable ORM contract tests against all supported adapters.
- [ ] Provider-specific capability tests for unsupported operations.
- [ ] Schema introspection, plan, apply, verify, and drift tests.
- [ ] Data upgrade interruption/replay/recovery tests.

### 13.3 Security and resilience tests

- [ ] Workspace/tenant isolation across every read/write path.
- [ ] Cross-company access policy.
- [ ] Relation traversal and computed-field leakage.
- [ ] Cache isolation and invalidation.
- [ ] Concurrent writes and optimistic concurrency conflicts.
- [ ] System Mode lock contention and process crash recovery.
- [ ] Plugin signature revocation and permission denial.
- [ ] Outbox idempotency and duplicate delivery.
- [ ] Database outage and degraded readiness behavior.

### 13.4 CI and release gates

- [ ] Enforce lint, formatting, typecheck, unit tests, and package build.
- [ ] Run adapter integration tests in CI with service containers.
- [ ] Verify package exports and dependency boundaries.
- [ ] Generate test/coverage reports for critical ORM packages.
- [ ] Require migration/reconciliation plan review for risky model changes.
- [ ] Require backup/restore evidence before production destructive operations.
- [ ] Do not mark a feature complete based only on compilation or a mocked test.

---

## 14. Phase 13 — Documentation and developer experience

- [ ] Write ORM quickstart: create a module, declare a model, register it, and query it with env/recordset.
- [ ] Write field reference with options, types, nullability, defaults, and provider support.
- [ ] Write relation guide with inverse relations and deletion policies.
- [ ] Write inheritance/extension/mixin guide with deterministic composition examples.
- [ ] Write Environment and Recordset guide with transaction and tenant-scope examples.
- [ ] Write domain/query guide and safe filtering examples.
- [ ] Write System Mode lifecycle guide and CLI runbook.
- [ ] Write schema plan/reconcile/verify operator guide.
- [ ] Write typed data-upgrade handler guide.
- [ ] Write plugin trust, signature, capability, and ORM-extension policy.
- [ ] Write SQLite System Database backup/restore runbook.
- [ ] Write PostgreSQL Business Database backup/restore and recovery runbook.
- [ ] Document supported provider capability matrix.
- [ ] Add runnable examples and verify them in CI.

---

## 15. Recommended implementation order and release gates

Do not implement the entire capability matrix in one large branch. Deliver vertical slices.

### Milestone A — Architecture and repository ready

- [ ] Complete Phase 0.
- [ ] Complete Phase 1 contracts and package boundaries.
- [ ] Exit gate: clean monorepo CI; architecture docs agree; package dependency graph is valid.

### Milestone B — Declaration and registry kernel

- [ ] Complete scalar subset of Phase 2.
- [ ] Complete core of Phase 3.
- [ ] Exit gate: a TypeScript module declares two models and an extension; System Mode composes a deterministic registry without a database.

### Milestone C — First usable ORM runtime

- [ ] Implement Environment, Recordset, basic CRUD, safe domain AST, and Unit of Work.
- [ ] Implement PostgreSQL adapter for the supported field subset.
- [ ] Exit gate: create/search/read/update/delete work through env and recordsets with transactions and type-safe model declarations.

### Milestone D — System Mode persistence lifecycle

- [ ] Implement SQLite System Database.
- [ ] Implement registry fingerprint persistence.
- [ ] Implement schema plan/apply/verify and safe additive reconciliation.
- [ ] Exit gate: fresh install and repeated no-op reconcile are deterministic; Runtime Mode never applies DDL.

### Milestone E — Security and base foundation

- [ ] Implement ACL, record rules, field policies, BaseEntity, identity, security, workspace, audit, and events.
- [ ] Exit gate: tenant isolation and audit atomicity tests pass.

### Milestone F — First business workflow

- [ ] Select one real business workflow and implement only the required addon/model/fields/mixins.
- [ ] Validate query behavior, permissions, audit, events, attachments/sequence only if required.
- [ ] Exit gate: workflow works end-to-end through ARSY API and Headquarter contract without direct database access.

### Milestone G — Public plugin readiness

- [ ] Implement signing/trust, capability permissions, compatibility, isolated plugin RPC, and controlled module upgrades.
- [ ] Exit gate: third-party plugin threat model and adversarial tests pass before public distribution.

---

## 16. Explicit non-goals for the first ORM release

- [ ] Do not clone all Odoo APIs or promise drop-in compatibility.
- [ ] Do not build every Base Platform addon before a real workflow needs it.
- [ ] Do not support arbitrary runtime code injection or hot reload of model classes.
- [ ] Do not expose raw SQL or Kysely to addon authors.
- [ ] Do not make every field dynamically editable from Headquarter.
- [ ] Do not allow normal API requests to alter physical schema.
- [ ] Do not automatically drop tables/columns when a module is disabled or a declaration disappears.
- [ ] Do not use SQLite as a multi-node, multi-writer business database.
- [ ] Do not treat Redis as durable business storage or the model registry source of truth.
- [ ] Do not treat Telegram as a database provider.
- [ ] Do not implement isolated plugin model execution until its metadata/RPC/security contract is explicitly designed.

---

## 17. Definition of Done — ORM v1

The first ORM release is complete only when all of the following are true:

- [ ] A developer can declare models, fields, relations, constraints, and extensions in TypeScript source code without a separate schema file.
- [ ] ARSY System Mode discovers declarations, validates modules, composes the registry, and generates a deterministic fingerprint.
- [ ] Runtime Mode loads a verified immutable registry and does not perform schema DDL.
- [ ] `env` carries trusted principal, tenant, transaction, and policy context.
- [ ] `recordset` supports predictable empty/single/multiple behavior and batch operations.
- [ ] CRUD, domains, relations, validation, and transactions work against PostgreSQL for the documented portable subset.
- [ ] SQLite System Database persists system/module/registry state and has tested backup/recovery.
- [ ] Safe additive schema reconciliation is idempotent; risky/destructive changes require explicit approval.
- [ ] BaseEntity injects exactly five universal persisted fields.
- [ ] ACL, record rules, field policies, and workspace isolation are enforced on all supported operations.
- [ ] Adapter contract, security, failure-recovery, and integration tests pass in CI.
- [ ] Developer and operator documentation is runnable and matches actual code.
- [ ] Repository audit/docs are updated with evidence and exact remaining gaps.

---

## 18. Current status tracking

Use these labels consistently when updating this file:

- `[ ]` Not started.
- `[~]` In progress (include issue/PR link or owner in the task line).
- `[x]` Complete (must have implementation and verification evidence).
- `[!]` Blocked (state the blocker and next action).

**Current state:** All tasks in this file are initially unchecked. This backlog does not claim that the ORM, System Mode, adapters, or base addons already exist.


## 19. Phase 0 execution log

**Working branch:** `chore/phase-0-repository-alignment`  
**Execution date:** 2026-11-07

### Completed in this pass
- [x] Rewrote docs/08 as the current architecture overview for declaration-based ORM, registry, Environment/Recordset, System Mode/Runtime Mode and provider ownership.
- [x] Reconciled docs/18 and docs/22 with the updated declaration and provider contracts.
- [x] Added docs/24 with ADR-001 through ADR-012.
- [x] Added a dated follow-up reinspection to docs/23 so the old audit snapshot no longer misstates the current Headquarter and ARSY Core file inventory.
- [x] Aligned root package identity and replaced recursive/missing root script references.
- [x] Replaced pnpm-workspace allowBuilds placeholders with explicit booleans.
- [x] Removed Headquarter lint success masking and added its Next lint config.
- [x] Replaced the ARSY app's placeholder lint-success script with the shared ESLint command.
- [x] Routed UI, types and ARSY Core lint through the shared flat ESLint config; removed the no-source lint task from the config-only package.
- [x] Added root .dockerignore.
- [x] Added a Node test for the repository governance audit.
- [x] Normalized the ORM import example to the existing `@riotworks/*` package namespace.

### Still open
- [ ] Execute `pnpm install --frozen-lockfile` and resolve any lockfile drift (do not claim success before running it).
- [ ] Run `pnpm run lockfile:check`, `pnpm run check:repo`, `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, and `pnpm run build` in a clean checkout.
- [ ] Verify Headquarter Next lint/build and ARSY typecheck/startup.
- [ ] Repair ARSY Core's undeclared imports/type/build contract and integrate it into apps/arsy or remove the unused dependency.
- [ ] Move PostgreSQL pool cleanup into Fastify lifecycle hooks; remove process signal handlers from database setup.
- [ ] Review/retire duplicate services/arsy and services/queue only after unique behavior is accounted for.
- [ ] Validate all GitHub workflow YAML and automation scripts; update the weekly workflow's indentation defect.
- [ ] Verify package exports, lockfile importers, Docker builds and runtime port/config behavior.
- [ ] Update docs/23 with the exact verification results and commit SHA after CI/clean-checkout execution.

**Verification status:** documentation and manifest edits are committed on the working branch; no local commands or CI jobs have been executed in this environment. The Phase 0 exit gate is therefore not yet satisfied.


### Phase 0 follow-up — ARSY script ownership
- [x] Move Fastify CLI build/start ownership to `apps/arsy`.
- [x] Remove server lifecycle scripts from `packages/arsy-core`; it is a library, not a second server.
- [ ] Implement and test the actual ARSY Core factory/dependency contract, then integrate it into the app without duplicate Fastify lifecycle.


## Phase 1 execution log — package boundaries and public contracts

**Branch:** `chore/phase-1-package-contracts`  
**Status:** In progress; initial contracts drafted, verification gate not yet met.

### Implemented in this slice

- [x] Create `@riotworks/orm` with a public TypeScript entrypoint for model kinds, field/relation metadata, separate addon/module manifests, registry snapshot, ORM error codes, Environment and Recordset contracts.
- [x] Create `@riotworks/orm-db-adaptor` with provider-neutral connection, transaction, query, introspection, schema-operation and capability contracts.
- [x] Create `@riotworks/orm-db` with UnitOfWork, schema plan/risk/approval, reconciliation receipt/store, planner/reconciler and semantic UpgradeHandler contracts.
- [x] Decide the adapter package name `orm-db-adaptor-sqlite` for the SQLite System Database role; PostgreSQL remains the Business Database adapter.
- [x] Document package ownership, allowed/forbidden dependency direction and Phase 1 verification gate in `docs/25-phase-1-package-contracts.md`.

### Still required before Phase 1 can be marked complete

- [ ] Add the missing mixin/model-extension contracts and finalize public error taxonomy.
- [ ] Add adapter/ORM contract tests and a minimal external consumer fixture.
- [ ] Add concrete PostgreSQL and SQLite adapter packages only with real driver-backed entrypoints and tests.
- [ ] Create `orm-addon-base` when BaseEntity and the first installable base modules have real declarations/services; do not add an empty placeholder package.
- [ ] Verify package exports, lint, typecheck, lockfile and clean workspace install.
- [ ] Verify dependency direction mechanically and update the repository audit with actual results.

**Evidence note:** No local pnpm install, TypeScript check, lint, unit test, adapter integration test or CI run has been executed in this slice. The presence of a contract file is not evidence that its behavior is implemented or verified.


### Contract refinement

- [x] Add explicit mixin and model-extension contract shapes.
- [x] Add the provider-neutral domain expression AST.
- [x] Make addon compatibility explicit for ARSY, ORM and optional API versions.
- [x] Encode the approved v1 database role pairing in the adapter identity type: SQLite = System Database; PostgreSQL = Business Database.


## Parallel execution log — Phase 1 completion work and Phase 3 start

**Phase 1 branch:** `chore/phase-1-package-contracts`  
**Phase 3 branch:** `feat/phase-3-deterministic-registry`

### Phase 1 follow-through in this slice

- [x] Add workspace package manifests and public export maps for `@riotworks/orm`, `@riotworks/orm-db-adaptor`, and `@riotworks/orm-db`.
- [x] Add a `./registry` public subpath for the ORM registry composer.
- [ ] Run clean pnpm install and refresh/check lockfile.
- [ ] Run TypeScript checks and ESLint for all three packages.
- [ ] Add and execute contract tests and minimal consumer fixture.
- [~] Implement PostgreSQL Business Database adapter and ARSY bootstrap integration; PostgreSQL container tests and production verification remain.
- [~] Implement SQLite System Database adapter and ARSY bootstrap integration; file-backed restart/WAL tests remain.
- [x] Complete ARSY Core integration and provider lifecycle wiring through explicit System/Business adapters.
- [ ] Add CI evidence; no phase completion claim until the full gate passes.

### Phase 3 initial implementation

- [x] Add deterministic addon/module topological ordering and cycle detection.
- [x] Validate addon/module ownership, duplicate IDs, required/optional dependencies and conflicts.
- [x] Validate addon dependency versions for exact, caret and tilde three-part ranges.
- [x] Compose model field metadata with deterministic extension ordering and fail-closed field collisions.
- [x] Validate direct relation targets and missing mixins.
- [x] Generate a stable SHA-256 registry fingerprint that excludes creation timestamp.
- [~] Return a frozen registry snapshot; deep-freeze and mutation tests remain.
- [ ] Implement full model inheritance and explicit field/method override semantics.
- [ ] Inject BaseEntity metadata exactly once after the BaseEntity contract is finalized.
- [ ] Persist registry snapshot/fingerprint in SQLite System Database and implement atomic activation.
- [ ] Add comprehensive registry unit and System Mode integration tests.

**Evidence note:** These changes were authored through GitHub repository operations. No clean checkout, package installation, TypeScript compiler, lint, test runner, database service or GitHub Actions result was executed in this work session. The new implementation is therefore an unverified code contribution, not a passing build.


## Phase 2 execution log — initial implementation slice

- [x] Add `Model` base class and static `ModelDeclaration` reader.
- [x] Add programmatic field factories for scalar, relation, computed and related field kinds.
- [x] Add initial declaration validator and integrate it into registry composition.
- [x] Add field value inference helper types.
- [x] Add unit test source for defaults, immutability, unique indexing, decimal bounds, selection uniqueness, relation target and nullability validation.
- [ ] Run Node 24 test command, TypeScript check, ESLint and formatting in clean CI.
- [ ] Add compile-time inference fixtures for create/update/read DTOs.
- [ ] Implement explicit model inheritance and override rules.
- [ ] Implement computed field dependency validation/evaluation.
- [ ] Complete Phase 1 database adapter and ARSY Core integration gates.

See `docs/27-phase-2-model-field-engine.md`. Source code has been authored through GitHub operations; no local execution or CI result is claimed.


## Phase 4 execution log — Environment and Recordset foundation

- [x] Add immutable Environment context and controlled derivation.
- [x] Bind Environment to registry, transaction handle and model collection.
- [x] Add lazy Recordset with stable empty/first/multiple behavior and async iteration.
- [x] Reject unknown model names, duplicate/empty IDs and use after transaction closure.
- [x] Add runtime test source for environment isolation and recordset lifecycle.
- [ ] Run test/typecheck/lint/format gates in clean CI.
- [ ] Integrate an authorized loader with UnitOfWork and real PostgreSQL adapter.
- [ ] Implement ACL, record rules, CRUD, domain compiler and identity map.

See `docs/28-phase-4-environment-recordset.md`. This is an initial runtime slice, not a complete CRUD engine.


## Phase 5 execution log — Unit of Work runtime

- [x] Implement adapter-backed UnitOfWorkFactory.
- [x] Implement explicit transaction state and commit/rollback handling.
- [x] Implement withUnitOfWork success/exception flow with rollback error preservation.
- [x] Add unit test source for commit, rollback and commit failure.
- [ ] Run test/typecheck/lint gates in clean CI.
- [ ] Implement PostgreSQL Business Database and SQLite System Database adapters.
- [ ] Add adapter contract/integration tests, savepoints and isolation semantics.
- [ ] Integrate UnitOfWork into Environment and model services.

See docs/30-phase-5-unit-of-work.md. No test or build result is claimed yet.


## Phase 6 execution log — Deterministic schema planner

- [x] Derive persistent table/column plans from registry metadata.
- [x] Map field kinds to PostgreSQL and SQLite storage types.
- [x] Plan create-table, add-column and index operations.
- [x] Classify safe, review and destructive schema changes.
- [x] Generate deterministic operation and plan IDs.
- [x] Prevent automatic drop-table/drop-column planning.
- [x] Add planner test source for additive changes, review gates and destructive type changes.
- [ ] Run test/typecheck/lint gates in CI.
- [ ] Implement concrete database adapters and provider introspection.
- [ ] Implement approval-bound reconciler, receipt store and atomic System Mode activation.

See docs/31-phase-6-schema-planner.md. Planning is implemented as an initial source slice; DDL execution is not claimed.


## Phase 7 execution log — Approval-bound schema reconciliation

- [x] Persist schema plan before execution.
- [x] Enforce exact provider/role match before applying DDL.
- [x] Implement off, plan, safe and strict policy modes.
- [x] Require explicit per-operation approval and actor binding for destructive operations.
- [x] Preflight strict mode to avoid partial execution when approvals are missing.
- [x] Persist operation results and verification status through the injected ReconciliationStore.
- [x] Verify create-table/add-column/alter-column/create-index operations from database introspection.
- [x] Add reconciler test source for mode, approval and provider boundaries.
- [ ] Run CI test/typecheck/lint gates.
- [ ] Implement durable SQLite System Database plan/receipt store and serialized activation lock.
- [ ] Implement real PostgreSQL and SQLite adapters and end-to-end DDL safety tests.

See docs/32-phase-7-schema-reconciler.md. This is an initial policy-enforced reconciler; real driver and durable system-store integrations remain open.


## Phase 8 execution log — Concrete database adapters

- [x] Add PostgreSQL adapter package using pg Pool/PoolClient.
- [x] Add SQLite System Database adapter package using better-sqlite3.
- [x] Enforce PostgreSQL/Business and SQLite/System identity pairing.
- [x] Implement connection, ping, parameterized query, transaction and schema introspection surfaces.
- [x] Implement idempotent create-table/add-column/create-index DDL with validation and transactional execution.
- [x] Reject automatic destructive/unsupported DDL for semantic upgrade handling.
- [x] Add SQLite in-memory/file-backed integration tests and live PostgreSQL container integration test source.
- [x] Allow the reviewed better-sqlite3 native build.
- [ ] Verify lockfile, native build, typecheck, lint and adapter tests in CI.
- [ ] Add PostgreSQL disposable-server integration tests.
- [ ] Add SQLite file-backed WAL/restart/busy-timeout tests.
- [ ] Integrate adapters into ARSY System Mode and Business persistence routing.

See docs/33-phase-8-database-adapters.md. Adapter code is authored but must not be treated as production-ready until the CI and provider integration gates pass.


### Phase 8 ARSY provider integration follow-up

- [x] Bootstrap SQLite System Database before PostgreSQL Business Database.
- [x] Replace the legacy direct pg Pool in apps/arsy with the two concrete adapter packages.
- [x] Add separate system/business database health routes.
- [x] Close Business Database and System Database through Fastify onClose in reverse dependency order.
- [~] Repository CI now provisions PostgreSQL and runs provider/ARSY lifecycle tests; latest code revision still requires its final CI run.


### CI environment propagation hardening

- [x] Pass TEST_POSTGRES_URL through Turbo test tasks so PostgreSQL and ARSY lifecycle integration tests actually execute in the repository CI job.
- [x] Declare apps/arsy as an ESM package to avoid Node test-runner module ambiguity.
- [ ] Confirm the latest CI run reports the live PostgreSQL and ARSY integration tests as passed (not skipped).


## Phase 9 — System Mode control plane and atomic registry activation

**Branch:** `feat/phase-9-system-mode-control-plane`  
**Status:** Initial SQLite control-store implementation slice; System Mode orchestration and production acceptance gates remain open.

- [~] Add `@riotworks/arsy-system-store-sqlite`: durable plans/receipts, registry snapshots, active pointer, audit, and fenced lease are implemented; addon/module install-state and acceptance tests remain.
- [ ] Add `@riotworks/arsy-system-mode` orchestration state machine; keep it outside HTTP request handlers.
- [ ] Implement trusted package discovery and fail-closed signature/integrity/compatibility/permission validation before importing addon code.
- [~] Implement database-backed lease with owner token, expiry, fencing generation, renewal, and stale-owner rejection; initial implementation and unit test source exist, cross-process stress/recovery tests remain.
- [~] Persist schema plans and registry snapshots with canonical digest; candidate lifecycle and end-to-end reconciliation orchestration remain.
- [ ] Bind review/destructive approvals to actor, plan fingerprint, and exact operation IDs.
- [ ] Reconcile PostgreSQL Business Database only under System Mode policy; preserve SQLite/PostgreSQL transaction separation.
- [~] Implement atomic registry pointer + receipt + audit event activation with persisted-plan/receipt, actor, provider, and lease checks; failure-injection/recovery tests remain.
- [ ] Recover incomplete runs without replacing the previous active registry.
- [ ] Load only verified immutable active snapshots in Runtime Mode; prohibit runtime discovery and DDL.
- [ ] Gate business API readiness on verified registry and PostgreSQL schema; preserve SQLite control-plane diagnostics during business DB outage.
- [ ] Add file-backed restart, multi-process contention, lease expiry/renewal, fencing, tamper, approval, recovery, and atomic-activation tests.
- [ ] Run clean frozen install, lockfile, typecheck, lint, test, adapter integration, and full build CI gates.

### Phase 9 initial code slice

- [x] Add `@riotworks/arsy-system-store-sqlite` package manifest and public entrypoint.
- [x] Initialize durable SQLite control tables for plans, receipts, registry snapshots, active state, leases, and audit.
- [x] Persist plans and receipts through the provider-neutral query interface.
- [x] Add fenced lease acquire/renew/release semantics; released lease rows preserve fencing generation.
- [x] Verify exact persisted plan + verified PostgreSQL/Business receipt + actor + current lease before activation.
- [x] Commit active registry pointer and activation audit in one SQLite transaction.
- [x] Verify active snapshot digest and matching verified receipt when loading active registry.
- [ ] Run new package typecheck, lint, tests, frozen install, and full workspace CI.
- [ ] Add multi-process, file-backed restart, crash-recovery, tamper, and failure-injection tests.
- [ ] Integrate the store into ARSY Core/System Mode bootstrap and readiness gating.

See `docs/34-phase-9-system-mode-control-plane.md`. Implementation source exists; no passing CI or production readiness is claimed for this new package.

### Phase 8 CI evidence

- [x] Repository integrity and full workspace typecheck/build passed on Phase 8 commit `8258e684356822313a9696ff372c396494139dc7` (workflow run 457).
- [ ] Latest Phase 8 CI revision adds PostgreSQL service-backed provider/ARSY integration tests; confirm these are executed and passing (not skipped).

Evidence: https://github.com/BRIDGE-ALLAH/MOONWITNESS/actions/runs/42395999916


### Phase 9 CI execution note

- [!] First Phase 9 CI run 541 reached repository lint and failed on one unused destructuring binding in the snapshot digest helper; that binding was removed in commit `c932363ebc08c6e0c97ac38ef7c152f9be4c11ab`.
- [!] Follow-up PR workflow run 554 was cancelled before checkout/validation completed; it provides no verification evidence.
- [ ] Obtain a fresh successful repository-integrity and full-workspace CI run for the latest Phase 9 head before treating the store package as verified.


## Phase 10 — System Mode Orchestrator

**Branch:** feat/phase-10-system-mode-orchestrator

- [x] Add explicit System Mode lifecycle orchestration: recovery, discovery, trust validation, registry composition, persistence preflight, approval, reconciliation, verification, activation, and runtime handoff.
- [x] Require actor identity and fenced deployment lease.
- [x] Persist plan and verified receipt before activation.
- [x] Keep readiness false until runtime handoff succeeds.
- [x] Add SQLite-backed deployment journal with optimistic stage transitions and incomplete-run discovery.
- [x] Add test source for lifecycle ordering, journal recovery listing, stale transition rejection, and handoff failure.
- [ ] Integrate orchestrator and journal into ARSY Core and an explicit deployment/admin command.
- [ ] Implement recovery policy per interrupted stage, idempotency keys, heartbeat/abort, and shutdown safety.
- [ ] Add process contention, file-backed restart, crash recovery, and CI verification.

See docs/35-phase-10-system-mode-orchestrator.md. Runtime handoff failure after activation leaves readiness false and requires journal-driven recovery; automatic database rollback is intentionally not attempted.

