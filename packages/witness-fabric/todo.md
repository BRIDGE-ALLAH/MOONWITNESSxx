# WITNESS FABRIC — Engineering TODO

## M1 Evidence Spine
- [x] Append-only typed events, actor, timestamp, evidence references, sequence and SHA-256 chain.
- [x] Serialize concurrent appends and isolate/freeze nested payloads.
- [ ] Durable SQL adapter with transactional append and restart recovery.
- [ ] Authenticated actor identity, tenant scope, retention and redaction policy.
- [ ] Signed checkpoints and independently anchored head hashes.

## M2 Epistemic Replay
- [x] Deterministic replay of claims, observations, decisions and action lifecycle.
- [x] Explicit relation events and claim-graph projection.
- [x] Counterfactual event/evidence exclusion replay and claim deltas.
- [x] Snapshot drift detection for confidence/status regression and staleness.
- [ ] Bi-temporal valid-time / observed-time query API.
- [ ] Source-level reliability and expiry records.
- [ ] Calibrated confidence evaluation with labelled benchmark outcomes.

## M3 Agent Accountability
- [x] Typed action proposal, policy evaluation, completion and failure records.
- [x] Replay rejects completion without explicit policy allow.
- [ ] ARSY tool-boundary preflight/postflight middleware.
- [ ] Idempotency keys, transactional outbox, signed receipts and approval UI.
- [ ] Headquarter Evidence-to-Decision Replay interface.

## Research / product experiments
- [x] Claim Genome: competing claims and provenance edges.
- [x] Counterfactual Observatory core: evidence exclusion and sensitivity report.
- [x] Reality Drift Radar core: stale and regressed claim detection.
- [ ] Benchmark with synthetic adversarial and real labelled evidence.
- [ ] Visual graph, counterfactual diff and drift inbox in Headquarter.
- [ ] External prior-art and patent review before any novelty claim.

## Release gates
- [ ] Dedicated tests and type-check pass on latest head.
- [ ] Full repository CI passes.
- [ ] Security review: tenant isolation, append-only permissions, actor attribution.
- [ ] Performance benchmarks at 10k/100k/1m events.
- [ ] API and data-retention review.
