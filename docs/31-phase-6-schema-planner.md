# Phase 6 — Deterministic Schema Planner

**Status:** Initial planning implementation; execution and persistence gates open.

## Implemented

- Derive desired physical tables from persistent model registry entries.
- Map declared field kinds to provider-specific SQLite/PostgreSQL storage types.
- Plan missing tables and additive columns without dropping unknown/existing data.
- Plan indexes from declared index/unique metadata.
- Classify nullable additions and new tables as safe, required additions without defaults as review, and type changes as destructive.
- Generate stable operation IDs and plan IDs using normalized SHA-256 inputs; timestamps do not affect plan identity.
- Reject unsafe table/column identifiers before producing a plan.
- Preserve explicit recovery notes for review/destructive operations.
- Add tests for table creation, additive columns, review classification, destructive type changes, no-drop policy and deterministic IDs.

## Safety rules

- This planner never proposes drop-table or drop-column operations.
- Existing columns with changed types are never silently altered; they produce destructive operations requiring explicit approval in a later reconciler.
- Required columns added to existing tables without a literal default are review-only because existing rows need a semantic backfill.
- Function defaults are not serialized into SQL. They require runtime initialization or an explicit semantic upgrade handler.
- Computed/related fields are excluded unless explicitly marked stored and provide a concrete databaseType.

## Not yet implemented

- DDL execution, transaction-wrapped schema application, SQLite registry snapshot store, atomic activation or reconciliation receipt persistence.
- Semantic migration handlers and data backfill execution.
- Foreign-key constraint planning and inverse relation validation.
- Full BaseEntity injection and inheritance-aware physical schema projection.
- Verified typecheck, lint, tests or database integration results.

## Acceptance gates

1. Run planner tests and typecheck in CI.
2. Add PostgreSQL and SQLite adapter introspection contract tests.
3. Add full column/index/foreign-key comparison and identifier length enforcement from provider capabilities.
4. Add explicit approval records and an approval-bound reconciler.
5. Add System Database plan/receipt persistence and serialized activation lock.
6. Prove destructive operations cannot execute without per-operation approval and recoverable backup metadata.
