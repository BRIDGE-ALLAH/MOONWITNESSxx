import type {
  DecisionGraphAssessment,
  DecisionGraphIssue,
  DecisionGraphSnapshot,
} from './types'

/**
 * Pure assessment only: no network, persistence, policy enforcement, or writes.
 * The caller supplies time so results are reproducible in tests and replays.
 */
export function assessDecisionGraph(
  snapshot: DecisionGraphSnapshot,
  now: Date = new Date(),
): DecisionGraphAssessment {
  const issues: DecisionGraphIssue[] = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]))
  const incoming = new Map<string, string[]>()

  for (const node of snapshot.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ code: 'duplicate_node_id', nodeId: node.id, message: `Duplicate node id: ${node.id}` })
    }
    nodeIds.add(node.id)

    if (node.kind === 'evidence' && !node.provenance?.sourceRef.trim()) {
      issues.push({
        code: 'missing_evidence_provenance',
        nodeId: node.id,
        message: `Evidence node "${node.id}" has no source reference`,
      })
    }
    if (node.confidence !== undefined && (!Number.isFinite(node.confidence) || node.confidence < 0 || node.confidence > 1)) {
      issues.push({
        code: 'invalid_confidence',
        nodeId: node.id,
        message: `Node "${node.id}" confidence must be between 0 and 1`,
      })
    }
    if (node.kind === 'evidence' && node.validUntil && Date.parse(node.validUntil) < now.getTime()) {
      issues.push({
        code: 'expired_evidence',
        nodeId: node.id,
        message: `Evidence node "${node.id}" is past its validity window`,
      })
    }
  }

  for (const edge of snapshot.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({ code: 'duplicate_edge_id', edgeId: edge.id, message: `Duplicate edge id: ${edge.id}` })
    }
    edgeIds.add(edge.id)

    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      issues.push({
        code: 'dangling_edge',
        edgeId: edge.id,
        message: `Edge "${edge.id}" references a missing node`,
      })
      continue
    }
    const targets = incoming.get(edge.to) ?? []
    targets.push(edge.relation)
    incoming.set(edge.to, targets)
  }

  let traceableDecisions = 0
  let unsubstantiatedDecisions = 0
  for (const node of snapshot.nodes) {
    if (node.kind !== 'decision') continue
    const relations = incoming.get(node.id) ?? []
    if (relations.includes('supports') || relations.includes('contradicts') || relations.includes('constrained_by')) {
      traceableDecisions += 1
    } else {
      unsubstantiatedDecisions += 1
      issues.push({
        code: 'unsubstantiated_decision',
        nodeId: node.id,
        message: `Decision "${node.id}" has no linked evidence or policy rationale`,
      })
    }
  }

  const decisions = traceableDecisions + unsubstantiatedDecisions
  return {
    traceableDecisions,
    unsubstantiatedDecisions,
    expiredEvidence: issues.filter((issue) => issue.code === 'expired_evidence').length,
    integrityIssues: issues,
    traceability: decisions === 0 ? 1 : traceableDecisions / decisions,
  }
}
