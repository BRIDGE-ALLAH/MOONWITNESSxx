# Phase 4 — Environment and Recordset Runtime Foundation

**Status:** Initial runtime slice; acceptance gate open  
**Branch:** `feat/phase-4-environment-recordset`

## Implemented

- Add immutable Environment context snapshots with principal, tenant, company scope, locale, timezone and trace identity.
- Add controlled `env.derive()` for presentation-context changes and allowed-company switching.
- Block derivation attempts that replace principal, tenant or allowed-company grants.
- Add transaction handle awareness; recordsets reject use after transaction closure.
- Add `env.models.get(modelName, ids)` with active-registry model validation.
- Add lazy Recordset loading, stable empty/single/multiple semantics, ordered identity storage, first(), toArray() and async iteration.
- Reject unknown models, empty/duplicate identities and loader cardinality mismatch.
- Add Node 24 runtime test source for environment scope and recordset lifecycle.

## Security boundaries

- Environment construction is a trusted server-side operation; callers must not pass client-controlled principal, tenant or allowed-company grants directly.
- `derive()` cannot elevate identity or tenancy. It can only change locale/timezone or select a company already in the immutable allowed-company set.
- A recordset is bound to one Environment and transaction. It cannot be re-bound to another tenant or transaction.
- This slice does not yet implement ACL/record-rule checks or CRUD. The loader must be an internal service that applies authorization before returning rows.

## Not yet implemented

- Database-backed CRUD/search, domain AST compilation and query limits.
- Identity map, relation prefetch, cache invalidation and N+1 detection.
- Access-policy evaluation and tenant enforcement at the persistence layer.
- A full UnitOfWork integration with the PostgreSQL adapter.
- Verified TypeScript, lint, test, formatting or CI results.

## Acceptance gates

1. Run the test suite under Node 24 and TypeScript checks.
2. Add property-based tests for environment derivation and transaction scope.
3. Integrate the Environment with a real UnitOfWork and authorized loader.
4. Add ACL/record-rule enforcement before database reads and writes.
5. Add domain AST validation and adapter compilation.
6. Add query-count and tenant-isolation integration tests.
