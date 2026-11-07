# API Contract

**Owner:** ARSY API owner and `packages/contract` owner  
**Source decisions:** `docs/08-technical-architecture.md`, `docs/09-information-architecture.md`  
**Scope:** Headquarter↔ARSY wire contracts, public API, internal control-plane endpoints, and client integration.

## Rules
- Headquarter MUST communicate with ARSY through typed, versioned API contracts.
- Runtime wire schemas and inferred wire types belong to `packages/contract`; framework-neutral primitives belong to `packages/types`.
- Headquarter MUST NOT import ARSY server internals, database adapters/drivers, database credentials, or private schema-administration clients.
- API validation and authorization execute on the server; client-side types are not a security boundary.
- Internal schema plan/reconcile/verify/status operations are private control-plane APIs. They require operator/deployment identity and MUST NOT be exposed as ordinary business UI capabilities.
- API changes MUST identify compatibility impact, authorization impact, error semantics, and migration/versioning strategy.
- External side effects MUST be idempotent or protected by idempotency keys/receipts; financial and publication operations preserve source receipts.

## Allowed
Public typed contracts, explicit API versioning, generated/inferred client types from the canonical contract package, restricted internal operations with explicit authorization.

## Forbidden
Direct database access from Headquarter; duplicated handwritten request/response types as independent authorities; exposing raw ORM/Kysely objects; arbitrary SQL/schema commands through public endpoints; treating UI visibility as authorization.

## Enforcement
- Current: package ownership review and application type-check workflows.
- Phase 2: import-boundary checks and contract compatibility tests.
- Phase 3: API authorization tests, endpoint exposure checks, and release compatibility gates.

## Acceptance evidence
Contract package is the shared wire authority; clients compile against it; server validates inputs and permissions; internal endpoints reject ordinary user identities; compatibility tests cover supported versions.

## Exceptions
ARSY API owner and security owner approve scope, client impact, compensating control, and expiry.
