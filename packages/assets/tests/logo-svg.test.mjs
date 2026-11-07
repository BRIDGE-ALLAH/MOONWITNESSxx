import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assetRegistry } from "../src/registry.ts";

const brandAssets = Object.values(assetRegistry).filter((asset) => asset.category === "brand");

test("brand registry contains canonical marks and original MW monogram", () => {
  for (const id of ["brand.symbol", "brand.wordmark", "brand.lockup", "brand.archive-seal", "brand.monogram", "brand.symbol.mono-light", "brand.symbol.mono-dark", "brand.symbol.small"]) assert.ok(assetRegistry[id], \`missing registry entry: \${id}\`);
});

test("registered brand SVGs have safe roots and positive viewBox dimensions", async () => {
  assert.ok(brandAssets.length >= 8);
  for (const asset of brandAssets) {
    const source = await readFile(fileURLToPath(new URL(asset.src)), "utf8");
    const root = source.match(/<svg\b([^>]*)>/i);
    assert.ok(root, \`\${asset.id}: missing SVG root\`);
    assert.match(root[1], /xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i);
    const box = root[1].match(/viewBox=["']\s*([\d.+-]+)[ ,]+([\d.+-]+)[ ,]+([\d.+-]+)[ ,]+([\d.+-]+)\s*["']/i);
    assert.ok(box, \`\${asset.id}: missing numeric viewBox\`);
    const [, x, y, width, height] = box.map(Number);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0);
    assert.ok(asset.width > 0 && asset.height > 0);
    assert.ok(Math.abs(width / height - asset.width / asset.height) < 0.02);
    assert.ok(source.trimEnd().endsWith("</svg>"));
  }
});

test("identity wordmark and monogram use outlined vector paths", async () => {
  for (const id of ["brand.wordmark", "brand.monogram"]) {
    const source = await readFile(fileURLToPath(new URL(assetRegistry[id].src)), "utf8");
    assert.doesNotMatch(source, /<text\b/i);
    assert.match(source, /<path\b/i);
  }
});

test("brand SVGs reject executable, embedded, or external content", async () => {
  for (const asset of brandAssets) {
    const source = await readFile(fileURLToPath(new URL(asset.src)), "utf8");
    assert.doesNotMatch(source, /<\s*(script|foreignObject|iframe|object|embed)\b/i);
    assert.doesNotMatch(source, /\bon[a-z]+\s*=/i);
    assert.doesNotMatch(source, /javascript\s*:/i);
    assert.doesNotMatch(source, /(?:href|xlink:href)\s*=\s*["'](?!#)/i);
    assert.doesNotMatch(source, /url\(\s*["']?(?!#)/i);
    assert.doesNotMatch(source, /<!ENTITY|<!DOCTYPE/i);
  }
});
