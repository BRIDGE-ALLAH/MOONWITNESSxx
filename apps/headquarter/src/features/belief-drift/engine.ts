import type { BeliefDriftFinding, BeliefDriftReport, BeliefSnapshot } from './types'

export type BeliefDriftOptions = { confidenceDeltaThreshold?: number; evidenceLossRatioThreshold?: number }

export function detectBeliefDrift(
  baseline: BeliefSnapshot,
  current: BeliefSnapshot,
  options: BeliefDriftOptions = {},
): BeliefDriftReport {
  const confidenceThreshold = options.confidenceDeltaThreshold ?? 0.2
  const evidenceLossThreshold = options.evidenceLossRatioThreshold ?? 0.5
  const findings: BeliefDriftFinding[] = []
  const validOptions = Number.isFinite(confidenceThreshold) && confidenceThreshold >= 0 && confidenceThreshold <= 1
    && Number.isFinite(evidenceLossThreshold) && evidenceLossThreshold >= 0 && evidenceLossThreshold <= 1
  const validSnapshot = (snapshot: BeliefSnapshot) => Boolean(snapshot.id.trim())
    && Number.isFinite(Date.parse(snapshot.capturedAt))
    && snapshot.beliefs.every((belief) => Boolean(belief.id.trim() && belief.subject.trim() && belief.claim.trim())
      && Number.isFinite(belief.confidence) && belief.confidence >= 0 && belief.confidence <= 1
      && new Set(belief.evidenceRefs).size === belief.evidenceRefs.length)
    && new Set(snapshot.beliefs.map((belief) => belief.id)).size === snapshot.beliefs.length

  if (!validOptions || !validSnapshot(baseline) || !validSnapshot(current)
    || Date.parse(current.capturedAt) < Date.parse(baseline.capturedAt)) {
    findings.push({ beliefId: '*', subject: 'Snapshot integrity', code: 'invalid_snapshot', severity: 'high', detail: 'Snapshots, chronology, or drift thresholds are invalid; no drift conclusion is trusted.' })
    return { valid: false, baselineId: baseline.id, currentId: current.id, findings, changedBeliefCount: 0, driftScore: 0 }
  }

  const before = new Map(baseline.beliefs.map((belief) => [belief.id, belief]))
  const after = new Map(current.beliefs.map((belief) => [belief.id, belief]))
  for (const belief of current.beliefs) {
    const previous = before.get(belief.id)
    if (!previous) {
      findings.push({ beliefId: belief.id, subject: belief.subject, code: 'new_belief', severity: 'low', detail: 'Belief was introduced after the baseline; it has no longitudinal comparison.' })
      continue
    }
    if (previous.claim !== belief.claim) findings.push({ beliefId: belief.id, subject: belief.subject, code: 'claim_changed', severity: 'high', detail: 'Claim text changed; downstream decisions should be revalidated.' })
    const delta = Math.abs(belief.confidence - previous.confidence)
    if (delta >= confidenceThreshold && delta > 0) findings.push({ beliefId: belief.id, subject: belief.subject, code: 'confidence_shift', severity: delta >= Math.max(confidenceThreshold * 2, 0.4) ? 'high' : 'medium', detail: `Confidence moved by ${delta.toFixed(3)} (descriptive delta, not calibrated probability).` })
    const removed = previous.evidenceRefs.filter((ref) => !belief.evidenceRefs.includes(ref))
    const lossRatio = previous.evidenceRefs.length === 0 ? 0 : removed.length / previous.evidenceRefs.length
    if (removed.length > 0 && lossRatio >= evidenceLossThreshold) findings.push({ beliefId: belief.id, subject: belief.subject, code: 'evidence_removed', severity: lossRatio >= 0.75 ? 'high' : 'medium', detail: `Evidence references removed: ${removed.join(', ')}.` })
  }
  for (const belief of baseline.beliefs) if (!after.has(belief.id)) findings.push({ beliefId: belief.id, subject: belief.subject, code: 'belief_removed', severity: 'medium', detail: 'Belief disappeared from the current snapshot; confirm whether it was superseded or accidentally dropped.' })
  const changedBeliefIds = new Set(findings.filter((finding) => finding.code !== 'invalid_snapshot').map((finding) => finding.beliefId))
  const denominator = Math.max(baseline.beliefs.length, current.beliefs.length, 1)
  return { valid: true, baselineId: baseline.id, currentId: current.id, findings, changedBeliefCount: changedBeliefIds.size, driftScore: Math.min(1, changedBeliefIds.size / denominator) }
}
