import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assetRegistry } from "../src/registry.ts";

const logoAssets = Object.values(assetRegistry).filter((asset) => asset.category === "brand");

test("brand registry contains the canonical marks and provisional variants", () => {
  for (const id of ["brand.symbol", "brand.wordmark", "brand.lockup", "brand.archive-seal", "brand.symbol.mono-light", "brand.symbol.mono-dark", "brand.symbol.small"]) {
    assert.ok(assetRegistry[id], `missing registry entry: ${id}`);
  }
});

test("registered brand SVGs have safe roots and positive viewBox dimensions", async () => {
  assert.ok(logoAssets.length >= 7);
  for (const asset of logoAssets) {
    const source = await readFile(fileURLToPath(new URL(asset.src)), "utf8");
    const root = source.match(/<svg\b([^>]*)>/i);
    assert.ok(root, `${asset.id}: missing SVG root`);
    assert.match(root[1], /xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i, `${asset.id}: missing SVG namespace`);
    const viewBox = root[1].match(/viewBox=["']\s*([\d.+-]+)[ ,]+([\d.+-]+)[ ,]+([\d.+-]+)[ ,]+([\d.+-]+)\s*["']/i);
    assert.ok(viewBox, `${asset.id}: missing numeric viewBox`);
    const [, , , width, height] = viewBox.map(Number);
    assert.ok(width > 0 && height > 0, `${asset.id}: viewBox dimensions must be positive`);
    assert.ok(asset.width > 0 && asset.height > 0, `${asset.id}: registry dimensions must be positive`);
    const ratioDelta = Math.abs((width / height) - (asset.width / asset.height));
    assert.ok(ratioDelta < 0.02, `${asset.id}: registry dimensions disagree with SVG viewBox`);
    assert.match(source, /<\/svg>\s*$/i, `${asset.id}: missing closing SVG tag`);
  }
});

test("brand SVGs reject executable, embedded, or external content", async () => {
  for (const asset of logoAssets) {
    const source = await readFile(fileURLToPath(new URL(asset.src)), "utf8");
    assert.doesNotMatch(source, /<\s*(script|foreignObject|iframe|object|embed)\b/i, `${asset.id}: executable/embedded element`);
    assert.doesNotMatch(source, /\bon[a-z]+\s*=/i, `${asset.id}: inline event handler`);
    assert.doesNotMatch(source, /javascript\s*:/i, `${asset.id}: javascript URL`);
    assert.doesNotMatch(source, /(?:href|xlink:href)\s*=\s*["'](?!#)/i, `${asset.id}: non-fragment reference`);
    assert.doesNotMatch(source, /url\(\s*["']?(?!#|data:image\/)/i, `${asset.id}: external CSS URL`);
    assert.doesNotMatch(source, /<!ENTITY|<!DOCTYPE/i, `${asset.id}: entity/doctype declaration`);
  }
});
