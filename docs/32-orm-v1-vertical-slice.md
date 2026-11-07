# RIOTWORKS ORM v1 vertical slice

**Status:** Implemented on `feat/riotworks-orm-v1-current-main`; awaiting CI and review. This is not a production-release claim.

## Delivered modules

- `@riotworks/orm`: static model/field contracts, field factories, deterministic addon/module dependency ordering, abstract inheritance, mixin and extension composition, domain AST validation, and stable registry fingerprints.
- `@riotworks/orm-db-adaptor`: provider-neutral CRUD, transactions, capability declaration, introspection, and schema-operation SPI.
- `@riotworks/orm-db`: trusted Environment context, model/record/field policy gates, bounded recordset loading, search, create/update/delete, transactional audit writing, schema planning and serialized reconciliation, and durable schema-plan/receipt ledger.
- `@riotworks/orm-db-adaptor-postgres`: PostgreSQL business database implementation.
- `@riotworks/orm-db-adaptor-libsql`: libSQL system database implementation, including local file and remote URL support from the libSQL client.
- `@riotworks/orm-addon-base`: BaseEntity mixin with the five canonical fields and a separate base audit model.
- `apps/arsy/src/orm.ts`: composition factory that wires the standard addon, adapters, ledger, runtime, and schema service.

## Trust and safety boundaries

- Application callers supply a trusted `EnvironmentContext`; user-supplied tenant, workspace, and company IDs are not accepted as writable business fields.
- Model, record, and field policy functions are mandatory. The runtime fails closed when they are absent or deny access.
- Create/update/delete and the associated audit insert share one database transaction.
- Search applies model and field checks, and row-level policy filtering occurs before pagination. Authorization scans are capped at 10,000 rows; callers must narrow larger searches.
- Schema changes are planned from the registry and actual provider introspection. The schema ledger lives in a separate System database.
- Schema apply uses a provider lock, recomputes the plan under that lock, and requires exact plan/actor-bound approval for review-risk operations.
- No destructive drop/rename operations are generated. Type changes and unsafe nullability changes block reconciliation pending a semantic data-upgrade path.
- Database credentials remain server-side. The frontend does not receive adapter instances or database credentials.

## Explicitly not complete

- No live PostgreSQL integration run has been executed from this conversation yet.
- Full SQL adapter contract matrix, multi-process libSQL schema locking, data-upgrade handlers, safe backfill orchestration, relation query loading/prefetch, computed/related expression execution, constraints/unique drift reconciliation, ACL/record-rule persistence, and comprehensive base addons remain open.
- The private ARSY schema control-plane HTTP routes and authenticated operator identity are not yet mounted; the service layer is present, but must not be exposed before the app authentication contract is wired.
- No production credentials, backup target, deployment environment, or approved production publisher have been verified. No production release is claimed.

## Verification

PR CI is configured to run ORM registry/domain tests, CRUD/audit rollback tests, BaseEntity composition tests, libSQL in-memory adapter tests, PostgreSQL adapter boundary tests, repository quality checks, CodeQL, and the existing container checks. Passing CI is necessary but does not replace live PostgreSQL and production smoke tests.
