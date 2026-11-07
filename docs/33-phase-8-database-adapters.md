# Phase 8 — Concrete PostgreSQL and SQLite Adapters

**Status:** First driver-backed implementation slice; production acceptance gates open.

## Implemented

- Add @riotworks/orm-db-adaptor-postgres using pg Pool and PoolClient.
- Add @riotworks/orm-db-adaptor-sqlite using better-sqlite3.
- Enforce the v1 identity pairing: PostgreSQL/Business and SQLite/System.
- Implement connection lifecycle, ping, parameterized query, transaction begin/commit/rollback and schema introspection.
- Implement idempotent create-table, add-column and create-index operations with identifier/type/default validation.
- Use transactional DDL for supported operations.
- Configure SQLite foreign keys, busy timeout, WAL for file-backed databases and synchronous NORMAL.
- Restrict SQLite to one active transaction per connection and reject concurrent transaction starts.
- Reject unsupported/destructive DDL such as automatic type alteration, drops and custom SQL; these require versioned semantic upgrade handlers.
- Add real in-memory SQLite integration test source and PostgreSQL identity/connection-guard test source.
- Explicitly allow the reviewed better-sqlite3 native build in pnpm workspace configuration.

## Boundaries and limitations

- PostgreSQL introspection targets current_schema(); multi-schema tenant layouts are not included.
- PostgreSQL index introspection currently handles simple column indexes; expression-index fidelity needs additional tests.
- SQLite introspection reads PRAGMA metadata and preserves SQLite-declared type names; provider type normalization needs more coverage.
- SQLite is a single-connection System Database and must be protected by the System Mode serialized writer lock.
- PostgreSQL integration tests require a disposable server and are not yet part of CI.
- Adapter secrets/configuration must be supplied by ARSY's secret/config layer; do not place credentials in plugin manifests or source.
- Semantic type conversions, data backfills, FK constraint changes and destructive DDL remain UpgradeHandler responsibilities.

## Acceptance gates

1. Run pnpm lockfile sync, install, typecheck, lint and adapter tests in CI.
2. Add PostgreSQL container integration tests for query, pool lifecycle, rollback and catalog introspection.
3. Add SQLite file-backed tests for WAL, restart persistence, busy timeout and concurrent writer behavior.
4. Add adapter contract suite shared by both providers.
5. Add secret-reference configuration and connection rotation lifecycle.
6. Integrate providers into ARSY registry and System Mode bootstrap; keep business and system transaction domains separate.
