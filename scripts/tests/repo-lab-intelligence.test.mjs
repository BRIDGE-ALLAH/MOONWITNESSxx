import test from "node:test";
import assert from "node:assert/strict";
import { analyzeChangedPaths, findDependencyCycles } from "../repo-lab-intelligence.mjs";

const graph = {
  nodes: [
    { name: "@app", path: "apps/app" },
    { name: "@shell", path: "packages/shell" },
    { name: "@ui", path: "packages/ui" },
    { name: "@ui-internal", path: "packages/ui/internal" },
    { name: "@types", path: "packages/types" },
    { name: "@other", path: "packages/other" }
  ],
  edges: [
    { from: "@app", to: "@shell", kind: "dependencies" },
    { from: "@shell", to: "@ui", kind: "dependencies" },
    { from: "@ui", to: "@types", kind: "devDependencies" }
  ]
};

test("maps changed files to the deepest owning package and reports unowned paths", () => {
  const result = analyzeChangedPaths(graph, [
    "packages/ui/internal/src/a.ts",
    "packages/ui/src/button.ts",
    "README.md",
    "./packages/ui/src/button.ts"
  ]);
  assert.deepEqual(result.changedPackages, ["@ui", "@ui-internal"]);
  assert.deepEqual(result.packageOwnership.find((item) => item.package === "@ui-internal").files, ["packages/ui/internal/src/a.ts"]);
  assert.deepEqual(result.unownedPaths, ["README.md"]);
  assert.deepEqual(result.impactedDependents, ["@app", "@shell"]);
});

test("structural exposure score is deterministic and explicitly not a failure probability", () => {
  const first = analyzeChangedPaths(graph, ["packages/types/src/index.ts"]);
  const second = analyzeChangedPaths(graph, ["packages/types/src/index.ts"]);
  assert.deepEqual(first.structuralExposure, second.structuralExposure);
  assert.match(first.structuralExposure.scale, /not a probability/);
  assert.equal(first.mandatoryCiPolicy.startsWith("Advisory only"), true);
});

test("rejects empty and unsafe changed paths", () => {
  assert.throws(() => analyzeChangedPaths(graph, []), /at least one/);
  assert.throws(() => analyzeChangedPaths(graph, ["../../secrets.env"]), /Unsafe repository path/);
});

test("finds multi-package cycles and self-loops, excluding acyclic nodes", () => {
  const cyclic = {
    nodes: graph.nodes,
    edges: [
      { from: "@app", to: "@shell", kind: "dependencies" },
      { from: "@shell", to: "@ui", kind: "dependencies" },
      { from: "@ui", to: "@shell", kind: "dependencies" },
      { from: "@types", to: "@types", kind: "peerDependencies" }
    ]
  };
  const result = findDependencyCycles(cyclic);
  assert.equal(result.cycleCount, 2);
  assert.deepEqual(result.cycles.map((cycle) => cycle.packages), [["@shell", "@ui"], ["@types"]]);
});
