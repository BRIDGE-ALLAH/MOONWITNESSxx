# WITNESS FABRIC — implementation notes

WITNESS FABRIC is an experimental MOONWITNESS evidence substrate. It is deliberately a small deterministic core, not a claim of a complete knowledge graph or autonomous agent platform.

## Three implementation milestones
1. **Evidence Spine:** append-only observations, claims, assessments, evidence references, and SHA-256 hash chaining.
2. **Epistemic Replay:** deterministic projection of the event stream into current claim confidence/status and decision snapshots.
3. **Agent Accountability Hooks:** stable actor IDs, event types, evidence references, and replay/verification APIs that future ARSY tool calls can wrap before side effects.

## Current API
- `WitnessLedger.append(event)` validates and appends a typed event.
- `WitnessLedger.verify()` checks sequence and hash-chain integrity.
- `WitnessLedger.replay()` reconstructs claims, observations, and decisions from the event history.
- `WitnessLedger.events()` returns a defensive event snapshot.

## Important limits
This v0.1 core is in-memory. It does not yet provide durable database storage, cryptographic signatures, authorization, tenant isolation, external timestamping, distributed concurrency, or calibrated probabilistic inference. SHA-256 chaining detects accidental or unauthorized mutation only if a trusted head hash is anchored elsewhere; it does not prove that an observation is true. Confidence is an explicitly recorded assessment, not a statistically calibrated posterior.

## Security and correctness invariants
- Append validates IDs, actor, timestamps, event payload shape, and assessment ranges.
- Duplicate event IDs are rejected.
- Claims must be proposed before assessment.
- Replay is deterministic for a fixed ordered event stream.
- Hash chain is verifiable and sequence-bound.\n- Concurrent appends are serialized to preserve a single deterministic sequence.\n- Event payloads are cloned at append time to prevent caller mutation.
- Never treat a claim's confidence as truth or as an authorization signal.

## Next adapter boundary
Persist the event stream through ARSY's business DB adapter and keep system registry state in the System Database. Do not import a database driver into this package. Add signed actor identity and tenant policy at the ARSY service boundary before exposing write endpoints.
