import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assetRegistry, getAsset, resolveAsset } from "../src/registry.ts";

test("registry keys are stable and unique", () => {
  const ids = Object.keys(assetRegistry);
  assert.equal(new Set(ids).size, ids.length);
  for (const [key, asset] of Object.entries(assetRegistry)) assert.equal(key, asset.id);
});

test("all registered files exist and contain SVG source", async () => {
  for (const asset of Object.values(assetRegistry)) {
    const path = fileURLToPath(new URL(asset.src));
    await access(path);
    const source = await readFile(path, "utf8");
    assert.match(source, /<svg\b/);
    assert.match(source, /<\/svg>\s*$/);
  }
});

test("registry helpers return known assets and safely reject unknown ids", () => {
  assert.equal(getAsset("texture.halftone").category, "texture");
  assert.equal(resolveAsset("illustration.empty-search").category, "illustration");
  assert.equal(resolveAsset("brand.not-real"), undefined);
});

test("all meaningful illustrations have alt text and every asset has provenance", () => {
  for (const asset of Object.values(assetRegistry)) {
    assert.ok(asset.description.length > 0);
    assert.ok(asset.source.length > 0);
    assert.ok(asset.license.length > 0);
    if (!asset.decorative) assert.ok(asset.alt?.length);
  }
});
