# 21 — Database Provider Strategy & Portability Contract

**Status:** Approved architecture decision | **Version:** 1.3 | **Updated:** 2026-11-07

## 1. Executive decision
RIOTWORKS will not use PocketBase as its primary persistence backend in v1. Use one SQL-first architecture:
- PostgreSQL: recommended production provider.
- libSQL: lightweight SQLite-compatible provider for local, embedded, single-node deployments.
- Kysely: internal query-builder/dialect in SQL adapters.
- RIOTWORKS ORM: only model registry, addon system, domain query API, desired-schema source.
This gives one app/model architecture without pretending concurrency, locking, or SQL semantics are identical.

## 2. Why not PocketBase in v1
PocketBase is a capable standalone backend, but brings its own collection schema, records API, auth collections, API rules, admin surface, and lifecycle. RIOTWORKS already owns ARSY/Fastify, API contracts, authorization, addon-aware ORM, and central audit.
Using PB as remote persistence duplicates backend API, schema/model, auth/rules, relation/filter responsibilities, and adds a second Go service and file lifecycle. A remote SDK call is not a substitute for a single SQL transaction spanning a business mutation and its audit event.
PB has a superuser-only Collections API for schema changes. This is useful when PB is the backend, but becomes a second schema authority beside ARSY.
PocketBase BaseModel already defines id, created, updated. This is not inherently a logical conflict with RIOTWORKS BaseEntity. A future adapter maps logical fields to native fields; its native ID format may require a compatible ID strategy rather than the current SQL UUID default. Never create duplicate columns.

## 3. Why not only SQLite without provider boundary
One SQLite provider is simpler initially but makes PostgreSQL transition riskier if domain code relies on SQLite behavior. RIOTWORKS needs agent workflows, finance/audit writes, reporting, and possible multiple ARSY processes. Provider boundary/shared tests are justified.
SQLite/libSQL fits embedded/single-node. Writer concurrency differs from PostgreSQL. A remote libSQL URL does not make it PostgreSQL-like multi-writer. Choose it for lightweight use, not transparent horizontal scale.

## 4. Comparison
| Dimension | libSQL | PostgreSQL |
|---|---|---|
| Deployment | Embedded file or remote service | DB server/container/managed |
| Setup | Low for one node | Higher; service/backups |
| Storage | SQLite-compatible | Relational server |
| Concurrent writes | SQLite single-writer constraint | Server-side concurrent writes |
| Multiple ARSY replicas | Not default | Recommended |
| Best fit | Quickstart/embedded/one-node | Production/multi-worker |

## 5. Profiles
Local/lightweight: libSQL file, one ARSY writer process, bounded workers, frequent backup/export.
Production: PostgreSQL, web/worker processes share DB, one serialized schema release task, backups/restore drills.
Remote libSQL: allowed for low-write deployments; retain SQLite concurrency assumptions.

## 6. Kysely and no duplication
RIOTWORKS ORM owns model declarations, addon registry, field/domain semantics, lifecycle, typed repositories. Kysely owns internal SQL compilation/execution/schema builder inside adapters. Adapters own connections, mapping, introspection, capabilities, physical operations. orm-db owns transaction/unit-of-work/schema policy. Do not add Drizzle as second ORM. Addons never import Kysely.

## 7. Package target
- packages/orm-db-adaptor: provider-neutral contract/registry.
- packages/orm-db-adaptor-libsql: libSQL mapping/introspection/execution.
- packages/orm-db-adaptor-postgres: PostgreSQL pool/mapping/introspection/execution.
- packages/orm-db: transaction manager, reconciler, ledger, upgrade coordination.
- packages/orm: only model registry/model API.

## 8. Portability
Portable v1 SQL ID policy: ARSY-generated UUIDs carried as opaque strings in the domain API; adapters preserve identity across providers. Any future provider-native ID format requires an explicit ID-factory/mapping contract and import/export tests. UTC timestamps; exact decimal or integer-minor-unit money; common scalar/date/JSON types; explicit FKs/indexes/nullability/defaults; portable query operators. Avoid provider-only arrays/enums, JSON operators, collations, generated columns, full text unless capability-gated.
Capability-gated: row/advisory locks, skip-locked, JSON path, full text, partial/concurrent indexes, vendor functions, bulk/returning differences. Unsupported semantics fail clearly.

## 9. Cross-provider tests
Run shared tests against both: CRUD/default/null, ID/timestamp normalization, constraints, FKs, transaction/rollback, audit atomicity, filters/sort/pagination/projection, common JSON, introspection/DDL, reconcile/idempotency/recovery, export/import, capability errors. Add provider-specific concurrency tests.

## 10. Provider switch is a data operation
Changing DATABASE_URL does not copy data. Provision target → schema plan/reconcile → consistent source export → bounded typed import preserving IDs/timestamps/audit/outbox → rebuild/verify constraints/indexes/relations → compare counts/aggregates/checksums/FKs → smoke test → freeze/cutover/rollback plan → switch config after verification. No automatic live replication or zero-downtime claim.

## 11. Schema API
Private ARSY API calls one SchemaReconciliationService. Adapter introspects and applies generated DDL through provider operations, then records receipts. No handwritten SQL schema files for routine model changes. See docs/20.

## 12. PocketBase/BaseEntity overlap
PocketBase BaseModel includes id, created, updated. If a future PB adapter is approved, map logical id → native id, createdAt → native created, updatedAt → native updated. Never add duplicate physical fields. Mapping resolves overlap; duplicate physical fields create conflict. PB is not a v1 provider.

## 13. References
- PocketBase collections: https://pocketbase.io/docs/collections/
- PocketBase Collections API: https://pocketbase.io/docs/api-collections/
- PocketBase BaseModel: https://pkg.go.dev/github.com/pocketbase/pocketbase/models#BaseModel
- Kysely: https://kysely.dev/docs/getting-started
- Kysely libSQL dialect: https://github.com/tursodatabase/kysely-libsql
- libSQL: https://github.com/tursodatabase/libsql


## 11. v1.3 BaseEntity clarification
The logical BaseEntity now contains id, createdAt, createdById, updatedAt and updatedById. createdById/updatedById reference the canonical principal abstraction and map to TEXT on libSQL and UUID on PostgreSQL. The ORM composes them once; adapters do not create duplicate fields. The full Odoo-inspired base addon suite is documented in docs/22.


## 12. Current implementation status and precedence
The provider strategy is a target decision. At the audited MOONWITNESS snapshot, neither SQL adapter nor the ORM database runtime exists in the tracked tree. PostgreSQL remains the production target and libSQL the local/single-node target; PocketBase remains excluded from v1. docs/23 is authoritative for current implementation inventory and execution order.
