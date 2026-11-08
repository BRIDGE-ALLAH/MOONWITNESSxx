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
const INTERNAL_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export async function buildGraph(root = ROOT) {
  const workspaceRoot = path.resolve(root);
  const manifests = [];
  const names = new Map();

  for (const workspaceDir of WORKSPACE_DIRS) {
    const absolute = path.join(workspaceRoot, workspaceDir);
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    // pnpm-workspace.yaml declares apps/* and packages/*; nested fixtures are not packages.
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const packageDir = path.join(absolute, entry.name);
      const manifestPath = path.join(packageDir, "package.json");
      let raw;
      try {
        raw = await readFile(manifestPath, "utf8");
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }

      let manifest;
      try {
        manifest = JSON.parse(raw);
      } catch (error) {
        throw new Error(
          `Invalid package manifest at ${path.relative(workspaceRoot, manifestPath)}: ${error.message}`,
        );
      }
      if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw new Error(`Package manifest must be a JSON object: ${manifestPath}`);
      }
      if (
        typeof manifest.name !== "string" ||
        !manifest.name.trim() ||
        manifest.name !== manifest.name.trim()
      ) {
        throw new Error(`Package manifest requires a normalized non-empty name: ${manifestPath}`);
      }
      if (names.has(manifest.name)) {
        throw new Error(
          `Duplicate workspace package name "${manifest.name}" at ${names.get(manifest.name)} and ${path.relative(workspaceRoot, packageDir)}`,
        );
      }

      for (const field of INTERNAL_FIELDS) {
        const dependencies = manifest[field] ?? {};
        if (
          !dependencies ||
          typeof dependencies !== "object" ||
          Array.isArray(dependencies)
        ) {
          throw new Error(`Invalid ${field} in package manifest: ${manifestPath}`);
        }
        for (const [dependency, version] of Object.entries(dependencies)) {
          if (!dependency.trim() || typeof version !== "string" || !version.trim()) {
            throw new Error(`Invalid ${field} entry in package manifest: ${manifestPath}`);
          }
        }
      }

      const packagePath = path.relative(workspaceRoot, packageDir).split(path.sep).join("/");
      names.set(manifest.name, packagePath);
      manifests.push({ name: manifest.name, path: packagePath, manifest });
    }
  }

  const knownNames = new Set(names.keys());
  const nodes = manifests
    .map(({ name, path: packagePath }) => ({ name, path: packagePath }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edges = [];

  for (const item of manifests) {
    for (const field of INTERNAL_FIELDS) {
      for (const dependency of Object.keys(item.manifest[field] ?? {})) {
        if (knownNames.has(dependency)) {
          edges.push({ from: item.name, to: dependency, kind: field });
        }
      }
    }
  }

  edges.sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.kind.localeCompare(b.kind),
  );
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

  return {
    target,
    affected: [...affected].sort(),
    dependents: [...affected].filter((name) => name !== target).sort(),
    reasons,
  };
}

function escapeMermaidLabel(value) {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function toMermaid(graph) {
  const lines = ["flowchart TD"];
  for (const node of graph.nodes) {
    const id = `n${Buffer.from(node.name).toString("hex")}`;
    lines.push(`  ${id}["${escapeMermaidLabel(node.name)}"]`);
  }
  const ids = new Map(
    graph.nodes.map((node) => [node.name, `n${Buffer.from(node.name).toString("hex")}`]),
  );
  for (const edge of graph.edges) {
    lines.push(`  ${ids.get(edge.from)} --> ${ids.get(edge.to)}`);
  }
  return lines.join("\n");
}

function help() {
  console.log(`Counterfactual Repo Lab (read-only; Node.js built-ins only)
Usage:
  pnpm run repo:lab
  pnpm run repo:lab -- --json
  pnpm run repo:lab -- --impact @riotworks/ui
  pnpm run repo:lab -- --simulate-outage @riotworks/ui
  pnpm run repo:lab -- --cycles
  pnpm run repo:lab -- --changed-files packages/ui/src/button.ts
  pnpm run repo:lab -- --mermaid

Commands:
  default                    Show workspace topology summary
  --json                     Print machine-readable graph
  --impact PACKAGE           Calculate transitive reverse-dependency blast radius
  --simulate-outage PACKAGE  Rehearse package unavailability; no scripts are executed
  --cycles                   Find dependency cycles using strongly connected components
  --changed-files PATH...    Map changed paths to packages and downstream dependents
  --mermaid                  Print dependency graph as Mermaid flowchart

The simulator is structural, not a runtime guarantee. It does not execute code,
change files, install packages, contact external services, or weaken mandatory CI.`);
}

export async function run(args = process.argv.slice(2), root = ROOT) {
  if (args[0] === "--") args = args.slice(1);
  if (args.includes("--help") || args.includes("-h")) return help();
  const graph = await buildGraph(root);
  const flag = args[0];
  const target = args[1];

  if (flag === "--json") return console.log(JSON.stringify(graph, null, 2));
  if (flag === "--cycles") {
    const { findDependencyCycles } = await import("./repo-lab-intelligence.mjs");
    return console.log(JSON.stringify(findDependencyCycles(graph), null, 2));
  }
  if (flag === "--changed-files") {
    const { analyzeChangedPaths } = await import("./repo-lab-intelligence.mjs");
    const report = analyzeChangedPaths(graph, args.slice(1));
    return console.log(JSON.stringify(report, null, 2));
  }
  if (flag === "--mermaid") return console.log(toMermaid(graph));
  if (flag === "--impact" || flag === "--simulate-outage") {
    if (!target) throw new Error(`${flag} requires a workspace package name`);
    const report = blastRadius(graph, target);
    console.log(
      JSON.stringify(
        {
          mode: flag === "--impact" ? "change-impact" : "counterfactual-outage",
          readOnly: true,
          ...report,
          interpretation:
            flag === "--impact"
              ? "Packages listed as dependents may require validation when the target changes."
              : "If this package became unavailable, listed dependents are structurally downstream; this is not a runtime failure prediction.",
        },
        null,
        2,
      ),
    );
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
  run().catch((error) => {
    console.error(`Repo Lab: ${error.message}`);
    process.exitCode = 1;
  });
}
