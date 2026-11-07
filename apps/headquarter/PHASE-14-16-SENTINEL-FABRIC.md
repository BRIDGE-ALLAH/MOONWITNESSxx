# Headquarter Phases 14–16 — Sentinel Fabric

**Scope:** deterministic, pure domain engines; no live ARSY contract, persistence, or execution authority.

## Phase 14 — Belief Drift Sentinel
Compares versioned belief snapshots and surfaces claim changes, confidence shifts, evidence removals, additions, and disappearing beliefs. Confidence deltas are descriptive, not calibrated probabilities. Invalid chronology, duplicate IDs, invalid confidence, or invalid thresholds fail closed.

## Phase 15 — Counterfactual Blast-Radius Map
Traverses only explicit `causes` edges from supplied seed nodes. Produces shortest causal depth, node criticality, a transparent descriptive impact score, and cycle detection. Dangling edges, unknown seeds, invalid criticality, or traversal-cap exhaustion invalidate the report. It is not a causal inference engine: graph edges must be supplied and justified by an authoritative source.

## Phase 16 — Evidence Expiry Budget
Computes time-to-expiry, warning/critical/expired/invalid buckets, and distinct decisions exposed by non-healthy evidence. Thresholds are configurable and validated. The engine never renews, deletes, or silently extends evidence validity.

## Safety and rollout
All three engines are pure and deterministic for fixed inputs/time. They do not infer truth, mutate decisions, authorize actions, or connect to ARSY. Production rollout requires versioned ARSY contracts, tenant isolation, source provenance, policy enforcement, immutable event storage, and human review. Prototype scores must not be used as automated approval criteria.
