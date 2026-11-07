import test from "node:test";
import assert from "node:assert/strict";
import { WitnessLedger } from "../src/index.ts";
import { queryBitemporalClaims } from "../src/temporal.ts";
import { createSignedCheckpoint, verifySignedCheckpoint } from "../src/checkpoint.ts";
import { createEvidenceFlightRecorder, verifyEvidenceFlightRecorder } from "../src/flight-recorder.ts";

const ev = (id, type, subject, payload, occurredAt, evidenceRefs = []) => ({
  id, type, actor: "observer", subject, payload, occurredAt, evidenceRefs
});
async function ledgerFixture() {
  const ledger = new WitnessLedger();
  await ledger.append(ev("p1", "claim.proposed", "claim:orbit", {
    statement: "Object is in orbit", validFrom: "2025-01-01T00:00:00.000Z"
  }, "2025-01-02T00:00:00.000Z", ["source:radar"]));
  await ledger.append(ev("a1", "claim.assessed", "claim:orbit", {
    confidence: 0.8, status: "supported"
  }, "2025-01-03T00:00:00.000Z", ["source:radar"]));
  return ledger;
}
test("bitemporal query separates when a fact is valid from when it became known", async () => {
  const ledger = await ledgerFixture();
  const beforeKnown = queryBitemporalClaims(ledger.events(), {
    validAt: "2025-01-02T12:00:00.000Z", knownAt: "2025-01-02T12:00:00.000Z"
  });
  const afterKnown = queryBitemporalClaims(ledger.events(), {
    validAt: "2025-01-02T12:00:00.000Z", knownAt: "2025-01-04T00:00:00.000Z"
  });
  assert.equal(beforeKnown[0].status, "proposed");
  assert.equal(afterKnown[0].status, "supported");
});
test("signed checkpoint detects altered ledger head", async () => {
  const ledger = await ledgerFixture();
  const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const checkpoint = await createSignedCheckpoint(ledger.events(), keys.privateKey, "2026-11-08T00:00:00.000Z");
  assert.equal(await verifySignedCheckpoint(checkpoint, keys.publicKey, ledger.events()), true);
  const altered = [...ledger.events()];
  altered[0] = { ...altered[0], hash: "f".repeat(64) };
  assert.equal(await verifySignedCheckpoint(checkpoint, keys.publicKey, altered), false);
});
test("Evidence Flight Recorder exports and verifies a portable signed replay bundle", async () => {
  const ledger = await ledgerFixture();
  const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const bundle = await createEvidenceFlightRecorder(ledger, keys.privateKey, "2026-11-08T00:00:00.000Z");
  const report = await verifyEvidenceFlightRecorder(bundle, keys.publicKey);
  assert.equal(report.valid, true);
  assert.equal(report.eventCount, 2);
  const tampered = { ...bundle, snapshot: { ...bundle.snapshot, eventCount: 99 } };
  assert.equal((await verifyEvidenceFlightRecorder(tampered, keys.publicKey)).valid, false);
});
