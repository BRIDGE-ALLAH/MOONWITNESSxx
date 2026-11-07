export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted'
export interface LineageSourceField { sourceId: string; fieldPath: string; tenantId: string; classification: DataClassification }
export interface DerivedArtifactLineage { artifactId: string; tenantId: string; sourceFields: readonly LineageSourceField[]; lineageComplete: boolean }
export interface LineageAccessContext { requesterId: string; tenantId: string; allowedClassifications: readonly DataClassification[]; allowedSourceIds?: readonly string[] }
const CLASSIFICATION_RANK: Record<DataClassification, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }
const isClassification = (value: unknown): value is DataClassification =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(CLASSIFICATION_RANK, value)

export interface LineageAccessDecision {
  allowed: boolean; reasonCodes: string[]
  deniedSourceFields: Array<{ sourceId: string; fieldPath: string; reason: string }>
}

/** Authorize every source field behind a derived artifact, not only its output label. */
export function evaluateLineageAccess(lineage: DerivedArtifactLineage, context: LineageAccessContext): LineageAccessDecision {
  const reasons: string[] = [], denied: LineageAccessDecision['deniedSourceFields'] = []
  if (!lineage.artifactId.trim() || !context.requesterId.trim() || !context.tenantId.trim()) reasons.push('identity_context_missing')
  if (!lineage.lineageComplete || lineage.sourceFields.length === 0) reasons.push('lineage_incomplete')
  if (lineage.tenantId !== context.tenantId) reasons.push('artifact_tenant_mismatch')
  const classes = new Set(context.allowedClassifications.filter(isClassification))
  const sources = context.allowedSourceIds ? new Set(context.allowedSourceIds) : null
  for (const source of lineage.sourceFields) {
    let reason: string | undefined
    if (!source.sourceId.trim() || !source.fieldPath.trim() || !source.tenantId.trim() || !isClassification(source.classification)) reason = 'source_field_metadata_invalid'
    else if (source.tenantId !== context.tenantId) reason = 'source_tenant_mismatch'
    else if (!classes.has(source.classification)) reason = 'classification_not_authorized'
    else if (sources && !sources.has(source.sourceId)) reason = 'source_not_authorized'
    if (reason) { denied.push({ sourceId: source.sourceId, fieldPath: source.fieldPath, reason }); reasons.push(reason) }
  }
  return { allowed: reasons.length === 0, reasonCodes: [...new Set(reasons)], deniedSourceFields: denied }
}

/** Preserve full parent lineage and the most restrictive classification for duplicate source fields. */
export function composeDerivedLineage(artifactId: string, tenantId: string, parents: readonly DerivedArtifactLineage[]): DerivedArtifactLineage {
  if (!artifactId.trim() || !tenantId.trim() || parents.length === 0) throw new Error('artifact identity and at least one parent are required')
  if (parents.some((parent) => parent.tenantId !== tenantId)) throw new Error('cross-tenant lineage composition is forbidden')
  const sources = new Map<string, LineageSourceField>()
  for (const parent of parents) for (const source of parent.sourceFields) {
    if (!source.sourceId.trim() || !source.fieldPath.trim() || !source.tenantId.trim() || !isClassification(source.classification)) {
      throw new Error('invalid source field lineage metadata')
    }
    if (source.tenantId !== tenantId) throw new Error('cross-tenant source lineage is forbidden')
    const key = source.tenantId + ':' + source.sourceId + ':' + source.fieldPath
    const existing = sources.get(key)
    if (!existing || CLASSIFICATION_RANK[source.classification] > CLASSIFICATION_RANK[existing.classification]) {
      sources.set(key, { ...source })
    }
  }
  const sourceFields = [...sources.values()].sort((a, b) =>
    (a.tenantId + ':' + a.sourceId + ':' + a.fieldPath).localeCompare(b.tenantId + ':' + b.sourceId + ':' + b.fieldPath))
  return { artifactId, tenantId, sourceFields, lineageComplete: parents.every((p) => p.lineageComplete && p.sourceFields.length > 0) }
}
