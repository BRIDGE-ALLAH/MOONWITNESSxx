import type { DecisionGraphNode, DecisionGraphSnapshot } from '../decision-graph/types'
import type { DecisionDebtFinding, DecisionDebtInput, DecisionDebtReason, DecisionDebtReport } from './types'

function downstreamFromDecision(snapshot: DecisionGraphSnapshot, decisionId: string): string[] {
  const outgoing = new Map<string, string[]>()
  for (const edge of snapshot.edges) {
    if (edge.relation !== 'causes') continue
    const targets = outgoing.get(edge.from) ?? []
    targets.push(edge.to)
    outgoing.set(edge.from, targets)
  }
  const visited = new Set<string>()
  const queue = [...(outgoing.get(decisionId) ?? [])]
  while (queue.length) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    queue.push(...(outgoing.get(id) ?? []))
  }
  return [...visited].sort()
}

/** Compiles stale/missing/contradictory decision support into a deterministic human-review backlog. */
export function compileDecisionDebt({ snapshot, now }: DecisionDebtInput): DecisionDebtReport {
  const nodes = new Map<string, DecisionGraphNode>(snapshot.nodes.map((node) => [node.id, node]))
  const findings: DecisionDebtFinding[] = []
  for (const decision of snapshot.nodes.filter((node) => node.kind === 'decision')) {
    const incoming = snapshot.edges.filter((edge) => edge.to === decision.id)
    const supportEdges = incoming.filter((edge) => edge.relation === 'supports')
    const contradictionEdges = incoming.filter((edge) => edge.relation === 'contradicts')
    const supportingEvidence = supportEdges.map((edge) => nodes.get(edge.from)).filter((node): node is DecisionGraphNode => node?.kind === 'evidence')
    const contradictoryEvidence = contradictionEdges.map((edge) => nodes.get(edge.from)).filter((node): node is DecisionGraphNode => node?.kind === 'evidence')
    const stale = supportingEvidence.filter((node) => {
      if (!node.validUntil) return false
      const expiry = Date.parse(node.validUntil)
      return !Number.isFinite(expiry) || expiry < now.getTime()
    })
    const invalidProvenance = supportingEvidence.filter((node) => !node.provenance?.sourceRef.trim() || !Number.isFinite(Date.parse(node.provenance.capturedAt)))
    const reasons: DecisionDebtReason[] = []
    if (supportingEvidence.length === 0) reasons.push('missing_support')
    if (stale.length > 0) reasons.push('stale_support')
    if (contradictoryEvidence.length > 0) reasons.push('unresolved_contradiction')
    if (invalidProvenance.length > 0) reasons.push('invalid_support_provenance')
    if (!reasons.length) continue
    const score = (reasons.includes('missing_support') ? 100 : 0)
      + stale.length * 35
      + contradictoryEvidence.length * 25
      + invalidProvenance.length * 20
    const severity = score >= 100 ? 'critical' : score >= 50 ? 'high' : 'medium'
    findings.push({
      decisionId: decision.id,
      decisionLabel: decision.label,
      severity,
      score,
      reasons,
      supportingEvidenceIds: supportingEvidence.map((node) => node.id).sort(),
      staleEvidenceIds: stale.map((node) => node.id).sort(),
      contradictoryEvidenceIds: contradictoryEvidence.map((node) => node.id).sort(),
      downstreamNodeIds: downstreamFromDecision(snapshot, decision.id),
    })
  }
  findings.sort((a, b) => b.score - a.score || a.decisionId.localeCompare(b.decisionId))
  const affected = new Set(findings.flatMap((finding) => finding.downstreamNodeIds))
  return {
    snapshotId: snapshot.id,
    evaluatedAt: now.toISOString(),
    findings,
    totalDebt: findings.reduce((sum, finding) => sum + finding.score, 0),
    affectedDownstreamNodeCount: affected.size,
  }
}
