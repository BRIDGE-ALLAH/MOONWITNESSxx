# Changelog

All notable changes to the RIOTWORKS monorepo will be documented in this file.

## [Unreleased]

### Added
- Product-integrity audit for workspace contracts, navigation truth, and release blockers.
- Runtime rate limiting for ARSY database health and readiness endpoints.
- Persistent accessible prototype/demo disclosure in Headquarter.
- Container build verification for ARSY and Headquarter.
- Compact density tokens now control shared Card spacing and Badge padding without shrinking form/button hit areas.
- Headquarter now applies route-scoped Observatory and Archive skins; the unsupported prototype light/dark toggle and unused `next-themes` dependencies were removed.

### Fixed
- ARSY application owns its build contract instead of delegating HTTP lifecycle to the framework-neutral core.
- Docker images include required workspace build configuration.
- Workspace audit rejects unsafe glob patterns that could traverse outside the repository.

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

