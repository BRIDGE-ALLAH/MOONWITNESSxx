import { DivineError } from "../errors.ts";
import type {
  OntologyCandidateGenerator, OntologyDiagnostic, OntologyDiff, OntologyMapping,
  OntologyMappingCandidate, OntologyMigrationPlan, OntologyScope, OntologyVersion,
} from "./types.ts";

const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const CANONICAL = /^mw:[a-z][a-z0-9-]*:[^\s]+$/;
const SCOPE_KEYS = ["tradition", "community", "school", "period", "method", "project"] as const;
const unique = (values: readonly string[]) => new Set(values).size === values.length;

function validateScope(scope: OntologyScope): boolean {
  return Object.entries(scope).every(([key, value]) =>
    (SCOPE_KEYS as readonly string[]).includes(key) && typeof value === "string" && CANONICAL.test(value),
  );
}

export function validateOntology(ontology: OntologyVersion): readonly OntologyDiagnostic[] {
  const diagnostics: OntologyDiagnostic[] = [];
  const add = (
    code: OntologyDiagnostic["code"],
    path: string,
    message: string,
    severity: OntologyDiagnostic["severity"] = "error",
  ) => diagnostics.push({ code, path, message, severity });

  if (!ID.test(ontology.id) || !ontology.namespace.includes(":")) {
    add("INVALID_NAMESPACE", "namespace", "Ontology id and namespace must be stable identifiers.");
  }
  if (!ID.test(ontology.profile.id) || !validateScope(ontology.profile.scope) ||
      !SCOPE_KEYS.some((key) => ontology.profile.scope[key])) {
    add("INVALID_NAMESPACE", "profile", "Ontology profile requires a stable id and explicit canonical scope.");
  }
  if (!VERSION.test(ontology.version)) {
    add("INVALID_VERSION", "version", "Ontology version must use semantic MAJOR.MINOR.PATCH.");
  }

  const schemes = new Map(ontology.schemes.map((item) => [item.id, item] as const));
  const concepts = new Map(ontology.concepts.map((item) => [item.id, item] as const));
  const relations = new Map(ontology.relations.map((item) => [item.id, item] as const));

  const collections = [
    ["schemes", ontology.schemes.map((item) => item.id)],
    ["concepts", ontology.concepts.map((item) => item.id)],
    ["relations", ontology.relations.map((item) => item.id)],
    ["mappings", ontology.mappings.map((item) => item.id)],
  ] as const;
  for (const [name, ids] of collections) {
    if (!unique(ids)) add("DUPLICATE_ID", name, "Duplicate identifiers in collection.");
  }

  for (const [index, scheme] of ontology.schemes.entries()) {
    if (!ID.test(scheme.id) || !scheme.namespace.startsWith(ontology.namespace)) {
      add("INVALID_NAMESPACE", "schemes[" + index + "]", "Scheme namespace must be inside the ontology namespace.");
    }
  }
  for (const [index, concept] of ontology.concepts.entries()) {
    if (!ID.test(concept.id)) add("INVALID_NAMESPACE", "concepts[" + index + "].id", "Concept id must be stable.");
    if (!schemes.has(concept.schemeId)) add("UNKNOWN_SCHEME", "concepts[" + index + "]", "Unknown concept scheme.");
    if (!CANONICAL.test(concept.corpusId)) {
      add("UNKNOWN_CONCEPT", "concepts[" + index + "].corpusId", "Concept must reference a canonical Corpus lexicon id.");
    }
    if (concept.externalUri && !/^https?:\/\//.test(concept.externalUri)) {
      add("INVALID_NAMESPACE", "concepts[" + index + "].externalUri", "External URI must be absolute HTTP(S).");
    }
  }
  for (const [index, relation] of ontology.relations.entries()) {
    if (!ID.test(relation.id) || !relation.domain.length || !relation.range.length || !relation.note.trim()) {
      add("INVALID_RELATION", "relations[" + index + "]", "Relation requires a stable id, domain, range and semantic note.");
    }
    for (const id of [...relation.domain, ...relation.range]) {
      if (!concepts.has(id)) add("UNKNOWN_CONCEPT", "relations[" + index + "]", "Unknown concept reference: " + id);
    }
    if (relation.inverseOf && !relations.has(relation.inverseOf)) {
      add("INVALID_RELATION", "relations[" + index + "].inverseOf", "Inverse relation must exist in this version.");
    }
  }

  const mappingKeys = new Set<string>();
  for (const [index, mapping] of ontology.mappings.entries()) {
    const key = [mapping.sourceConceptId, mapping.targetConceptId, mapping.relation].join("|");
    if (mappingKeys.has(key)) add("DUPLICATE_MAPPING", "mappings[" + index + "]", "Duplicate mapping tuple.");
    mappingKeys.add(key);
    if (!concepts.has(mapping.sourceConceptId) || !concepts.has(mapping.targetConceptId)) {
      add("UNKNOWN_CONCEPT", "mappings[" + index + "]", "Mapping endpoints must resolve to declared concepts.");
    }
    if (!validateScope(mapping.scope) || !SCOPE_KEYS.some((key) => mapping.scope[key])) add("INVALID_NAMESPACE", "mappings[" + index + "].scope", "Mapping scope must be explicit and use canonical Corpus references.");
    if (["accepted", "rejected", "deprecated"].includes(mapping.status)) {
      if (!mapping.method.trim() || !mapping.evidenceRefs.length || !mapping.reviewer || !CANONICAL.test(mapping.reviewer)) {
        add("UNREVIEWED_MAPPING", "mappings[" + index + "]", "Promoted mappings require method, evidence and a canonical reviewer.");
      }
    }
    if (mapping.evidenceRefs.some((id) => !CANONICAL.test(id))) {
      add("UNKNOWN_CONCEPT", "mappings[" + index + "].evidenceRefs", "Evidence references must be canonical Corpus ids.");
    }
    if (mapping.relation === "exact" && mapping.status === "accepted" && !mapping.rationale.trim()) {
      add("UNREVIEWED_MAPPING", "mappings[" + index + "]", "Accepted exact mappings require rationale.");
    }
  }

  for (const id of ontology.deprecatedConceptIds ?? []) {
    if (!concepts.has(id)) add("UNKNOWN_CONCEPT", "deprecatedConceptIds", "Unknown deprecated concept: " + id, "warning");
  }
  return Object.freeze(diagnostics.map((item) => Object.freeze(item)));
}

export function assertValidOntology(ontology: OntologyVersion): void {
  const errors = validateOntology(ontology).filter((item) => item.severity === "error");
  if (errors.length) {
    throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Ontology failed validation.", {
      ontologyId: ontology.id, version: ontology.version, diagnostics: errors,
    });
  }
}

export class OntologyRegistry {
  private readonly versions = new Map<string, OntologyVersion>();

  register(ontology: OntologyVersion): void {
    assertValidOntology(ontology);
    const key = ontology.id + "@" + ontology.version;
    if (this.versions.has(key)) {
      throw new DivineError("DIVINE_ONTOLOGY_DUPLICATE_VERSION", "Ontology version is immutable and already registered.", { key });
    }
    this.versions.set(key, structuredClone(ontology));
  }

  get(id: string, version: string): OntologyVersion | undefined {
    const value = this.versions.get(id + "@" + version);
    return value ? structuredClone(value) : undefined;
  }

  list(id?: string): readonly OntologyVersion[] {
    return [...this.versions.values()]
      .filter((item) => !id || item.id === id)
      .sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version))
      .map((item) => structuredClone(item));
  }
}

export function diffOntology(previous: OntologyVersion, next: OntologyVersion): OntologyDiff {
  if (previous.id !== next.id) {
    throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Cannot diff different ontology identities.");
  }
  const oldConcepts = new Map(previous.concepts.map((item) => [item.id, item] as const));
  const newConcepts = new Map(next.concepts.map((item) => [item.id, item] as const));
  const oldRelations = new Map(previous.relations.map((item) => [item.id, JSON.stringify(item)] as const));
  const newRelations = new Map(next.relations.map((item) => [item.id, JSON.stringify(item)] as const));
  const oldMappings = new Map(previous.mappings.map((item) => [item.id, item] as const));
  const newMappings = new Map(next.mappings.map((item) => [item.id, item] as const));

  const addedConceptIds = [...newConcepts.keys()].filter((id) => !oldConcepts.has(id)).sort();
  const removedConceptIds = [...oldConcepts.keys()].filter((id) => !newConcepts.has(id)).sort();
  const addedRelationIds = [...newRelations.keys()].filter((id) => !oldRelations.has(id)).sort();
  const removedRelationIds = [...oldRelations.keys()].filter((id) => !newRelations.has(id)).sort();
  const changedRelationIds = [...newRelations.keys()]
    .filter((id) => oldRelations.has(id) && oldRelations.get(id) !== newRelations.get(id)).sort();
  const addedMappingIds = [...newMappings.keys()].filter((id) => !oldMappings.has(id)).sort();
  const removedMappingIds = [...oldMappings.keys()].filter((id) => !newMappings.has(id)).sort();

  const impacted = new Set<string>(removedConceptIds);
  for (const id of addedRelationIds) {
    const relation = next.relations.find((item) => item.id === id)!;
    relation.domain.concat(relation.range).forEach((conceptId) => impacted.add(conceptId));
  }
  for (const id of removedRelationIds) {
    const relation = previous.relations.find((item) => item.id === id)!;
    relation.domain.concat(relation.range).forEach((conceptId) => impacted.add(conceptId));
  }
  for (const id of changedRelationIds) {
    const before = previous.relations.find((item) => item.id === id)!;
    const after = next.relations.find((item) => item.id === id)!;
    [...before.domain, ...before.range, ...after.domain, ...after.range].forEach((conceptId) => impacted.add(conceptId));
  }
  for (const id of [...addedMappingIds, ...removedMappingIds]) {
    const mapping = newMappings.get(id) ?? oldMappings.get(id)!;
    impacted.add(mapping.sourceConceptId);
    impacted.add(mapping.targetConceptId);
  }

  return Object.freeze({
    from: previous.version, to: next.version,
    addedConceptIds, removedConceptIds, addedRelationIds, removedRelationIds, changedRelationIds,
    addedMappingIds, removedMappingIds, impactedConceptIds: [...impacted].sort(),
    requiresReview: removedConceptIds.length + removedRelationIds.length + changedRelationIds.length +
      addedMappingIds.length + removedMappingIds.length > 0,
  });
}

export function mappingRequiresHumanReview(mapping: OntologyMapping): boolean {
  return mapping.status === "candidate" || mapping.status === "proposed";
}

export async function generateMappingCandidates(
  generator: OntologyCandidateGenerator,
  source: OntologyVersion["concepts"][number],
  targets: readonly OntologyVersion["concepts"][number][],
  scope: OntologyScope,
): Promise<readonly OntologyMappingCandidate[]> {
  const candidates = await generator.generate({ source, targets, scope });
  const allowedTargets = new Set(targets.map((item) => item.id));
  for (const candidate of candidates) {
    if (candidate.sourceConceptId !== source.id || !allowedTargets.has(candidate.targetConceptId)) {
      throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Candidate generator returned an endpoint outside the supplied candidate set.", { candidate });
    }
    if (!candidate.method.trim() || !candidate.rationale.trim()) {
      throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Mapping candidates require a method and rationale.", { candidate });
    }
  }
  return Object.freeze(candidates.map((item) => Object.freeze({ ...item })));
}

export function planConceptDeprecation(
  plan: OntologyMigrationPlan,
  ontology: OntologyVersion,
): OntologyMigrationPlan {
  if (!ontology.concepts.some((item) => item.id === plan.conceptId)) {
    throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Cannot deprecate an unknown concept.", { conceptId: plan.conceptId });
  }
  if (plan.replacementConceptId && !ontology.concepts.some((item) => item.id === plan.replacementConceptId)) {
    throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Replacement concept must exist in the target ontology version.", {
      replacementConceptId: plan.replacementConceptId,
    });
  }
  if (plan.strategy === "redirect" && !plan.replacementConceptId) {
    throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Redirect strategy requires a replacement concept.");
  }
  if (!plan.rationale.trim() || !VERSION.test(plan.effectiveVersion) || !plan.requiredReviewers.length ||
      plan.requiredReviewers.some((id) => !CANONICAL.test(id))) {
    throw new DivineError("DIVINE_ONTOLOGY_INVALID", "Deprecation plans require rationale, semantic version and canonical reviewers.");
  }
  return Object.freeze({
    ...plan,
    requiredReviewers: Object.freeze([...plan.requiredReviewers]),
  });
}
