# WITNESS FABRIC

Experimental deterministic evidence substrate for MOONWITNESS.

## Core
- `WitnessLedger`: append-only event ledger, hash-chain verification, deterministic replay.
- `buildClaimGenome(events)`: claim lineage graph retaining competing claims and explicit support/contradiction/supersession/derivation edges.
- `runCounterfactual(events, replay, options)`: replay a hypothetical evidence world after excluding selected evidence references or event IDs. This is sensitivity analysis, not causal inference.
- `detectRealityDrift(...)`: compare snapshots for confidence regression, status regression, stale claims and disappeared claims.

## Example
```ts
const genome = buildClaimGenome(ledger.events());
const report = await runCounterfactual(ledger.events(), replayEvents, {
  excludeEvidenceRefs: ["source:lab-report-7"]
});
const drift = detectRealityDrift({
  previous: yesterday, current: today, now: new Date().toISOString(),
  staleAfterMs: 30 * 24 * 60 * 60 * 1000, genome
});
```

## Limits
- The ledger is currently in-memory; a durable adapter is not included.
- Counterfactual output is event-removal sensitivity analysis, not a causal effect estimate.
- Staleness currently uses claim last-updated time as a proxy; source-level expiry needs explicit source records.
- Contradiction edges are assertions, not automatic semantic contradiction detection.
- Confidence values are recorded assessments, not calibrated probabilities.
- Hash chaining is tamper-evident only when the head is independently anchored.
- No ARSY external side effects are executed by this package.
