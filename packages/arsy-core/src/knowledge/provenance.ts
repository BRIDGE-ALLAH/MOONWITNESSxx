export type SignatureStatus = 'verified' | 'unverified' | 'invalid' | 'not_available'
export type EvidenceDisposition = 'accept' | 'review' | 'quarantine'

export interface EvidenceQualityVector {
  authenticity: number
  authority: number
  freshness: number
  contextCompleteness: number
  /** Must represent the origin, not merely a copied URL or mirror. */
  independenceGroup: string
  signatureStatus: SignatureStatus
  provenanceComplete: boolean
}

export interface EvidenceTrustPolicy {
  minimumAuthenticity: number
  minimumAuthority: number
  minimumFreshness: number
  minimumContextCompleteness: number
  minimumIndependentSources: number
  requireVerifiedSignature: boolean
}

export interface EvidenceTrustAssessment {
  disposition: EvidenceDisposition
  reasonCodes: string[]
}

const DEFAULT_POLICY: EvidenceTrustPolicy = {
  minimumAuthenticity: 0.7,
  minimumAuthority: 0.4,
  minimumFreshness: 0.4,
  minimumContextCompleteness: 0.7,
  minimumIndependentSources: 2,
  requireVerifiedSignature: false,
}

function assertUnitInterval(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1`)
}

/** Keep trust dimensions separate; do not collapse provenance into one opaque score. */
export function assessEvidenceTrust(
  quality: EvidenceQualityVector,
  policy: EvidenceTrustPolicy = DEFAULT_POLICY,
): EvidenceTrustAssessment {
  assertUnitInterval(quality.authenticity, 'authenticity')
  assertUnitInterval(quality.authority, 'authority')
  assertUnitInterval(quality.freshness, 'freshness')
  assertUnitInterval(quality.contextCompleteness, 'contextCompleteness')

  const quarantine: string[] = []
  const review: string[] = []
  if (!quality.provenanceComplete) quarantine.push('provenance_incomplete')
  if (quality.signatureStatus === 'invalid') quarantine.push('signature_invalid')
  if (quality.authenticity < policy.minimumAuthenticity) quarantine.push('authenticity_below_floor')
  if (policy.requireVerifiedSignature && quality.signatureStatus !== 'verified') {
    quarantine.push('verified_signature_required')
  }
  if (!quality.independenceGroup.trim()) quarantine.push('independence_group_missing')

  if (quality.authority < policy.minimumAuthority) review.push('authority_below_threshold')
  if (quality.freshness < policy.minimumFreshness) review.push('evidence_stale')
  if (quality.contextCompleteness < policy.minimumContextCompleteness) review.push('context_incomplete')
  if (quality.signatureStatus === 'unverified' || quality.signatureStatus === 'not_available') {
    review.push('signature_not_verified')
  }

  if (quarantine.length) return { disposition: 'quarantine', reasonCodes: quarantine }
  if (review.length) return { disposition: 'review', reasonCodes: review }
  return { disposition: 'accept', reasonCodes: [] }
}

export interface ClaimEvidenceRef {
  evidenceId: string
  independenceGroup: string
  disposition: EvidenceDisposition
}

/** Copies and mirrors from the same origin count as one corroborating source. */
export function assessClaimCorroboration(
  evidence: readonly ClaimEvidenceRef[],
  minimumIndependentSources = DEFAULT_POLICY.minimumIndependentSources,
): { promotable: boolean; independentSourceCount: number; quarantinedEvidenceIds: string[] } {
  if (!Number.isInteger(minimumIndependentSources) || minimumIndependentSources < 1) {
    throw new Error('minimumIndependentSources must be a positive integer')
  }
  const quarantinedEvidenceIds = evidence
    .filter((item) => item.disposition === 'quarantine')
    .map((item) => item.evidenceId)
  const independentGroups = new Set(
    evidence.filter((item) => item.disposition === 'accept').map((item) => item.independenceGroup),
  )
  return {
    promotable: quarantinedEvidenceIds.length === 0 && independentGroups.size >= minimumIndependentSources,
    independentSourceCount: independentGroups.size,
    quarantinedEvidenceIds,
  }
}

export interface ContaminationLink {
  sourceId: string
  evidenceId: string
  claimId: string
  decisionIds: string[]
}

/**
 * In-memory dependency index for fast quarantine impact discovery.
 * Persist the links in the evidence store before using this for production governance.
 */
export class ContaminationIndex {
  private readonly links = new Map<string, ContaminationLink>()
  private readonly quarantinedSources = new Set<string>()

  linkEvidence(link: ContaminationLink): void {
    if (!link.sourceId || !link.evidenceId || !link.claimId) throw new Error('sourceId, evidenceId and claimId are required')
    this.links.set(link.evidenceId, { ...link, decisionIds: [...new Set(link.decisionIds)] })
  }

  quarantineSource(sourceId: string): {
    sourceId: string
    affectedEvidenceIds: string[]
    affectedClaimIds: string[]
    frozenDecisionIds: string[]
  } {
    if (!sourceId.trim()) throw new Error('sourceId is required')
    this.quarantinedSources.add(sourceId)
    const affected = [...this.links.values()].filter((link) => link.sourceId === sourceId)
    return {
      sourceId,
      affectedEvidenceIds: affected.map((link) => link.evidenceId),
      affectedClaimIds: [...new Set(affected.map((link) => link.claimId))],
      frozenDecisionIds: [...new Set(affected.flatMap((link) => link.decisionIds))],
    }
  }

  isQuarantined(sourceId: string): boolean {
    return this.quarantinedSources.has(sourceId)
  }
}
