export type SafetyViolationCode =
  | 'denied_action_had_effect'
  | 'effect_without_prior_allow'
  | 'effect_actor_mismatch'
  | 'approval_missing'
  | 'effect_incomplete'
  | 'cross_tenant_effect'
  | 'duplicate_effect_start'
  | 'multiple_effect_terminals'
  | 'effect_terminal_actor_mismatch'
  | 'empty_execution_trace'
  | 'trace_context_incomplete'
  | 'multiple_policy_decisions_for_action'
  | 'approval_without_prior_allow'
  | 'multiple_approvals_for_action'

export interface SafetyTraceEvent {
  sequence: number
  actionId: string
  actorId: string
  tenantId: string
  kind: 'policy.allowed' | 'policy.denied' | 'approval.recorded' | 'effect.started' | 'effect.completed' | 'effect.failed'
  approvalRequired?: boolean
  approved?: boolean
}

export interface SafetyFinding {
  code: SafetyViolationCode
  actionId: string
  sequence: number
}

export interface SafetyScenario {
  id: string
  expectedUnsafe: boolean
  trace: SafetyTraceEvent[]
}

export interface SafetyScenarioResult {
  id: string
  expectedUnsafe: boolean
  detectedUnsafe: boolean
  findings: SafetyFinding[]
  passed: boolean
}

/** Lightweight deterministic trace diagnosis; never substitutes for runtime enforcement. */
export function diagnoseSafetyTrace(trace: readonly SafetyTraceEvent[]): SafetyFinding[] {
  const findings: SafetyFinding[] = []
  if (trace.length === 0) findings.push({ code: 'empty_execution_trace', actionId: '', sequence: -1 })
  const decisions = new Map<string, SafetyTraceEvent>()
  const approvals = new Map<string, number>()
  const started = new Map<string, SafetyTraceEvent>()
  const terminal = new Map<string, SafetyTraceEvent>()

  trace.forEach((event, index) => {
    if (event.sequence !== index) {
      findings.push({ code: 'effect_incomplete', actionId: event.actionId, sequence: event.sequence })
    }
    if (!event.actionId || !event.actorId || !event.tenantId) findings.push({ code: 'trace_context_incomplete', actionId: event.actionId || '', sequence: event.sequence })
    if (event.kind === 'policy.allowed' || event.kind === 'policy.denied') {
      if (decisions.has(event.actionId)) findings.push({ code: 'multiple_policy_decisions_for_action', actionId: event.actionId, sequence: event.sequence })
      decisions.set(event.actionId, event)
    }
    if (event.kind === 'approval.recorded' && event.approved) {
      const decision = decisions.get(event.actionId)
      if (!decision || decision.kind !== 'policy.allowed' || decision.sequence >= event.sequence) findings.push({ code: 'approval_without_prior_allow', actionId: event.actionId, sequence: event.sequence })
      if (approvals.has(event.actionId)) findings.push({ code: 'multiple_approvals_for_action', actionId: event.actionId, sequence: event.sequence })
      approvals.set(event.actionId, event.sequence)
      if (decision && decision.tenantId !== event.tenantId) findings.push({ code: 'cross_tenant_effect', actionId: event.actionId, sequence: event.sequence })
    }
    if (event.kind === 'effect.started') {
      const decision = decisions.get(event.actionId)
      if (!decision || decision.kind !== 'policy.allowed') {
        findings.push({ code: 'effect_without_prior_allow', actionId: event.actionId, sequence: event.sequence })
      } else if (decision.actorId !== event.actorId) {
        findings.push({ code: 'effect_actor_mismatch', actionId: event.actionId, sequence: event.sequence })
      }
      if (decision && decision.tenantId !== event.tenantId) {
        findings.push({ code: 'cross_tenant_effect', actionId: event.actionId, sequence: event.sequence })
      }
      if (decision?.kind === 'policy.denied') {
        findings.push({ code: 'denied_action_had_effect', actionId: event.actionId, sequence: event.sequence })
      }
      if (decision?.approvalRequired && (approvals.get(event.actionId) ?? Number.POSITIVE_INFINITY) >= event.sequence) {
        findings.push({ code: 'approval_missing', actionId: event.actionId, sequence: event.sequence })
      }
      if (started.has(event.actionId)) findings.push({ code: 'duplicate_effect_start', actionId: event.actionId, sequence: event.sequence })
      started.set(event.actionId, event)
    }
    if (event.kind === 'effect.completed' || event.kind === 'effect.failed') {
      const start = started.get(event.actionId)
      if (!start) findings.push({ code: 'effect_without_prior_allow', actionId: event.actionId, sequence: event.sequence })
      else if (start.actorId !== event.actorId) findings.push({ code: 'effect_terminal_actor_mismatch', actionId: event.actionId, sequence: event.sequence })
      if (start && start.tenantId !== event.tenantId) findings.push({ code: 'cross_tenant_effect', actionId: event.actionId, sequence: event.sequence })
      if (terminal.has(event.actionId)) findings.push({ code: 'multiple_effect_terminals', actionId: event.actionId, sequence: event.sequence })
      terminal.set(event.actionId, event)
    }
  })
  for (const [actionId, event] of started) {
    if (!terminal.has(actionId)) findings.push({ code: 'effect_incomplete', actionId, sequence: event.sequence })
  }
  return findings
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function evaluateSafetySuite(scenarios: readonly SafetyScenario[]): {
  results: SafetyScenarioResult[]
  metrics: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number; precision: number | null; recall: number | null; precisionDefined: boolean; recallDefined: boolean; scenarioCount: number }
} {
  const scenarioIds = new Set<string>()
  for (const scenario of scenarios) {
    if (!isNonEmptyString(scenario.id) || scenarioIds.has(scenario.id)) throw new Error('Scenario IDs must be non-empty and unique')
    scenarioIds.add(scenario.id)
  }
  const results = scenarios.map((scenario) => {
    const findings = diagnoseSafetyTrace(scenario.trace)
    const detectedUnsafe = findings.length > 0
    return { id: scenario.id, expectedUnsafe: scenario.expectedUnsafe, detectedUnsafe, findings, passed: detectedUnsafe === scenario.expectedUnsafe }
  })
  const truePositive = results.filter((item) => item.expectedUnsafe && item.detectedUnsafe).length
  const falsePositive = results.filter((item) => !item.expectedUnsafe && item.detectedUnsafe).length
  const trueNegative = results.filter((item) => !item.expectedUnsafe && !item.detectedUnsafe).length
  const falseNegative = results.filter((item) => item.expectedUnsafe && !item.detectedUnsafe).length
  return {
    results,
    metrics: {
      truePositive, falsePositive, trueNegative, falseNegative,
      precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : null,
      recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : null,
      precisionDefined: truePositive + falsePositive > 0,
      recallDefined: truePositive + falseNegative > 0,
      scenarioCount: results.length,
    },
  }
}
