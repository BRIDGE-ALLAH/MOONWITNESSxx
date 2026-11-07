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
