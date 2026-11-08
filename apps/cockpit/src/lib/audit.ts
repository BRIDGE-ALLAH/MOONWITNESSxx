import { isTauri, invoke } from './tauri.ts'

export type AuditEventType =
  | 'action-requested'
  | 'action-confirmed'
  | 'action-cancelled'
  | 'execution-marker'
  | 'copilot-draft'
  | 'provider-switch'
  | 'telemetry-degraded'

export interface AuditEvent {
  id: string
  ts: string
  type: AuditEventType
  actionId?: string
  source?: 'operator' | 'copilot-draft' | 'system'
  actor?: string
  result?: 'approved' | 'denied' | 'executed' | 'error'
  environment?: string
  correlationId?: string
  metadata?: Record<string, unknown>
}

const KEY = 'cockpit-audit-v1'

export interface AuditFilters {
  type?: AuditEventType
  actionId?: string
  source?: string
  environment?: string
  result?: string
  correlationId?: string
  query?: string
}

export function filterAuditEvents(events: AuditEvent[], filters: AuditFilters): AuditEvent[] {
  const { type, actionId, source, environment, result, correlationId, query } = filters
  const q = query ? query.toLowerCase() : null
  return events.filter((e) => {
    if (type && e.type !== type) return false
    if (actionId && e.actionId !== actionId) return false
    if (source && e.source !== source) return false
    if (environment && e.environment !== environment) return false
    if (result && e.result !== result) return false
    if (correlationId && e.correlationId !== correlationId) return false
    if (q) {
      const haystack = [
        e.id,
        e.ts,
        e.type,
        e.actionId ?? '',
        e.source ?? '',
        e.actor ?? '',
        e.result ?? '',
        e.environment ?? '',
        e.correlationId ?? '',
        ...(e.metadata ? Object.values(e.metadata) : []),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function exportAuditJsonl(events: AuditEvent[]): string {
  const lines = events.map((e) => JSON.stringify(e))
  return lines.length ? lines.join('\n') + '\n' : ''
}

export async function appendAudit(event: AuditEvent): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('audit_append', { event })
      return
    } catch {}
  }
  try {
    const raw = localStorage.getItem(KEY)
    const arr: AuditEvent[] = raw ? JSON.parse(raw) : []
    arr.push(event)
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-1000)))
  } catch {}
}

export async function readAudit(limit = 500): Promise<AuditEvent[]> {
  if (isTauri()) {
    try {
      return await invoke<AuditEvent[]>('audit_read', { limit })
    } catch {}
  }
  try {
    const raw = localStorage.getItem(KEY)
    const arr: AuditEvent[] = raw ? JSON.parse(raw) : []
    return arr.slice(-limit).reverse()
  } catch {
    return []
  }
}
