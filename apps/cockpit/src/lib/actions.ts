import { appendAudit } from './audit.ts'

export type ActionId =
  | 'DIAGNOSTIC_HEALTH_CHECK'
  | 'FLUSH_CONTAINER_CACHE'
  | 'CYCLE_SOCKET_CONNECTOR'
  | 'EMERGENCY_DEGRADE_SYSTEM'

export interface ActionMeta {
  id: ActionId
  label: string
  destructive: boolean
  privileged: boolean
  token?: string
}

export const ACTIONS_META: ActionMeta[] = [
  {
    id: 'DIAGNOSTIC_HEALTH_CHECK',
    label: 'Run Diagnostics Sweep',
    destructive: false,
    privileged: false,
  },
  {
    id: 'FLUSH_CONTAINER_CACHE',
    label: 'Flush Redis Queue Cache',
    destructive: false,
    privileged: true,
  },
  {
    id: 'CYCLE_SOCKET_CONNECTOR',
    label: 'Recycle Docker Socket Connector',
    destructive: false,
    privileged: true,
  },
  {
    id: 'EMERGENCY_DEGRADE_SYSTEM',
    label: 'Fail-Closed Lockdown Mode',
    destructive: true,
    privileged: true,
    token: 'CONFIRM LOCKDOWN',
  },
]

export function findAction(id: ActionId): ActionMeta {
  return ACTIONS_META.find((a) => a.id === id)!
}

// dialog state managed by component; this helper just audits
export async function auditRequested(
  actionId: ActionId,
  source: 'operator' | 'copilot-draft',
  environment?: string,
  correlationId?: string
) {
  await appendAudit({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type: 'action-requested',
    actionId,
    source,
    environment,
    correlationId,
  })
}
export async function auditConfirmed(
  actionId: ActionId,
  source: 'operator' | 'copilot-draft',
  environment?: string,
  correlationId?: string
) {
  await appendAudit({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type: 'action-confirmed',
    actionId,
    source,
    result: 'approved',
    environment,
    correlationId,
  })
  await appendAudit({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type: 'execution-marker',
    actionId,
    source,
    result: 'executed',
    environment,
    correlationId,
    metadata: { note: 'intent only; no execution' },
  })
}
export async function auditCancelled(
  actionId: ActionId,
  source: 'operator' | 'copilot-draft',
  environment?: string,
  correlationId?: string
) {
  await appendAudit({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type: 'action-cancelled',
    actionId,
    source,
    result: 'denied',
    environment,
    correlationId,
  })
}
