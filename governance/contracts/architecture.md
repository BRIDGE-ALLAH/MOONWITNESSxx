# Architecture Contract

**Owner:** Architecture maintainers; Headquarter, ARSY, and package owners  
**Source decisions:** `docs/08-technical-architecture.md`, `docs/18-monorepo-and-orm-addon-architecture.md`  
**Scope:** app/package ownership, runtime composition, ORM, addons, database adapters, and dependency direction.

## Rules

- Headquarter is the frontend/operator experience. It MUST consume ARSY through public versioned API contracts and MUST NOT connect directly to databases.
- ARSY is the Fastify backend/composition root and owns runtime configuration, security, ORM composition, trusted addons, services, routes, and readiness.
- `packages/contract` owns runtime wire contracts/inferred types; `packages/types` owns framework-neutral primitives.
- ORM owns model metadata, registry, domain/query API, and addon composition. `orm-db` owns connections, transactions, unit-of-work, schema policy/reconciliation. Provider-neutral adapter contracts own capabilities; concrete adapters own drivers and provider SQL.
- Kysely MUST remain internal to concrete SQL adapters. It MUST NOT leak into addon/domain contracts. A second ORM/model registry (including Drizzle) is forbidden unless a new architecture decision explicitly replaces the current one.
- Trusted TypeScript addon model declarations are the desired-schema source. Programmatic reconciliation may execute provider-native DDL; this does not mean the physical database is schema-free.
- `services/*` remains outside the pnpm workspace until ownership/runtime boundaries are reconciled.

## Allowed

PostgreSQL as recommended production provider; libSQL for lightweight local/embedded/single-node profiles; explicit provider capability checks; trusted code-first model declarations and private schema-control operations.

## Forbidden

Headquarter database access/credentials; ARSY-to-UI dependencies; package-to-app imports; app-to-app source imports; addons importing raw SQL/Kysely; ORM importing concrete provider drivers; parallel schema/model authority; silent schema drops on addon removal.

## Enforcement

- Current: repository audit, workspace manifest checks, clean install, CI.
- Phase 2: AST/dependency graph checks and architecture boundary fixtures.
- Human review: architecture changes, new runtime owner, provider changes, and boundary exceptions.

## Acceptance evidence

Workspace graph has no forbidden edges; public API contracts are used across app boundary; ORM/adapter ownership matches docs/08 and docs/18; shared provider tests cover supported semantics.

## Exceptions

Affected app/package owners and architecture maintainer approve a scoped exception, migration plan, tests, compensating control, and review date.
