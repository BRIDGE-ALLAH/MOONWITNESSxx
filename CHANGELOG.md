# Changelog

All notable changes to the RIOTWORKS monorepo will be documented in this file.

## [Unreleased]

### Added
- Product-integrity audit for workspace contracts, navigation truth, and release blockers.
- Runtime rate limiting for ARSY database health and readiness endpoints.
- Persistent accessible prototype/demo disclosure in Headquarter.
- Container build verification for ARSY and Headquarter.
- Operator-authenticated Headquarter workflows for opportunity capture, product brief promotion, and financial event recording/reconciliation.
- Owner-scoped idempotency for opportunity and financial-event creation.
- PostgreSQL integration coverage for commerce migration reruns and persisted opportunity/product/finance lifecycle.
- Operator decision changes and soft-archive actions, plus product and financial-ledger portfolio screens backed by persisted API records.
- Aftershock metrics sourced from persisted opportunity/product records and verified financial summaries, with bounded-count and unavailable-cohort disclosures.
- Playwright browser E2E workflow configured for the authenticated opportunity → product → finance → analytics → archive journey.

### Security
- Headquarter operator sessions use HMAC-signed, expiring HttpOnly/SameSite cookies, exact-origin mutation checks, explicit operator identity, and HTTPS-only production configuration.
- The Headquarter ARSY proxy rejects unauthenticated browser requests before using server-only service credentials.
- Operator login is throttled after five failed attempts per 15-minute process-local window; production ingress still needs shared throttling before horizontal scaling.
- ARSY business routes now have a default per-route rate limit in addition to stricter health-route limits.

### Fixed
- ARSY application owns its build contract instead of delegating HTTP lifecycle to the framework-neutral core.
- Docker images include required workspace build configuration.
- Workspace audit rejects unsafe glob patterns that could traverse outside the repository.
- ARSY versioned business APIs now share a fail-closed operator identity/token boundary; financial routes are registered in the runtime.
- Commerce migration is scoped to implemented tables and includes validated request hashes for idempotency.
- Unsupported FX-adjustment entries and the superseded duplicate ledger component were removed until their contracts are implemented.
- Headquarter proxies forward list limits; portfolio counts explicitly describe the latest 100 records rather than implying lifetime totals.

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

