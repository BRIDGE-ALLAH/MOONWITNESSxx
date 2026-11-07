import test from "node:test";
import assert from "node:assert/strict";
import { blastRadius, toMermaid } from "../counterfactual-repo-lab.mjs";

const graph = {
  nodes: ["app","shell","ui","types","unused"].map((name) => ({ name: `@${name}`, path: name })),
  edges: [
    { from: "@app", to: "@shell", kind: "dependencies" },
    { from: "@shell", to: "@ui", kind: "dependencies" },
    { from: "@ui", to: "@types", kind: "devDependencies" }
  ]
};

test("computes transitive reverse dependency blast radius", () => {
  const result = blastRadius(graph, "@types");
  assert.deepEqual(result.affected, ["@app","@shell","@types","@ui"]);
  assert.deepEqual(result.dependents, ["@app","@shell","@ui"]);
});

test("does not include unrelated packages", () => {
  assert.deepEqual(blastRadius(graph, "@unused").affected, ["@unused"]);
});

test("rejects unknown packages instead of silently returning an empty report", () => {
  assert.throws(() => blastRadius(graph, "@missing"), /Unknown workspace package/);
});

test("renders deterministic Mermaid graph", () => {
  const diagram = toMermaid(graph);
  assert.ok(diagram.startsWith("flowchart TD"));
  assert.equal(diagram.split("\n").length, 9);
});
