# Phase 9 — System Mode Control Plane and Atomic Registry Activation

**Status:** Initial SQLite control-store implementation started; complete System Mode orchestration and production acceptance gates remain open. Phase 8 provides driver-backed adapters and ARSY provider bootstrap.

## Objective

Turn the existing ORM registry, schema planner, approval-bound reconciler, SQLite System Database adapter, and PostgreSQL Business Database adapter into one safe installation/activation lifecycle. SQLite remains the authoritative control plane; PostgreSQL remains the business-data plane.

## Non-negotiable invariants

1. SQLite System Database is initialized before any business service is marked ready.
2. Registry discovery/composition and schema reconciliation run only in explicit System Mode, never in an HTTP request path.
3. Runtime Mode loads one verified immutable registry snapshot and does not discover arbitrary code or execute DDL.
4. A registry is active only after its snapshot, schema receipt, provider identities, and fingerprint have been verified.
5. System activation is serialized across processes. SQLite's single-writer behavior is treated as a constraint, not as a distributed lock substitute.
6. System metadata and business records never share a database transaction. No distributed transaction is assumed.
7. Failed activation leaves the previous active registry intact; candidate state is not partially published.
8. Plugin credentials and signing secrets are references to secret storage, never values in manifests or registry snapshots.

## Proposed package ownership

- `@riotworks/arsy-system-mode`: explicit System Mode orchestration, boot/recovery state machine, activation protocol, readiness result.
- `@riotworks/arsy-system-store-sqlite`: SQLite-specific durable store for addon/module installation state, registry snapshots, plan/receipt records, activation generation, lock leases, and system audit.
- `@riotworks/orm-db`: retains provider-neutral plan/reconcile contracts and policy.
- `@riotworks/orm-db-adaptor-sqlite`: owns SQLite connection, introspection, and validated physical DDL; it does not own addon business semantics.
- `@riotworks/arsy-core`: composes System Mode during controlled startup/administrative installation and exposes verified runtime services.

The SQLite store may use the adapter's parameterized query and transaction surface, but it must not leak SQLite-specific types into ORM or addon APIs.

## System Mode state machine

1. **CONTROL_DB_BOOTSTRAP** — open SQLite, verify provider identity/version, initialize the versioned control-store tables.
2. **RECOVERY_CHECK** — inspect incomplete deployment/activation records and expired leases; never guess that a partially applied business schema is safe.
3. **PACKAGE_DISCOVERY** — enumerate only configured trusted package roots; reject path traversal, duplicate IDs, unsupported entrypoints, and untrusted external executable packages.
4. **TRUST_VALIDATION** — verify publisher identity, package integrity/signature, compatibility, declared capabilities, permissions, and secret references before importing trusted code.
5. **REGISTRY_COMPOSITION** — normalize static TypeScript declarations and produce a deterministic candidate snapshot/fingerprint.
6. **PERSISTENCE_PREFLIGHT** — inspect PostgreSQL and produce a deterministic schema plan; classify safe/review/destructive operations.
7. **APPROVAL_GATE** — persist the exact plan and require actor-bound approval for review/destructive operations.
8. **RECONCILIATION** — execute only approved operations under the serialized System Mode lease; persist each result.
9. **VERIFY_CANDIDATE** — introspect the actual business schema and verify every required model/table/column/index supported by the plan.
10. **ATOMIC_ACTIVATION** — atomically persist candidate snapshot, active fingerprint, generation, receipt reference, and activation audit in SQLite.
11. **RUNTIME_HANDOFF** — publish the immutable snapshot to Runtime Mode only after activation commit.
12. **DEGRADED/RECOVERY** — if any step fails, preserve the previous active snapshot, retain candidate/receipt evidence, and keep readiness false when required state is incompatible.

## SQLite control-store records

Versioned, indexed records are required for:
- installed addon and module versions/status/integrity;
- candidate and active registry snapshots (serialized canonical payload + fingerprint + generation);
- schema plans and reconciliation receipts;
- deployment lock lease (owner token, fencing generation, acquired/expiry timestamps);
- System Mode run state and failure/recovery metadata;
- append-only system audit events.

Secrets, business records, and volatile queues are explicitly excluded.

## Atomicity and concurrency

- Acquire a database-backed lease using an atomic compare-and-swap transaction; include an owner token, expiry, and monotonically increasing fencing generation.
- Renew the lease before each long-running stage and verify ownership/fencing generation before every state transition.
- Every write is idempotent by run ID, plan ID, or fingerprint.
- Activation uses one SQLite transaction to update the active registry pointer and append the activation receipt/audit event.
- A stale or expired owner cannot activate after a newer fencing generation has been issued.
- Do not hold a SQLite transaction open while executing PostgreSQL DDL; the lease is the coordination primitive, and the two databases remain separate transaction domains.

## Runtime boot and readiness

- Load the active snapshot from SQLite and verify its canonical hash and activation receipt.
- Verify provider identity is SQLite/System and PostgreSQL/Business.
- Verify PostgreSQL schema against the active snapshot before declaring business APIs ready.
- If PostgreSQL is unavailable, keep control-plane diagnostics available while business APIs report degraded/not-ready.
- Runtime Mode must not import untrusted plugin code, mutate registry metadata, or execute schema changes.

## Required tests and acceptance gates

- SQLite file-backed restart and recovery from incomplete System Mode runs.
- Multi-process lock contention, lease expiry, renewal, fencing-token rejection, and crash recovery.
- Atomic activation rollback: previous active fingerprint remains authoritative after injected failure.
- Tampered snapshot, invalid signature/integrity, incompatible addon, path traversal, duplicate package identity, and permission escalation are rejected.
- Approval binding is checked against actor, exact plan fingerprint, and exact operation IDs.
- PostgreSQL unavailable / SQLite unavailable / schema drift readiness behavior is deterministic.
- No HTTP request can invoke discovery, reconciliation, or activation.
- Clean frozen install, typecheck, lint, unit tests, adapter integration tests, and full build pass in CI.

## Out of scope

- Multi-writer SQLite over network filesystems.
- Distributed transactions between SQLite and PostgreSQL.
- Executing third-party plugin code in-process by default.
- Automatic destructive schema changes or implicit data loss.
- Public marketplace billing and plugin distribution UX.


## Initial implementation slice (not production complete)

The Phase 9 branch now includes `@riotworks/arsy-system-store-sqlite` with:

- SQLite/System adapter identity enforcement and idempotent control-store initialization.
- Durable schema-plan and reconciliation-receipt persistence.
- Registry snapshot storage with a separate canonical content digest and active-pointer integrity verification.
- A database-backed lease with owner token, expiry, monotonically increasing fencing generation, renewal, and stale-owner rejection.
- Transactional registry activation that requires a persisted matching plan, persisted verified PostgreSQL/Business receipt, actor binding, and a valid lease; the active pointer and audit event commit together.
- Initial Node test source covering persistence, lease exclusion/renewal/release, activation, and stale-lease rejection.

Not yet implemented: System Mode discovery/signature verification, full run/recovery state machine, cross-process stress tests, file-backed crash recovery, readiness integration, package installation in ARSY Core, and successful CI for this new package. Keep all corresponding acceptance gates open.
