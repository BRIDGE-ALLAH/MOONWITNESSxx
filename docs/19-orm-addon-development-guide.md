# 19 — ORM Addon Development Guide

**Status:** Approved developer contract | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Purpose
Addon authors declare models/behavior in TypeScript. ORM composes BaseEntity; orm-db reconciles schema programmatically. Addons never import Kysely, raw SQL, database drivers, or provider APIs. No hand-authored schema migration files for ordinary model edits.

## 2. Addon contract
Each addon has unique technical name, semantic version, ORM compatibility, manifest, public exports, models, services/hooks, permissions, optional typed data-upgrade handlers, tests, docs. Persisted business addons depend on base unless documented otherwise.

## 3. Models
Manifest declares dependencies, models, services, permissions, optional data-upgrade handlers; no routine migration list. Models declare only domain fields, constraints, indexes, relations. Registry injects id, createdAt, createdById, updatedAt, updatedById exactly once. Actor IDs come from trusted execution context. Duplicates are fatal registry conflicts.

## 4. Optional mixins
createdBy/updatedBy: actor attribution; archivedAt/archivedBy: recoverable archive; version: optimistic concurrency; active/enabled: independent toggle; deletedAt: soft-delete. Apply only when domain requires semantics. Do not use active=false for archive/business status/deletion.

## 5. Extension
Extend only models from declared dependencies. Registry validates dependencies, collisions, type compatibility, deterministic order. No import-time model mutation/private cross-addon imports.

## 6. Schema sync
Compose models/BaseEntity/mixins → read actual schema/capabilities → deterministic plan → classify operations → authorized setup/release applies safe changes → run typed data-upgrade handlers if needed → verify/receipt. Repeated sync is a no-op. Safe additions: table, nullable field, portable default, compatible index, optional relation. Renames/type changes/required-field backfill/enum remap/split-merge/semantic changes require handler/mapping. Drops never automatic.

## 7. Data-upgrade handlers
Trusted TypeScript, not raw SQL; only for semantic transformation. Require stable ID/version boundary, pre/postconditions, idempotency, bounded batches, checkpoints, pause/resume, progress, audit context, timeout/budget, recovery notes. Long jobs run in workers/deployment task.

## 8. BaseEntity/mixins
BaseEntity has exactly id, createdAt, createdById, updatedAt, updatedById. These are composed once by the ORM. Optional OwnershipAttribution, Archiveable, Versioned, Toggleable, SoftDeletable, WorkspaceScoped and CompanyScoped mixins each document query and authorization semantics. Creator/updater attribution is not business ownership.

## 9. AuditTrail
Base owns generic record-change audit. Addons may publish domain events but never duplicate generic audit. SQL mutation and required audit insert share a transaction. External delivery uses transactional outbox. Redact secrets.

## 10. Portability
Use portable field/query APIs, UTC, exact money, tested common JSON/relation behavior. Do not assume row locks, concurrent SQLite writers, arrays, native enums, identical collations, vendor JSON. Same public API for portable features does not imply same performance/capabilities. Connection string change does not transfer data.

## 11. Developer workflow
Edit model → request private schema plan → review → safe local reconcile → tests both providers → commit model/typed handler code → CI plan/compatibility → one serialized release sync. All entrypoints call one SchemaReconciliationService.

## 12. Disable/uninstall
Disabling prevents services/routes/jobs loading. Uninstall never auto-drops tables or records. Export/retention/destructive removal require approved operation, impact report, verified backup.

## 13. Tests
Manifest/dependency, extension, BaseEntity once, mixins, conflict detection, query validation, plan determinism, idempotency/recovery, handler pre/postconditions, audit transactions, provider capabilities, export/typecheck.

## 14. Project addon
Owns Project domain fields/behavior only; reuses BaseEntity, mixins, central AuditTrail.

## 15. Intelligent addon
Owns AI/agent domain fields/behavior only. Stores secret references, not raw credentials; attributes usage/cost to run/task.


## 15. v1.3 authoritative base contract
This document's earlier three-field BaseEntity summary is superseded: inject id, createdAt, createdById, updatedAt and updatedById exactly once. The full base platform is not a universal model; it is a suite of independently declared addon manifests. See docs/22 for addon IDs, models, dependencies, mixins and strict ownership boundaries.


## 16. Current implementation status
The addon development guide defines the target contract; the ORM and addon packages are not yet implemented in the audited MOONWITNESS tree. Follow docs/23 for implementation order and repository P0 work. Do not create placeholder packages and report them complete.
