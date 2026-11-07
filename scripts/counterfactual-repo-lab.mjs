#!/usr/bin/env node
/**
 * Counterfactual Repo Lab — deterministic, read-only workspace graph and failure rehearsal.
 * Uses only Node.js built-ins. Never executes package scripts or modifies repository files.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_DIRS = ["apps", "packages"];
const INTERNAL_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

async function discoverManifests(dir, found = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const candidate = path.join(dir, entry.name);
    try {
      const raw = await readFile(path.join(candidate, "package.json"), "utf8");
      const manifest = JSON.parse(raw);
      if (manifest.name) found.push({ name: manifest.name, path: path.relative(ROOT, candidate).split(path.sep).join("/"), manifest });
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await discoverManifests(candidate, found);
  }
  return found;
}

export async function buildGraph(root = ROOT) {
  const previousRoot = process.cwd();
  const manifests = [];
  for (const dir of WORKSPACE_DIRS) {
    const absolute = path.join(root, dir);
    let entries = [];
    try { entries = await readdir(absolute, { withFileTypes: true }); } catch { /* optional workspace dir */ }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const packageDir = path.join(absolute, entry.name);
      const queue = [packageDir];
      while (queue.length) {
        const current = queue.pop();
        let children = [];
        try { children = await readdir(current, { withFileTypes: true }); } catch { continue; }
        for (const child of children) {
          if (!child.isDirectory() || child.name === "node_modules" || child.name.startsWith(".")) continue;
          queue.push(path.join(current, child.name));
        }
        try {
          const manifest = JSON.parse(await readFile(path.join(current, "package.json"), "utf8"));
          if (manifest.name) manifests.push({ name: manifest.name, path: path.relative(root, current).split(path.sep).join("/"), manifest });
        } catch (error) {
          if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        }
      }
    }
  }
  const names = new Set(manifests.map((item) => item.name));
  const nodes = manifests.map(({ name, path: packagePath }) => ({ name, path: packagePath })).sort((a,b) => a.name.localeCompare(b.name));
  const edges = [];
  for (const item of manifests) {
    for (const field of INTERNAL_FIELDS) {
      for (const dependency of Object.keys(item.manifest[field] ?? {})) {
        if (names.has(dependency)) edges.push({ from: item.name, to: dependency, kind: field });
      }
    }
  }
  edges.sort((a,b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  return { schemaVersion: 1, generatedBy: "counterfactual-repo-lab", nodes, edges };
}

export function blastRadius(graph, target) {
  const known = new Set(graph.nodes.map((node) => node.name));
  if (!known.has(target)) throw new Error(`Unknown workspace package: ${target}`);
  const affected = new Set([target]);
  const reasons = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (affected.has(edge.to) && !affected.has(edge.from)) {
        affected.add(edge.from);
        reasons.push({ package: edge.from, dependsOn: edge.to, kind: edge.kind });
        changed = true;
      }
    }
  }
  return { target, affected: [...affected].sort(), dependents: [...affected].filter((name) => name !== target).sort(), reasons };
}

export function toMermaid(graph) {
  const lines = ["flowchart TD"];
  for (const node of graph.nodes) {
    const id = `n${Buffer.from(node.name).toString("hex")}`;
    lines.push(`  ${id}["${node.name.replace(/["<>]/g, "")}"]`);
  }
  const ids = new Map(graph.nodes.map((node) => [node.name, `n${Buffer.from(node.name).toString("hex")}`]));
  for (const edge of graph.edges) lines.push(`  ${ids.get(edge.from)} --> ${ids.get(edge.to)}`);
  return lines.join("\n");
}

function help() {
  console.log(`Counterfactual Repo Lab (read-only; Node.js built-ins only)
Usage:
  pnpm run repo:lab
  pnpm run repo:lab -- --json
  pnpm run repo:lab -- --impact @riotworks/ui
  pnpm run repo:lab -- --simulate-outage @riotworks/ui
  pnpm run repo:lab -- --mermaid

Commands:
  default                 Show workspace topology summary
  --json                  Print machine-readable graph
  --impact PACKAGE        Calculate transitive reverse-dependency blast radius
  --simulate-outage PKG   Rehearse package unavailability; no scripts are executed
  --mermaid               Print dependency graph as Mermaid flowchart

The simulator is structural, not a runtime guarantee. It does not execute code,
change files, install packages, or contact external services.`);
}

export async function run(args = process.argv.slice(2), root = ROOT) {
  if (args.includes("--help") || args.includes("-h")) return help();
  const graph = await buildGraph(root);
  const flag = args[0];
  const target = args[1];
  if (flag === "--json") return console.log(JSON.stringify(graph, null, 2));
  if (flag === "--mermaid") return console.log(toMermaid(graph));
  if (flag === "--impact" || flag === "--simulate-outage") {
    if (!target) throw new Error(`${flag} requires a workspace package name`);
    const report = blastRadius(graph, target);
    console.log(JSON.stringify({
      mode: flag === "--impact" ? "change-impact" : "counterfactual-outage",
      readOnly: true,
      ...report,
      interpretation: flag === "--impact"
        ? "Packages listed as dependents may require validation when the target changes."
        : "If this package became unavailable, listed dependents are structurally downstream; this is not a runtime failure prediction."
    }, null, 2));
    return;
  }
  if (flag) throw new Error(`Unknown option: ${flag}. Use --help.`);
  const counts = { packages: graph.nodes.length, dependencyEdges: graph.edges.length };
  console.log("MOONWITNESS Counterfactual Repo Lab");
  console.log(`Packages: ${counts.packages} | Internal dependency edges: ${counts.dependencyEdges}`);
  console.log("Read-only structural model; no code was executed.");
  console.log("\nPackages:");
  for (const node of graph.nodes) console.log(`  ${node.name.padEnd(32)} ${node.path}`);
  console.log("\nTry: pnpm run repo:lab -- --impact @riotworks/ui");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch((error) => { console.error(`Repo Lab: ${error.message}`); process.exitCode = 1; });
}
