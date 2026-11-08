export type EvidenceRecord = { id: string; capturedAt: string; validUntil: string; linkedDecisionIds: string[] }
export type EvidenceExpiryStatus = 'invalid' | 'expired' | 'critical' | 'warning' | 'healthy'
export type EvidenceExpiryItem = { evidenceId: string; status: EvidenceExpiryStatus; daysRemaining: number | null; dependentDecisionCount: number; dependentDecisionIds: string[] }
export type EvidenceExpiryReport = { valid: boolean; evaluatedAt: string; items: EvidenceExpiryItem[]; counts: Record<EvidenceExpiryStatus, number>; exposedDecisionCount: number }
