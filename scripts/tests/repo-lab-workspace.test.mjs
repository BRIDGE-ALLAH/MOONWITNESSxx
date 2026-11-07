import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph } from "../counterfactual-repo-lab.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function withWorkspace(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "repo-lab-"));
  try {
    await mkdir(path.join(root, "apps", "app"), { recursive: true });
    await mkdir(path.join(root, "packages", "shared"), { recursive: true });
    await writeFile(
      path.join(root, "apps", "app", "package.json"),
      JSON.stringify({ name: "@test/app", dependencies: { "@test/shared": "workspace:*" } }),
    );
    await writeFile(
      path.join(root, "packages", "shared", "package.json"),
      JSON.stringify({ name: "@test/shared" }),
    );
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("scans only direct apps/* and packages/* workspace manifests", async () => {
  await withWorkspace(async (root) => {
    await mkdir(path.join(root, "apps", "app", "fixtures", "nested"), { recursive: true });
    await writeFile(
      path.join(root, "apps", "app", "fixtures", "nested", "package.json"),
      JSON.stringify({ name: "@test/fixture" }),
    );
    const graph = await buildGraph(root);
    assert.deepEqual(graph.nodes.map((node) => node.name), ["@test/app", "@test/shared"]);
    assert.deepEqual(graph.edges, [
      { from: "@test/app", to: "@test/shared", kind: "dependencies" },
    ]);
  });
});

test("fails closed with a useful path for malformed package JSON", async () => {
  await withWorkspace(async (root) => {
    await writeFile(path.join(root, "apps", "app", "package.json"), "{ invalid json");
    await assert.rejects(
      () => buildGraph(root),
      /Invalid package manifest at apps\/app\/package.json/,
    );
  });
});

test("rejects duplicate package names across workspace roots", async () => {
  await withWorkspace(async (root) => {
    await writeFile(
      path.join(root, "packages", "shared", "package.json"),
      JSON.stringify({ name: "@test/app" }),
    );
    await assert.rejects(() => buildGraph(root), /Duplicate workspace package name/);
  });
});

test("rejects malformed dependency sections instead of emitting an incomplete graph", async () => {
  await withWorkspace(async (root) => {
    await writeFile(
      path.join(root, "apps", "app", "package.json"),
      JSON.stringify({ name: "@test/app", dependencies: ["@test/shared"] }),
    );
    await assert.rejects(() => buildGraph(root), /Invalid dependencies/);
  });
});

test("CLI smoke tests execute cycle and changed-path commands", () => {
  const script = path.join(ROOT, "scripts", "counterfactual-repo-lab.mjs");
  const cycles = spawnSync(process.execPath, [script, "--", "--cycles"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(cycles.status, 0, cycles.stderr);
  assert.equal(JSON.parse(cycles.stdout).mode, "dependency-cycle-radar");

  const changed = spawnSync(
    process.execPath,
    [script, "--", "--changed-files", "packages/divine/src/index.ts"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(changed.status, 0, changed.stderr);
  const report = JSON.parse(changed.stdout);
  assert.deepEqual(report.changedPackages, ["@riotworks/divine"]);
  assert.equal(report.mandatoryCiPolicy.startsWith("Advisory only"), true);
});
