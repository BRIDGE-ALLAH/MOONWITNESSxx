#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const failures = [];
const warnings = [];

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) failures.push(`Node.js >=20 required; found ${process.versions.node}`);

let pnpmVersion = "";
try {
  pnpmVersion = execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" }).trim();
  const pnpmMajor = Number(pnpmVersion.split(".")[0]);
  const requiredPnpm = Number(pkg.engines?.pnpm?.replace(/[^0-9].*$/, ""));
  if (pnpmMajor < requiredPnpm) failures.push(`pnpm >=${requiredPnpm} required; found ${pnpmVersion}`);
} catch {
  failures.push("pnpm is not available on PATH; enable Corepack or install the declared package manager");
}

if (!existsSync(path.join(root, "pnpm-lock.yaml"))) failures.push("pnpm-lock.yaml is missing; run pnpm install");
if (!existsSync(path.join(root, "pnpm-workspace.yaml"))) failures.push("pnpm-workspace.yaml is missing");
if (!pkg.packageManager?.startsWith("pnpm@")) failures.push("packageManager must pin the pnpm version in root package.json");

for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  if (new RegExp(`pnpm\\s+run\\s+${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`).test(command)) {
    failures.push(`root script "${name}" recursively invokes itself`);
  }
}
if (!pkg.scripts?.["format:check"]?.includes("prettier --check")) failures.push("format:check must run Prettier in check mode");
if (!pkg.scripts?.["dev:doctor"]) warnings.push("dev:doctor script is not registered");

console.log("MOONWITNESS developer environment");
console.log(`  Node: ${process.versions.node} (required >=20)`);
console.log(`  pnpm: ${pnpmVersion || "unavailable"} (declared ${pkg.packageManager || "not pinned"})`);
console.log(`  Workspace lockfile: ${existsSync(path.join(root, "pnpm-lock.yaml")) ? "present" : "missing"}`);

for (const warning of warnings) console.warn(`WARN  ${warning}`);
for (const failure of failures) console.error(`FAIL  ${failure}`);
if (failures.length) process.exitCode = 1;
else console.log("PASS  Environment and root script contracts look healthy.");
