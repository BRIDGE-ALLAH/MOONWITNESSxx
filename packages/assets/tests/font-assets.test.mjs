import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("MOONWITNESS Signal Display WOFF2 is bundled and has valid container signature", async () => {
  const font = await readFile(new URL("../fonts/MOONWITNESS-SignalDisplay-SemiBold.woff2", import.meta.url));
  assert.ok(font.length > 1000 && font.length < 64 * 1024);
  assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2");
});

test("editable Signal glyph source covers uppercase, digits, and common punctuation", async () => {
  const source = JSON.parse(await readFile(new URL("../fonts/source/moonwitness-signal-glyphs.json", import.meta.url), "utf8"));
  for (const char of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-/") assert.ok(source.glyphs[char], "missing glyph " + char);
  assert.ok(Object.keys(source.glyphs).length >= 50);
});
