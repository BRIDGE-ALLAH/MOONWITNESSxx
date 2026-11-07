# Phase 8 — Scenario Forge / Shadow Reality

**Product bet:** let operators rehearse the future before changing the real system.

## Problem to solve

Dashboards show current conditions. Workflow engines execute commands. Few operator surfaces provide a safe, replayable environment for testing the consequences of a proposed change against a fixed baseline.

## Proposed module

**Scenario Forge** creates immutable shadow scenarios from a source snapshot. Explicit assumptions and ordered operations produce deterministic, comparable outcomes. The initial engine is read-only by construction.

### Signature capabilities

- Snapshot fork: create isolated scenarios from one versioned baseline.
- Assumption ledger: every change carries a human-readable rationale.
- Scenario arena: compare conservative, expected, upside, and stress cases against one baseline.
- Sensitivity lens: identify assumptions with the greatest effect on outcomes.
- Replay capsule: same snapshot + scenario definition + engine version yields the same result.
- Decision Graph bridge: attach simulation output as analysis evidence, clearly labelled as simulated.
- Later, controlled promotion: separate approval, policy evaluation, diff, idempotency key, and audit event; never a direct "execute simulation" button.

### Initial delivery

- [x] Domain contract for metrics, assumptions, and ordered operations.
- [x] Pure deterministic shadow calculation kernel.
- [x] Validation for duplicate IDs, unknown metrics, missing rationale, and non-finite values/results.
- [x] Tests for deterministic replay, baseline immutability, and shadow-only output.
- [ ] Multi-scenario comparison and sensitivity analysis.
- [ ] Versioned ARSY read-only snapshot contract with scope and freshness metadata.
- [ ] Scenario history, persistence, and workspace authorization.
- [ ] Accessible Scenario Arena UI and explicit human approval flow for any future production change.

### Non-negotiable guardrails

- Simulation is not a forecast, guarantee, or financial advice.
- No network, persistence, external action, or production mutation in the initial engine.
- Units, currency, time horizon, missing data, and confidence must be explicit before real data is connected.
- A simulation result is never silently promoted to production state.

### Acceptance gate

The same baseline and scenario definition must replay deterministically; all assumptions must be inspectable; invalid operations must fail closed; and simulation output must remain isolated from production mutation paths.
