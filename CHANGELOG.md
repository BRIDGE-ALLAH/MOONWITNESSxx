# Changelog

All notable changes to the RIOTWORKS monorepo will be documented in this file.

## [Unreleased]

## [1.2.0] - 2026-11-08

### Added

- ORACLE PostgreSQL-backed job lifecycle with atomic idempotency, bounded queue/retention, leased workers, fencing, and restart recovery.
- Explicit checksum-verified ORACLE SQL migrations and separate database migration/runtime roles.
- Restricted ORACLE runtime access to DML on `oracle.jobs` only; migration metadata and unrelated schemas remain inaccessible.
- PostgreSQL integration coverage and Compose E2E restart-persistence verification.
- Product-integrity audit for workspace contracts, navigation truth, and release blockers.
- Runtime rate limiting for ARSY database health and readiness endpoints.
- Persistent accessible prototype/demo disclosure in Headquarter.
- Container build verification for ARSY and Headquarter.
- Governance Lab persistence vertical slice: owner-scoped governance snapshots (decision graph, uncertainty gate inputs, scenario baseline and operations) stored in PostgreSQL through ARSY and recorded, selected and soft-archived in Headquarter against the live authenticated API, with an explicitly labelled client-side demo mode that is never persisted.
- Shared `@riotworks/contract` governance wire schemas with strict validation (duplicate node/edge and dangling-edge rejection, unknown-metric scenario operation rejection).
- ARSY governance migration `008_governance_snapshots.sql` and PostgreSQL integration coverage proving owner-scoping, forged-owner rejection and restart persistence.
- Headquarter governance browser E2E covering record → reload persistence → archive through the operator session.

### Fixed

- ARSY root liveness endpoint returned HTTP 500 because the `fastify-type-provider-zod@1` response serializer (zod-to-json-schema v3) cannot compile Zod v4 schemas; the static root payload now uses Fastify's default JSON serialization while request validation remains Zod v4.
- Zod v4 `z.record` key-schema compatibility in the shared audit/telemetry contracts and ARSY evidence/deployment request validation.
- ARSY application owns its build contract instead of delegating HTTP lifecycle to the framework-neutral core.
- Removed fabricated market intelligence from Signal Room and replaced it with an explicit disconnected state (#107).
- Removed synthetic financial, product/provenance, and inspection records from Mizan Ledger, The Forge, and ZILL Watch (#109).
- Corrected the shared CardTitle forwarded-ref type to match its rendered heading element (#104).
- Docker images include required workspace build configuration.
- Workspace audit rejects unsafe glob patterns that could traverse outside the repository.

### Security

- Bind delegated ARSY capability-grant signatures to their exact parent grant; preserve legacy root-grant signatures.

## [1.0.0] - 2026-11-07

### Added

- Initial monorepo structure with packages, apps, and services

### Changed

-

### Deprecated

-

### Removed

-

### Fixed

-

### Security

-
