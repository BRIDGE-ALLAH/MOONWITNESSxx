import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assetRegistry } from "../src/registry.ts";

const MAX_SVG_BYTES = 100 * 1024;
const errors = [];
const ids = new Set();

for (const [key, asset] of Object.entries(assetRegistry)) {
  if (ids.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
  ids.add(asset.id);

  if (key !== asset.id) errors.push(`Registry key "${key}" does not match asset id "${asset.id}"`);
  if (!asset.source.trim()) errors.push(`${asset.id}: missing source provenance`);
  if (!asset.license.trim()) errors.push(`${asset.id}: missing license / usage status`);
  if (!asset.description.trim()) errors.push(`${asset.id}: missing description`);
  if (!asset.decorative && !asset.alt?.trim()) errors.push(`${asset.id}: meaningful asset requires alt text`);
  if (asset.width <= 0 || asset.height <= 0) errors.push(`${asset.id}: dimensions must be positive`);

  let filePath;
  try {
    const url = new URL(asset.src);
    if (url.protocol !== "file:") throw new Error(`expected local file URL, received ${url.protocol}`);
    filePath = fileURLToPath(url);
    const fileStats = await stat(filePath);
    if (fileStats.size > MAX_SVG_BYTES) errors.push(`${asset.id}: exceeds ${MAX_SVG_BYTES} byte SVG budget`);
    const svg = await readFile(filePath, "utf8");

    if (!/<svg\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["'][^>]*>/i.test(svg)) {
      errors.push(`${asset.id}: missing valid SVG root / namespace`);
    }
    if (!/<\/svg>\s*$/i.test(svg)) errors.push(`${asset.id}: SVG closing tag missing`);
    if (/<script\b|<foreignObject\b|\bon[a-z]+\s*=|javascript:/i.test(svg)) {
      errors.push(`${asset.id}: unsafe SVG markup detected`);
    }
    if (/(?:href|xlink:href)\s*=\s*["']https?:/i.test(svg)) {
      errors.push(`${asset.id}: external SVG references are not allowed`);
    }
  } catch (error) {
    errors.push(`${asset.id}: unable to read asset (${error.message})`);
  }
}

if (errors.length) {
  console.error("Asset validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${ids.size} registered assets successfully.`);
}
