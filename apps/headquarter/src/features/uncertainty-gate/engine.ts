import type { GovernanceGateInput, GovernanceGatePolicy, GovernanceGateResult, UncertaintyMetric } from './types'

export const DEFAULT_GOVERNANCE_POLICY: GovernanceGatePolicy = {
  minimumEvidenceCoverage: 0.75,
  maximumRelativeRange: 0.5,
  blockOnStaleEvidence: true,
}

function metricIsValid(metric: UncertaintyMetric): boolean {
  return [metric.low, metric.base, metric.high].every(Number.isFinite)
    && metric.low <= metric.base
    && metric.base <= metric.high
}

export function assessGovernanceReadiness(
  input: GovernanceGateInput,
  policy: GovernanceGatePolicy = DEFAULT_GOVERNANCE_POLICY,
): GovernanceGateResult {
  const reasons: GovernanceGateResult['reasons'] = []
  const countsValid = [input.requiredEvidenceCount, input.verifiedEvidenceCount, input.staleEvidenceCount, input.contradictionCount, input.unresolvedAssumptionCount].every((count) => Number.isInteger(count) && count >= 0)
  const policyValid = Number.isFinite(policy.minimumEvidenceCoverage) && policy.minimumEvidenceCoverage >= 0 && policy.minimumEvidenceCoverage <= 1 && Number.isFinite(policy.maximumRelativeRange) && policy.maximumRelativeRange >= 0
  const invalidMetrics = input.metrics.filter((metric) => !metricIsValid(metric))
  const missingMetrics = input.metrics.filter((metric) => metric.sourceQuality === 'missing')
  const coverage = !countsValid || input.requiredEvidenceCount <= 0
    ? 0
    : Math.max(0, Math.min(1, input.verifiedEvidenceCount / input.requiredEvidenceCount))
  const maxRelativeRange = input.metrics.filter(metricIsValid).reduce((maximum, metric) => {
    const denominator = Math.max(Math.abs(metric.base), Math.abs(metric.high - metric.low), 1e-9)
    return Math.max(maximum, (metric.high - metric.low) / denominator)
  }, 0)

  if (!countsValid || !policyValid) reasons.push({ code: 'invalid_governance_counters', message: 'Evidence counters and governance thresholds must be finite, non-negative, and within supported bounds' })
  if (invalidMetrics.length) reasons.push({ code: 'invalid_metric_range', message: `${invalidMetrics.length} metric range(s) are invalid` })
  if (missingMetrics.length) reasons.push({ code: 'missing_required_metric', message: `${missingMetrics.length} required metric(s) have missing source data` })
  if (coverage < policy.minimumEvidenceCoverage) reasons.push({ code: 'low_evidence_coverage', message: `Evidence coverage ${Math.round(coverage * 100)}% is below the ${Math.round(policy.minimumEvidenceCoverage * 100)}% threshold` })
  if (input.staleEvidenceCount > 0) reasons.push({ code: 'stale_evidence', message: `${input.staleEvidenceCount} stale evidence item(s) remain in scope` })
  if (input.contradictionCount > 0) reasons.push({ code: 'unresolved_contradiction', message: `${input.contradictionCount} unresolved contradiction(s) require review` })
  if (maxRelativeRange > policy.maximumRelativeRange) reasons.push({ code: 'wide_uncertainty_range', message: `Maximum relative uncertainty ${Math.round(maxRelativeRange * 100)}% exceeds the ${Math.round(policy.maximumRelativeRange * 100)}% review threshold` })
  if (input.unresolvedAssumptionCount > 0) reasons.push({ code: 'unresolved_assumptions', message: `${input.unresolvedAssumptionCount} assumption(s) remain unresolved` })

  const blocked = !countsValid || !policyValid || invalidMetrics.length > 0 || missingMetrics.length > 0
    || coverage < Math.min(policy.minimumEvidenceCoverage, 0.5)
    || (policy.blockOnStaleEvidence && input.staleEvidenceCount > 0)
  const status = blocked ? 'blocked'
    : reasons.length > 0 ? 'review_required'
      : 'eligible_for_human_review'
  return {
    status,
    requiresHumanApproval: true,
    evidenceCoverage: coverage,
    maximumRelativeRange: maxRelativeRange,
    reasons,
  }
}
