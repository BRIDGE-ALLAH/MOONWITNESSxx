# WITNESS FABRIC

Experimental deterministic evidence substrate for MOONWITNESS.

## Core API
- `WitnessLedger`: append-only event ledger, hash-chain verification and deterministic replay.
- `buildClaimGenome(events)`: claim lineage graph retaining competing claims and explicit support, contradiction, supersession and derivation edges.
- `runCounterfactual(events, replay, options)`: replay a hypothetical evidence world after excluding selected evidence references or event IDs.
- `detectRealityDrift(...)`: compare snapshots for confidence regression, status regression, stale claims and disappeared claims.

## Counterfactual example
```ts
const report = await runCounterfactual(ledger.events(), replayEvents, {
  excludeEvidenceRefs: ["source:lab-report-7"]
});
```

## Limits
- The ledger is currently in-memory; no durable adapter is included.
- Counterfactual output is event-removal sensitivity analysis, not a causal effect estimate.
- Staleness currently uses claim last-updated time as a proxy; source-level expiry needs explicit source records.
- Contradiction edges are explicit assertions, not automatic semantic contradiction detection.
- Confidence values are recorded assessments, not calibrated probabilities.
- Hash chaining is tamper-evident only when the head is independently anchored.
- No ARSY external side effects are executed by this package.
