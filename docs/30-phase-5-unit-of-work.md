# Phase 5 — Unit of Work Runtime Foundation

**Status:** Initial implementation slice; adapter acceptance gate open.

## Implemented

- Add adapter-backed UnitOfWorkFactory.
- Add explicit active, committed, rolled-back and failed lifecycle state handling.
- Commit only active transactions and surface commit failures.
- Roll back operation failures and preserve both operation and rollback errors with AggregateError.
- Add withUnitOfWork helper that commits on success and rolls back on failure.
- Add Node 24 test source for commit, rollback and commit failure behavior.

## Boundaries

- No concrete PostgreSQL or SQLite adapter is included in this slice.
- No savepoint/nested transaction abstraction, retry policy, isolation mapping or transaction hooks are included.
- Business audit/outbox writes must use the same PostgreSQL UnitOfWork; external effects must remain outside the transaction and use an outbox.
- The SQLite System Database has a separate adapter identity and serialized write ownership; it must not share business UnitOfWork by default.

## Acceptance gates

1. Run unit tests and TypeScript/lint checks in CI.
2. Implement and test PostgreSQL and SQLite adapters against the common SPI.
3. Add adapter contract tests for connection lifecycle, query, transaction, rollback and schema introspection.
4. Test rollback on validation/hook/provider failures and concurrent transaction boundaries.
5. Integrate UnitOfWork into Environment and authorized model services.
