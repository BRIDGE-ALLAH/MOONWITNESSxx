#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export function findRecursiveRootScripts(scripts = {}) {
  return Object.entries(scripts)
    .filter(([name, command]) => String(command).includes(`pnpm run ${name}`))
    .map(([name]) => name);
}

export function minimumPnpmMajor(engineRange = "") {
  const match = String(engineRange).match(/\d+/);
  return match ? Number(match[0]) : Number.NaN;
}

export function validateRootManifest(pkg, root) {
  const failures = [];
  if (!pkg.packageManager?.startsWith("pnpm@")) failures.push("packageManager must pin pnpm in root package.json");
  if (!existsSync(path.join(root, "pnpm-lock.yaml"))) failures.push("pnpm-lock.yaml is missing; run pnpm install");
  if (!existsSync(path.join(root, "pnpm-workspace.yaml"))) failures.push("pnpm-workspace.yaml is missing");
  for (const name of findRecursiveRootScripts(pkg.scripts)) failures.push(`root script "${name}" recursively invokes itself`);
  if (!pkg.scripts?.["format:check"]?.includes("prettier --check")) failures.push("format:check must run Prettier in check mode");
  return failures;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const failures = validateRootManifest(pkg, root);
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) failures.push(`Node.js >=20 required; found ${process.versions.node}`);

  let pnpmVersion = "";
  try {
    pnpmVersion = execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" }).trim();
    const pnpmMajor = Number(pnpmVersion.split(".")[0]);
    const requiredPnpm = minimumPnpmMajor(pkg.engines?.pnpm);
    if (!Number.isNaN(requiredPnpm) && pnpmMajor < requiredPnpm) {
      failures.push(`pnpm >=${requiredPnpm} required; found ${pnpmVersion}`);
    }
    const pinnedVersion = pkg.packageManager?.match(/^pnpm@(\d+\.\d+\.\d+)$/)?.[1];
    if (pinnedVersion && pnpmVersion !== pinnedVersion) {
      failures.push(`pnpm ${pinnedVersion} is pinned; found ${pnpmVersion}. Run corepack prepare pnpm@${pinnedVersion} --activate`);
    }
  } catch {
    failures.push("pnpm is not available on PATH; enable Corepack or install the declared package manager");
  }

  console.log("MOONWITNESS developer environment");
  console.log(`  Node: ${process.versions.node} (required >=20)`);
  console.log(`  pnpm: ${pnpmVersion || "unavailable"} (pinned ${pkg.packageManager || "not set"})`);
  console.log(`  Workspace lockfile: ${existsSync(path.join(root, "pnpm-lock.yaml")) ? "present" : "missing"}`);
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  if (failures.length) process.exitCode = 1;
  else console.log("PASS  Environment and root script contracts look healthy.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
