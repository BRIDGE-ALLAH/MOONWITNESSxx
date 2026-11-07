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
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
    for (const target of adjacency.get(current) ?? []) {
      if (distance.has(target)) continue
      if (distance.size >= maxNodes) return invalid('Traversal limit exceeded; impact result is incomplete.')
      distance.set(target, (distance.get(current) ?? 0) + 1)
      queue.push(target)
    }
  }
  // Kahn's algorithm distinguishes a real directed cycle from a longer alternate path in a DAG.
  const reachable = new Set(distance.keys())
  const indegree = new Map([...reachable].map((id) => [id, 0]))
  for (const from of reachable) for (const to of adjacency.get(from) ?? []) if (reachable.has(to)) indegree.set(to, (indegree.get(to) ?? 0) + 1)
  const zeroes = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id).sort()
  let processed = 0
  for (let cursor = 0; cursor < zeroes.length; cursor += 1) {
    const from = zeroes[cursor]
    processed += 1
    for (const to of adjacency.get(from) ?? []) {
      if (!reachable.has(to)) continue
      const next = (indegree.get(to) ?? 0) - 1
      indegree.set(to, next)
      if (next === 0) zeroes.push(to)
    }
  }
  const impacted = [...distance.entries()].filter(([id]) => !seedIds.includes(id)).map(([id, depth]) => {
    const node = nodes.get(id)!
    return { nodeId: id, label: node.label, depth, criticality: node.criticality, impactScore: Number((node.criticality / depth).toFixed(4)) }
  }).sort((a, b) => a.depth - b.depth || b.impactScore - a.impactScore || a.nodeId.localeCompare(b.nodeId))
  return { valid: true, seedIds: [...seedIds].sort(), impacted, maximumDepth: impacted.reduce((max, item) => Math.max(max, item.depth), 0), aggregateImpact: Number(impacted.reduce((sum, item) => sum + item.impactScore, 0).toFixed(4)), cycleDetected: processed < reachable.size }
}
