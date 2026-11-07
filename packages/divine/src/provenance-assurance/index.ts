export interface SourceLineageRecord {
  readonly sourceRef: string;
  readonly familyId?: string;
  readonly parentSourceRefs: readonly string[];
  readonly lineageComplete: boolean;
}
export type LineageIndependenceStatus = "independent" | "dependent" | "unknown";
export interface LineageIndependenceAssessment {
  readonly status: LineageIndependenceStatus;
  readonly selectedSourceRefs: readonly string[];
  readonly familyIds: readonly string[];
  readonly sharedAncestorRefs: readonly string[];
  readonly unresolvedSourceRefs: readonly string[];
  readonly cyclePaths: readonly (readonly string[])[];
  readonly reasonCodes: readonly string[];
  readonly traversalLimitExceeded: boolean;
  readonly interpretation: "declared-lineage-only";
}
export interface ProvenanceAssuranceCapsule {
  readonly schemaVersion: 1;
  readonly claimRef: string;
  readonly corpusRelease: string;
  readonly methodVersion: string;
  readonly scope: Readonly<Record<string, string>>;
  readonly selectedSourceRefs: readonly string[];
  readonly graphDigest: string;
  readonly assessment: LineageIndependenceAssessment;
  readonly fingerprint: string;
}
const MAX_LINEAGE_DEPTH = 512;
const MAX_LINEAGE_NODES = 10_000;
const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => JSON.stringify(key) + ":" + canonical(record[key])).join(",") + "}";
}
async function digest(value: unknown): Promise<string> {
  return hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value))));
}
function validateRecords(records: readonly SourceLineageRecord[]): Map<string, SourceLineageRecord> {
  if (!Array.isArray(records)) throw new Error("Source lineage records must be an array");
  const byRef = new Map<string, SourceLineageRecord>();
  for (const record of records) {
    if (!record || typeof record !== "object" || typeof record.sourceRef !== "string" || !record.sourceRef.trim() || record.sourceRef !== record.sourceRef.trim()) throw new Error("Source lineage records require a normalized sourceRef");
    if (typeof record.lineageComplete !== "boolean") throw new Error("lineageComplete must be an explicit boolean for: " + record.sourceRef);
    if (record.familyId !== undefined && typeof record.familyId !== "string") throw new Error("familyId must be a string when present: " + record.sourceRef);
    if (byRef.has(record.sourceRef)) throw new Error("Duplicate source lineage record: " + record.sourceRef);
    if (!Array.isArray(record.parentSourceRefs)) throw new Error("Invalid parent source references for: " + record.sourceRef);
    for (const parentRef of record.parentSourceRefs as readonly unknown[]) {
      if (typeof parentRef !== "string" || !parentRef.trim() || parentRef !== parentRef.trim()) throw new Error("Invalid parent source references for: " + record.sourceRef);
    }
    byRef.set(record.sourceRef, record);
  }
  return byRef;
}
/** Independence requires complete, acyclic, disjoint ancestry and distinct declared witness families. */
export function assessSourceLineageIndependence(input: { records: readonly SourceLineageRecord[]; selectedSourceRefs: readonly string[] }): LineageIndependenceAssessment {
  if (!input || !Array.isArray(input.selectedSourceRefs) || input.selectedSourceRefs.some((ref: unknown) => typeof ref !== "string" || !ref.trim() || ref !== ref.trim())) throw new Error("Selected source references must be a normalized string array");
  if (new Set(input.selectedSourceRefs).size !== input.selectedSourceRefs.length) throw new Error("Selected source references must be unique");
  const byRef = validateRecords(input.records);
  const selected = sortedUnique(input.selectedSourceRefs);
  if (selected.length < 2) throw new Error("At least two distinct source references are required");
  for (const ref of selected) if (!byRef.has(ref)) throw new Error("Selected source is missing: " + ref);
  const closures = new Map<string, Set<string>>();
  const unresolved = new Set<string>();
  const cycles: string[][] = [];
  let traversalLimitExceeded = false;
  for (const selectedRef of selected) {
    const closure = new Set<string>();
    const active: string[] = [];
    const visited = new Set<string>();
    const visit = (ref: string) => {
      if (active.length >= MAX_LINEAGE_DEPTH) { unresolved.add(ref); traversalLimitExceeded = true; return; }
      const cycleAt = active.indexOf(ref);
      if (cycleAt >= 0) { cycles.push([...active.slice(cycleAt), ref]); unresolved.add(ref); return; }
      if (visited.has(ref)) return;
      if (visited.size >= MAX_LINEAGE_NODES) { unresolved.add(ref); traversalLimitExceeded = true; return; }
      const record = byRef.get(ref);
      if (!record) { unresolved.add(ref); return; }
      visited.add(ref); active.push(ref); closure.add(ref);
      if (!record.lineageComplete) unresolved.add(ref);
      for (const parent of sortedUnique(record.parentSourceRefs)) visit(parent);
      active.pop();
    };
    visit(selectedRef); closures.set(selectedRef, closure);
  }
  const shared = new Set<string>();
  for (let i = 0; i < selected.length; i += 1) for (let j = i + 1; j < selected.length; j += 1) {
    const left = closures.get(selected[i])!; const right = closures.get(selected[j])!;
    for (const ref of left) if (right.has(ref)) shared.add(ref);
  }
  const familyIds: string[] = selected.map((ref) => {\n    const familyId: unknown = byRef.get(ref)?.familyId;\n    return typeof familyId === "string" ? familyId.trim() : "";\n  });
  const duplicateFamilies = familyIds.some((family, index) => family !== "" && familyIds.indexOf(family) !== index);
  const missingFamilies = selected.some((ref) => {\n    const familyId: unknown = byRef.get(ref)?.familyId;\n    return typeof familyId !== "string" || !familyId.trim();\n  });
  const reasonCodes: string[] = [];
  if (shared.size) reasonCodes.push("shared-lineage-ancestor");
  if (duplicateFamilies) reasonCodes.push("shared-witness-family");
  if (missingFamilies) reasonCodes.push("witness-family-unassigned");
  if (unresolved.size) reasonCodes.push("lineage-incomplete-or-missing");
  if (cycles.length) reasonCodes.push("lineage-cycle-detected");
  if (traversalLimitExceeded) reasonCodes.push("lineage-traversal-limit-exceeded");
  const status: LineageIndependenceStatus = cycles.length > 0 || traversalLimitExceeded ? "unknown" : shared.size > 0 || duplicateFamilies ? "dependent" : missingFamilies || unresolved.size > 0 ? "unknown" : "independent";
  return { status, selectedSourceRefs: selected, familyIds: sortedUnique(familyIds.filter(Boolean)), sharedAncestorRefs: sortedUnique([...shared]), unresolvedSourceRefs: sortedUnique([...unresolved]), cyclePaths: cycles.map((path) => [...path]), reasonCodes, traversalLimitExceeded, interpretation: "declared-lineage-only" };
}
/** Deterministic red-team mutations for common false-independence failure modes. */
export function runProvenanceAttackSuite(input: { records: readonly SourceLineageRecord[]; selectedSourceRefs: readonly string[] }): {
  baseline: LineageIndependenceAssessment;
  results: readonly { mutationId: string; detected: boolean; status: LineageIndependenceStatus; reasonCodes: readonly string[] }[];
  falseAcceptances: readonly string[];
} {
  const baseline = assessSourceLineageIndependence(input);
  if (baseline.status !== "independent") throw new Error("Attack suite requires an independently classified baseline");
  if (baseline.selectedSourceRefs.length !== 2) throw new Error("Attack suite currently requires exactly two selected sources");
  const [first, second] = baseline.selectedSourceRefs;
  const firstRecord = input.records.find((record) => record.sourceRef === first)!;
  const secondRecord = input.records.find((record) => record.sourceRef === second)!;
  const mutations: { id: string; records: SourceLineageRecord[] }[] = [
    { id: "shared-ancestor-with-distinct-families", records: [...input.records.filter((record) => record.sourceRef !== first && record.sourceRef !== second), { sourceRef: "__attack_shared_ancestor__", familyId: "__attack_ancestor_family__", parentSourceRefs: [], lineageComplete: true }, { ...firstRecord, parentSourceRefs: [...firstRecord.parentSourceRefs, "__attack_shared_ancestor__"] }, { ...secondRecord, parentSourceRefs: [...secondRecord.parentSourceRefs, "__attack_shared_ancestor__"] }] },
    { id: "witness-family-collision", records: input.records.map((record) => record.sourceRef === second ? { ...record, familyId: firstRecord.familyId } : record) },
    { id: "lineage-completeness-downgrade", records: input.records.map((record) => record.sourceRef === second ? { ...record, lineageComplete: false } : record) },
    { id: "missing-witness-family", records: input.records.map((record) => record.sourceRef === second ? { ...record, familyId: undefined } : record) },
    { id: "lineage-cycle-injection", records: input.records.map((record) => record.sourceRef === first ? { ...record, parentSourceRefs: [...record.parentSourceRefs, second] } : record.sourceRef === second ? { ...record, parentSourceRefs: [...record.parentSourceRefs, first] } : record) },
  ];
  const results = mutations.map((mutation) => {
    const assessment = assessSourceLineageIndependence({ records: mutation.records, selectedSourceRefs: baseline.selectedSourceRefs });
    return { mutationId: mutation.id, detected: assessment.status !== "independent", status: assessment.status, reasonCodes: assessment.reasonCodes };
  });
  return { baseline, results, falseAcceptances: results.filter((result) => !result.detected).map((result) => result.mutationId) };
}
export async function createProvenanceAssuranceCapsule(input: {
  claimRef: string; corpusRelease: string; methodVersion: string; scope: Readonly<Record<string, string>>;
  records: readonly SourceLineageRecord[]; selectedSourceRefs: readonly string[];
}): Promise<ProvenanceAssuranceCapsule> {
  if (!input.claimRef.trim() || !input.corpusRelease.trim() || !input.methodVersion.trim()) throw new Error("Claim, Corpus release and method version are required");
  if (!input.scope || typeof input.scope !== "object" || Array.isArray(input.scope)) throw new Error("A non-empty string scope object is required");
  const scopeEntries = Object.entries(input.scope);
  if (!scopeEntries.length || scopeEntries.some(([key, value]) => !key.trim() || typeof value !== "string" || !value.trim())) throw new Error("Scope keys and values must be non-empty strings");
  const scope = Object.fromEntries(scopeEntries.sort(([a], [b]) => a.localeCompare(b)));
  const records = [...input.records].map((record) => ({ ...record, parentSourceRefs: sortedUnique(record.parentSourceRefs) })).sort((a, b) => a.sourceRef.localeCompare(b.sourceRef));
  const assessment = assessSourceLineageIndependence({ records, selectedSourceRefs: input.selectedSourceRefs });
  const body = { schemaVersion: 1 as const, claimRef: input.claimRef, corpusRelease: input.corpusRelease, methodVersion: input.methodVersion, scope, selectedSourceRefs: assessment.selectedSourceRefs, graphDigest: await digest(records), assessment };
  return { ...body, fingerprint: await digest(body) };
}
export async function verifyProvenanceAssuranceCapsule(capsule: ProvenanceAssuranceCapsule, records: readonly SourceLineageRecord[]): Promise<{ valid: boolean; errors: readonly string[] }> {
  const errors: string[] = [];
  if (!capsule || capsule.schemaVersion !== 1) return { valid: false, errors: ["Unsupported provenance assurance capsule schema"] };
  try {
    const rebuilt = await createProvenanceAssuranceCapsule({ claimRef: capsule.claimRef, corpusRelease: capsule.corpusRelease, methodVersion: capsule.methodVersion, scope: capsule.scope, records, selectedSourceRefs: capsule.selectedSourceRefs });
    if (rebuilt.graphDigest !== capsule.graphDigest) errors.push("Source lineage graph digest mismatch");
    if (canonical(rebuilt.assessment) !== canonical(capsule.assessment)) errors.push("Lineage assessment mismatch");
    const { fingerprint: _fingerprint, ...body } = capsule;
    if (await digest(body) !== capsule.fingerprint) errors.push("Capsule fingerprint mismatch");
  } catch (error) { errors.push(error instanceof Error ? error.message : "Capsule verification failed"); }
  return { valid: errors.length === 0, errors };
}
