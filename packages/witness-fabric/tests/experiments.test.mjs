import test from "node:test";
import assert from "node:assert/strict";
import { WitnessLedger } from "../src/index.ts";
import { buildClaimGenome, detectRealityDrift, runCounterfactual } from "../src/experiments.ts";

const input = (id, type, subject, payload, evidenceRefs = []) => ({
  id, type, actor: "researcher:1", occurredAt: "2026-11-08T00:00:00.000Z", subject, payload, evidenceRefs
});
async function makeLedger() {
  const ledger = new WitnessLedger();
  await ledger.append(input("c1", "claim.proposed", "claim:A", { statement: "A is true" }));
  await ledger.append(input("a1", "claim.assessed", "claim:A", { confidence: 0.9, status: "supported" }, ["src:one"]));
  await ledger.append(input("c2", "claim.proposed", "claim:B", { statement: "A is false" }, ["src:two"]));
  await ledger.append(input("r1", "relation.asserted", "claim:A", { targetClaimId: "claim:B", relation: "contradicts" }));
  return ledger;
}
test("Claim Genome preserves competing claims and explicit contradiction edges", async () => {
  const ledger = await makeLedger();
  const genome = buildClaimGenome(ledger.events());
  assert.equal(genome.nodes.length, 2);
  assert.equal(genome.edges[0].relation, "contradicts");
  assert.deepEqual(genome.conflicts[0].claimIds, ["claim:A", "claim:B"]);
});
test("Claim Genome rejects dangling relations instead of silently dropping them", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(input("c1", "claim.proposed", "claim:A", { statement: "A" }));
  await ledger.append(input("r1", "relation.asserted", "claim:A", { targetClaimId: "claim:missing", relation: "contradicts" }));
  assert.throws(() => buildClaimGenome(ledger.events()), /unknown claim/);
});
test("Counterfactual replay removes assessments tied to an excluded source", async () => {
  const ledger = await makeLedger();
  const report = await runCounterfactual(ledger.events(), async (inputs) => {
    const replayLedger = new WitnessLedger();
    for (const event of inputs) await replayLedger.append(event);
    return replayLedger.replay();
  }, { excludeEvidenceRefs: ["src:one"] });
  assert.equal(report.excludedEvents, 1);
  assert.equal(report.counterfactual.claims["claim:A"].confidence, 0.5);
  assert.equal(report.deltas.some((delta) => delta.claimId === "claim:A"), true);
});
test("Reality Drift Radar flags confidence regression and stale claims", async () => {
  const ledger = await makeLedger();
  const previous = ledger.replay();
  const nextLedger = new WitnessLedger();
  await nextLedger.append(input("c1", "claim.proposed", "claim:A", { statement: "A is true" }, ["src:one"]));
  await nextLedger.append(input("a1", "claim.assessed", "claim:A", { confidence: 0.4, status: "contested" }, ["src:one"]));
  const drift = detectRealityDrift({
    previous, current: nextLedger.replay(), now: "2026-11-09T00:00:00.000Z",
    staleAfterMs: 60_000, confidenceDropThreshold: 0.2
  });
  const claim = drift.find((item) => item.claimId === "claim:A");
  assert.ok(claim?.reasons.includes("confidence_drop"));
  assert.ok(claim?.reasons.includes("stale_evidence"));
  assert.equal(claim?.severity, "critical");
});
