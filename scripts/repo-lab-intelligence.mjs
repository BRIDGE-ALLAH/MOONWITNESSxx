/** Deterministic change-path analysis and dependency-cycle diagnostics. */
import { blastRadius } from "./counterfactual-repo-lab.mjs";

function normalizeRepoPath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Changed paths must be non-empty strings");
  const path = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`Unsafe repository path: ${value}`);
  }
  return path.replace(/\/{2,}/g, "/");
}

export function analyzeChangedPaths(graph, changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    throw new Error("Provide at least one changed repository path");
  }
  const packages = [...graph.nodes].sort((a, b) => b.path.length - a.path.length || a.name.localeCompare(b.name));
  const normalized = [...new Set(changedPaths.map(normalizeRepoPath))].sort();
  const owners = new Map();
  const unowned = [];
  for (const file of normalized) {
    const owner = packages.find((pkg) => file === pkg.path || file.startsWith(`${pkg.path}/`));
    if (owner) {
      if (!owners.has(owner.name)) owners.set(owner.name, []);
      owners.get(owner.name).push(file);
    } else {
      unowned.push(file);
    }
  }
  const changedPackages = [...owners.keys()].sort();
  const impactByPackage = changedPackages.map((name) => ({
    ...blastRadius(graph, name),
    changedFiles: owners.get(name).sort()
  }));
  const impacted = new Set(impactByPackage.flatMap((item) => item.dependents));
  const reasons = impactByPackage.flatMap((item) => item.reasons);
  const affectedNodes = graph.nodes.filter((node) => impacted.has(node.name) || changedPackages.includes(node.name));
  const layers = new Set(affectedNodes.map((node) => node.path.split("/")[0]));
  const edgeKinds = new Set(reasons.map((reason) => reason.kind));
  const components = changedPackages.length;
  const dependents = impacted.size;
  const score = Math.min(100,
    (components ? 10 : 0) +
    Math.min(45, dependents * 5) +
    Math.min(20, Math.max(0, components - 1) * 5) +
    Math.min(15, Math.max(0, edgeKinds.size - 1) * 5) +
    (layers.has("apps") && layers.has("packages") ? 10 : 0)
  );
  const level = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";
  return {
    schemaVersion: 1,
    generatedBy: "counterfactual-repo-lab",
    mode: "changed-path-impact",
    readOnly: true,
    changedFiles: normalized,
    changedPackages,
    packageOwnership: changedPackages.map((name) => ({ package: name, files: owners.get(name).sort() })),
    unownedPaths: unowned,
    impactByPackage,
    impactedDependents: [...impacted].sort(),
    structuralExposure: {
      score,
      level,
      scale: "0-100 heuristic index; not a probability of failure",
      factors: {
        changedPackages: components,
        impactedDependents: dependents,
        dependencyEdgeKinds: [...edgeKinds].sort(),
        spansAppsAndPackages: layers.has("apps") && layers.has("packages")
      }
    },
    mandatoryCiPolicy: "Advisory only: this report must never skip or weaken required CI checks."
  };
}

export function findDependencyCycles(graph) {
  const nodes = graph.nodes.map((node) => node.name).sort();
  const adjacency = new Map(nodes.map((name) => [name, []]));
  for (const edge of graph.edges) {
    if (adjacency.has(edge.from) && adjacency.has(edge.to)) adjacency.get(edge.from).push(edge.to);
  }
  for (const list of adjacency.values()) list.sort();
  let nextIndex = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  function visit(node) {
    index.set(node, nextIndex);
    low.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const neighbor of adjacency.get(node)) {
      if (!index.has(neighbor)) {
        visit(neighbor);
        low.set(node, Math.min(low.get(node), low.get(neighbor)));
      } else if (onStack.has(neighbor)) {
        low.set(node, Math.min(low.get(node), index.get(neighbor)));
      }
    }
    if (low.get(node) === index.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      component.sort();
      const selfLoop = component.length === 1 && adjacency.get(component[0]).includes(component[0]);
      if (component.length > 1 || selfLoop) components.push(component);
    }
  }
  for (const node of nodes) if (!index.has(node)) visit(node);
  components.sort((a, b) => a[0].localeCompare(b[0]));
  return {
    schemaVersion: 1,
    generatedBy: "counterfactual-repo-lab",
    mode: "dependency-cycle-radar",
    readOnly: true,
    cycleCount: components.length,
    cycles: components.map((packages) => ({
      packages,
      edges: graph.edges
        .filter((edge) => packages.includes(edge.from) && packages.includes(edge.to))
        .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind))
    }))
  };
}
