import assert from "node:assert/strict";
import test from "node:test";
import { SystemModeOrchestrator, type SystemModePorts, type SystemModeStage } from "../src/index.ts";
import type { RegistryBuildInput, RegistrySnapshot } from "@riotworks/orm";
import type { DatabaseAdapter, DatabaseSnapshot } from "@riotworks/orm-db-adaptor";
import type { ReconciliationPolicy, SchemaPlan, ReconciliationReceipt } from "@riotworks/orm-db";

const registry: RegistrySnapshot = { formatVersion: 1, fingerprint: "fp", createdAt: "2026-01-01T00:00:00.000Z", addonOrder: [], moduleOrder: [], models: {} };
const plan: SchemaPlan = { id: "plan", registryFingerprint: "fp", provider: "postgres:business", generatedAt: "2026-01-01T00:00:00.000Z", operations: [], requiresApproval: false };
const receipt: ReconciliationReceipt = { planId: "plan", registryFingerprint: "fp", provider: "postgres:business", appliedAt: "2026-01-01T00:00:00.000Z", actorId: "operator", results: [], verified: true, status: "verified" };

function makePorts(events: string[], failHandoff = false): SystemModePorts {
  let current: SystemModeStage = "control-bootstrap";
  const policy: ReconciliationPolicy = { mode: "safe", allowDestructive: false, requireApprovalForReview: true };
  return {
    store: {
      async acquireLease() { events.push("lease"); return { name: "arsy-system-mode", ownerToken: "token", fencingGeneration: 1, expiresAt: 99_999 }; },
      async renewLease(lease) { events.push("renew"); return lease; },
      async releaseLease() { events.push("release"); },
      async savePlan() { events.push("save-plan"); },
      async saveReceipt() { events.push("save-receipt"); },
      async activateRegistry() { events.push("activate"); return { generation: 1, activatedAt: "2026-01-01T00:00:00.000Z" }; },
      async appendAudit(type) { events.push(type); },
    },
    journal: {
      async begin() { events.push("begin"); },
      async transition(_id, expected, next) { assert.equal(current, expected); current = next; events.push(next); },
      async finish(_id, status) { events.push(status); },
      async incomplete() { return []; },
    },
    composer: { compose() { events.push("compose"); return registry; } },
    businessAdapter: {} as DatabaseAdapter,
    planner: { plan() { events.push("plan"); return plan; } },
    reconciler: {
      async reconcile() { events.push("reconcile"); return receipt; },
      async verify() { events.push("verify"); return true; },
    },
    policy,
    async discover() { events.push("discover"); return { addons: [], modules: [], models: [] } satisfies RegistryBuildInput; },
    async verifyTrust(input) { events.push("trust"); return input; },
    async recover() { events.push("recover"); },
    async inspectBusiness() { return {} as DatabaseSnapshot; },
    async approve() { events.push("approve"); return policy; },
    async handoff() { events.push("handoff"); if (failHandoff) throw new Error("canary failed"); },
    async setReadiness(ready) { events.push(ready ? "ready" : "not-ready"); },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    createRunId: () => "run-1",
  };
}
test("orders discovery, approval, reconciliation, verification, activation and runtime handoff", async () => {
  const events: string[] = [];
  const result = await new SystemModeOrchestrator(makePorts(events)).run("operator");
  assert.equal(result.registry.fingerprint, "fp");
  assert.ok(events.indexOf("verify") < events.indexOf("activate"));
  assert.ok(events.indexOf("activate") < events.indexOf("handoff"));
  assert.ok(events.includes("ready"));
  assert.ok(events.includes("completed"));
  assert.ok(events.includes("release"));
});
test("keeps readiness false and journals failure when runtime handoff fails", async () => {
  const events: string[] = [];
  await assert.rejects(() => new SystemModeOrchestrator(makePorts(events, true)).run("operator"), /canary failed/);
  assert.ok(events.includes("failed"));
  assert.ok(events.includes("not-ready"));
  assert.ok(events.includes("release"));
});
