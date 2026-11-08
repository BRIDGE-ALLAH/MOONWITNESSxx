export type UncertaintyMetric = {
  id: string
  label: string
  low: number
  base: number
  high: number
  unit?: string
  sourceQuality: 'verified' | 'estimated' | 'missing'
  missingReason?: string
}

export type GovernanceGateInput = {
  metrics: UncertaintyMetric[]
  requiredEvidenceCount: number
  verifiedEvidenceCount: number
  staleEvidenceCount: number
  contradictionCount: number
  unresolvedAssumptionCount: number
}

export type GovernanceGatePolicy = {
  minimumEvidenceCoverage: number
  maximumRelativeRange: number
  blockOnStaleEvidence: boolean
}

export type GovernanceGateReasonCode =
  | 'invalid_metric_range'
  | 'invalid_governance_counters'
  | 'missing_required_metric'
  | 'low_evidence_coverage'
  | 'stale_evidence'
  | 'unresolved_contradiction'
  | 'wide_uncertainty_range'
  | 'unresolved_assumptions'

export type GovernanceGateResult = {
  status: 'blocked' | 'review_required' | 'eligible_for_human_review'
  requiresHumanApproval: true
  evidenceCoverage: number
  maximumRelativeRange: number
  reasons: { code: GovernanceGateReasonCode; message: string }[]
}
