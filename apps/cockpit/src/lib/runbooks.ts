// Pure runbook/action-recommendation engine for MOONWITNESS COCKPIT.
// Draft-only: every recommendation's draftActions require explicit operator
// confirmation before any intent is recorded. No real execution happens here.
// The only governed real execution in the system remains DIAGNOSTIC_HEALTH_CHECK
// (read-only, desktop/Tauri only); everything else is intent-only.

import { findAction, type ActionId } from './actions.ts'

export type RunbookSeverity = 'info' | 'warning' | 'critical'

export type RunbookNodeStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE'

export interface RunbookProbe {
  status: string
  latencyMs: number
  target: string
  ok: boolean
  error?: string
  kind?: 'http' | 'tcp'
}

export interface RunbookNode {
  id: string
  name: string
  category: string
  status: RunbookNodeStatus
  latencyMs: number
  port?: number | string
  uptime?: string
  load?: string
  source?: string
  timestamp?: string
}

export interface RunbookSnapshot {
  timestamp: string
  environment: string
  targetHost: string
  source: string
  probe: RunbookProbe
  nodes: RunbookNode[]
  recentLogs?: { text: string }[]
}

export interface RunbookOptions {
  /** Maximum number of recommendations to return. */
  limit?: number
  /** When false, intent-only privileged drafts (e.g. socket recycle) are omitted. Default true. */
  includePrivilegedDrafts?: boolean
}

export interface DraftAction {
  actionId: ActionId
  label: string
  requiresConfirmation: true
  /** How the action executes once confirmed. read-only-tauri only runs in desktop/Tauri. */
  execution: 'read-only-tauri' | 'intent-only'
  note?: string
}

export interface RunbookRecommendation {
  id: string
  severity: RunbookSeverity
  title: string
  observed: string
  citations: string[]
  nextSteps: string[]
  draftActions: DraftAction[]
}

const LATENCY_ELEVATED_MS = 200

function draftAction(actionId: ActionId): DraftAction {
  const meta = findAction(actionId)
  return {
    actionId,
    label: `Draft: ${meta.label}`,
    requiresConfirmation: true,
    execution: meta.realExecution,
    note:
      meta.realExecution === 'read-only-tauri'
        ? 'Read-only diagnostic. Real execution only in desktop/Tauri; intent-only in web.'
        : 'Intent recorded only; no real execution. Requires explicit confirmation.',
  }
}

const DRAFT_DIAGNOSTIC: DraftAction = draftAction('DIAGNOSTIC_HEALTH_CHECK')
const DRAFT_CYCLE_SOCKET: DraftAction = draftAction('CYCLE_SOCKET_CONNECTOR')

function probeCitation(snapshot: RunbookSnapshot): string {
  const { probe, environment } = snapshot
  return `Probe target=${probe.target} status=${probe.status} latency=${probe.latencyMs}ms ok=${probe.ok} env=${environment} kind=${probe.kind ?? 'n/a'}`
}

function nodeCitation(n: RunbookNode): string {
  return `${n.name} [${n.id}] status=${n.status} latency=${n.latencyMs}ms category=${n.category} port=${n.port ?? 'n/a'}${n.source ? ` source=${n.source}` : ''}`
}

function isTcpUnavailableInWeb(probe: RunbookProbe, source: string): boolean {
  return (
    probe.kind === 'tcp' &&
    source === 'frontend' &&
    probe.error != null &&
    /tcp probe unavailable/i.test(probe.error)
  )
}

export function generateRunbooks(
  snapshot: RunbookSnapshot,
  options: RunbookOptions = {}
): RunbookRecommendation[] {
  const { limit, includePrivilegedDrafts = true } = options
  const { probe, nodes, source, environment, targetHost } = snapshot
  const recs: RunbookRecommendation[] = []

  const degraded = nodes.filter((n) => n.status !== 'HEALTHY')
  const offlineOrCritical = degraded.filter(
    (n) => n.status === 'OFFLINE' || n.status === 'CRITICAL'
  )
  const tcpWebUnavailable = isTcpUnavailableInWeb(probe, source)

  const baseCitations = [probeCitation(snapshot)]

  // 1. TCP probe unavailable in web frontend — explicitly NOT a service outage.
  //    The web runtime cannot perform TCP probes; treat as a verification prompt
  //    for desktop/Tauri rather than an outage.
  if (tcpWebUnavailable) {
    recs.push({
      id: 'runbook-tcp-probe-unavailable-web',
      severity: 'info',
      title: 'TCP probe unavailable in web (not a confirmed outage)',
      observed:
        `TCP probe for ${probe.target} is unavailable in the web frontend. ` +
        `This is a web/runtime probe limitation, not a confirmed outage.`,
      citations: [
        ...baseCitations,
        `source=${source} error=${probe.error}`,
        `Environment: ${environment} (${targetHost})`,
      ],
      nextSteps: [
        'Open desktop/Tauri to probe TCP reachability with full fidelity.',
        'Do not restart, flush, or degrade services based on web TCP unavailability alone.',
        'Run the diagnostics sweep in desktop/Tauri if the concern persists.',
      ],
      draftActions: [DRAFT_DIAGNOSTIC],
    })
  }

  // 2. Probe offline / unreachable — a real reachability signal (when not the
  //    web TCP limitation above, which is explicitly excluded).
  if (!tcpWebUnavailable && (probe.status === 'OFFLINE' || !probe.ok)) {
    recs.push({
      id: 'runbook-probe-offline',
      severity: 'critical',
      title: 'Probe reports cluster unreachable',
      observed:
        `Probe target ${probe.target} reports ${probe.status} (ok=${probe.ok}). ` +
        `Cluster reachability cannot be confirmed from this view.`,
      citations: baseCitations,
      nextSteps: [
        'Verify local backend/service availability before any cluster-wide action.',
        'Run diagnostics sweep to capture current health.',
        'Check dependent nodes and recent event stream for repeated failures.',
      ],
      draftActions: [DRAFT_DIAGNOSTIC],
    })
  }

  // 3. Degraded nodes. Suppressed when the web TCP limitation explains the
  //    offline states, to avoid false outage claims.
  if (degraded.length > 0 && !tcpWebUnavailable) {
    const actions: DraftAction[] = [DRAFT_DIAGNOSTIC]
    const hasNetwork = degraded.some((n) => n.category === 'network')
    if (hasNetwork && includePrivilegedDrafts) {
      actions.push(DRAFT_CYCLE_SOCKET)
    }

    recs.push({
      id: 'runbook-degraded-nodes',
      severity: offlineOrCritical.length > 0 ? 'critical' : 'warning',
      title: `${degraded.length} node(s) not healthy`,
      observed: degraded.map((n) => `${n.name} (${n.id}) is ${n.status}`).join('; ') + '.',
      citations: [...baseCitations, ...degraded.map(nodeCitation)],
      nextSteps: [
        'Prioritize non-healthy nodes for operator review.',
        'Run diagnostics sweep to capture current health.',
        'Inspect recent event stream for operator actions or repeated failures.',
      ],
      draftActions: actions,
    })
  }

  // 4. Elevated node latency.
  const highLatency = nodes.filter((n) => n.latencyMs >= LATENCY_ELEVATED_MS)
  if (highLatency.length > 0 && !tcpWebUnavailable) {
    recs.push({
      id: 'runbook-elevated-latency',
      severity: 'info',
      title: 'Elevated node latency',
      observed: highLatency.map((n) => `${n.name} latency ${n.latencyMs}ms`).join('; ') + '.',
      citations: [...baseCitations, ...highLatency.map((n) => nodeCitation(n))],
      nextSteps: [
        'Run diagnostics sweep to capture current health.',
        'Check downstream dependencies of high-latency nodes.',
      ],
      draftActions: [DRAFT_DIAGNOSTIC],
    })
  }

  // 5. No actionable conditions.
  if (recs.length === 0) {
    recs.push({
      id: 'runbook-all-healthy',
      severity: 'info',
      title: 'No actionable conditions',
      observed:
        `All ${nodes.length} node(s) healthy and probe reachable ` +
        `(${probe.status}, ${probe.latencyMs}ms).`,
      citations: [...baseCitations, ...nodes.map((n) => `${n.name} [${n.id}] status=${n.status}`)],
      nextSteps: ['Continue routine monitoring. No draft action required.'],
      draftActions: [],
    })
  }

  const dedup = Array.from(new Map(recs.map((r) => [r.id, r])).values())
  const result = limit != null ? dedup.slice(0, limit) : dedup
  return result
}
