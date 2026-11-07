# Data Contract

**Owner:** Domain/data owners, ARSY persistence owner, and security owner  
**Source decisions:** `docs/13-domain-and-data-model.md`, `docs/18-monorepo-and-orm-addon-architecture.md`, `docs/21-database-provider-strategy.md`  
**Scope:** logical entities, audit history, database providers, money/time, provenance, credentials, retention, and data lifecycle.

## Rules
- The current v1.3 BaseEntity contract is exactly five logical fields: `id`, `createdAt`, `createdById`, `updatedAt`, `updatedById`. This supersedes earlier three-field wording in historical sections of docs/13.
- Universal entity metadata is composed once by the ORM; addons MUST NOT redeclare BaseEntity fields. Optional concerns (archive, version, toggle, soft-delete) are explicit mixins, not universal fields.
- AuditTrail is the authoritative generic change history. Ordinary application flows MUST append; ordinary code MUST NOT update/delete audit history. Redact secrets and sensitive personal data.
- When audit atomicity is required, domain mutation and audit insert share a transaction. External side effects use an outbox/idempotent dispatch.
- PostgreSQL is the recommended production provider for multi-process/concurrent workloads. libSQL is for local, embedded, and single-node profiles; preserve SQLite single-writer assumptions.
- Provider portability is capability-based. A common model API MUST NOT imply identical concurrency, locking, or performance.
- Money uses exact decimal or integer minor units plus currency; binary floating point is never authoritative. Store UTC instants; timezone is display context. Preserve source currency and FX provenance.
- Provenance, financial events, external receipts, and publication history MUST be retained according to domain policy.
- Raw provider credentials MUST NOT be stored in ordinary domain tables, logs, artifacts, or frontend state.

## Allowed
PostgreSQL and libSQL through declared adapters; provider-specific capability-gated features; explicit data-upgrade handlers and schema reconciliation; domain-specific retention/archival policies.

## Forbidden
A second ORM/schema authority; silent provider switching as a data migration; untracked destructive DDL; mutating/deleting audit records through ordinary app code; float-based money authority; credential plaintext in domain/frontend state.

## Enforcement
- Current: package boundaries, frozen lockfile, CodeQL/Dependabot, audit and review.
- Phase 2: data model/adapter capability checks and contract test coverage.
- Phase 5: migration approval, backups, restore drills, and runtime lifecycle gates.

## Acceptance evidence
BaseEntity is injected once; audit atomicity tests pass; provider contract tests cover CRUD/transactions/normalization/reconciliation; data exports preserve identity/provenance; secret scans and redaction tests pass.

## Exceptions
Domain/data owner and security owner approve scope, legal/retention impact, backup/recovery, compensating controls, and expiry.
