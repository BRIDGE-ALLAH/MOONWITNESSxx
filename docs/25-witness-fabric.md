# MOONWITNESS — Evidence-to-Decision Replay

**Status:** Deterministic WITNESS FABRIC core plus separate ARSY durable evidence runtime  
**Owner:** MOONWITNESS / ARSY integration boundary  
**Research cut-off:** 2026-11-08

## Thesis

A knowledge system should not merely return an answer. It should reconstruct the evidence, actors, uncertainty, policies, and sequence of operations that produced the answer or action.

## Product architecture

The repository has two deliberately separate evidence implementations with different roles:

- `@moonwitness/witness-fabric` is the deterministic in-memory research/replay library: claim genome, counterfactual sensitivity, reality drift, bitemporal query, signed checkpoint, and portable flight-recorder primitives.
- `@riotworks/arsy-core` owns the ARSY evidence event contract and `EvidenceLedger`; `apps/arsy` owns authenticated operator identity, PostgreSQL persistence, API lifecycle, and tenant/operator scoping.

They are not two interchangeable database authorities. The WITNESS FABRIC package remains dependency-light and in-memory; ARSY's evidence store is the durable operational event stream. A bridge between their event vocabularies must be explicit and tested before any projection or shared persistence is claimed.

## Deterministic library capabilities

### Evidence Spine

Append-only typed event model for observations, claims, assessments, relations, and decisions. Every event has a stable ID, actor, subject, timestamp, evidence references, sequence, previous hash, and SHA-256 digest.

### Epistemic Replay

A deterministic projector reconstructs claim state from events. Confidence and status are recorded as assessments and never silently overwritten. Contradictory evidence remains in event history; competing claim branches are represented explicitly.

### Agent Accountability Hooks

Event contracts carry actor and evidence references. The library validates policy-gated action lifecycle, but it does not execute tools or side effects.

### Claim Genome, Counterfactual Observatory, Reality Drift Radar

- Claim Genome represents claims as separate nodes with explicit `supports`, `contradicts`, `supersedes`, and `derived_from` relations.
- Counterfactual Observatory removes selected evidence/event inputs and reports deterministic claim deltas. This is sensitivity analysis, not causal inference.
- Reality Drift Radar compares snapshots for disappeared claims, confidence drops, status regression, new contradiction edges, and stale claims. The current stale check uses claim update time as a proxy.

### Bitemporal Truth and Flight Recorder

- Bitemporal query separates world-valid time from system-knowledge time.
- Ed25519 checkpoints sign ledger sequence and head hash.
- Evidence Flight Recorder exports a portable signed event prefix, deterministic snapshot, Claim Genome, and checkpoint.

## ARSY durable evidence runtime

ARSY exposes an authenticated, operator-scoped API backed by PostgreSQL:

- `POST /api/v1/evidence/streams/:aggregateId/events`
- `GET /api/v1/evidence/streams/:aggregateId/events`
- `GET /api/v1/evidence/streams/:aggregateId/verify`

The authenticated server-side operator becomes the event actor; caller-supplied actor IDs are rejected. Internal storage keys are derived from operator identity plus logical aggregate ID, preventing cross-operator stream collision. PostgreSQL advisory locks and expected-head checks reject stale concurrent writes. A separate migration installs database triggers that reject UPDATE, DELETE, and TRUNCATE. Migrations remain deployment/System Mode-owned and are not applied at application startup.

## Threat model and caveats

Hash chaining alone is not a signature, trusted timestamp, or truth proof. The database trigger enforces append-only behavior for ordinary SQL mutation paths, but storage credentials, privileged database administration, backups, and restore controls remain part of the operational threat model. Signed checkpoints must be anchored in a separately controlled store; use authenticated actors and least-privilege database roles. Redact secrets before event persistence. Treat external source text as untrusted input. Never let confidence alone authorize high-impact actions.

## Evaluation plan

- Integrity: mutation, truncation, reordering, duplicate IDs, and broken references.
- Replay: deterministic snapshot equality for same event stream.
- Provenance completeness: percentage of decisions with resolvable source-to-claim-to-action trace.
- Recovery: reconstruct action context after application restart from durable storage.
- Performance: p50/p95 append, verification, replay, and query latency at 10k/100k/1m events.
- Epistemic calibration: Brier score / calibration error only when assessments have a defined probabilistic interpretation and labelled outcomes.

## Remaining work

- Connect WITNESS FABRIC's richer claim/relation vocabulary to ARSY's operational event stream through an explicit mapping contract; do not silently coerce event kinds.
- Add bounded pagination and stream-size policy for large event histories.
- Add retention, privacy redaction, database-role review, backup/restore drills, and external checkpoint anchoring.
- Add a Headquarter evidence timeline/graph only after its real API contract and user workflow are approved.
- Keep production release blocked until security review and operational controls are evidenced.

## Prior-art statement

This design combines established ideas from provenance models, event sourcing, temporal knowledge graphs, and auditable agents. It is not claimed to be globally unprecedented. The differentiator hypothesis is the integrated operator workflow and its measured ability to reconstruct evidence-to-decision paths.
