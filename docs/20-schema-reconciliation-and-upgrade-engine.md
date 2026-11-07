# 20 — Programmatic Schema Reconciliation & Data Upgrade Engine

**Status:** Approved architecture contract  
**Version:** 1.0  
**Updated:** 2026-11-07

## 1. Decision

RIOTWORKS uses **code-first model declarations with programmatic schema reconciliation**.

Addon authors declare the desired model in TypeScript. ORM composes all models, compares the desired schema with the actual database schema, plans differences, applies safe compatible changes, verifies the result, and records the schema state.

Hand-authored migration scripts are **not required for ordinary schema changes** such as adding a model or nullable field.

The word "migration" may still exist inside a database provider's own deployment mechanism (for example PocketBase's native pb_migrations). That is an implementation/deployment artifact, not a manual task repeated by every addon developer.

## 2. Three distinct concepts

### A. Schema declaration
The desired schema is expressed in addon source:
- model names;
- fields and types;
- defaults and nullability;
- indexes and uniqueness;
- relations;
- constraints;
- adapter mapping metadata.

This is the source of truth.

### B. Schema reconciliation
A programmatic engine compares the declared schema with the real provider schema and safely converges actual schema toward desired schema.

This is automatic infrastructure.

### C. Data upgrade
A developer-written typed function is used only when the system cannot safely infer how existing data should be transformed.

Examples:
- convert a legacy string to a structured object;
- merge two old fields;
- split one field into two;
- map old enum values to new business meanings;
- backfill derived values;
- move records between models.

These are not routine schema migrations and should be rare, explicit, testable, and idempotent.

## 3. Engine components

Located primarily in:
- packages/orm: model metadata and composed desired schema.
- packages/orm-db: SchemaReconciler, diff planner, application lock, schema history, verification.
- packages/orm-db-adaptor: schema capability contracts and provider-neutral operations.
- packages/orm-db-adaptor-pocketbase: PocketBase schema compiler, collection operations, native artifact generator/capture.
- addon packages: model declarations and optional typed data-upgrade handlers.

Suggested internal components:
- SchemaSnapshot
- DesiredSchemaBuilder
- ActualSchemaReader
- SchemaDiffer
- SchemaChangePlan
- SchemaChangeClassifier
- SchemaReconciler
- SchemaApplyLock
- SchemaHistoryRepository
- SchemaVerifier
- DataUpgradeRunner
- ProviderArtifactGenerator

## 4. Reconciliation algorithm

1. Load trusted addon manifests.
2. Validate addon IDs, versions, dependencies, and conflicts.
3. Resolve dependency graph deterministically.
4. Compose all model metadata and shared BaseEntity fields.
5. Build desired schema snapshot and stable fingerprint.
6. Read actual schema snapshot through the active adapter.
7. Normalize provider-specific schema to canonical metadata.
8. Calculate differences.
9. Classify each difference.
10. Build plan, impact summary, and generated provider artifact if needed.
11. Acquire a schema application lock.
12. Re-read schema/fingerprint to prevent stale plans.
13. Apply only permitted changes.
14. Run declared data-upgrade handlers where required.
15. Verify resulting schema and key invariants.
16. Record addon version, schema fingerprint, plan hash, artifact receipt, and status.
17. Release lock and allow app readiness.

If validation, application, or verification fails, the addon must not be reported ready. Preserve a structured failure report and a recovery action.

## 5. Change classification

### SAFE_AUTO
May be applied automatically if the adapter supports it:
- new collection/table;
- new nullable field;
- new field with an explicit safe default;
- compatible index;
- optional relation;
- non-breaking description/label metadata.

### REQUIRES_DATA_UPGRADE
Needs a typed and reviewed handler:
- rename where mapping must be explicit;
- type conversion;
- precision change;
- required-field backfill;
- enum value remapping;
- split/merge or semantic transformation.

### DESTRUCTIVE
Never auto-apply:
- drop field/model/collection/index;
- narrowing a field with potential data loss;
- relation changes with cascade/deletion impact;
- overwrite or truncate.

Requires backup verification, explicit impact plan, owner authorization, and a recovery strategy.

### UNSUPPORTED
The active adapter cannot safely express the operation. Fail clearly and explain the capability gap. Do not silently emulate.

## 6. Synchronization modes

| Mode | Behavior | Recommended use |
|---|---|---|
| plan | Compare and report only | CI, review, drift check |
| safe | Apply compatible additive/non-destructive changes | Local development; controlled release job |
| strict | Fail when unexpected drift exists | Production health / release gate |
| off | No mutation; report state | Read-only diagnostics |

Default policy:
- Local development: safe.
- CI: plan, with unexpected drift causing failure.
- Staging: safe in a serialized deployment step.
- Production: strict readiness plus a single serialized release/schema task; safe changes may be applied by that task according to explicit deployment policy.
- Destructive changes: never unattended.

Do not have multiple ARSY instances reconcile the same database concurrently. Use a lock and re-check the schema fingerprint before applying.

## 7. PocketBase implementation

PocketBase is a separate service with SQLite-backed collections. The RIOTWORKS adapter must use supported collection and record APIs; it is not a direct SQL driver.

### Desired flow
1. ORM composes addon models into canonical schema metadata.
2. PocketBase schema compiler maps canonical fields to PocketBase collection/field definitions.
3. Adapter reads existing collection configuration and calculates the difference.
4. Safe supported collection operations are applied or compiled into PocketBase-native artifacts.
5. When PocketBase --automigrate is enabled, configuration changes made through Dashboard or Web API generate native files in pb_migrations.
6. Generated files are preserved in version control and promoted with the application release.
7. PocketBase applies pending native migrations through serve or migrate up.
8. Reconciler checks resulting collection definitions and records the schema fingerprint.

PocketBase officially documents that unapplied JavaScript migrations in pb_migrations run automatically on serve or migrate up, and that the prebuilt executable enables --automigrate by default for collection configuration changes made through Dashboard or Web API. PocketBase also documents programmatic collection operations in its JavaScript migration runtime.

Official references:
- https://pocketbase.io/docs/js-migrations/
- https://pocketbase.io/docs/collections/
- https://pocketbase.io/docs/js-collections/

### Important boundaries
- Superuser collection-management credentials remain only in the protected server/deployment environment.
- Headquarter never talks to PocketBase as superuser.
- Do not directly mutate PocketBase internal SQLite tables.
- Do not claim arbitrary SQL joins or transaction semantics through the remote SDK.
- Respect View collection read-only behavior and Auth collection system fields.
- PocketBase's native migration transaction is not a blanket promise that ordinary remote SDK CRUD plus AuditTrail is atomic.
- Generated PB migration files are provider deployment artifacts; addon authors should not hand-write them for routine fields.

### Version control and environments
- Development may use PocketBase automigrate to generate files after programmatic/Dashboard/API schema edits.
- Review/squash noisy development artifacts before promotion.
- Commit the resulting pb_migrations artifacts.
- CI checks that model declarations and committed provider artifacts are in sync.
- Production applies the committed artifacts through PocketBase's own migration lifecycle.
- Never rely on a mutable container filesystem as the only copy of generated schema artifacts.

## 8. BaseEntity mapping

The canonical ORM BaseEntity is composed into every persisted model by orm-addon-base and the model registry.

For PocketBase, canonical logical fields can map to native PocketBase system fields:
- ORM id → PocketBase id.
- ORM createdAt → PocketBase created.
- ORM updatedAt → PocketBase updated.

Custom fields such as active, createdBy, and updatedBy are added through collection metadata as needed. Do not create duplicate physical createdAt/updatedAt fields when the adapter can map native system fields correctly.

AuditTrail remains a separate base-owned collection/model with provider-aware writes and permission controls.

## 9. Typed data-upgrade handlers

Use typed handlers only for semantic data transformation.

Required contract:
- stable handler ID;
- addon version boundary;
- preconditions;
- transformation function using approved ORM/context APIs;
- batch size and checkpoint;
- idempotency key;
- audit context;
- postconditions;
- timeout/resource budget;
- recoverability or compensation note.

Large transformations must support pause/resume and report processed/failed counts. Do not run unbounded work in Fastify startup. Use a deployment job/worker and keep the application unready only for changes that are truly required before serving traffic.

## 10. Schema history and drift

Maintain a system-owned schema/addon ledger with:
- addon name/version;
- ORM metadata fingerprint;
- adapter actual-schema fingerprint;
- plan hash;
- provider artifact names/checksums;
- applied timestamp and actor;
- environment;
- result and error.

This history enables drift detection, deterministic deployments, and support diagnostics. It is not a requirement for developers to author migrations.

## 11. Developer experience

Normal addon author workflow:

1. Add or edit a model in the addon TypeScript source.
2. Run pnpm arsy schema:plan.
3. Review generated diff and capability classification.
4. Run pnpm arsy schema:sync --mode=safe in development.
5. Run addon tests and verify data.
6. Commit the model change and any generated PocketBase-native artifact.
7. CI checks the schema plan is clean.
8. Production release runs the serialized schema deployment job.

The exact CLI names are proposed contracts; implement consistent commands and document actual names when built.

## 12. Acceptance criteria

- No hand-written migration is required for a normal new model/nullable field.
- Addon TypeScript declarations are the source of desired schema.
- Schema diff is deterministic and idempotent.
- Adapter capabilities are checked before application.
- Unsupported schema operations fail explicitly.
- Safe changes are applied programmatically.
- Destructive or semantic data changes require an explicit plan/handler and approval.
- PocketBase provider artifacts are generated/captured and version-controlled.
- Production applies schema changes in a serialized deployment step.
- Schema drift is observable.
- Addon authors never duplicate BaseEntity or generic AuditTrail.
