# WITNESS FABRIC — Engineering TODO

## M1–M3 Evidence, replay and accountability
- [x] Append-only hash-chained event stream, deterministic replay and policy-gated action lifecycle.
- [ ] Durable transactional storage adapter, restart recovery and tenant partitioning.
- [ ] ARSY execution-boundary preflight/postflight middleware, idempotency and transactional outbox.

## M4–M6 Knowledge experiments
- [x] Claim Genome with provenance and explicit relation edges.
- [x] Counterfactual evidence-removal replay.
- [x] Reality Drift Radar snapshot comparison.

## M7–M9 Trust and temporal evidence
- [x] Bitemporal claim query: world-valid time vs system-knowledge time.
- [x] Ed25519 signed ledger checkpoint.
- [x] Evidence Flight Recorder portable bundle with replay and integrity verification.
- [ ] KMS/HSM key custody, rotation, revocation and signer identity policy.
- [ ] Durable source registry with source-level observedAt, validUntil, reliability and retrieval status.
- [ ] Cross-vendor bundle schema, JSON Schema and independent verifier CLI.

## Release gates
- [x] Fixed checkpoint verifier to recompute each event digest and chain link after the first tamper test exposed an endpoint-only verification gap.
- [ ] Latest dedicated tests and type-check pass.
- [ ] Full repository CI passes.
- [ ] Security review, tenant isolation, retention and redaction.
- [ ] 10k/100k/1m event benchmarks and adversarial tamper tests.
- [ ] ARSY and Headquarter integration.
