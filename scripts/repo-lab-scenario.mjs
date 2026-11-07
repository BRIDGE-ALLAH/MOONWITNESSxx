#!/usr/bin/env node
/** Deterministic scenario replay for Counterfactual Repo Lab. Read-only, no dependencies. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildGraph, blastRadius } from "./counterfactual-repo-lab.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODES = new Set(["change-impact", "counterfactual-outage"]);

export function validateScenarioDocument(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("Scenario document must be a JSON object");
  }
  if (document.schemaVersion !== 1) throw new Error("Scenario schemaVersion must be 1");
  if (!Array.isArray(document.scenarios) || document.scenarios.length === 0) {
    throw new Error("Scenario document must contain a non-empty scenarios array");
  }
  const ids = new Set();
  for (const [index, scenario] of document.scenarios.entries()) {
    const prefix = `scenarios[${index}]`;
    if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
      throw new Error(`${prefix} must be an object`);
    }
    if (typeof scenario.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(scenario.id)) {
      throw new Error(`${prefix}.id must be a stable lowercase identifier (1-64 chars)`);
    }
    if (ids.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
    if (!MODES.has(scenario.mode)) throw new Error(`${prefix}.mode must be change-impact or counterfactual-outage`);
    if (typeof scenario.target !== "string" || !scenario.target.trim()) {
      throw new Error(`${prefix}.target must be a non-empty package name`);
    }
    for (const key of Object.keys(scenario)) {
      if (!["id", "mode", "target", "description"].includes(key)) {
        throw new Error(`${prefix} contains unsupported field: ${key}`);
      }
    }
    if (scenario.description !== undefined && typeof scenario.description !== "string") {
      throw new Error(`${prefix}.description must be a string`);
    }
  }
  return document;
}

export function replayScenarios(graph, document) {
  validateScenarioDocument(document);
  const results = document.scenarios.map((scenario) => {
    const impact = blastRadius(graph, scenario.target);
    return {
      id: scenario.id,
      mode: scenario.mode,
      target: scenario.target,
      ...(scenario.description ? { description: scenario.description } : {}),
      affected: impact.affected,
      dependents: impact.dependents,
      reasons: impact.reasons,
      interpretation: scenario.mode === "change-impact"
        ? "Dependents are candidates for additional validation; mandatory checks must still run."
        : "Dependents are structurally downstream; this report does not predict runtime failure."
    };
  });
  return {
    schemaVersion: 1,
    generatedBy: "counterfactual-repo-lab",
    readOnly: true,
    scenarioCount: results.length,
    results
  };
}

export async function runScenarioFile(file, root = ROOT) {
  const absolute = path.resolve(process.cwd(), file);
  const document = JSON.parse(await readFile(absolute, "utf8"));
  const graph = await buildGraph(root);
  const report = replayScenarios(graph, document);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    console.log("Usage: node scripts/repo-lab-scenario.mjs <scenario.json>");
    process.exitCode = args.length === 1 ? 0 : 2;
  } else {
    runScenarioFile(args[0]).catch((error) => {
      console.error(`Repo Lab scenario: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
