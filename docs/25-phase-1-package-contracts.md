# 25 — Phase 1 Package Boundaries and Public Contracts

**Status:** Initial contract surface drafted; verification pending  
**Updated:** 2026-11-07  
**Scope:** Package ownership, dependency direction and provider-neutral public TypeScript contracts.

This document records the first implementation slice of Phase 1. It is not evidence that database drivers, the model engine, registry composer, transaction manager or schema reconciler are implemented.

## 1. Package ownership

| Package | Owns | Must not own |
|---|---|---|
| `@riotworks/orm` | TypeScript model declarations, field/relation metadata, model kinds, addon/module manifest contracts, registry snapshot contracts, Environment/Recordset API contracts, ORM error vocabulary | Connections, SQL, DDL, database driver imports |
| `@riotworks/orm-db-adaptor` | Provider-neutral connection/transaction/query/introspection/schema-operation SPI and capability negotiation | Model declarations, addon business logic, concrete drivers |
| `@riotworks/orm-db` | Unit-of-work, transaction orchestration, schema planning/reconciliation policy, ledger/receipt and semantic upgrade orchestration | SQL dialects, concrete driver connections, business model declarations |
| `@riotworks/orm-db-adaptor-postgres` | PostgreSQL driver/pool, type mapping, catalog introspection, DDL and query execution | Model registry and addon model imports |
| `@riotworks/orm-db-adaptor-sqlite` | SQLite System Database driver, local connection lifecycle, SQLite mapping/introspection/DDL and system-store integration | PostgreSQL business persistence or ORM declarations |
| `@riotworks/arsy-core` | ARSY lifecycle/composition, plugin runtime, runtime context, logging, health and service container | Business model ownership or physical SQL implementation |
| `@riotworks/orm-addon-base` | Independently installable base modules and their declarations/services/policies | ORM internals and provider drivers |

Concrete adapters and `orm-addon-base` are deliberately not scaffolded as empty packages in this slice. They are created when their driver or addon has a real entrypoint and testable behavior.

## 2. Dependency direction

Allowed:

- Headquarter → API contracts, framework-neutral types and UI.
- ARSY application → ARSY Core, API contracts, ORM/database runtime and trusted addons.
- ORM addons → public ORM API and declared addon dependencies.
- ORM → framework-neutral types and contracts only.
- ORM DB runtime → ORM contracts and provider-neutral adapter SPI.
- Concrete adapters → provider-neutral adapter SPI, their own driver and private SQL compiler.
- Base addon → public ORM API.

Forbidden:

- ORM importing PostgreSQL, SQLite, Redis, Kysely or Fastify.
- Addons importing Kysely, raw SQL or database drivers.
- SQL adapters importing addon model classes.
- Headquarter importing database drivers or schema-admin credentials.
- App-to-app source imports and circular package dependencies.

## 3. Public contract surfaces introduced

### ORM

`packages/orm/src/index.ts` currently exposes:

- model kinds, field/relation descriptor metadata, mixin and model-extension shapes;
- model constructor and normalized model-definition shapes;
- separate AddonManifest and ModuleManifest contracts, including ARSY/ORM/API compatibility metadata;
- deterministic RegistrySnapshot and RegistryComposer contracts;
- stable ORM error codes and a provider-neutral domain expression AST;
- Environment, principal context, model collection and Recordset contracts.

The canonical declaration syntax remains the static TypeScript field map recorded in ADR-003. The declarations in this phase are public contracts, not the field factory/runtime implementation.

### Adapter SPI

`packages/orm-db-adaptor/src/index.ts` currently exposes:

- PostgreSQL and SQLite provider identity;
- explicit provider capability vocabulary and capability negotiation;
- a discriminated provider identity that locks the v1 role pairing: SQLite/System and PostgreSQL/Business;
- connection options, query request/result and transaction contracts;
- schema snapshot/column/index/foreign-key contracts;
- schema operations and adapter lifecycle interface.

A provider must reject unsupported capabilities explicitly. The shared ORM contract is only the tested portable subset; it does not promise identical performance or every provider-specific feature.

### Persistence orchestration

`packages/orm-db/src/index.ts` currently exposes:

- UnitOfWork and factory contracts;
- deterministic schema plan, risk classification and approval policy;
- reconciliation receipt and persistence-store contracts;
- planner/reconciler contracts;
- versioned TypeScript semantic UpgradeHandler contract.

It does not yet implement transaction behavior, locks, schema diffing, DDL execution or durable receipt storage.

## 4. Provider decision

The package name for the control-plane adapter is `orm-db-adaptor-sqlite`, not `orm-db-adaptor-libsql`. The approved System Database is SQLite. PostgreSQL remains the Business Database. This naming avoids making a client/protocol product (libSQL) the architectural identity of the SQLite system-store adapter.

The SQLite adapter and PostgreSQL adapter are separate packages because their connection lifecycle, introspection, DDL and capability sets differ. They implement the same SPI but do not share physical schema ownership. The public adapter identity type encodes the v1 pairing as a discriminated union so an adapter cannot accidentally claim SQLite as the Business Database or PostgreSQL as the System Database.

## 5. Explicit non-goals of this phase

- No ORM field factories or CRUD implementation.
- No registry composition algorithm or fingerprint implementation.
- No live PostgreSQL or SQLite adapter.
- No Kysely dependency in ORM or addon APIs.
- No schema reconciliation or migration runner.
- No automatic schema DDL during API startup/request handling.
- No BaseEntity business addon implementation yet.
- No public plugin marketplace or external plugin sandbox implementation.

## 6. Phase 1 verification gate

Before Phase 1 is complete:

1. Run a clean pnpm install and regenerate/verify the lockfile.
2. Type-check the three new packages in the workspace.
3. Run shared lint on their public entrypoints.
4. Add contract tests for capability rejection, manifest invariants and stable public exports.
5. Verify dependency direction and package exports from a minimal consumer fixture.
6. Confirm the package contracts compile without Fastify, PostgreSQL, SQLite, Redis or Kysely imports in `@riotworks/orm`.
7. Update `docs/23` and `todo.md` with the actual command results.

Until those checks pass, Phase 1 remains in progress.
