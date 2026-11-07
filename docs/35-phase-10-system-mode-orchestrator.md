# Phase 10 — System Mode Orchestrator

## Goal
Make installation and synchronization an explicit deployment lifecycle, never an HTTP request side effect.

## Implemented slice
- Adds an orchestrator with ordered stages: lease, recovery, discovery, trust validation, registry composition, schema preflight, approval, reconciliation, verification, atomic activation, runtime handoff, and completion.
- Requires actor identity and fenced control-plane lease.
- Persists the plan and verified receipt through the control store.
- Activates only after the Business Database schema is verified.
- Lowers readiness before synchronization and restores it only after runtime handoff.
- Uses injected ports for discovery, trust, recovery, approval, and runtime publication.

## Creative additions
1. Deployment journal: each stage is recorded and incomplete runs are supplied to an explicit recovery handler.
2. Activation preview: the exact schema plan is persisted before approval; approval binds to the plan and actor.
3. Health-based handoff: runtime readiness is only restored after the new registry is published.
4. Canary lane: a future shadow runtime can run synthetic checks before traffic switches; never attempt destructive schema rollback.
5. Lease renewal: ownership is renewed before expensive reconciliation and activation; long DDL still needs heartbeat/abort integration.

## Remaining gates
- [x] Implement SQLite-backed run journal with optimistic stage transitions and incomplete-run discovery.
- Add recovery behavior and idempotency semantics for every stage.
- Add long-operation heartbeat, abort handling, and shutdown safety.
- Integrate into ARSY Core and expose an explicit deployment/admin command, not an HTTP route.
- Add file-backed restart, process contention, and injected-failure tests.
- Run typecheck, lint, tests, and CI.


## SQLite journal implementation

The package now exports `SqliteSystemRunJournal`. It enforces SQLite/System adapter identity, persists run identity/actor/stage/status/fingerprint/plan/error/timestamps, uses compare-and-set stage transitions, rejects stale transitions, and returns interrupted running records for an explicit recovery handler. Initialize the journal during controlled startup before invoking the orchestrator.

Important failure boundary: if runtime handoff fails after atomic activation, the candidate pointer has already been committed. Readiness remains false and recovery must inspect the journal; automatic pointer rollback is intentionally not attempted because PostgreSQL schema rollback may be unsafe. The prior snapshot remains stored for an operator-directed rollback only when compatibility is established.


### Pre-activation shadow preparation

The orchestrator now requires a runtime preparation step after database verification and before activation. This is the safe place to warm a shadow registry/runtime, load routes/services, and run synthetic health checks without publishing it as active. The post-activation handoff should be a narrow in-memory pointer switch. If preparation fails, the active registry has not yet changed.
