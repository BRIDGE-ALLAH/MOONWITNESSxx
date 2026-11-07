export type DependencyKind = 'source' | 'evidence' | 'claim' | 'memory' | 'summary' | 'cache' | 'decision' | 'action'
export type RevocationState = 'active' | 'revoked' | 'frozen'
export interface DependencyNode { id: string; kind: DependencyKind; tenantId: string }
export interface DependencyEdge { upstreamId: string; downstreamId: string }
export interface RevocationRequest { revocationId: string; sourceId: string; actorId: string; reason: string; occurredAt: string }
export interface RevocationImpact {
  revocationId: string; sourceId: string; affectedNodeIds: string[]; revokedClaimIds: string[]
  invalidatedMemoryIds: string[]; invalidatedSummaryIds: string[]; invalidatedCacheIds: string[]
  frozenDecisionIds: string[]; frozenActionIds: string[]; propagationPaths: Record<string, string[]>
}

/** Dependency-aware revocation; production must persist graph and propagation receipts transactionally. */
export class RevocationPropagationGraph {
  private readonly nodes = new Map<string, DependencyNode>()
  private readonly outgoing = new Map<string, Set<string>>()
  private readonly states = new Map<string, RevocationState>()
  private readonly revocations = new Map<string, RevocationImpact>()

  registerNode(node: DependencyNode): void {
    if (!node.id.trim() || !node.tenantId.trim()) throw new Error('node id and tenantId are required')
    const existing = this.nodes.get(node.id)
    if (existing && (existing.kind !== node.kind || existing.tenantId !== node.tenantId)) throw new Error('dependency node identity cannot be redefined')
    this.nodes.set(node.id, { ...node })
    if (!this.states.has(node.id)) this.states.set(node.id, 'active')
  }
  addDependency(edge: DependencyEdge): void {
    if (edge.upstreamId === edge.downstreamId) throw new Error('self-dependency is not allowed')
    const upstream = this.nodes.get(edge.upstreamId), downstream = this.nodes.get(edge.downstreamId)
    if (!upstream || !downstream) throw new Error('dependency edge references an unknown node')
    if (upstream.tenantId !== downstream.tenantId) throw new Error('cross-tenant dependency edges are forbidden')
    const targets = this.outgoing.get(edge.upstreamId) ?? new Set<string>()
    targets.add(edge.downstreamId); this.outgoing.set(edge.upstreamId, targets)
  }
  revoke(request: RevocationRequest): RevocationImpact {
    if (!request.revocationId.trim() || !request.actorId.trim() || !request.reason.trim()) throw new Error('revocationId, actorId and reason are required')
    if (!Number.isFinite(Date.parse(request.occurredAt))) throw new Error('occurredAt must be a valid timestamp')
    if (!this.nodes.has(request.sourceId)) throw new Error('unknown revocation source: ' + request.sourceId)
    const prior = this.revocations.get(request.revocationId)
    if (prior) {
      if (prior.sourceId !== request.sourceId) throw new Error('revocation id collision')
      return structuredClone(prior)
    }
    const tenantId = this.nodes.get(request.sourceId)!.tenantId
    const paths: Record<string, string[]> = { [request.sourceId]: [request.sourceId] }
    const queue = [request.sourceId], visited = new Set(queue)
    while (queue.length) {
      const current = queue.shift()!
      for (const next of this.outgoing.get(current) ?? []) {
        if (visited.has(next)) continue
        if (this.nodes.get(next)!.tenantId !== tenantId) throw new Error('cross-tenant propagation blocked')
        visited.add(next); paths[next] = [...paths[current], next]; queue.push(next)
      }
    }
    for (const id of visited) {
      const kind = this.nodes.get(id)!.kind
      this.states.set(id, kind === 'decision' || kind === 'action' ? 'frozen' : 'revoked')
    }
    const affectedNodeIds = [...visited].filter((id) => id !== request.sourceId).sort()
    const byKind = (kind: DependencyKind) => affectedNodeIds.filter((id) => this.nodes.get(id)!.kind === kind)
    const impact: RevocationImpact = {
      revocationId: request.revocationId, sourceId: request.sourceId, affectedNodeIds,
      revokedClaimIds: byKind('claim'), invalidatedMemoryIds: byKind('memory'),
      invalidatedSummaryIds: byKind('summary'), invalidatedCacheIds: byKind('cache'),
      frozenDecisionIds: byKind('decision'), frozenActionIds: byKind('action'),
      propagationPaths: Object.fromEntries(affectedNodeIds.map((id) => [id, paths[id]]))
    }
    this.revocations.set(request.revocationId, structuredClone(impact))
    return impact
  }
  stateOf(nodeId: string): RevocationState | 'unknown' { return this.states.get(nodeId) ?? 'unknown' }
  canServe(nodeId: string): boolean { return this.states.get(nodeId) === 'active' }
  /** Rebuild requires fresh evidence and actor; descendants stay revoked until separately rebuilt. */
  rebuildNode(nodeId: string, evidenceIds: readonly string[], actorId: string): void {
    if (!this.nodes.has(nodeId)) throw new Error('unknown dependency node: ' + nodeId)
    if (!actorId.trim() || evidenceIds.length === 0 || evidenceIds.some((id) => !id.trim())) throw new Error('rebuild requires an actor and fresh evidence references')
    this.states.set(nodeId, 'active')
  }
}
