# WITNESS FABRIC

Deterministic evidence substrate for MOONWITNESS.

## API
- `WitnessLedger`: append-only event ledger, hash-chain verification and deterministic replay.
- `buildClaimGenome(events)`: provenance graph for competing claims and explicit relations.
- `runCounterfactual(events, replay, options)`: evidence/event exclusion replay and claim deltas.
- `detectRealityDrift(...)`: confidence/status regression, stale claims and disappearance.
- `queryBitemporalClaims(events, { validAt, knownAt })`: query world-valid time separately from system-knowledge time.
- `createSignedCheckpoint(events, privateKey)` / `verifySignedCheckpoint(...)`: Ed25519 anchor over ledger sequence and head hash.
- `createEvidenceFlightRecorder(ledger, privateKey)` / `verifyEvidenceFlightRecorder(bundle, publicKey)`: portable signed incident/replay package.

## Security boundaries
The Ed25519 private key must be held outside the event ledger (KMS/HSM or deployment secret store). A signature proves possession of the signing key, not the truth of the underlying claims or the identity of an actor unless key custody is separately governed. Bundle verification checks signature, hash-chain reconstruction, deterministic snapshot and claim-genome projection.

## Current limitations
- Ledger persistence is still adapter-driven/in-memory; this package does not yet ship a database adapter.
- Counterfactual replay is evidence-removal sensitivity analysis, not causal inference.
- Staleness uses claim update time as a proxy until a source registry supplies expiry/reliability.
- Contradictions are explicit edges, not automatic semantic inference.
- Confidence values are assessments, not calibrated probabilities.
- Bitemporal query supports claim valid-time and event knowledge-time; source-level temporal lifecycle remains future work.
