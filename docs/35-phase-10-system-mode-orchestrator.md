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
- Implement a SQLite-backed run journal and connect it to the Phase 9 store.
- Add recovery behavior and idempotency semantics for every stage.
- Add long-operation heartbeat, abort handling, and shutdown safety.
- Integrate into ARSY Core and expose an explicit deployment/admin command, not an HTTP route.
- Add file-backed restart, process contention, and injected-failure tests.
- Run typecheck, lint, tests, and CI.
