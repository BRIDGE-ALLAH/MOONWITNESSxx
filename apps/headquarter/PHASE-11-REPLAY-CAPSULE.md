# Phase 11 — Replay Capsule

**Status:** implemented domain kernel + synthetic Governance Lab presentation.  
**Route:** /governance-lab

## Goal
Make a scenario independently reproducible from the exact baseline, scenario assumptions, ordered operations, engine version, and computed result.

## Implementation
- Canonical JSON serialization sorts object keys while preserving array order.
- SHA-256 content digest identifies the complete replay payload.
- Capsule embeds schema version, engine version, baseline metrics, scenario definition, and result.
- Verification checks both digest equality and deterministic recomputation with the Scenario Forge engine.
- Supplied result is rejected if it does not match the baseline and scenario.

## Safety boundary
A hash is an integrity checksum, not a signature, identity proof, trusted timestamp, or authorization. Production requires ARSY-owned immutable storage, signed attestations, trusted time, schema registry, access policy, and audit linkage.

## Acceptance
- [x] Deterministic canonical payload and SHA-256 digest.
- [x] Recompute and compare stored result.
- [x] Detect payload tampering and mismatched result.
- [x] Unit tests cover valid and tampered capsules.
- [ ] Signed server attestations and trusted timestamp authority.
- [ ] Persisted replay registry with workspace-scoped access.
