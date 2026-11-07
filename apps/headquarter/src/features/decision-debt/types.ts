import type { DecisionGraphSnapshot } from '../decision-graph/types'

export type DecisionDebtReason = 'missing_support' | 'stale_support' | 'unresolved_contradiction' | 'invalid_support_provenance'

export type DecisionDebtFinding = {
  decisionId: string
  decisionLabel: string
  severity: 'critical' | 'high' | 'medium'
  score: number
  reasons: DecisionDebtReason[]
  supportingEvidenceIds: string[]
  staleEvidenceIds: string[]
  contradictoryEvidenceIds: string[]
  downstreamNodeIds: string[]
}

export type DecisionDebtReport = {
  snapshotId: string
  evaluatedAt: string
  findings: DecisionDebtFinding[]
  totalDebt: number
  affectedDownstreamNodeCount: number
}

export type DecisionDebtInput = {
  snapshot: DecisionGraphSnapshot
  now: Date
}
