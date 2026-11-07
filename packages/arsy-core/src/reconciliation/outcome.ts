export type ReconciliationStatus = 'confirmed' | 'drift_detected' | 'unavailable' | 'stale'
export interface ExpectedOutcome { resourceId: string; expectedDigest: string; actionId: string }
export interface ObservedOutcome { observedDigest?: string | null; observedAt?: string | null; observerId?: string | null }
export interface ReconciliationAssessment {
  resourceId: string; actionId: string; status: ReconciliationStatus
  reasonCodes: string[]; reopenRequired: boolean
}

/** Read-only postcondition check; provider adapters own observation and remediation. */
export function reconcileOutcome(
  expected: ExpectedOutcome, observed: ObservedOutcome,
  options: { now?: string; maximumObservationAgeMinutes?: number } = {},
): ReconciliationAssessment {
  if (!expected.resourceId.trim() || !expected.actionId.trim() || !expected.expectedDigest.trim()) {
    throw new Error('resourceId, actionId and expectedDigest are required')
  }
  const nowMs = Date.parse(options.now ?? new Date().toISOString())
  if (Number.isNaN(nowMs)) throw new Error('now must be a valid date')
  const maximumAge = options.maximumObservationAgeMinutes ?? 15
  if (!Number.isFinite(maximumAge) || maximumAge < 0) throw new Error('maximumObservationAgeMinutes must be non-negative')
  const base = { resourceId: expected.resourceId, actionId: expected.actionId }
  if (!observed.observedDigest || !observed.observedAt || !observed.observerId?.trim()) {
    return { ...base, status: 'unavailable', reasonCodes: ['independent_observation_missing'], reopenRequired: true }
  }
  const observedMs = Date.parse(observed.observedAt)
  if (Number.isNaN(observedMs) || observedMs > nowMs) {
    return { ...base, status: 'unavailable', reasonCodes: ['invalid_observation_time'], reopenRequired: true }
  }
  if ((nowMs - observedMs) / 60000 > maximumAge) {
    return { ...base, status: 'stale', reasonCodes: ['observation_exceeded_freshness_window'], reopenRequired: true }
  }
  if (observed.observedDigest !== expected.expectedDigest) {
    return { ...base, status: 'drift_detected', reasonCodes: ['observed_state_differs_from_expected'], reopenRequired: true }
  }
  return { ...base, status: 'confirmed', reasonCodes: [], reopenRequired: false }
}
