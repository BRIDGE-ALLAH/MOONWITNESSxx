export type ReviewSeverity = 'critical' | 'high' | 'normal'
export interface ReviewQueueItem {
  id: string; severity: ReviewSeverity; createdAt: string
  sourceCompromised?: boolean; blocksAction?: boolean
}
export interface RoutedReviewItem {
  item: ReviewQueueItem; priority: ReviewSeverity; ageMinutes: number; reasonCodes: string[]
}

/** Deterministic human-attention ordering; never approves or executes decisions. */
export function routeReviewQueue(items: readonly ReviewQueueItem[], now = new Date().toISOString()): RoutedReviewItem[] {
  const nowMs = Date.parse(now)
  if (Number.isNaN(nowMs)) throw new Error('now must be a valid date')
  const ids = new Set<string>()
  const routed = items.map((item) => {
    if (!item.id.trim() || ids.has(item.id)) throw new Error('Duplicate or empty review item id: ' + item.id)
    ids.add(item.id)
    if (!['critical', 'high', 'normal'].includes(item.severity)) throw new Error('Invalid severity for review item: ' + item.id)
    const createdMs = Date.parse(item.createdAt)
    if (Number.isNaN(createdMs)) throw new Error('Invalid createdAt for review item: ' + item.id)
    const ageMinutes = Math.max(0, Math.floor((nowMs - createdMs) / 60000))
    const reasonCodes: string[] = []
    let priority = item.severity
    if (item.sourceCompromised) { priority = 'critical'; reasonCodes.push('upstream_source_compromised') }
    if (item.blocksAction) reasonCodes.push('pending_action_blocked')
    if (ageMinutes >= 1440) reasonCodes.push('review_older_than_24h')
    return { item, priority, ageMinutes, reasonCodes }
  })
  const rank: Record<ReviewSeverity, number> = { critical: 0, high: 1, normal: 2 }
  return routed.sort((a, b) => rank[a.priority] - rank[b.priority]
    || Number(Boolean(b.item.blocksAction)) - Number(Boolean(a.item.blocksAction))
    || b.ageMinutes - a.ageMinutes || a.item.id.localeCompare(b.item.id))
}
