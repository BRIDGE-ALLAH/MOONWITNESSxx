# Phase 7 — Approval-Bound Schema Reconciliation

**Status:** Initial reconciler implementation; real-adapter integration gate open.

## Implemented

- Persist the plan before attempting schema changes.
- Bind plan execution to exact provider identity (provider plus role), so SQLite/System and PostgreSQL/Business cannot be crossed.
- Support off, plan, safe and strict reconciliation modes.
- Apply safe operations in safe mode; leave review/destructive operations unapplied unless the configured approval rules are satisfied.
- Require per-operation approval, an approval ID, matching approving actor and allowDestructive=true for destructive changes.
- Strict mode preflights every operation and refuses the entire plan before executing any DDL if any operation is not approved.
- Record operation results, failure details, actor, approval ID and verification status in a reconciliation receipt.
- Inspect the resulting database snapshot and verify applied table/column/index operations before marking a receipt verified.
- Add tests for safe mode, plan-only mode, destructive approvals, strict preflight and provider-role mismatch.

## Important limits

- The adapter SPI currently exposes executeSchemaOperation without a transaction argument. Concrete adapters must guarantee atomicity per operation; multi-operation transactional grouping is not yet provided.
- The current verification covers create-table, add-column, alter-column and create-index. Constraint/custom operation verification remains unsupported and therefore cannot be marked verified.
- ReconciliationStore is injected; a durable SQLite System Database implementation and serialized System Mode activation lock remain open.
- Approval records are supplied by trusted server-side policy code. This module does not itself authenticate an approver or persist an approval workflow.

## Acceptance gates

1. Run reconciler tests, typecheck and lint in CI.
2. Implement SQLite/PostgreSQL adapters with safe DDL execution and introspection.
3. Implement durable plan/receipt/approval storage in SQLite System Database.
4. Add atomic operation grouping, lock ownership, restart recovery and idempotent receipts.
5. Add end-to-end tests proving unapproved destructive DDL cannot execute.
