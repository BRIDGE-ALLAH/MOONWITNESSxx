import { createHash } from "node:crypto";
import type { AddonManifest, ModuleManifest } from "@riotworks/orm";

export type CapabilityRisk = "low" | "medium" | "high" | "critical";
export type TrustStatus = "verified" | "unverified" | "rejected" | "quarantined";
export interface CapabilityDefinition { readonly id: string; readonly risk: CapabilityRisk; readonly description: string }
export const CAPABILITY_CATALOG: readonly CapabilityDefinition[] = Object.freeze([
  { id: "models.register", risk: "medium", description: "Register ORM models and extensions." },
  { id: "database.business.read", risk: "high", description: "Read business records." },
  { id: "database.business.write", risk: "critical", description: "Write business records." },
  { id: "database.schema.plan", risk: "high", description: "Request schema planning." },
  { id: "database.schema.apply", risk: "critical", description: "Apply approved schema changes." },
  { id: "filesystem.staging.read", risk: "medium", description: "Read isolated staging files." },
  { id: "filesystem.staging.write", risk: "high", description: "Write isolated staging files." },
  { id: "network.outbound", risk: "high", description: "Make outbound network requests." },
  { id: "secrets.reference.read", risk: "critical", description: "Resolve granted secret references." },
  { id: "jobs.register", risk: "medium", description: "Register background jobs." },
  { id: "events.publish", risk: "low", description: "Publish namespaced events." },
  { id: "http.routes.register", risk: "medium", description: "Register namespaced HTTP routes." },
]);
const capabilityMap = new Map(CAPABILITY_CATALOG.map((item) => [item.id, item]));
const riskRank: Record<CapabilityRisk, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const idPattern = /^[a-z][a-z0-9_.-]*$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export interface CapabilityPolicy {
  readonly allowed: readonly string[];
  readonly denied?: readonly string[];
  readonly approvalRequired?: readonly string[];
  readonly maximumRisk?: CapabilityRisk;
}
export interface CapabilityDecision {
  readonly granted: readonly string[];
  readonly approvalRequired: readonly string[];
  readonly denied: readonly Readonly<{ capability: string; reason: string }>[];
}
export function evaluateCapabilities(requested: readonly string[], policy: CapabilityPolicy): CapabilityDecision {
  const allow = new Set(policy.allowed);
  const deny = new Set(policy.denied ?? []);
  const approval = new Set(policy.approvalRequired ?? []);
  const granted: string[] = [];
  const approvalRequired: string[] = [];
  const denied: Array<{ capability: string; reason: string }> = [];
  for (const id of [...new Set(requested)].sort()) {
    const definition = capabilityMap.get(id);
    if (!definition) denied.push({ capability: id, reason: "Unknown capabilities are denied by default." });
    else if (deny.has(id)) denied.push({ capability: id, reason: "Explicitly denied by policy." });
    else if (!allow.has(id)) denied.push({ capability: id, reason: "Not present in capability allow-list." });
    else if (policy.maximumRisk && riskRank[definition.risk] > riskRank[policy.maximumRisk]) denied.push({ capability: id, reason: "Exceeds configured risk ceiling." });
    else if (approval.has(id)) approvalRequired.push(id);
    else granted.push(id);
  }
  return Object.freeze({
    granted: Object.freeze(granted),
    approvalRequired: Object.freeze(approvalRequired),
    denied: Object.freeze(denied.map((item) => Object.freeze(item))),
  });
}

export interface AddonTrustEvidence {
  readonly status: TrustStatus;
  readonly publisher: string;
  readonly digest: string;
  readonly signatureVerified: boolean;
  readonly reason?: string;
}
export interface AddonCandidate {
  readonly manifest: AddonManifest;
  readonly modules: readonly ModuleManifest[];
  readonly trust: AddonTrustEvidence;
}
export interface InstalledAddon {
  readonly id: string;
  readonly version: string;
  readonly enabled: boolean;
}
export interface AddonInstallOperation {
  readonly addon: string;
  readonly fromVersion: string | null;
  readonly toVersion: string;
  readonly action: "install" | "upgrade" | "enable";
  readonly moduleOrder: readonly string[];
  readonly capabilities: CapabilityDecision;
  readonly trustDigest: string;
}
export interface AddonInstallPlan {
  readonly id: string;
  readonly operations: readonly AddonInstallOperation[];
  readonly requiredApprovals: readonly string[];
  readonly blocked: readonly Readonly<{ addon: string; reason: string }>[];
  readonly createdAt: string;
}
export interface AddonPlannerOptions {
  readonly capabilityPolicy: CapabilityPolicy;
  readonly runtimeVersions: Readonly<{ arsy: string; orm: string }>;
  readonly now?: () => Date;
}

function satisfies(actual: string, range: string): boolean {
  if (range === "*" || range === actual) return true;
  const match = range.match(/^([~^])(\d+)\.(\d+)\.(\d+)$/);
  const version = actual.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match || !version) return false;
  const [, op, major, minor, patch] = match;
  const [a, b, c] = version.slice(1).map(Number);
  const [x, y, z] = [Number(major), Number(minor), Number(patch)];
  return op === "^" ? a === x && (b > y || (b === y && c >= z)) : a === x && b === y && c >= z;
}
function orderModules(modules: readonly ModuleManifest[]): ModuleManifest[] {
  const byId = new Map(modules.map((module) => [module.id, module]));
  if (byId.size !== modules.length) throw new Error("Duplicate module identity.");
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: ModuleManifest[] = [];
  const visit = (module: ModuleManifest, trail: readonly string[]) => {
    if (visited.has(module.id)) return;
    if (visiting.has(module.id)) throw new Error("Module dependency cycle: " + [...trail, module.id].join(" -> "));
    visiting.add(module.id);
    for (const dep of [...(module.depends ?? [])].sort((a, b) => a.module.localeCompare(b.module))) {
      const target = byId.get(dep.module);
      if (!target) { if (!dep.optional) throw new Error("Missing module dependency " + dep.module + "."); }
      else if (!satisfies(target.version, dep.version)) throw new Error("Module dependency version mismatch: " + dep.module + ".");
      else visit(target, [...trail, module.id]);
    }
    visiting.delete(module.id);
    visited.add(module.id);
    ordered.push(module);
  };
  for (const module of [...modules].sort((a, b) => a.id.localeCompare(b.id))) visit(module, []);
  return ordered;
}
function orderAddons(candidates: readonly AddonCandidate[]): AddonCandidate[] {
  const byId = new Map(candidates.map((candidate) => [candidate.manifest.id, candidate]));
  if (byId.size !== candidates.length) throw new Error("Duplicate addon identity prevents deterministic planning.");
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: AddonCandidate[] = [];
  const visit = (candidate: AddonCandidate, trail: readonly string[]) => {
    const id = candidate.manifest.id;
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error("Addon dependency cycle: " + [...trail, id].join(" -> "));
    visiting.add(id);
    for (const dep of [...(candidate.manifest.dependencies ?? [])].sort((a, b) => a.addon.localeCompare(b.addon))) {
      const target = byId.get(dep.addon);
      if (target) visit(target, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(candidate);
  };
  for (const candidate of [...candidates].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id))) visit(candidate, []);
  return ordered;
}

function manifestIssues(candidate: AddonCandidate, runtimeVersions: Readonly<{ arsy: string; orm: string }>): string[] {
  const { manifest, modules, trust } = candidate;
  const issues: string[] = [];
  if (!idPattern.test(manifest.id)) issues.push("Invalid addon identifier.");
  if (!versionPattern.test(manifest.version)) issues.push("Invalid addon semantic version.");
  if (!manifest.publisher.trim() || trust.publisher !== manifest.publisher) issues.push("Publisher does not match verified evidence.");
  if (trust.status !== "verified" || !trust.signatureVerified || !trust.digest.trim()) issues.push("Package is not cryptographically verified.");
  if (!manifest.integrity || manifest.integrity !== trust.digest) issues.push("Manifest digest does not match verified artifact digest.");
  if (!manifest.entrypoint || manifest.entrypoint.startsWith("/") || manifest.entrypoint.includes("..") || manifest.entrypoint.includes("\\")) issues.push("Unsafe package entrypoint.");
  if (!manifest.compatibility?.arsy || !manifest.compatibility?.orm) issues.push("Compatibility declaration is incomplete.");
  else {
    if (!satisfies(runtimeVersions.arsy, manifest.compatibility.arsy)) issues.push("ARSY runtime version is incompatible.");
    if (!satisfies(runtimeVersions.orm, manifest.compatibility.orm)) issues.push("ORM runtime version is incompatible.");
  }
  const ids = new Set(modules.map((module) => module.id));
  if (ids.size !== modules.length || ids.size !== manifest.modules.length || manifest.modules.some((id) => !ids.has(id))) issues.push("Manifest module list does not exactly match module declarations.");
  for (const module of modules) {
    if (module.addon !== manifest.id) issues.push("Module ownership mismatch for " + module.id + ".");
    if (!idPattern.test(module.id) || !versionPattern.test(module.version)) issues.push("Invalid module identity/version for " + module.id + ".");
  }
  return issues;
}

export class AddonInstallPlanner {
  readonly #options: AddonPlannerOptions;
  constructor(options: AddonPlannerOptions) { this.#options = options; }

  plan(candidates: readonly AddonCandidate[], installed: readonly InstalledAddon[] = []): AddonInstallPlan {
    const blocked: Array<{ addon: string; reason: string }> = [];
    const operations: AddonInstallOperation[] = [];
    const installedById = new Map(installed.map((item) => [item.id, item]));
    const candidateById = new Map<string, AddonCandidate>();
    const duplicateIds = new Set<string>();
    const blockedIds = new Set<string>();
    const block = (addon: string, reason: string) => { blocked.push({ addon, reason }); blockedIds.add(addon); };
    for (const candidate of candidates) {
      const id = candidate.manifest.id;
      if (candidateById.has(id)) duplicateIds.add(id);
      else candidateById.set(id, candidate);
    }
    for (const id of duplicateIds) block(id, "Duplicate addon candidate.");
    let orderedCandidates: AddonCandidate[];
    try { orderedCandidates = orderAddons([...candidateById.values()].filter((candidate) => !duplicateIds.has(candidate.manifest.id))); }
    catch (error) {
      for (const candidate of candidates) block(candidate.manifest.id, error instanceof Error ? error.message : String(error));
      orderedCandidates = [];
    }
    for (const candidate of orderedCandidates) {
      const manifest = candidate.manifest;
      const issues = manifestIssues(candidate, this.#options.runtimeVersions);
      if (issues.length) { block(manifest.id, issues.join(" ")); continue; }
      const conflicts = (manifest.conflicts ?? []).filter((id) => candidateById.has(id) || installedById.has(id));
      if (conflicts.length) { block(manifest.id, "Conflicts with " + conflicts.join(", ") + "."); continue; }
      let dependencyFailure = false;
      for (const dep of manifest.dependencies ?? []) {
        if (blockedIds.has(dep.addon)) { block(manifest.id, "Dependency " + dep.addon + " is blocked."); dependencyFailure = true; continue; }
        const target = candidateById.get(dep.addon)?.manifest;
        const installedTarget = installedById.get(dep.addon);
        const version = target?.version ?? installedTarget?.version;
        if (!version && !dep.optional) { block(manifest.id, "Missing addon dependency " + dep.addon + "."); dependencyFailure = true; }
        else if (version && !satisfies(version, dep.version)) { block(manifest.id, "Addon dependency version mismatch: " + dep.addon + "."); dependencyFailure = true; }
      }
      if (dependencyFailure) continue;
      let moduleOrder: ModuleManifest[];
      try { moduleOrder = orderModules(candidate.modules); }
      catch (error) { block(manifest.id, error instanceof Error ? error.message : String(error)); continue; }
      const capabilities = evaluateCapabilities(manifest.capabilities ?? [], this.#options.capabilityPolicy);
      if (capabilities.denied.length) { block(manifest.id, capabilities.denied.map((item) => item.capability + ": " + item.reason).join(" ")); continue; }
      const existing = installedById.get(manifest.id);
      if (existing?.version === manifest.version && existing.enabled) continue;
      operations.push(Object.freeze({
        addon: manifest.id, fromVersion: existing?.version ?? null, toVersion: manifest.version,
        action: existing ? (existing.version === manifest.version ? "enable" : "upgrade") : "install",
        moduleOrder: Object.freeze(moduleOrder.map((module) => module.id)), capabilities,
        trustDigest: candidate.trust.digest,
      }));
    }
    const requiredApprovals = [...new Set(operations.flatMap((operation) => operation.capabilities.approvalRequired))].sort();
    blocked.sort((a, b) => a.addon.localeCompare(b.addon));
    const payload = JSON.stringify({
      operations: operations.map(({ addon, fromVersion, toVersion, action, moduleOrder, capabilities, trustDigest }) =>
        ({ addon, fromVersion, toVersion, action, moduleOrder, capabilities, trustDigest })),
      requiredApprovals, blocked,
    });
    return Object.freeze({
      id: createHash("sha256").update(payload).digest("hex"),
      operations: Object.freeze(operations),
      requiredApprovals: Object.freeze(requiredApprovals),
      blocked: Object.freeze(blocked.map((item) => Object.freeze(item))),
      createdAt: (this.#options.now ?? (() => new Date()))().toISOString(),
    });
  }
}
