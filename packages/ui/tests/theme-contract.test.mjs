import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const stylesheet = await readFile(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const tailwindConfig = await readFile(new URL("../tailwind.config.js", import.meta.url), "utf8");

function readRule(selector) {
  const start = stylesheet.indexOf(selector);
  assert.notEqual(start, -1, `Missing theme selector: ${selector}`);
  const open = stylesheet.indexOf("{", start);
  assert.notEqual(open, -1, `Missing declaration block for: ${selector}`);

  let depth = 0;
  for (let index = open; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === "{") depth += 1;
    if (stylesheet[index] === "}") {
      depth -= 1;
      if (depth === 0) return stylesheet.slice(open + 1, index);
    }
  }
  assert.fail(`Unclosed CSS declaration block: ${selector}`);
}

const requiredSemanticTokens = [
  "background", "foreground", "card", "card-foreground",
  "popover", "popover-foreground", "primary", "primary-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "success", "success-foreground", "warning", "warning-foreground",
  "info", "info-foreground", "border", "input", "ring", "focus", "overlay",
];

function readVariable(rule, name) {
  const match = rule.match(new RegExp(\`--\${name}\\s*:\\s*([^;]+);\`));
  assert.ok(match, \`Missing semantic token --\${name}\`);
  return match[1].trim();
}

test("default light root matches the canonical Archive semantic tokens", () => {
  const root = readRule(":root");
  const archive = readRule(".theme-archive");
  assert.match(root, /color-scheme:\s*light/);
  for (const token of requiredSemanticTokens) {
    assert.equal(
      readVariable(root, token),
      readVariable(archive, token),
      \`Default root --\${token} must match the Archive theme\`,
    );
  }
});

test("Archive overrides inherited dark tokens and defines the semantic surface contract", () => {
  const archive = readRule(".theme-archive");
  assert.match(archive, /color-scheme:\s*light/);
  assert.match(archive, /--background:\s*45\s+35%\s+93%/);
  assert.match(archive, /--foreground:\s*230\s+21%\s+11%/);
  assert.match(archive, /--primary:\s*255\s+32%\s+43%/);
  for (const token of requiredSemanticTokens) {
    assert.match(archive, new RegExp(`--${token}\\s*:`), `Archive is missing --${token}`);
  }
});

test("Observatory supports both the app dark preference and an explicit route theme", () => {
  const observatory = readRule(".theme-observatory");
  assert.match(observatory, /color-scheme:\s*dark/);
  assert.match(observatory, /--background:\s*230\s+25%\s+5%/);
  assert.match(observatory, /--primary:\s*41\s+74%\s+65%/);
  assert.match(observatory, /--focus:\s*41\s+74%\s+65%/);
  for (const token of requiredSemanticTokens) {
    assert.match(observatory, new RegExp(`--${token}\\s*:`), `Observatory is missing --${token}`);
  }
});

test("display typography follows the current MOONWITNESS design contract", () => {
  assert.match(tailwindConfig, /display:\s*\['Space Grotesk'/);
  assert.match(tailwindConfig, /ui:\s*\['Space Grotesk'/);
  assert.match(tailwindConfig, /mono:\s*\['IBM Plex Mono'/);
  assert.doesNotMatch(tailwindConfig, /Archivo Black|Anton/);
  assert.doesNotMatch(stylesheet.split("\\n")[0], /Archivo Black/);
});
