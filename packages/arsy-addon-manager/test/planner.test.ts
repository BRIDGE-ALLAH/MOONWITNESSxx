import assert from "node:assert/strict";
import test from "node:test";
import { AddonInstallPlanner, evaluateCapabilities, type AddonCandidate, type CapabilityPolicy } from "../src/index.ts";

const policy: CapabilityPolicy = {
  allowed: ["models.register", "database.business.write", "events.publish"],
  approvalRequired: ["database.business.write"],
  maximumRisk: "critical",
};
function candidate(id = "crm", moduleIds = ["crm"]): AddonCandidate {
  return {
    manifest: {
      id, version: "1.0.0", publisher: "moonwitness",
      compatibility: { arsy: "^1.0.0", orm: "^1.0.0" },
      modules: moduleIds, entrypoint: "dist/index.js", integrity: "sha256:abc",
      capabilities: ["models.register", "database.business.write"],
    },
    modules: moduleIds.map((module) => ({ id: module, addon: id, version: "1.0.0" })),
    trust: { status: "verified", publisher: "moonwitness", digest: "sha256:abc", signatureVerified: true },
  };
}
test("unknown capabilities are denied and high-risk grants require approval", () => {
  const decision = evaluateCapabilities(["models.register", "unknown.root", "database.business.write"], policy);
  assert.deepEqual(decision.granted, ["models.register"]);
  assert.deepEqual(decision.approvalRequired, ["database.business.write"]);
  assert.equal(decision.denied[0]?.capability, "unknown.root");
});
test("creates deterministic installation plan and records required approvals", () => {
  const planner = new AddonInstallPlanner({ capabilityPolicy: policy, now: () => new Date("2026-01-01T00:00:00.000Z") });
  const plan = planner.plan([candidate()]);
  assert.equal(plan.operations[0]?.addon, "crm");
  assert.deepEqual(plan.requiredApprovals, ["database.business.write"]);
  assert.equal(plan.id.length, 64);
});
test("quarantines invalid signature and unsafe entrypoint candidates", () => {
  const planner = new AddonInstallPlanner({ capabilityPolicy: policy });
  const value = candidate();
  const invalid = { ...value, manifest: { ...value.manifest, entrypoint: "../outside.js" }, trust: { ...value.trust, signatureVerified: false } };
  const plan = planner.plan([invalid]);
  assert.equal(plan.operations.length, 0);
  assert.equal(plan.blocked.length, 1);
});
test("rejects module dependency cycles", () => {
  const planner = new AddonInstallPlanner({ capabilityPolicy: policy });
  const value = candidate("sales", ["sales", "billing"]);
  const cyclic = { ...value, modules: [
    { id: "sales", addon: "sales", version: "1.0.0", depends: [{ module: "billing", version: "^1.0.0" }] },
    { id: "billing", addon: "sales", version: "1.0.0", depends: [{ module: "sales", version: "^1.0.0" }] },
  ] };
  const plan = planner.plan([cyclic]);
  assert.equal(plan.operations.length, 0);
  assert.match(plan.blocked[0]?.reason ?? "", /cycle/i);
});
