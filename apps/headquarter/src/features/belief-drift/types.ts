export type BeliefRecord = {
  id: string
  subject: string
  claim: string
  confidence: number
  evidenceRefs: string[]
}
export type BeliefSnapshot = { id: string; capturedAt: string; beliefs: BeliefRecord[] }
export type BeliefDriftCode = 'claim_changed' | 'confidence_shift' | 'evidence_removed' | 'new_belief' | 'belief_removed' | 'invalid_snapshot'
export type BeliefDriftFinding = { beliefId: string; subject: string; code: BeliefDriftCode; severity: 'low' | 'medium' | 'high'; detail: string }
export type BeliefDriftReport = { valid: boolean; baselineId: string; currentId: string; findings: BeliefDriftFinding[]; changedBeliefCount: number; driftScore: number }
