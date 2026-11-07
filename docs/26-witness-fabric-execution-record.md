# WITNESS FABRIC — Three-Milestone Execution Record

**Date:** 2026-11-08  
**Branch:** `feat/moonwitness-brand-identity-v1`  
**Status:** First vertical slice implemented; CI verification pending.

## Milestone 1 — Evidence Spine
**Implemented**
- New workspace package `@moonwitness/witness-fabric`.
- Typed append-only event vocabulary for observations, claims, claim assessments, relations, decisions, and action lifecycle.
- Stable sequence, actor, subject, timestamp, evidence references, previous hash, and SHA-256 digest.
- Duplicate-ID validation and confidence range/status validation.
- Serialized concurrent appends and cloned payloads to avoid race and caller-mutation corruption.

**Not yet complete**
- Durable SQL adapter, authenticated actor context, tenant scoping, retention and privacy policy.
- Signed checkpoints and externally anchored head hashes.

## Milestone 2 — Epistemic Replay
**Implemented**
- Deterministic replay of claim, observation, decision, and action projections.
- Claim assessments preserve confidence, status, and accumulated evidence references.
- Replay fails closed for assessment-before-proposal and action-completion-without-policy-allow.
- Hash-chain verification checks sequence, previous hash, and content digest.

**Not yet complete**
- Contradiction graph, temporal valid-time vs observed-time, source quality model, calibrated confidence, and counterfactual evidence removal.
- Durable restart recovery requires a storage adapter.

## Milestone 3 — Agent Accountability Hooks
**Implemented**
- Typed action proposal, policy evaluation, completion, and failure events.
- Replay refuses to mark an action completed unless a prior policy event explicitly allowed it.
- Execution receipts and policy references are preserved in action projections.
- Dedicated CI job added for tests and type-check; branch push glob fixed for slash-separated feature branches.

**Not yet complete**
- ARSY integration at the tool execution boundary; no side-effect endpoint has been exposed.
- Server-side authorization, idempotency keys, outbox transaction, secret redaction, signed receipts, and approval UI.

## Tests added
1. Sequential hash-chain verification.
2. Duplicate event and invalid confidence rejection.
3. Claim replay and evidence accumulation.
4. Unknown-claim assessment rejection.
5. Observation and decision replay.
6. Action completion denied without policy allow.
7. Policy-gated action lifecycle and receipt replay.
8. Concurrent append serialization.
9. Caller payload mutation isolation.

The tests are committed but must run in GitHub Actions before the milestone can be called CI-verified.

## Next three research/engineering experiments
1. **Claim Genome:** represent competing claims as branches with temporal validity and source lineage rather than collapsing disagreement into a scalar.
2. **Counterfactual Observatory:** remove or downgrade one source and replay downstream claim/decision changes to measure evidence sensitivity.
3. **Reality Drift Radar:** compare successive snapshots and alert when high-impact claims lose support, sources expire, or contradictory evidence appears.

These are hypotheses and proposed experiments, not claims of world-first invention. Prior-art and benchmark evaluation are required before any novelty statement.


# WITNESS FABRIC — Next Three Experiments

**Date:** 2026-11-08  
**Status:** Deterministic library prototypes committed; production integration and UI are not complete.

## Phase 4 — Claim Genome
Represent competing propositions as separate nodes. Explicit relation edges include `supports`, `contradicts`, `supersedes`, and `derived_from`. Valid-time metadata is retained on claims when supplied. Dangling references fail closed. No automatic LLM contradiction detection is implied.

## Phase 5 — Counterfactual Observatory
Remove selected evidence references or event IDs, replay the remaining history, and report claim confidence/status deltas. This is evidence sensitivity analysis; it is not a causal effect estimate. An excluded assessment is removed as a whole because the current event schema does not attribute individual confidence contributions to individual sources.

## Phase 6 — Reality Drift Radar
Compare two snapshots and surface disappeared claims, confidence drops, status regression, and stale claims. The current stale check uses claim last-updated time as a proxy. A future source registry must provide explicit observedAt, validUntil, retrieval status, and source reliability.

## Research synthesis
The field is active; these ingredients are not individually unprecedented:
- ICLR 2026 HEDRA studies counterfactual detection and heterogeneous event causality in temporal knowledge graphs.
- EZ-check (Information Sciences, 25 June 2026) studies explainable zero-shot KG extraction and fact-checking.
- FreeGuard (2026) includes counterfactual evidence-chain governance.
- Reddit practitioner discussions repeatedly report stale memory, silent supersession, weak provenance, retrieval of superseded beliefs, and the need to separate relevance from validity.
- GitHub ecosystem surveys show temporal KG, append-only event history, agent memory, and no-DB/local-first architectures coexisting; Graphiti, Hindsight, OpenViking, Mem0, and GraphRAG are relevant prior art/comparison targets.

## Proposed differentiation (hypothesis, not world-first claim)
**Evidence Flight Recorder**: a reproducible "why did the system believe/act?" bundle containing an anchored event prefix, claim-genome branch, policy decision, counterfactual sensitivity report, and drift alerts. It could be exported as a portable signed bundle for incident review across agent vendors. Prior-art review, threat modelling, and benchmark comparison are required before novelty claims.


# WITNESS FABRIC — Phases 7–9 Execution Record

**Date:** 2026-11-08. **Status:** Library prototypes implemented; production key custody and durable integration remain release gates.

## Phase 7 — Bitemporal Truth Query
Added `queryBitemporalClaims(events, { validAt, knownAt })`. `validAt` asks when a proposition applies in the modeled world; `knownAt` limits the event history to what the system had observed by that time. Supersession edges can end a claim's validity window. This prevents hindsight leakage in historical replay. Source-level validity and late-arriving correction policies remain future work.

## Phase 8 — Signed Witness Checkpoint
Added Ed25519 signed checkpoints over ledger sequence and head hash. Verification rejects changed event count or head. The private key must remain outside the event log and should be held by a KMS/HSM in production. Signature validity alone does not prove signer identity or factual correctness.

## Phase 9 — Evidence Flight Recorder
Added portable bundle creation and verification: event prefix, deterministic snapshot, Claim Genome, and signed checkpoint. The verifier reconstructs the ledger, checks hash chain, recomputes projections, and verifies the signature. This enables independent incident replay. Cross-vendor schema/versioning and an offline verifier CLI remain future tasks.

## New differentiator hypothesis
**Temporal Evidence Twin**: every high-impact claim has two clocks (when it was true vs when the system learned it), a cryptographically anchored history, and a portable replay artifact. Potential use cases: AI incident response, compliance evidence, scientific audit trails, and agent-to-agent trust handoff. This combines known techniques; novelty must be established by benchmarks and prior-art review.
