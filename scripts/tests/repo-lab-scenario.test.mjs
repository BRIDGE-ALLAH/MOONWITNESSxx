import test from "node:test";
import assert from "node:assert/strict";
import { replayScenarios, validateScenarioDocument } from "../repo-lab-scenario.mjs";

const graph = {
  nodes: ["@app", "@shell", "@ui", "@types", "@other"].map((name) => ({ name, path: name })),
  edges: [
    { from: "@app", to: "@shell", kind: "dependencies" },
    { from: "@shell", to: "@ui", kind: "dependencies" },
    { from: "@ui", to: "@types", kind: "devDependencies" }
  ]
};

test("replays multiple scenarios in stable input order", () => {
  const report = replayScenarios(graph, {
    schemaVersion: 1,
    scenarios: [
      { id: "ui-change", mode: "change-impact", target: "@ui" },
      { id: "types-outage", mode: "counterfactual-outage", target: "@types" }
    ]
  });
  assert.equal(report.scenarioCount, 2);
  assert.deepEqual(report.results.map((item) => item.id), ["ui-change", "types-outage"]);
  assert.deepEqual(report.results[1].dependents, ["@app", "@shell", "@ui"]);
  assert.equal(report.readOnly, true);
});

test("rejects unsupported schema versions and duplicate identifiers", () => {
  assert.throws(() => validateScenarioDocument({ schemaVersion: 2, scenarios: [{ id: "a", mode: "change-impact", target: "@ui" }] }), /schemaVersion/);
  assert.throws(() => validateScenarioDocument({ schemaVersion: 1, scenarios: [
    { id: "same", mode: "change-impact", target: "@ui" },
    { id: "same", mode: "counterfactual-outage", target: "@types" }
  ] }), /Duplicate scenario id/);
});

test("rejects unsafe or ambiguous scenario fields", () => {
  assert.throws(() => validateScenarioDocument({ schemaVersion: 1, scenarios: [{ id: "bad id", mode: "change-impact", target: "@ui" }] }), /stable lowercase identifier/);
  assert.throws(() => validateScenarioDocument({ schemaVersion: 1, scenarios: [{ id: "a", mode: "execute-shell", target: "@ui" }] }), /mode must be/);
  assert.throws(() => validateScenarioDocument({ schemaVersion: 1, scenarios: [{ id: "a", mode: "change-impact", target: "@ui", command: "rm -rf" }] }), /unsupported field/);
});

test("unknown package targets fail rather than yielding a misleading empty report", () => {
  assert.throws(() => replayScenarios(graph, {
    schemaVersion: 1,
    scenarios: [{ id: "missing", mode: "change-impact", target: "@missing" }]
  }), /Unknown workspace package/);
});
