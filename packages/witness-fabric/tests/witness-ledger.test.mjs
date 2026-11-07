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

test("agent action cannot complete until a policy decision explicitly allows it", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base({ type: "action.proposed", subject: "action:publish-1", payload: { tool: "publisher.publish" } }));
  await ledger.append(base({ id: "evt-2", type: "action.completed", subject: "action:publish-1", payload: { receipt: { remoteId: "post-1" } } }));
  assert.throws(() => ledger.replay(), /without an allowed policy decision/);
});

test("action lifecycle records policy and execution receipt", async () => {
  const ledger = new WitnessLedger();
  await ledger.append(base({ type: "action.proposed", subject: "action:publish-1", payload: { tool: "publisher.publish" } }));
  await ledger.append(base({ id: "evt-2", type: "policy.evaluated", subject: "action:publish-1", payload: { decision: "allowed", policyRef: "policy:publish-v2" } }));
  await ledger.append(base({ id: "evt-3", type: "action.completed", subject: "action:publish-1", payload: { receipt: { remoteId: "post-1" } } }));
  const action = ledger.replay().actions["action:publish-1"];
  assert.equal(action.status, "completed");
  assert.equal(action.policyRef, "policy:publish-v2");
  assert.equal(action.receipt.remoteId, "post-1");
});

test("concurrent appends are serialized and retain a valid hash chain", async () => {
  const ledger = new WitnessLedger();
  await Promise.all(Array.from({ length: 30 }, (_, i) => ledger.append(base({
    id: "parallel-" + i, subject: "observation:" + i,
    type: "observation.recorded", payload: { content: i }
  }))));
  const result = await ledger.verify();
  assert.equal(result.valid, true);
  assert.equal(result.checked, 30);
  assert.deepEqual(ledger.events().map((event) => event.sequence), Array.from({ length: 30 }, (_, i) => i + 1));
});

test("caller mutation cannot silently alter an appended event", async () => {
  const ledger = new WitnessLedger();
  const payload = { statement: "Original statement" };
  await ledger.append(base({ payload }));
  payload.statement = "Mutated after append";
  assert.equal(ledger.replay().claims["claim:moon-water"].statement, "Original statement");
  assert.equal((await ledger.verify()).valid, true);
});
