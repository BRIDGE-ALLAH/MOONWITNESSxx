# Changelog

All notable changes to the RIOTWORKS monorepo will be documented in this file.

## [Unreleased]

### Added
- Product-integrity audit for workspace contracts, navigation truth, and release blockers.
- Runtime rate limiting for ARSY database health and readiness endpoints.
- Persistent accessible prototype/demo disclosure in Headquarter.
- Container build verification for ARSY and Headquarter.

### Fixed
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

