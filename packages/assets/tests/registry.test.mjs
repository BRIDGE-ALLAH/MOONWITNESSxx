import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assetRegistry, getAsset, resolveAsset } from "../src/registry.ts";
import { inspectSvgSafety } from "../src/svg-safety.ts";

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

test("registered dimensions match every SVG viewBox aspect ratio", async () => {
  for (const asset of Object.values(assetRegistry)) {
    const path = fileURLToPath(new URL(asset.src));
    const source = await readFile(path, "utf8");
    const root = source.match(/<svg\b[^>]*>/i)?.[0];
    assert.ok(root, asset.id + ": missing SVG root");

    const viewBoxMatch = root.match(/\bviewBox\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    const viewBox = viewBoxMatch?.[1] ?? viewBoxMatch?.[2];
    assert.ok(viewBox, asset.id + ": missing viewBox");
    const values = viewBox.trim().split(/[\s,]+/).map(Number);
    assert.equal(values.length, 4, asset.id + ": viewBox requires four numbers");
    assert.ok(values.every(Number.isFinite), asset.id + ": viewBox contains non-finite values");
    assert.ok(values[2] > 0 && values[3] > 0, asset.id + ": viewBox dimensions must be positive");

    const sourceRatio = values[2] / values[3];
    const registryRatio = asset.width / asset.height;
    assert.ok(
      Math.abs(sourceRatio - registryRatio) < 0.02,
      asset.id + ": SVG viewBox ratio " + sourceRatio + " does not match registry ratio " + registryRatio,
    );
  }
});

test("SVG safety rules reject executable markup and external resource loading", () => {
  const unsafeFixtures = [
    ["script element", '<svg><script>alert(1)</script></svg>'],
    ["foreign object", '<svg><foreignObject><div>content</div></foreignObject></svg>'],
    ["inline event handler", '<svg onload="run()"></svg>'],
    ["JavaScript URL", '<svg><a href="javascript:run()"></a></svg>'],
    ["absolute resource href", '<svg><image href="https://example.invalid/image.svg"/></svg>'],
    ["protocol-relative resource href", '<svg><image href="//example.invalid/image.svg"/></svg>'],
    ["relative resource href", '<svg><image href="../image.svg"/></svg>'],
    ["CSS absolute url", '<svg><style>.mark{fill:url(https://example.invalid/paint.svg#id)}</style></svg>'],
    ["CSS protocol-relative url", '<svg><style>.mark{fill:url("//example.invalid/paint.svg")}</style></svg>'],
    ["CSS import", '<svg><style>@import "https://example.invalid/theme.css";</style></svg>'],
    ["DTD declaration", '<!DOCTYPE svg><svg></svg>'],
    ["entity declaration", '<!ENTITY payload "unsafe"><svg></svg>'],
  ];

  for (const [label, svg] of unsafeFixtures) {
    assert.ok(inspectSvgSafety(svg).length > 0, label + " must be rejected");
  }
});

test("local SVG fragment references remain valid", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="signal"/></defs><rect fill="url(#signal)"/><use href="#signal"/></svg>';
  assert.deepEqual(inspectSvgSafety(svg), []);
});

test("every registered SVG satisfies the shared safety contract", async () => {
  for (const asset of Object.values(assetRegistry)) {
    const path = fileURLToPath(new URL(asset.src));
    const source = await readFile(path, "utf8");
    assert.deepEqual(
      inspectSvgSafety(source),
      [],
      asset.id + ": registered SVG must not load external resources or contain executable markup",
    );
  }
});
