export type VerificationStatus = 'PASS' | 'FAIL' | 'UNVERIFIED'
export interface VerificationCheck { id: string; required?: boolean; requireEvidence?: boolean }
export interface VerificationContract { id: string; version: string; checks: readonly VerificationCheck[] }
export interface VerificationObservation {
  checkId: string; status: VerificationStatus; verifierId: string; observedAt: string
  evidenceRefs?: readonly string[]; detail?: string
}
export interface CheckAssessment {
  checkId: string; status: VerificationStatus; reasonCodes: string[]
  verifierId?: string; evidenceRefs: string[]
}
export interface CompletionAssessment {
  contractId: string; contractVersion: string; status: VerificationStatus
  checks: CheckAssessment[]; completionAllowed: boolean
}

/** Executor self-assertions never count as independent verification. */
export function evaluateCompletion(
  contract: VerificationContract, executorId: string, observations: readonly VerificationObservation[],
): CompletionAssessment {
  if (!contract.id.trim() || !contract.version.trim()) throw new Error('contract id and version are required')
  if (!executorId.trim()) throw new Error('executorId is required')
  if (!contract.checks.some((check) => check.required !== false)) throw new Error('contract must define at least one required check')
  const checkIds = new Set<string>()
  for (const check of contract.checks) {
    if (!check.id.trim() || checkIds.has(check.id)) throw new Error('Duplicate or empty verification check id: ' + check.id)
    checkIds.add(check.id)
  }
  const grouped = new Map<string, VerificationObservation[]>()
  for (const observation of observations) {
    if (!checkIds.has(observation.checkId)) continue
    const values = grouped.get(observation.checkId) ?? []
    values.push(observation)
    grouped.set(observation.checkId, values)
  }
  const checks = contract.checks.map((check): CheckAssessment => {
    const matches = grouped.get(check.id) ?? []
    if (matches.length === 0) {
      const optional = check.required === false
      return { checkId: check.id, status: optional ? 'PASS' : 'UNVERIFIED', reasonCodes: [optional ? 'optional_check_not_run' : 'required_check_missing'], evidenceRefs: [] }
    }
    if (matches.length > 1) return { checkId: check.id, status: 'UNVERIFIED', reasonCodes: ['duplicate_verification_observations'], evidenceRefs: [] }
    const observation = matches[0]
    if (!['PASS', 'FAIL', 'UNVERIFIED'].includes(observation.status)) {
      return { checkId: check.id, status: 'UNVERIFIED', reasonCodes: ['invalid_verification_status'], evidenceRefs: [] }
    }
    if (typeof observation.verifierId !== 'string' || !observation.verifierId.trim() || Number.isNaN(Date.parse(observation.observedAt))) {
      return { checkId: check.id, status: 'UNVERIFIED', reasonCodes: ['invalid_verifier_or_timestamp'], evidenceRefs: [] }
    }
    const refs = [...(observation.evidenceRefs ?? [])].filter((ref) => ref.trim())
    if (observation.verifierId === executorId) {
      return { checkId: check.id, status: 'UNVERIFIED', reasonCodes: ['self_verification_not_independent'], verifierId: observation.verifierId, evidenceRefs: refs }
    }
    if (check.requireEvidence !== false && refs.length === 0) {
      return { checkId: check.id, status: 'UNVERIFIED', reasonCodes: ['verification_evidence_missing'], verifierId: observation.verifierId, evidenceRefs: [] }
    }
    return { checkId: check.id, status: observation.status, reasonCodes: observation.status === 'UNVERIFIED' ? ['verifier_returned_unverified'] : [], verifierId: observation.verifierId, evidenceRefs: refs }
  })
  const required = checks.filter((result) => contract.checks.find((check) => check.id === result.checkId)?.required !== false)
  const status: VerificationStatus = required.some((check) => check.status === 'FAIL') ? 'FAIL'
    : required.some((check) => check.status !== 'PASS') ? 'UNVERIFIED' : 'PASS'
  return { contractId: contract.id, contractVersion: contract.version, status, checks, completionAllowed: status === 'PASS' }
}
