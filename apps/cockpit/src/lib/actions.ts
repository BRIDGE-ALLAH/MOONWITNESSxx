import { appendAudit } from './audit.ts'
import { invoke, isTauri } from './tauri.ts'

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
  /** Only DIAGNOSTIC_HEALTH_CHECK may perform governed read-only real execution in desktop/Tauri. */
  realExecution: 'read-only-tauri' | 'intent-only'
}

export const ACTIONS_META: ActionMeta[] = [
  {
    id: 'DIAGNOSTIC_HEALTH_CHECK',
    label: 'Run Diagnostics Sweep',
    destructive: false,
    privileged: false,
    realExecution: 'read-only-tauri',
  },
  {
    id: 'FLUSH_CONTAINER_CACHE',
    label: 'Flush Redis Queue Cache',
    destructive: false,
    privileged: true,
    realExecution: 'intent-only',
  },
  {
    id: 'CYCLE_SOCKET_CONNECTOR',
    label: 'Recycle Docker Socket Connector',
    destructive: false,
    privileged: true,
    realExecution: 'intent-only',
  },
  {
    id: 'EMERGENCY_DEGRADE_SYSTEM',
    label: 'Fail-Closed Lockdown Mode',
    destructive: true,
    privileged: true,
    token: 'CONFIRM LOCKDOWN',
    realExecution: 'intent-only',
  },
]

export function findAction(id: ActionId): ActionMeta {
  return ACTIONS_META.find((a) => a.id === id)!
}

export interface ExecutionMarker {
  mode: 'read-only-executed' | 'intent-only'
  outcome?: 'executed' | 'error'
  command?: string
  detail?: string
  data?: Record<string, unknown>
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

export async function auditExecutionMarker(
  actionId: ActionId,
  source: 'operator' | 'copilot-draft',
  environment: string | undefined,
  correlationId: string | undefined,
  marker: ExecutionMarker
) {
  const result = marker.outcome ?? (marker.mode === 'read-only-executed' ? 'executed' : 'executed')
  await appendAudit({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    type: 'execution-marker',
    actionId,
    source,
    result,
    environment,
    correlationId,
    metadata: {
      mode: marker.mode,
      note:
        marker.mode === 'intent-only'
          ? 'intent only; no execution'
          : 'governed read-only diagnostic executed in desktop/Tauri',
      ...(marker.command ? { command: marker.command } : {}),
      ...(marker.detail ? { detail: marker.detail } : {}),
      ...(marker.data ? marker.data : {}),
    },
  })
}

export async function auditConfirmed(
  actionId: ActionId,
  source: 'operator' | 'copilot-draft',
  environment?: string,
  correlationId?: string,
  marker?: ExecutionMarker
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
  await auditExecutionMarker(
    actionId,
    source,
    environment,
    correlationId,
    marker ?? { mode: 'intent-only' }
  )
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

/** Strict allowlist: only DIAGNOSTIC_HEALTH_CHECK may invoke a real read-only Tauri command. */
export async function executeGovernedDiagnostic(
  actionId: ActionId
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  if (actionId !== 'DIAGNOSTIC_HEALTH_CHECK') {
    return { ok: false, error: 'action not in read-only execution allowlist' }
  }
  if (!isTauri()) {
    return { ok: false, error: 'read-only execution requires desktop/Tauri runtime' }
  }
  try {
    const data = await invoke<Record<string, unknown>>('run_diagnostic_health_check')
    return { ok: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
