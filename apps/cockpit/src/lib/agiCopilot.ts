export type NodeStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE'

export interface SnapshotNode {
  id: string
  name: string
  category: string
  port?: number | string
  status: NodeStatus
  latencyMs: number
  uptime?: string
  load?: string
}

export interface SnapshotLog {
  text: string
}

export interface CockpitSnapshot {
  timestamp: string
  environment: string
  targetHost: string
  probe: {
    status: 'HEALTHY' | 'OFFLINE' | 'WARNING' | 'CRITICAL'
    latencyMs: number
    target: string
    ok?: boolean
    error?: string
  }
  nodes: SnapshotNode[]
  recentLogs: SnapshotLog[]
  source?: 'backend' | 'frontend'
}

export type Confidence = 'High' | 'Medium' | 'Low'

export interface SuggestedAction {
  actionId:
    | 'DIAGNOSTIC_HEALTH_CHECK'
    | 'FLUSH_CONTAINER_CACHE'
    | 'CYCLE_SOCKET_CONNECTOR'
    | 'EMERGENCY_DEGRADE_SYSTEM'
  label: string
  reason: string
  requiresConfirmation: true
}

export interface CopilotResponse {
  answer: string
  confidence: Confidence
  citations: string[]
  suggestedActions: SuggestedAction[]
  provider: 'local-heuristic' | 'remote-llm'
  model?: string
  disclaimer: string
  // Set by the provider layer when a remote request fell back to local.
  // Absent when the response came directly from the selected provider.
  fallbackReason?: string
}

export interface CopilotProvider {
  id: string
  analyze: (snapshot: CockpitSnapshot, question: string) => CopilotResponse
}

const DISCLAIMER =
  'AI assistive output only. Verify telemetry and obtain human approval before taking operator actions.'

function normalize(text: string): string {
  return text.toLowerCase().trim()
}

function nodeCitation(node: SnapshotNode): string {
  return `${node.name} [${node.id}] status=${node.status} latency=${node.latencyMs}ms uptime=${node.uptime ?? 'n/a'} load=${node.load ?? 'n/a'} port=${node.port ?? 'n/a'}`
}

function probeCitation(snapshot: CockpitSnapshot): string {
  return `Probe target=${snapshot.probe.target} status=${snapshot.probe.status} latency=${snapshot.probe.latencyMs}ms env=${snapshot.environment}`
}

function summarizeNodes(snapshot: CockpitSnapshot) {
  const counts = { HEALTHY: 0, WARNING: 0, CRITICAL: 0, OFFLINE: 0 }
  for (const n of snapshot.nodes) counts[n.status]++
  return counts
}

function buildSummary(snapshot: CockpitSnapshot): CopilotResponse {
  const counts = summarizeNodes(snapshot)
  const degraded = snapshot.nodes.filter((n) => n.status !== 'HEALTHY')
  const citations = [probeCitation(snapshot), ...snapshot.nodes.map(nodeCitation)]
  const answerParts = [
    `Environment ${snapshot.environment} targeting ${snapshot.targetHost} at ${snapshot.timestamp}.`,
    `Probe reports ${snapshot.probe.status} (${snapshot.probe.latencyMs}ms).`,
    `Node summary: ${counts.HEALTHY} healthy, ${counts.WARNING} warning, ${counts.CRITICAL} critical, ${counts.OFFLINE} offline.`,
  ]
  if (degraded.length > 0) {
    answerParts.push(`Attention: ${degraded.map((n) => `${n.name} (${n.status})`).join('; ')}.`)
  } else {
    answerParts.push('No degraded nodes detected in the current snapshot.')
  }
  return {
    answer: answerParts.join(' '),
    confidence: snapshot.nodes.length > 0 ? 'High' : 'Low',
    citations,
    suggestedActions:
      degraded.length > 0
        ? [
            {
              actionId: 'DIAGNOSTIC_HEALTH_CHECK',
              label: 'Draft: Run diagnostics sweep',
              reason: 'Degraded nodes present; collect fresh diagnostics before operator action.',
              requiresConfirmation: true,
            },
          ]
        : [],
    provider: 'local-heuristic',
    disclaimer: DISCLAIMER,
  }
}

function buildDegradedExplanation(snapshot: CockpitSnapshot): CopilotResponse {
  const degraded = snapshot.nodes.filter((n) => n.status !== 'HEALTHY')
  const citations = [probeCitation(snapshot), ...degraded.map(nodeCitation)]
  if (degraded.length === 0) {
    return {
      answer:
        'No degraded or offline nodes are present in the current snapshot. The probe and node statuses indicate normal operation for the visible cluster matrix.',
      confidence: 'High',
      citations: [probeCitation(snapshot), ...snapshot.nodes.map(nodeCitation)],
      suggestedActions: [],
      provider: 'local-heuristic',
      disclaimer: DISCLAIMER,
    }
  }
  const details = degraded.map((n) => {
    const notes: string[] = [`${n.name} is ${n.status}`]
    if (n.status === 'OFFLINE') notes.push('service unreachable from the current view')
    if (n.status === 'WARNING') notes.push('service responding but outside a healthy baseline')
    if (n.status === 'CRITICAL') notes.push('service requires immediate operator review')
    notes.push(`latency ${n.latencyMs}ms`, `uptime ${n.uptime ?? 'n/a'}`, `load ${n.load ?? 'n/a'}`)
    return notes.join(', ') + '.'
  })
  const suggested: SuggestedAction[] = [
    {
      actionId: 'DIAGNOSTIC_HEALTH_CHECK',
      label: 'Draft: Run diagnostics sweep',
      reason: 'Validate degraded node state with a controlled diagnostic pass.',
      requiresConfirmation: true,
    },
  ]
  if (degraded.some((n) => n.category === 'network')) {
    suggested.push({
      actionId: 'CYCLE_SOCKET_CONNECTOR',
      label: 'Draft: Recycle Docker socket connector',
      reason: 'Network-category node degraded; connector recycle may help if approved.',
      requiresConfirmation: true,
    })
  }
  return {
    answer: `Degraded node analysis: ${details.join(' ')}`,
    confidence: 'High',
    citations,
    suggestedActions: suggested,
    provider: 'local-heuristic',
    disclaimer: DISCLAIMER,
  }
}

function buildDiagnostics(snapshot: CockpitSnapshot): CopilotResponse {
  const degraded = snapshot.nodes.filter((n) => n.status !== 'HEALTHY')
  const steps = [
    'Confirm environment target and probe reachability.',
    'Run a diagnostics sweep to capture current service health.',
    'Inspect recent event stream entries for operator actions or repeated failures.',
    'Check highest-latency or non-healthy nodes first, then verify downstream dependencies.',
  ]
  if (snapshot.probe.status === 'OFFLINE') {
    steps.unshift(
      'Probe is offline: verify local backend availability before cluster-wide actions.'
    )
  }
  if (degraded.length > 0) {
    steps.push(`Prioritize: ${degraded.map((n) => `${n.name} (${n.status})`).join(', ')}.`)
  }
  return {
    answer: `Suggested diagnostics (draft): ${steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}`,
    confidence: snapshot.probe.status === 'OFFLINE' ? 'High' : 'Medium',
    citations: [
      probeCitation(snapshot),
      ...snapshot.nodes.map(nodeCitation),
      ...snapshot.recentLogs.slice(0, 5).map((l, i) => `Recent log #${i + 1}: ${l.text}`),
    ],
    suggestedActions: [
      {
        actionId: 'DIAGNOSTIC_HEALTH_CHECK',
        label: 'Draft: Run diagnostics sweep',
        reason: 'Start with a read-oriented diagnostic action.',
        requiresConfirmation: true,
      },
    ],
    provider: 'local-heuristic',
    disclaimer: DISCLAIMER,
  }
}

function buildActionDraft(snapshot: CockpitSnapshot, q: string): CopilotResponse {
  const wantsLockdown = /lockdown|emergency|degrade|fail.?closed/.test(q)
  const wantsCache = /cache|redis|queue|flush/.test(q)
  const wantsSocket = /socket|connector|docker|cycle|recycle/.test(q)
  const wantsDiag = /diagnostic|health|sweep|check/.test(q)

  const actions: SuggestedAction[] = []
  if (wantsDiag || actions.length === 0) {
    actions.push({
      actionId: 'DIAGNOSTIC_HEALTH_CHECK',
      label: 'Draft: Run diagnostics sweep',
      reason: 'Low-risk diagnostic dispatch; still requires operator confirmation.',
      requiresConfirmation: true,
    })
  }
  if (wantsCache) {
    actions.push({
      actionId: 'FLUSH_CONTAINER_CACHE',
      label: 'Draft: Flush Redis queue cache',
      reason: 'Cache flush can affect queued work; confirm impact before dispatch.',
      requiresConfirmation: true,
    })
  }
  if (wantsSocket) {
    actions.push({
      actionId: 'CYCLE_SOCKET_CONNECTOR',
      label: 'Draft: Recycle Docker socket connector',
      reason: 'Connector recycle can interrupt integrations; confirm maintenance window.',
      requiresConfirmation: true,
    })
  }
  if (wantsLockdown) {
    actions.push({
      actionId: 'EMERGENCY_DEGRADE_SYSTEM',
      label: 'Draft: Fail-closed lockdown mode',
      reason:
        'Destructive/privileged action. Use only with explicit operator authorization and incident context.',
      requiresConfirmation: true,
    })
  }

  const unique = Array.from(new Map(actions.map((a) => [a.actionId, a])).values())
  return {
    answer:
      'Action draft prepared from current telemetry. No action has been executed. Review the draft, verify citations, and confirm explicitly before dispatch.',
    confidence: wantsLockdown ? 'Medium' : 'Medium',
    citations: [probeCitation(snapshot), ...snapshot.nodes.map(nodeCitation)],
    suggestedActions: unique,
    provider: 'local-heuristic',
    disclaimer: DISCLAIMER,
  }
}

export function analyzeCopilot(snapshot: CockpitSnapshot, question: string): CopilotResponse {
  const q = normalize(question)
  if (!q) {
    return {
      answer: 'Enter a question about the current cockpit state, or choose a quick prompt.',
      confidence: 'Low',
      citations: [probeCitation(snapshot)],
      suggestedActions: [],
      provider: 'local-heuristic',
      disclaimer: DISCLAIMER,
    }
  }
  if (/degrad|offline|warning|critical|unhealthy|down|fail/.test(q)) {
    return buildDegradedExplanation(snapshot)
  }
  if (/summar|status|state|overview|what('?s| is) happening/.test(q)) {
    return buildSummary(snapshot)
  }
  if (/diagnos|next step|suggest|investig|troubleshoot|check/.test(q)) {
    return buildDiagnostics(snapshot)
  }
  if (/action|dispatch|flush|cache|socket|recycle|lockdown|emergency/.test(q)) {
    return buildActionDraft(snapshot, q)
  }
  return {
    ...buildSummary(snapshot),
    answer: `Interpreted as a general status question. ${buildSummary(snapshot).answer} For a focused answer, ask about degraded nodes, diagnostics, or action drafting.`,
    confidence: 'Medium',
  }
}

export const localCopilotProvider: CopilotProvider = {
  id: 'local-heuristic',
  analyze: analyzeCopilot,
}
