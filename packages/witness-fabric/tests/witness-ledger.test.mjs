import test from "node:test";
import assert from "node:assert/strict";
import { WitnessLedger } from "../src/index.ts";

const base = (overrides = {}) => ({
  id: "evt-1", type: "claim.proposed", actor: "researcher:1",
  occurredAt: "2026-11-08T00:00:00.000Z", subject: "claim:moon-water",
  payload: { statement: "Sample contains water ice." }, evidenceRefs: ["obs:spectrum-1"], ...overrides
});

test("append creates a sequential tamper-evident hash chain", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base());
  await ledger.append(base({ id: "evt-2", type: "claim.assessed", payload: { confidence: 0.82, status: "supported" } }));
  assert.equal((await ledger.verify()).valid, true);
  assert.equal((await ledger.verify()).checked, 2);
  assert.notEqual(ledger.events()[0].hash, ledger.events()[1].hash);
});

test("duplicate IDs and invalid confidence are rejected", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base());
  await assert.rejects(() => ledger.append(base()), /duplicate event id/);
  await assert.rejects(() => ledger.append(base({ id: "evt-3", type: "claim.assessed", payload: { confidence: 2, status: "supported" } })), /confidence/);
});

test("replay reconstructs claim status and evidence history", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base());
  await ledger.append(base({ id: "evt-2", type: "claim.assessed", payload: { confidence: 0.91, status: "supported" }, evidenceRefs: ["obs:lab-2"] }));
  const state = ledger.replay().claims["claim:moon-water"];
  assert.equal(state.confidence, 0.91);
  assert.equal(state.status, "supported");
  assert.deepEqual(state.evidenceRefs, ["obs:spectrum-1", "obs:lab-2"]);
});

test("replay fails closed when assessment precedes claim proposal", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base({ type: "claim.assessed", payload: { confidence: 0.6, status: "contested" } }));
  assert.throws(() => ledger.replay(), /unknown claim/);
});

test("observation and decision events survive deterministic replay", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base({ type: "observation.recorded", subject: "obs:1", payload: { content: { source: "paper", page: 4 } } }));
  await ledger.append(base({ id: "evt-2", type: "decision.recorded", subject: "decision:1", payload: { rationale: "Evidence insufficient for release." } }));
  const snapshot = ledger.replay();
  assert.equal(snapshot.observations["obs:1"].content.source, "paper");
  assert.equal(snapshot.decisions["decision:1"].rationale, "Evidence insufficient for release.");
});
