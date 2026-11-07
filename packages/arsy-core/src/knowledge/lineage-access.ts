export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted'
export interface LineageSourceField { sourceId: string; fieldPath: string; tenantId: string; classification: DataClassification }
export interface DerivedArtifactLineage { artifactId: string; tenantId: string; sourceFields: readonly LineageSourceField[]; lineageComplete: boolean }
export interface LineageAccessContext { requesterId: string; tenantId: string; allowedClassifications: readonly DataClassification[]; allowedSourceIds?: readonly string[] }
const CLASSIFICATION_RANK: Record<DataClassification, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }\n\nexport interface LineageAccessDecision {
  allowed: boolean; reasonCodes: string[]
  deniedSourceFields: Array<{ sourceId: string; fieldPath: string; reason: string }>
}

/** Authorize every source field behind a derived artifact, not only its output label. */
export function evaluateLineageAccess(lineage: DerivedArtifactLineage, context: LineageAccessContext): LineageAccessDecision {
  const reasons: string[] = [], denied: LineageAccessDecision['deniedSourceFields'] = []
  if (!lineage.artifactId.trim() || !context.requesterId.trim()) reasons.push('identity_context_missing')
  if (!lineage.lineageComplete || lineage.sourceFields.length === 0) reasons.push('lineage_incomplete')
  if (lineage.tenantId !== context.tenantId) reasons.push('artifact_tenant_mismatch')
  const classes = new Set(context.allowedClassifications)
  const sources = context.allowedSourceIds ? new Set(context.allowedSourceIds) : null
  for (const source of lineage.sourceFields) {
    let reason: string | undefined
    if (!source.sourceId.trim() || !source.fieldPath.trim() || !source.tenantId.trim() || !Object.hasOwn(CLASSIFICATION_RANK, source.classification)) reason = 'source_field_metadata_invalid'\n    else if (source.tenantId !== context.tenantId) reason = 'source_tenant_mismatch'
    else if (!classes.has(source.classification)) reason = 'classification_not_authorized'
    else if (sources && !sources.has(source.sourceId)) reason = 'source_not_authorized'
    if (reason) { denied.push({ sourceId: source.sourceId, fieldPath: source.fieldPath, reason }); reasons.push(reason) }
  }
  return { allowed: reasons.length === 0, reasonCodes: [...new Set(reasons)], deniedSourceFields: denied }
}

/** Preserve full parent lineage so derived summaries cannot launder restricted source fields. */
export function composeDerivedLineage(artifactId: string, tenantId: string, parents: readonly DerivedArtifactLineage[]): DerivedArtifactLineage {
  if (!artifactId.trim() || !tenantId.trim() || parents.length === 0) throw new Error('artifact identity and at least one parent are required')
  if (parents.some((parent) => parent.tenantId !== tenantId)) throw new Error('cross-tenant lineage composition is forbidden')
  const sources = new Map<string, LineageSourceField>()
  for (const parent of parents) for (const source of parent.sourceFields) {
    sources.set(source.tenantId + ':' + source.sourceId + ':' + source.fieldPath, { ...source })
  }
  return { artifactId, tenantId, sourceFields: [...sources.values()], lineageComplete: parents.every((p) => p.lineageComplete && p.sourceFields.length > 0) }
}
