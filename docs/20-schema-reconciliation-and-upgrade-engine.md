# 20 — Programmatic Schema Reconciliation & Data Upgrade Engine

**Status:** Approved architecture contract | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Decision
RIOTWORKS uses code-first model declarations and programmatic schema reconciliation through ARSY's private operations API. Addon TypeScript models are the only desired-schema source. ORM composes desired schema; schema engine compares desired/actual provider schema; adapter applies safe physical schema operations through its DB connection.

Normal workflow does not use hand-authored SQL migration files, a migration directory, a schema generator, or migration-runner workflow. Changes derive from current model metadata and are idempotent. A database still executes provider-native DDL (CREATE/ALTER); no system changes physical schema without DB schema operations.

## 2. Single-owner responsibility
| Concern | Owner | Not owned by |
|---|---|---|
| Desired schema | ORM registry + trusted addons | Adapter/API caller |
| Model/domain semantics | packages/orm | Kysely/database |
| Diff/safety policy/plan | packages/orm-db | Addon/adapter |
| Physical introspection/DDL | SQL adapter | ORM registry |
| SQL compiler/dialect | Kysely inside adapter | Addon API |
| Trigger/authorization | ARSY internal API | Headquarter |
| Semantic data conversion | Typed data-upgrade handler | Schema reconciler |
| Generic audit | Base AuditTrail | Duplicate addon audit |
| Schema run ledger | orm-db system tables | Business audit |

No second ORM, schema registry, or schema engine.

## 3. Private control-plane API
- POST /internal/admin/schema/plan — read-only plan.
- POST /internal/admin/schema/reconcile — apply permitted safe changes.
- POST /internal/admin/schema/verify — verify desired/actual state.
- GET /internal/admin/schema/status — fingerprints, last run, lock, drift.
CLI, CI, deployment job, and HTTP call same SchemaReconciliationService. Require operator/deployment identity, least privilege. Never accept arbitrary SQL, user schema, executable code. Record actor, environment, request ID, plan hash, operations, result. Separate runtime DB credentials from schema-apply privilege where possible. Not a normal Headquarter feature.

## 4. Reconciliation algorithm
1. Validate trusted addon manifests/dependencies/versions.
2. Resolve graph deterministically.
3. Compose models with BaseEntity and explicit mixins.
4. Build canonical desired snapshot/fingerprint.
5. Read actual schema/capabilities via adapter.
6. Normalize provider schema.
7. Detect drift and calculate deterministic differences.
8. Classify with preconditions, impact, postconditions.
9. Acquire provider schema lock.
10. Re-read fingerprint to reject stale plan.
11. Apply allowed operations.
12. Run typed data-upgrade handlers only if required.
13. Re-introspect and verify.
14. Record plan hash, fingerprints, actor, environment, receipt, status, errors.
15. Release lock.
Same desired/actual schema yields no-op.

## 5. Adapter execution model
Engine calls adapter-neutral operations such as create table, add nullable field, create index, verify constraint. libSQL uses its client, SQLite-compatible introspection, tested Kysely libSQL dialect/schema builder. PostgreSQL uses pg, catalog/introspection, Kysely PostgreSQL schema builder. Kysely remains internal to adapters.
No universal REST schema API exists across SQL providers. ARSY supplies private API; adapters execute DDL through DB connection. This removes manual schema files, not provider DDL.

## 6. Change classes
SAFE_AUTO only when supported: create registered table; add nullable field; add portable default; add compatible index after uniqueness validation; add optional relation/constraint; non-breaking metadata.
REQUIRES_DATA_UPGRADE: rename preserving data, type/precision conversion, nullable-to-required backfill, enum remap, split/merge, semantic change, relation cardinality/ownership transformation.
DESTRUCTIVE: drop field/table/index, truncate/overwrite, narrowing with possible loss, risky cascade. Never automatic; approval, verified backup, impact report, recovery plan required.
UNSUPPORTED: typed capability error, never silently emulate.

## 7. Locking and recovery
One schema runner mutates at a time. PostgreSQL uses advisory lock/equivalent lease. libSQL uses DB-backed lease/compare-and-set; do not assume PostgreSQL lock semantics. Re-read schema before execution. Record operations. Make safe operations idempotent/resumable. On partial failure stop, introspect, reconcile ledger, generate fresh plan. Never blindly rollback partial/destructive changes. App remains unready if critical invariants are missing.

## 8. System schema ledger
Framework-owned reserved metadata tables: schema state (fingerprints/provider/ORM version), schema runs (plan hash/actor/environment/status), schema operations (precondition/result/checkpoint/error), addon registry (versions/model fingerprint), data-upgrade runs (handler/version/checkpoint/count/status). Bootstrap programmatically and exclude from addon uninstall. Ledger records execution/drift; it is not migration-file storage.

## 9. Data-upgrade handlers
Only when data meaning changes. Trusted TypeScript with stable ID/version, pre/postconditions, bounded batches, idempotency, checkpoints, pause/resume, progress/errors, audit context, timeout/budget, recovery notes. Long tasks run in deployment/worker, not HTTP or unbounded startup.

## 10. Modes
| Mode | Behavior | Use |
|---|---|---|
| plan | Inspect/report | CI/review |
| safe | Apply additive compatible changes | Local/serialized release |
| strict | Fail on unexpected drift | Production preflight |
| off | No schema writes | Read-only diagnostics |
Local=safe; CI=plan; staging=one serialized safe job; production=one serialized release with backup/readiness then strict verify. Destructive changes never unattended.

## 11. Ownership and drift
Every managed table has addon/model ownership metadata. Reconciler modifies only owned objects. Unmanaged tables/columns are preserved. Manual edits are reported as drift, not overwritten. Disabled/uninstalled addons retain data. Deletion is a separate approved operation.

## 12. BaseEntity
Inject only id, createdAt, updatedAt. Ownership, archive, toggle, soft-delete, version are explicit mixins. Reject duplicates and conflicting mixins.

## 13. Developer flow
Edit TypeScript model → request plan → review classification → safe local sync → tests → commit model/typed handler → CI verifies plan/compatibility → one serialized release job reconciles/verifies. No generated SQL migration files in standard workflow.

## 14. Acceptance
Model declarations are desired source; routine nullable field requires no handwritten migration; API/CLI call same reconciler; no arbitrary SQL/untrusted code; deterministic/idempotent plans; capability checked; safe changes applied/verified; destructive/semantic changes authorized; partial failure recoverable; no replica race; unowned objects preserved; schema ledger and AuditTrail do not overlap.


## 13. v1.3 composed schema scope
Desired schema is composed from the enabled base-platform addon manifests as well as business addons. BaseEntity injects id, createdAt, createdById, updatedAt and updatedById exactly once. Optional mixins and optional base addons contribute schema only when enabled. Schema plan/reconcile remains API-triggered through ARSY; adapters execute provider-native schema operations. This supersedes older three-field BaseEntity references.
