import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDivineRuntime, resolveAddons } from "../src/index.ts";
import { assertAdapterCapabilities } from "../src/adapters/index.ts";

test("Divine core imports without optional platform integrations or runtime dependencies", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}), []);
  assert.deepEqual(Object.keys(manifest.optionalDependencies ?? {}), []);
  assert.equal(typeof createDivineRuntime, "function");
  assert.equal(typeof resolveAddons, "function");
  assert.equal(typeof assertAdapterCapabilities, "function");
});
test("adapter capability checks fail closed with an actionable missing-capability list", () => {
  const port = { descriptor: { id: "test.corpus", version: "1.0.0", capabilities: ["corpus.read"] } };
  assert.throws(() => assertAdapterCapabilities(port, ["corpus.read", "corpus.identity.resolve"]), error =>
    error.code === "DIVINE_ADAPTER_CAPABILITY_MISSING" &&
    error.details.missing.includes("corpus.identity.resolve"));
});
