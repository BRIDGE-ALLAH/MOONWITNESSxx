import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assetRegistry } from "../src/registry.ts";

const brandAssets = Object.values(assetRegistry).filter((asset) => asset.category === "brand");

test("brand registry contains canonical marks and original MW monogram", () => {
  for (const id of ["brand.symbol", "brand.wordmark", "brand.lockup", "brand.archive-seal", "brand.monogram", "brand.symbol.mono-light", "brand.symbol.mono-dark", "brand.symbol.small"]) {
    assert.ok(assetRegistry[id], "missing registry entry: " + id);
  }
});

test("registered brand SVGs have safe roots and positive viewBox dimensions", async () => {
  assert.ok(brandAssets.length >= 8);
  for (const asset of brandAssets) {
    const source = await readFile(fileURLToPath(new URL(asset.src)), "utf8");
    const rootStart = source.indexOf("<svg");
    const rootEnd = source.indexOf(">", rootStart);
    assert.ok(rootStart >= 0 && rootEnd > rootStart, asset.id + ": missing SVG root");
    const root = source.slice(rootStart, rootEnd);
    assert.ok(root.includes('xmlns="http://www.w3.org/2000/svg"'), asset.id + ": missing SVG namespace");
    const viewBoxMatch = root.match(/viewBox="([^"]+)"/);
    assert.ok(viewBoxMatch, asset.id + ": missing viewBox");
    const dimensions = viewBoxMatch[1].trim().split(/[ ,]+/).map(Number);
    assert.equal(dimensions.length, 4);
    assert.ok(dimensions[2] > 0 && dimensions[3] > 0);
    assert.ok(asset.width > 0 && asset.height > 0);
    assert.ok(Math.abs(dimensions[2] / dimensions[3] - asset.width / asset.height) < 0.02);
    assert.ok(source.trimEnd().endsWith("</svg>"));
  }
});

test("identity wordmark and monogram use outlined vector paths", async () => {
  for (const id of ["brand.wordmark", "brand.monogram"]) {
    const source = await readFile(fileURLToPath(new URL(assetRegistry[id].src)), "utf8");
    assert.equal(source.includes("<text"), false, id + ": text nodes are not acceptable");
    assert.equal(source.includes("<path"), true, id + ": outlined paths are required");
  }
});

test("brand SVGs reject executable, embedded, or external content", async () => {
  for (const asset of brandAssets) {
    const source = await readFile(fileURLToPath(new URL(asset.src)), "utf8");
    for (const forbidden of ["<script", "<foreignObject", "<iframe", "<object", "<embed", "javascript:", "<!ENTITY", "<!DOCTYPE", 'href="http', "href='http", "url(http", "url(https"]) {
      assert.equal(source.includes(forbidden), false, asset.id + ": " + forbidden);
    }
    assert.equal(new RegExp("\\son[a-z]+\\s*=", "i").test(source), false, asset.id + ": inline event handler");
  }
});
