# Changelog

All notable changes to the RIOTWORKS monorepo will be documented in this file.

## [Unreleased]

### Added
- ORACLE PostgreSQL-backed job lifecycle with atomic idempotency, bounded queue/retention, leased workers, fencing, and restart recovery.
- Explicit checksum-verified ORACLE SQL migrations and separate database migration/runtime roles.
- Restricted ORACLE runtime access to DML on `oracle.jobs` only; migration metadata and unrelated schemas remain inaccessible.
- PostgreSQL integration coverage and Compose E2E restart-persistence verification.
- Product-integrity audit for workspace contracts, navigation truth, and release blockers.
- Runtime rate limiting for ARSY database health and readiness endpoints.
- Persistent accessible prototype/demo disclosure in Headquarter.
- Container build verification for ARSY and Headquarter.

### Fixed
- ARSY application owns its build contract instead of delegating HTTP lifecycle to the framework-neutral core.
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

