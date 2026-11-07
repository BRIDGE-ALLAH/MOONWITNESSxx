# Scenario Forge — Shadow Reality

**Phase:** 8 (foundation)  
**Status:** deterministic pure simulation kernel; no production data source, UI, or execution connector.

## Product thesis

A command center should not merely report current state. It should let an operator ask **"what changes if we do this?"** before anything touches production. Scenario Forge creates a safe shadow copy of an approved snapshot, applies explicit assumptions, and compares possible futures.

## Core experience

- Fork a named baseline snapshot into isolated scenarios.
- Change explicit variables using set/add/multiply operations with human-readable rationale.
- Compare baseline, optimistic, conservative, and stress scenarios side by side.
- Inspect which assumptions drive the largest outcome changes.
- Attach a scenario result to a Decision Graph node as supporting analysis.
- Replay the exact same input and definition to obtain the same result.

## Differentiators

1. **Shadow-only by construction:** the initial engine is a pure function with no network or write capability.
2. **Assumption ledger:** every change requires a rationale; assumptions remain visible in results.
3. **Counterfactual comparison:** compare multiple futures against the same immutable baseline.
4. **Decision feedback loop:** a simulation can inform a decision; observed outcomes can later test the scenario's assumptions.
5. **Replayable experiment:** stable baseline ID plus ordered operations make the calculation reproducible.

## Initial domain contract

- Baseline metrics have unique IDs and finite numeric values.
- Operations are ordered and explicit: set, add, multiply.
- Each operation has a unique ID and non-empty rationale.
- Unknown metrics and non-finite results are rejected.
- Results are marked `shadow-only`; the engine cannot trigger real workflows.

## Trust and safety boundaries

- Simulations are not forecasts, guarantees, or financial advice.
- Inputs must carry source, timestamp, unit, and scope metadata when connected to real data.
- ARSY must authorize snapshot access and enforce workspace isolation.
- Never wire a scenario result directly to a production mutation.
- Any future "promote scenario" workflow requires a separate approval, diff, policy check, idempotency key, and append-only audit event.

## Production gates

1. ARSY read-only snapshot contract with scope and freshness metadata.
2. Units, currency, time horizon, and missing-data semantics.
3. Versioned scenario definitions and deterministic engine versioning.
4. Confidence/uncertainty model and sensitivity analysis before predictive claims.
5. Resource limits and sandboxing for advanced simulation plugins.
6. Approval workflow and explicit separation from production execution.

## Verification

Run `pnpm --filter @riotworks/headquarter test`. Tests cover deterministic replay, immutability, validation, and shadow-only output.
