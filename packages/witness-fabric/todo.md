# WITNESS FABRIC — Engineering TODO

## M1 Evidence Spine
- [x] Create workspace package with zero runtime framework/database dependencies.
- [x] Define append-only observation, claim, assessment, relation, decision, and action events.
- [x] Add stable event IDs, actor, subject, time, sequence, evidence refs, previous hash, SHA-256 digest.
- [x] Serialize concurrent appends and isolate caller payload mutation.
- [ ] Add durable ARSY/SQL adapter and transaction boundary.
- [ ] Add actor authentication, tenant scope, retention and redaction policy.
- [ ] Add signed checkpoint and external head anchoring.

## M2 Epistemic Replay
- [x] Deterministic projection of claims, observations, decisions, and actions.
- [x] Preserve claim assessments and evidence references.
- [x] Fail closed for invalid assessment order and action without policy allow.
- [x] Verify sequence and hash-chain integrity.
- [ ] Add contradiction/competing-claim graph and temporal validity intervals.
- [ ] Add source reliability and calibrated confidence methodology.
- [ ] Add counterfactual evidence removal and sensitivity report.
- [ ] Add restart/recovery tests against durable storage.

## M3 Agent Accountability Hooks
- [x] Define action proposal, policy evaluation, completion, and failure events.
- [x] Require explicit policy allow before completed action replay.
- [x] Preserve policy reference and execution receipt.
- [x] Add dedicated CI workflow job and branch matching for slash-separated feature branches.
- [ ] Integrate hooks at ARSY tool execution boundary.
- [ ] Add idempotency, transactional outbox, signed receipts, and operator approval.
- [ ] Add Headquarter Evidence-to-Decision Replay interface.

## Research experiments
- [ ] Claim Genome: branch competing claims and provenance.
- [ ] Counterfactual Observatory: replay after removing/downgrading evidence.
- [ ] Reality Drift Radar: detect stale/contradicted/high-impact claims.
- [ ] Publish benchmark dataset and reproducible evaluation protocol.

## Release gates
- [ ] GitHub Actions test and type-check job passes.
- [ ] Full workspace CI passes.
- [ ] Security review for tenant isolation, append-only permissions, and actor attribution.
- [ ] Performance benchmarks at 10k/100k/1m events.
- [ ] Documentation and API contract review.
