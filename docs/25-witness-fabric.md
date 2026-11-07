# WITNESS FABRIC — Evidence-to-Decision Replay

**Status:** Experimental architecture and first deterministic core, v0.1  
**Owner:** MOONWITNESS / ARSY integration boundary  
**Research cut-off:** 2026-11-08

## Thesis
A knowledge system should not merely return an answer. It should reconstruct the evidence, actors, uncertainty, policies, and sequence of operations that produced the answer or action.

## Three phases implemented in the first vertical slice

### Phase 1 — Evidence Spine
Append-only typed event model for observations, claims, assessments, relations, and decisions. Every event has a stable ID, actor, subject, timestamp, evidence references, sequence, previous hash, and SHA-256 digest.

### Phase 2 — Epistemic Replay
A deterministic projector reconstructs claim state from events. Confidence and status are recorded as assessments and never silently overwritten. Contradictory evidence should remain in the event history; future UI can present competing claim branches.

### Phase 3 — Agent Accountability Hooks
Event contracts carry actor and evidence references. ARSY can later wrap tool calls in preflight policy checks and postflight receipts. The current core does not execute tools or side effects.

## Proposed end-to-end workflow
1. Capture a source as an observation with source locator, retrieval time, content hash, and access/license metadata.
2. Propose one or more claims derived from the observation.
3. Attach explicit evidence references and assessment rationale.
4. Run policy preflight before a tool or external side effect.
5. Record action intent, policy decision, execution receipt, and output artifact.
6. Replay the causal chain from source to decision and downstream effects.

## Architecture boundaries
- `@moonwitness/witness-fabric`: deterministic event primitives, hashing, replay; no database, web, or LLM dependency.
- ARSY: authentication, authorization, tenant isolation, durable storage, transactions, tool execution, and outbox.
- Headquarter: evidence graph, claim timeline, confidence history, and replay UI.
- System Database: module registry and control-plane receipts.
- Business Database: domain evidence and business event stream according to tenant/data ownership.

## Threat model and caveats
Hash chaining alone is not a signature, trusted timestamp, or truth proof. Anchor signed checkpoints in a separately controlled store; use authenticated actors and append-only database permissions. Redact secrets before event persistence. Treat external source text as untrusted input. Never let confidence alone authorize high-impact actions.

## Evaluation plan
- Integrity: mutation, truncation, reordering, duplicate IDs, and broken references.
- Replay: deterministic snapshot equality for same event stream.
- Provenance completeness: percentage of decisions with source-to-claim-to-action trace.
- Recovery: reconstruct action context after application restart from durable storage.
- Performance: p50/p95 append, verification, replay, and query latency at 10k/100k/1m events.
- Epistemic calibration: Brier score / calibration error only when assessments have a defined probabilistic interpretation and labelled outcomes.

## Open research questions
- How to represent mutually exclusive claims without collapsing them into one scalar confidence?
- How to model time validity versus observation time?
- How to make tamper evidence survive compromise of the application database?
- How to evaluate explanation usefulness without rewarding verbose narratives?
- How to expose provenance without leaking private source data?

## Prior-art statement
This design combines established ideas from provenance models, event sourcing, temporal knowledge graphs, and auditable agents. It is not claimed to be globally unprecedented. The differentiator hypothesis is the integrated operator workflow and its measured ability to reconstruct evidence-to-decision paths.
