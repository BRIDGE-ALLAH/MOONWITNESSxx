// Pure snapshot diff helpers for cockpit node telemetry.
// Thresholds are documented here and in tests.

export const LATENCY_SIGNIFICANT_ABS_MS = 100
export const LATENCY_SIGNIFICANT_REL = 0.5
export const LATENCY_SIGNIFICANT_MIN_ABS_MS = 50

export interface DiffableNode {
  id: string
  name?: string
  status: string
  source: string
  latencyMs: number
}

export interface NodeChange {
  nodeId: string
  name?: string
  kind: 'status' | 'source' | 'latency'
  from: string | number
  to: string | number
}

export interface SnapshotDiff {
  changes: NodeChange[]
}

export function isLatencySignificant(prevMs: number, currMs: number): boolean {
  const delta = Math.abs(currMs - prevMs)
  if (delta >= LATENCY_SIGNIFICANT_ABS_MS) return true
  if (
    delta >= LATENCY_SIGNIFICANT_MIN_ABS_MS &&
    prevMs > 0 &&
    delta / prevMs >= LATENCY_SIGNIFICANT_REL
  )
    return true
  return false
}

export function computeSnapshotDiff(
  prev: DiffableNode[] | null | undefined,
  curr: DiffableNode[] | null | undefined
): SnapshotDiff {
  const changes: NodeChange[] = []
  if (!prev || !curr) return { changes }
  const prevMap = new Map(prev.map((n) => [n.id, n]))
  for (const c of curr) {
    const p = prevMap.get(c.id)
    if (!p) continue
    if (p.status !== c.status) {
      changes.push({ nodeId: c.id, name: c.name, kind: 'status', from: p.status, to: c.status })
    }
    if (p.source !== c.source) {
      changes.push({ nodeId: c.id, name: c.name, kind: 'source', from: p.source, to: c.source })
    }
    if (isLatencySignificant(p.latencyMs, c.latencyMs)) {
      changes.push({
        nodeId: c.id,
        name: c.name,
        kind: 'latency',
        from: p.latencyMs,
        to: c.latencyMs,
      })
    }
  }
  return { changes }
}
