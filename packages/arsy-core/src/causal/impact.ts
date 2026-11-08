export type ImpactNodeKind = 'model' | 'field' | 'policy' | 'agent' | 'tool' | 'connector' | 'tenant' | 'workflow' | 'deployment'
export type ImpactEdgeKind = 'declared_dependency' | 'observed_sequence' | 'validated_cause'

export interface ImpactNode {
  id: string
  kind: ImpactNodeKind
  label: string
  /** Relative consequence weight from 1 (low) to 5 (critical). */
  impactWeight: number
}

export interface ImpactEdge {
  id: string
  /** Direction is upstream -> downstream. */
  sourceId: string
  targetId: string
  kind: ImpactEdgeKind
  /** Confidence in the edge evidence, not a probability that a change will fail. */
  confidence: number
  evidenceIds: string[]
}

export interface ImpactGraph {
  nodes: readonly ImpactNode[]
  edges: readonly ImpactEdge[]
}

export interface ImpactForecastEntry {
  node: ImpactNode
  confidence: number
  severityScore: number
  path: string[]
  edgeKinds: ImpactEdgeKind[]
}

export interface ImpactForecast {
  changedNodeId: string
  impacted: ImpactForecastEntry[]
  excludedObservedSequenceEdges: string[]
}

/**
 * Computes a conservative, explainable dependency blast radius.
 * Temporal co-occurrence is deliberately excluded: sequence is not causation.
 * This is graph reachability, not a calibrated digital twin or failure probability.
 */
export function computeImpactForecast(
  graph: ImpactGraph,
  changedNodeId: string,
  minimumConfidence = 0.5,
): ImpactForecast {
  if (!graph.nodes.some((node) => node.id === changedNodeId)) throw new Error(`Unknown impact node: ${changedNodeId}`)
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
    throw new Error('minimumConfidence must be between 0 and 1')
  }

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id)) throw new Error(`Duplicate or empty impact node id: ${node.id}`)
    if (!Number.isFinite(node.impactWeight) || node.impactWeight < 1 || node.impactWeight > 5) {
      throw new Error(`Invalid impactWeight for node: ${node.id}`)
    }
    ids.add(node.id)
  }

  const excludedObservedSequenceEdges = graph.edges
    .filter((edge) => edge.kind === 'observed_sequence')
    .map((edge) => edge.id)
  const outgoing = new Map<string, ImpactEdge[]>()
  for (const edge of graph.edges) {
    if (!nodes.has(edge.sourceId) || !nodes.has(edge.targetId)) throw new Error(`Impact edge ${edge.id} references an unknown node`)
    if (!Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1) {
      throw new Error(`Invalid confidence for impact edge: ${edge.id}`)
    }
    if (edge.kind === 'observed_sequence' || edge.confidence < minimumConfidence) continue
    const list = outgoing.get(edge.sourceId) ?? []
    list.push(edge)
    outgoing.set(edge.sourceId, list)
  }

  const best = new Map<string, ImpactForecastEntry>()
  const queue: Array<{ id: string; confidence: number; path: string[]; edgeKinds: ImpactEdgeKind[] }> = [
    { id: changedNodeId, confidence: 1, path: [changedNodeId], edgeKinds: [] },
  ]
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of outgoing.get(current.id) ?? []) {
      if (current.path.includes(edge.targetId)) continue
      const confidence = current.confidence * edge.confidence
      if (confidence < minimumConfidence) continue
      const node = nodes.get(edge.targetId)!
      const existing = best.get(node.id)
      if (existing && existing.confidence >= confidence) continue
      const path = [...current.path, node.id]
      const edgeKinds = [...current.edgeKinds, edge.kind]
      best.set(node.id, { node, confidence, severityScore: node.impactWeight * confidence, path, edgeKinds })
      queue.push({ id: node.id, confidence, path, edgeKinds })
    }
  }

  return {
    changedNodeId,
    impacted: [...best.values()].sort((a, b) => b.severityScore - a.severityScore || a.node.id.localeCompare(b.node.id)),
    excludedObservedSequenceEdges,
  }
}
