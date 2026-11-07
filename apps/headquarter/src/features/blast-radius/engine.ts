import type { BlastRadiusReport, ImpactGraph } from './types'

export function calculateBlastRadius(graph: ImpactGraph, seedIds: string[], maxNodes = 1000): BlastRadiusReport {
  const invalid = (reason: string): BlastRadiusReport => ({ valid: false, seedIds: [...seedIds], impacted: [], maximumDepth: 0, aggregateImpact: 0, cycleDetected: false, reason })
  if (!Number.isInteger(maxNodes) || maxNodes < 1 || seedIds.length === 0 || new Set(seedIds).size !== seedIds.length) return invalid('Seeds and traversal limit must be valid and unique.')
  const nodes = new Map<string, ImpactGraph['nodes'][number]>()
  for (const node of graph.nodes) {
    if (!node.id.trim() || !Number.isFinite(node.criticality) || node.criticality < 1 || node.criticality > 5 || nodes.has(node.id)) return invalid('Graph contains invalid or duplicate nodes.')
    nodes.set(node.id, node)
  }
  if (seedIds.some((id) => !nodes.has(id))) return invalid('At least one impact seed is missing from the graph.')
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) return invalid('Graph contains a dangling edge.')
    if (edge.relation !== 'causes') continue
    const targets = adjacency.get(edge.from) ?? []
    targets.push(edge.to)
    adjacency.set(edge.from, targets)
  }
  for (const targets of adjacency.values()) targets.sort()
  const distance = new Map<string, number>()
  const queue = [...seedIds].sort()
  for (const id of queue) distance.set(id, 0)
  let cycleDetected = false
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
    for (const target of adjacency.get(current) ?? []) {
      const candidate = (distance.get(current) ?? 0) + 1
      const known = distance.get(target)
      if (known === undefined) {
        if (distance.size >= maxNodes) return invalid('Traversal limit exceeded; impact result is incomplete.')
        distance.set(target, candidate)
        queue.push(target)
      } else if (candidate >= known) cycleDetected = true
    }
  }
  const impacted = [...distance.entries()].filter(([id]) => !seedIds.includes(id)).map(([id, depth]) => {
    const node = nodes.get(id)!
    return { nodeId: id, label: node.label, depth, criticality: node.criticality, impactScore: Number((node.criticality / depth).toFixed(4)) }
  }).sort((a, b) => a.depth - b.depth || b.impactScore - a.impactScore || a.nodeId.localeCompare(b.nodeId))
  return { valid: true, seedIds: [...seedIds].sort(), impacted, maximumDepth: impacted.reduce((max, item) => Math.max(max, item.depth), 0), aggregateImpact: Number(impacted.reduce((sum, item) => sum + item.impactScore, 0).toFixed(4)), cycleDetected }
}
