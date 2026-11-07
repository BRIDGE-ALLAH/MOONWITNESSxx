import type { EvidenceExpiryItem, EvidenceExpiryReport, EvidenceRecord, EvidenceExpiryStatus } from './types'

export type EvidenceExpiryOptions = { warningDays?: number; criticalDays?: number }
export function compileEvidenceExpiryBudget(records: EvidenceRecord[], now: Date, options: EvidenceExpiryOptions = {}): EvidenceExpiryReport {
  const warningDays = options.warningDays ?? 14
  const criticalDays = options.criticalDays ?? 3
  const counts = { invalid: 0, expired: 0, critical: 0, warning: 0, healthy: 0 }
  const invalidOptions = !Number.isFinite(warningDays) || !Number.isFinite(criticalDays) || warningDays < criticalDays || criticalDays < 0
  const invalidNow = !Number.isFinite(now.getTime())
  const seen = new Set<string>()
  const items: EvidenceExpiryItem[] = records.map((record): EvidenceExpiryItem => {
    const captured = Date.parse(record.capturedAt), expiry = Date.parse(record.validUntil)
    const malformed = invalidOptions || invalidNow || !record.id.trim() || seen.has(record.id)
      || !Number.isFinite(captured) || !Number.isFinite(expiry) || expiry < captured
      || new Set(record.linkedDecisionIds).size !== record.linkedDecisionIds.length
    seen.add(record.id)
    const dependentDecisionIds = [...record.linkedDecisionIds].sort()
    if (malformed) return { evidenceId: record.id, status: 'invalid', daysRemaining: null, dependentDecisionCount: dependentDecisionIds.length, dependentDecisionIds }
    const daysRemaining = Math.ceil((expiry - now.getTime()) / 86_400_000)
    const status: EvidenceExpiryStatus = expiry <= now.getTime() ? 'expired' : daysRemaining <= criticalDays ? 'critical' : daysRemaining <= warningDays ? 'warning' : 'healthy'
    return { evidenceId: record.id, status, daysRemaining, dependentDecisionCount: dependentDecisionIds.length, dependentDecisionIds }
  }).sort((a, b) => {
    const order: Record<EvidenceExpiryStatus, number> = { invalid: 0, expired: 1, critical: 2, warning: 3, healthy: 4 }
    return order[a.status] - order[b.status] || (a.daysRemaining ?? -Infinity) - (b.daysRemaining ?? -Infinity) || a.evidenceId.localeCompare(b.evidenceId)
  })
  for (const item of items) counts[item.status] += 1
  const exposed = new Set(items.filter((item) => item.status !== 'healthy').flatMap((item) => item.dependentDecisionIds))
  return { valid: !invalidOptions && !invalidNow && counts.invalid === 0, evaluatedAt: invalidNow ? 'invalid' : now.toISOString(), items, counts, exposedDecisionCount: exposed.size }
}
