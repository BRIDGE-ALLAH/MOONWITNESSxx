export type SafetyViolationCode =
  | 'denied_action_had_effect'
  | 'effect_without_prior_allow'
  | 'effect_actor_mismatch'
  | 'approval_missing'
  | 'effect_incomplete'
  | 'cross_tenant_effect'

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
  const decisions = new Map<string, SafetyTraceEvent>()
  const approvals = new Set<string>()
  const started = new Map<string, SafetyTraceEvent>()
  const terminal = new Set<string>()

  trace.forEach((event, index) => {
    if (event.sequence !== index) {
      findings.push({ code: 'effect_incomplete', actionId: event.actionId, sequence: event.sequence })
    }
    if (event.kind === 'approval.recorded' && event.approved) approvals.add(event.actionId)
    if (event.kind === 'policy.allowed' || event.kind === 'policy.denied') decisions.set(event.actionId, event)
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
      if (decision?.approvalRequired && !approvals.has(event.actionId)) {
        findings.push({ code: 'approval_missing', actionId: event.actionId, sequence: event.sequence })
      }
      started.set(event.actionId, event)
    }
    if (event.kind === 'effect.completed' || event.kind === 'effect.failed') terminal.add(event.actionId)
  })
  for (const [actionId, event] of started) {
    if (!terminal.has(actionId)) findings.push({ code: 'effect_incomplete', actionId, sequence: event.sequence })
  }
  return findings
}

export function evaluateSafetySuite(scenarios: readonly SafetyScenario[]): {
  results: SafetyScenarioResult[]
  metrics: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number; precision: number; recall: number }
} {
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
      precision: truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 1,
      recall: truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 1,
    },
  }
}
