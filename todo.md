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
import { Model, fields } from "@moonwitness/orm";

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

- [ ] Confirm this static declaration map as the v1 canonical syntax because it is explicit, introspectable, and avoids relying on JavaScript instance-field initialization.
- [ ] Keep the declaration inside the model class/module source; it is not a separate schema file or database-first workflow.
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

- [ ] Review `docs/08-technical-architecture.md`, `docs/18-monorepo-and-orm-addon-architecture.md`, `docs/22-base-platform-and-orm-capability-blueprint.md`, and `docs/23-repository-audit-and-current-execution-plan.md`.
- [ ] Update docs/08 so its ORM description explicitly says programmatic TypeScript model declarations + composed registry + System Mode; avoid wording that implies a separate schema-first workflow.
- [ ] Update docs/08 provider roles to distinguish SQLite System Database from PostgreSQL Business Database.
- [ ] Keep docs/22 as the detailed ORM capability contract; link to it from the architecture overview.
- [ ] Keep docs/23 as the authoritative repository implementation inventory; do not mark planned packages as implemented.
- [ ] Record approved decisions as ADRs: declaration-based ORM, registry composition, System/Runtime Mode, environment/recordset, safe reconciliation, system/business DB split, and external plugin execution boundary.
- [ ] Add a glossary for Model, Field, Module, Addon, Plugin, Provider, Registry, Environment, Recordset, System Mode, Runtime Mode, Schema Plan, and Upgrade Handler.
- [ ] Document which Odoo concepts are adopted and which are intentionally redesigned for TypeScript; do not promise Odoo API compatibility.

**Acceptance criteria**
- [ ] No canonical document describes a separate manually maintained schema file as the model source of truth.
- [ ] Provider responsibilities are consistent across docs.
- [ ] The repository audit remains explicit about what is not implemented.
- [ ] Every architecture decision has one canonical home and cross-links rather than contradictory duplicated definitions.

### 1.2 Repair the monorepo before ORM feature work

- [ ] Fix the Headquarter package identity/scripts/dependencies so its Next.js source and package manifest agree.
- [ ] Implement or temporarily remove the unresolved `@riotworks/arsy-core` dependency from `apps/arsy`; do not leave a false package dependency.
- [ ] Remove the UI package from the ARSY backend dependency graph.
- [ ] Confirm `apps/arsy` as the only canonical HTTP backend application.
- [ ] Review the duplicate `services/arsy` and `services/queue` code; extract useful behavior, then retire duplicates deliberately.
- [ ] Repair root pnpm/Turbo scripts and package task dependencies; remove success-masking `|| true` from required checks.
- [ ] Ensure lint, typecheck, test, and build commands are deterministic and fail-fast.
- [ ] Establish package naming convention consistently, including the existing `adaptor` spelling if retained.
- [ ] Add/verify root `.gitignore`, `.dockerignore`, environment examples, and package export conventions.
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

- [ ] `packages/orm`: model declarations, field descriptors, model kinds, metadata types, registry composition, inheritance/extension, environment/recordset contracts, domain AST, validation, lifecycle contracts, and typed model APIs.
- [ ] `packages/orm-db-adaptor`: provider-neutral persistence capabilities and adapter interfaces; no concrete driver.
- [ ] `packages/orm-db`: transaction orchestration, unit-of-work, schema introspection/reconciliation coordination, schema ledger, and upgrade orchestration.
- [ ] `packages/orm-db-adaptor-postgres`: PostgreSQL pool/driver integration, type mapping, introspection, DDL, and query execution.
- [ ] `packages/orm-db-adaptor-sqlite` (or agreed package name): SQLite System Database adapter and required system-store operations; do not conflate this with the PostgreSQL business adapter.
- [ ] `packages/arsy-core`: ARSY application lifecycle, plugin composition, runtime context, logging, health, and service container.
- [ ] `packages/orm-addon-base`: independently installable base addon manifests and their models/services/policies.
- [ ] Keep `packages/types` framework/database-neutral.
- [ ] Keep `packages/contract` for API/event wire contracts, not ORM persistence definitions.

### 2.2 Define contracts before implementation

- [ ] Define `ModelConstructor`, `ModelDefinition`, `ModelKind`, `FieldDefinition`, `RelationDefinition`, `MixinDefinition`, and `ModelExtensionDefinition`.
- [ ] Define `AddonManifest` and `ModuleManifest` separately; a plugin package may provide one or more modules.
- [ ] Define package/module IDs, semantic versions, compatibility ranges, dependencies, conflicts, capabilities, and public exports.
- [ ] Define `RegistrySnapshot` with deterministic ordering and stable fingerprint/hash.
- [ ] Define adapter capability negotiation so unsupported provider features fail explicitly.
- [ ] Define typed error classes/codes for declaration errors, registry conflicts, access denial, validation, concurrency, provider capability gaps, and system reconciliation failures.
- [ ] Define public API versus internal API boundaries. Addons must not import private ORM internals.
- [ ] Define package export maps and enforce dependency direction with lint rules.

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

- [ ] Implement immutable/scoped `Environment`.
- [ ] Include transaction/unit-of-work handle.
- [ ] Include authenticated principal/service identity.
- [ ] Include trusted workspace/tenant context.
- [ ] Include optional company context and allowed-company set.
- [ ] Include locale, timezone, and relevant formatting context.
- [ ] Include permission evaluator and field-policy context.
- [ ] Include request/trace/correlation metadata.
- [ ] Include access to approved ARSY services/providers through capability interfaces.
- [ ] Implement safe environment derivation (for example with user/context/tenant) without mutating the parent environment.
- [ ] Prevent user-controlled context from escalating principal, tenant, company, or permissions.
- [ ] Ensure nested environment changes cannot silently escape transaction boundaries.

### 5.2 Recordset

- [ ] Implement typed recordset identity: model + environment + ordered record identities.
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

- [ ] Implement transaction-scoped Unit of Work.
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

---

## 19. Phase 14 — Living Evidence Graph & Epistemic Memory

**Status:** [~] Event ledger + PostgreSQL transactional adapter/migration + native tests authored; System Mode migration orchestration, evidence graph projections, source-span capture, and runtime wiring remain. See implementation PR.  
**Goal:** Make every consequential ARSY conclusion reconstructable from the evidence, assumptions, decisions, and system state that existed at the time.

- [ ] Define a versioned Evidence Graph schema: Evidence, Claim, Source, Observation, Belief, Decision, Action, Outcome, Counterevidence, and Supersession edges.
- [ ] Preserve immutable source observations and content hashes; keep extracted claims separate from raw evidence.
- [ ] Record bitemporal metadata: valid time (when a fact applies) and transaction time (when the system learned/stored it).
- [ ] Add provenance links from every claim to exact source spans, tool outputs, actor, timestamp, and ingestion method.
- [ ] Add belief lifecycle states: candidate, supported, contested, superseded, rejected, and expired; never silently overwrite conflicting beliefs.
- [ ] Implement contradiction detection and evidence-weighted promotion gates; confidence is a calibrated estimate, not a truth guarantee.
- [ ] Add decision records containing alternatives, constraints, assumptions, policy version, evidence snapshot, rationale, and approval context.
- [ ] Implement a query API for “what did ARSY know then?”, “why did it decide?”, “what evidence changed?”, and “which current claims depend on this source?”
- [ ] Add citation-lock behavior: generated claims may cite only evidence actually retrieved/opened in the current reasoning context.
- [ ] Add privacy-aware retention, redaction, deletion/tombstone semantics, and cryptographic audit continuity without retaining data that policy requires deleting.
- [ ] Build benchmark fixtures for stale evidence, source poisoning, contradictory facts, temporal corrections, missing provenance, and retrieval omissions.
- [ ] Compare against Graphiti, Hindsight, Mem0, PROJECTMEM, and Agent Zero Memory; document capability differences rather than claiming superiority without measurements.

**Exit gate:** A deterministic replay can reconstruct the evidence and belief state at a chosen historical point; every promoted claim has inspectable provenance; conflict and deletion behavior pass automated tests.

## 20. Phase 15 — ARSY Reality Replay & Counterfactual Safety Engine

**Status:** [~] Initial code vertical slice in `packages/arsy-core/src/replay/`; sandbox runner, external fixture adapters, capsule persistence, and automated safety tests remain. See implementation PR.  
**Goal:** Evaluate high-impact actions against a reproducible snapshot before execution, and preserve the relationship between prediction and observed outcome.

- [ ] Define a Replay Capsule: registry fingerprint, policy version, actor/tenant scope, input snapshot, evidence IDs, tool versions, random seeds where controllable, and external dependency declarations.
- [ ] Capture execution as typed events with causality IDs, parent/child spans, idempotency keys, and deterministic ordering where possible.
- [ ] Build a replay runner with mockable external boundaries; never repeat irreversible external side effects during replay.
- [ ] Add counterfactual branches for proposed parameter/policy/action changes and compare expected outcomes against a baseline.
- [ ] Implement a pre-action risk gate: classify reversibility, blast radius, data sensitivity, policy constraints, evidence freshness, and confidence.
- [ ] Require human approval for destructive, financial, permission-changing, or externally consequential actions unless a separately approved policy explicitly permits them.
- [ ] Add invariant assertions before and after execution (tenant isolation, authorization, balance/quantity constraints where applicable, schema compatibility).
- [ ] Add outcome reconciliation: compare predicted and observed effects, calculate drift, and feed calibrated error signals into future risk estimates.
- [ ] Add failure injection and recovery tests for timeout, duplicate delivery, partial commit, provider outage, and stale registry.
- [ ] Expose a human-readable replay report with timeline, evidence, action diffs, policy decisions, side-effect boundaries, and recovery status.
- [ ] Establish evaluation metrics: replay fidelity, side-effect containment, decision calibration, false-block rate, unsafe-action escape rate, and recovery success.
- [ ] Prototype with a narrow, reversible workflow before generalizing to all ARSY tools.

**Exit gate:** The same recorded input and controlled dependencies reproduce the same internal decision path within documented tolerances; replay cannot trigger live side effects; high-impact actions are blocked or approval-gated when evidence/policy is insufficient.

## 21. Research and novelty validation gate

- [ ] Maintain a prior-art matrix for each proposed capability, including papers, GitHub projects, standards, patents where relevant, and known limitations.
- [ ] Distinguish genuinely new algorithms from novel product integration or engineering combinations.
- [ ] Record source URL, publication/version date, license, benchmark methodology, and implementation status.
- [ ] Do not use “first in the world”, “never done before”, or equivalent claims without a defensible prior-art search and independent review.
- [ ] Prefer measurable hypotheses and reproducible prototypes over speculative feature claims.
- [ ] Re-run the research review before public release because the agent infrastructure ecosystem changes quickly.


## 22. Phase 16 — Causal Blast-Radius Mesh & Change Digital Twin

**Status:** [~] Framework-neutral impact graph traversal and tests authored; trace ingestion, scenario runner, calibration, and real workflow benchmark remain.  
**Goal:** Predict the downstream impact of a proposed change across data, policies, agents, integrations, and user-visible workflows before it is applied.

- [~] Add framework-neutral typed impact graph and conservative blast-radius traversal in `packages/arsy-core/src/causal/impact.ts`; event ingestion and production graph projection remain.
- [ ] Distinguish correlation, declared dependency, and experimentally supported causal edge; attach confidence and provenance to each edge.
- [ ] Create a Change Impact Capsule containing proposed diff, affected entities, policy/registry fingerprints, and current evidence snapshot.
- [ ] Run bounded counterfactual scenarios against isolated fixtures; estimate blast radius, reversibility, affected tenants, and recovery cost.
- [ ] Add a “no-op / do nothing” baseline so ARSY can recommend delaying an action when evidence is weak.
- [ ] Generate a machine-readable impact report and a human-readable explanation with uncertainty intervals and missing evidence.
- [ ] Calibrate predictions against post-deployment observations; track false-positive and missed-impact rates.
- [ ] Start with schema/policy changes and a single reversible workflow; do not claim a general digital twin prematurely.

**Exit gate:** Impact predictions are benchmarked against recorded changes; causal edges are provenance-backed; uncertainty is explicit; no scenario can touch live external systems.

## 23. Phase 17 — Knowledge Immune System & Adversarial Provenance Defense

**Status:** [~] Evidence quality vector, trust disposition, independent-source corroboration, contamination index, and tests authored; persistent source registry, adversarial corpus, operator review, and calibrated policy remain.  
**Goal:** Detect poisoned, manipulated, stale, coordinated, or context-stripped evidence before it contaminates beliefs and downstream actions.

- [~] Add separate authenticity/authority/freshness/context/signature dimensions and fail-closed quarantine evaluation in `packages/arsy-core/src/knowledge/provenance.ts`; persistent source identity and signed acquisition remain.
- [ ] Detect near-duplicate campaigns, sudden source behavior changes, quote/context mismatch, temporal anomalies, and conflicting independent observations.
- [~] Add in-memory source → evidence → claim → decision contamination index; durable dependency graph and action gate integration remain.
- [ ] Introduce quarantined evidence state and reversible belief promotion; never delete counterevidence during conflict resolution.
- [ ] Use independent corroboration classes and diversity constraints; multiple copies of one origin do not count as independent sources.
- [ ] Add adversarial fixtures for prompt injection in retrieved content, forged citations, source spoofing, replayed stale evidence, and coordinated repetition.
- [ ] Add a “belief circuit breaker” that freezes promotion and high-impact actions when provenance integrity falls below policy thresholds.
- [ ] Provide explainable quarantine reports and an operator appeal/release path.
- [ ] Evaluate precision/recall, time-to-detection, contamination depth, false quarantine rate, and downstream action prevention.
- [ ] Ensure privacy, retention, deletion, and user correction semantics remain enforceable.

**Exit gate:** Poisoned evidence fixtures are quarantined before belief promotion; contamination can be traced and rolled back; false-positive rates are measured; safety gates fail closed without blocking unrelated trusted evidence.



## Phase 18 — Provenance-Bound Capability Delegation & Runtime Contract

**Status:** [~] Initial capability-chain evaluator and escalation tests authored in `packages/arsy-core/src/runtime-contract/capability.ts`; trusted issuer registry, canonical signature format, enforcement middleware integration, and production key rotation remain.

**Goal:** Ensure every tool action is authorized for the original principal, current tenant, purpose, resource and action—not merely because an agent or intermediary possesses ambient credentials.

- [~] Add root-to-leaf capability grants with subject, issuer, tenant, purpose, action/resource scopes, validity window and signature envelope.
- [~] Enforce attenuation-only delegation: child grants cannot widen parent action/resource scope, tenant, purpose or lifetime.
- [~] Verify each grant through an injected trusted verifier; do not let the model provide or override the trust anchor.
- [ ] Add issuer trust registry, key rotation/revocation, canonical serialization and signature verification backed by the deployment key-management system.
- [ ] Bind capability evaluation to actual MCP/tool gateway and deny before credentials or side effects are exposed.
- [ ] Add TOCTOU protection: bind the authorization decision to immutable normalized tool arguments and a short-lived one-time nonce.
- [ ] Add explicit delegation chain to audit/evidence events, including the initiating human principal and every intermediate agent.
- [ ] Add cross-tenant, replayed-grant, expired-grant, privilege-escalation and confused-deputy adversarial tests.

**Exit gate:** No agent or sub-agent can exceed the original principal's grant; every effectful tool invocation is denied at the enforcement boundary when capability verification or context binding fails.

## Phase 19 — Proof-Carrying Execution & Attestable Outcomes

**Status:** [~] Trace invariant validator and digest-bound attestation prototype authored in `packages/arsy-core/src/attestation/proof.ts`; signature anchoring, durable storage, trusted effect receipts and runtime issuance remain.

**Goal:** An action is considered completed only when the system can present a verifiable contract, policy decision, observed effect and terminal outcome—not merely a successful model response.

- [~] Define typed execution events for policy allow/deny, approval and effect lifecycle.
- [~] Validate sequence continuity, tenant consistency, prior authorization, approval timing, actor consistency and terminal effect records.
- [~] Generate a SHA-256 trace digest and trace-consistent attestation only when the validator reports no invariant violation.
- [ ] Bind the attestation to a signed execution contract and append-only Evidence Ledger event.
- [ ] Require effectors to emit receipts with idempotency key, normalized request hash, provider reference and observed result hash.
- [ ] Add external trust anchoring (KMS/HSM-backed signature or equivalent) and verifier CLI/API.
- [ ] Define partial-commit and compensation states; an effect marked failed is not equivalent to an effect that never happened.
- [ ] Test forged receipts, trace truncation, reordered events, tenant switching, denied-but-executed actions and approval-after-effect.

**Exit gate:** An independent verifier can reject forged, incomplete, reordered or unauthorized execution traces; no success status is issued without an effect receipt and valid terminal state.

## Phase 20 — Continuous Agent Safety Lab & Counterfactual Policy Testing

**Status:** [~] Deterministic trace diagnosis and confusion-matrix evaluator authored in `packages/arsy-core/src/evaluation/safety-suite.ts`; benchmark corpus, CI thresholds, mutation runner and regression dashboard remain.

**Goal:** Turn every incident, policy change and new agent capability into a reproducible adversarial regression test.

- [~] Add deterministic trace findings for denied effects, missing authorization, actor mismatch, missing approval, incomplete effect and cross-tenant execution.
- [~] Add scenario suite evaluation with true/false positive and negative counts, precision and recall.
- [ ] Import a curated subset of public AgentDojo/TraceProbe-style scenarios after checking dataset and code licenses.
- [ ] Add mutation testing for policy rules: remove, weaken or reorder one rule and prove that known attack traces become detectable.
- [ ] Add metamorphic tests: duplicate tool calls, reorder independent events, alter tenant IDs, expire grants, replace source provenance, and truncate traces.
- [ ] Add CI release gates for unsafe-action escape rate, false-block rate, trace coverage and replay determinism; thresholds must be calibrated to a declared corpus.
- [ ] Persist minimized failing traces as regression fixtures with privacy-safe redaction and provenance.
- [ ] Add incident-to-test workflow: an operator-approved incident report generates a reproducible test proposal, never an automatically trusted policy update.

**Exit gate:** Each release runs a versioned adversarial suite; policy regressions are detected before deployment; metrics and false positives are reported with the exact corpus version.

## Phase 21 — Developer Environment Doctor

**Status:** [~] Read-only Node/pnpm/workspace/lockfile/dependency readiness diagnostics authored in `scripts/devx/cli.mjs`; clean-machine validation, platform matrix and setup automation remain.

- [~] Add stable machine-readable doctor findings with pass/warn/fail, remediation text and summary.
- [~] Check Node baseline, exact pnpm pin, workspace globs, lockfile, safe env template, installed dependencies and package scripts.
- [ ] Validate on clean Linux/macOS/Windows environments and document optional service prerequisites.
- [ ] Add devcontainer or Nix-based reproducible environment only after measuring actual setup pain and image/toolchain maintenance cost.
- [ ] Add an onboarding contract test ensuring every required step maps to a runnable command or human prerequisite.

**Exit gate:** a new contributor can diagnose setup blockers in one command without mutating files or requiring network access beyond the already-installed package manager.

## Phase 22 — Change-Aware Workspace Task Graph

**Status:** [~] Read-only changed-file → package ownership → reverse dependency planner authored in `scripts/devx/lib.mjs`; DAG ordering, worktree collision analysis and measured CI savings remain.

- [~] Collect committed, staged, unstaged and untracked paths.
- [~] Resolve owning packages and reverse workspace dependents.
- [~] Emit only commands backed by scripts actually present in package manifests.
- [ ] Add topological DAG execution with bounded concurrency and fail-fast/continue policy.
- [ ] Add task-to-file/dependency provenance in machine-readable output.
- [ ] Compare selected verification with full CI and ensure no false-negative test selection.
- [ ] Add optional worktree collision forecast for parallel agent tasks.

**Exit gate:** change-aware checks reduce unnecessary local test time without weakening required full CI or missing affected package regressions.

## Phase 23 — Agent Context Compiler & Repository Flight Recorder

**Status:** [~] Allowlisted, bounded, fingerprinted repository context compiler authored in `scripts/devx/lib.mjs`; task execution receipts, context freshness leases and agent adapters remain.

- [~] Compile architecture instructions, workspace map, package scripts and governance into Markdown or versioned JSON.
- [~] Add deterministic SHA-256 fingerprint and explicit truncation behavior.
- [~] Exclude environment files and arbitrary source files; redact sensitive-looking key/value lines.
- [ ] Add context freshness lease and automatic invalidation when source instructions/manifests/CI change.
- [ ] Add opt-in local task receipt with repository fingerprint, command, toolchain, changed paths, exit code and test evidence.
- [ ] Add cross-agent adapters for Codex/Claude/Copilot using existing standard files; avoid duplicating prompts.
- [ ] Measure time-to-first-successful-PR, context token cost, correction rate and unrelated-file edit rate.

**Exit gate:** a coding agent can reconstruct the repository's current ownership and valid verification commands from a small, fingerprinted artifact; every task receipt reports observed facts, not inferred success.

## Phase 24 — Repository Flight Recorder

**Status:** [~] Local append-only JSONL receipts with same-process append serialization, canonical SHA-256 hash chain and verifier implemented.

- [x] Append sequenced records with previous-hash linkage.
- [x] Verify ordering, malformed lines and content tampering.
- [x] Test concurrent same-process appends and tamper detection.
- [ ] Add cross-process file locking and crash-safe checkpoint recovery.
- [ ] Add receipt schema for repository fingerprint, command, toolchain, changed paths, exit code and test evidence.
- [ ] Add signed checkpoints and external anchoring before treating receipts as attestations.

**Exit gate:** receipts are reproducible and verifiable; no security claims beyond the implemented local hash chain.

## Phase 25 — Parallel Workset Collision Forecast

**Status:** [~] Static write-path collision forecast implemented; runtime resource and semantic conflict detection remain.

- [x] Detect same-path and ancestor/descendant path overlaps.
- [x] Reject absolute paths and parent traversal.
- [x] Emit machine-readable severity and safe-to-parallelize status.
- [ ] Add declared interface/API/schema ownership leases.
- [ ] Add runtime resource passport for ports, DB/schema, queues, volumes and environment namespaces.
- [ ] Integrate with worktree orchestration only after resource isolation is validated.

**Exit gate:** static collisions are detected before launch; disjoint paths are not misrepresented as proof of runtime isolation.

## Phase 26 — Context Freshness Lease

**Status:** [~] Explicit TTL- and fingerprint-bound context lease implemented.

- [x] Bind lease to repository context SHA-256 fingerprint.
- [x] Reject changed fingerprints, expired leases and invalid timestamps.
- [x] Refuse implicit overwrite when writing lease files.
- [ ] Add automatic regeneration in supported agent adapters.
- [ ] Add signed lease and policy integration only if a real trust boundary requires it.

**Exit gate:** stale or expired context fails verification before an agent proceeds; a lease is never treated as an authorization credential.

## Phase 27 — Objective Delta Watchdog
**Status:** [x] Deterministic objective-gap fingerprinting and repeated-gap watchdog implemented; automatic pause/replan adapter and calibrated benchmark remain.
- [x] Normalize and fingerprint unresolved tests, missing criteria and blockers independent of ordering.
- [x] Detect repeated consecutive gap fingerprints despite changing activity text.
- [x] Emit a conservative pause-and-replan recommendation after a configurable threshold.
- [ ] Connect verified test-runner output and acceptance-criterion IDs to observations.
- [ ] Calibrate false-loop and missed-loop rates before automatic cancellation.
**Exit gate:** repeated observed gaps only; no process termination without an explicit runtime adapter.

## Phase 28 — Interface Treaty
**Status:** [x] Treaty validation and static provider/consumer breaking-change forecast implemented; commit-time enforcement and schema-diff adapters remain.
- [x] Declare owner, provided/consumed interfaces, breaking changes and expiry.
- [x] Reject malformed, expired and duplicate declarations.
- [x] Detect duplicate providers and breaking changes consumed by another agent.
- [ ] Derive declarations from TypeScript exports, OpenAPI, GraphQL and migration plans.
- [ ] Revalidate treaty fingerprints at commit/merge boundaries and require consumer acknowledgement.
**Exit gate:** static conflicts block the advisory integration check; declarations are not claimed complete or automatically inferred.

## Phase 29 — Runtime Resource Passport
**Status:** [x] Resource passport generation and static port/database/queue/volume/environment collision forecast implemented; runtime provisioning/isolation remains.
- [x] Validate agent IDs, resource identifiers and host port range.
- [x] Generate deterministic per-agent namespaced identifiers for non-port resources.
- [x] Detect duplicate host ports and shared resource identifiers before launch.
- [ ] Add Docker Compose, ephemeral database, service discovery and secret-injection adapters.
- [ ] Add runtime reservation/release with leases, crash cleanup and cross-host coordination.
- [ ] Benchmark startup latency and isolation leakage against worktree-only and VM-per-agent baselines.
**Exit gate:** advisory until a runtime adapter reserves and enforces each resource; no claim of actual database, volume, secret or network isolation.

## Phase 30 — Objective-Gap Control Plane
**Status:** [x] Evidence-gated objective aggregation and prioritized next-action frontier implemented; external evidence authentication and live agent routing remain.
- [x] Model objectives and acceptance criteria separately from activity logs.
- [x] Require latest verified, timestamp-valid evidence for criterion completion.
- [x] Emit deterministic gap fingerprints, owners and next actions.
- [ ] Bind observations to signed CI/test receipts and independent reviewer identities.
- [ ] Connect the frontier to an agent scheduler with bounded retries and explicit stop conditions.
**Exit gate:** no criterion is marked complete from agent prose or activity alone.

## Phase 31 — Interface Escrow
**Status:** [x] Breaking-interface escrow and exact-fingerprint consumer acknowledgements implemented; automatic schema diffing and merge hooks remain.
- [x] Compute a contract fingerprint over the declared breaking interface set and consumer treaties.
- [x] Require every declared impacted consumer to acknowledge the exact fingerprint before readiness.
- [x] Reject unknown consumers, stale fingerprints, duplicate acknowledgements and expired escrows.
- [ ] Derive interface changes from TypeScript/OpenAPI/GraphQL/SQL migration diffs.
- [ ] Bind acknowledgements to authenticated GitHub identities and branch-protection checks.
**Exit gate:** changed contracts remain blocked until every declared consumer acknowledges the same contract snapshot.

## Phase 32 — Proof-Carrying Merge Queue
**Status:** [x] Fail-closed merge evidence packet validator and deterministic digest implemented; GitHub check authentication and merge queue adapter remain.
- [x] Recompute objective readiness, interface escrow and declared resource collisions from packet inputs.
- [x] Require four named quality gates, evidence hashes and a verified rollback plan.
- [x] Emit a deterministic SHA-256 packet digest and explicit blockers.
- [ ] Verify CI run IDs/check suites against GitHub API and bind them to the exact commit SHA.
- [ ] Sign packets with an organization-managed key and persist immutable release receipts.
- [ ] Integrate GitHub merge queue only after review, branch-protection and provenance policy are verified.
**Exit gate:** local packet readiness is advisory until external checks, identity, signatures and repository merge policy are authenticated.

## Phase 18–20 hardening update (2026-11-08)
- [x] Phase 18: reject malformed/blank capability context and fail closed on verifier outages.
- [x] Phase 19: enforce approval-after-allow ordering, reject duplicate approvals, bind trace digest to contract identity and prevent pre-trace attestation issuance.
- [x] Phase 20: detect empty traces, malformed context, duplicate policy decisions and cross-tenant terminal receipts; mark undefined benchmark metrics as null rather than perfect.
- [ ] Authenticated issuer registry, signed attestation envelope/KMS, actual tool-gateway enforcement, licensed benchmark import and calibrated CI thresholds remain open.
See `docs/30-arsy-phases-18-20-hardening.md`. These are deterministic contract checks, not production security enforcement.
