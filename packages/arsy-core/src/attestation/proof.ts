import { createHash } from 'node:crypto'

export type ExecutionEventKind =
  | 'policy.allowed'
  | 'policy.denied'
  | 'approval.recorded'
  | 'effect.started'
  | 'effect.completed'
  | 'effect.failed'

export interface ExecutionEvent {
  id: string
  sequence: number
  kind: ExecutionEventKind
  actionId: string
  actorId: string
  tenantId: string
  occurredAt: string
  payloadHash?: string
  approvalRequired?: boolean
  approved?: boolean
}

export interface ExecutionContract {
  id: string
  version: string
  actorId: string
  tenantId: string
}

export interface ExecutionAttestation {
  executionId: string
  contractVersion: string
  traceDigest: string
  eventCount: number
  issuedAt: string
  assurance: 'trace-consistent'
}

export class ExecutionProofError extends Error {
  constructor(readonly violations: string[]) {
    super(`Execution proof rejected: ${violations.join(', ')}`)
    this.name = 'ExecutionProofError'
  }
}

/** Validate the observed trace before issuing a digest-bound execution attestation. */
export function validateExecutionTrace(
  contract: ExecutionContract,
  events: readonly ExecutionEvent[],
): string[] {
  const violations: string[] = []
  const ids = new Set<string>()
  const decisions = new Map<string, ExecutionEvent>()
  const approvals = new Set<string>()
  const started = new Set<string>()
  const terminal = new Set<string>()
  const approvalSequence = new Map<string, number>()
  let previousTimestamp = Number.NEGATIVE_INFINITY

  events.forEach((event, index) => {
    if (event.sequence !== index) violations.push('trace_sequence_not_contiguous')
    if (!event.id || ids.has(event.id)) violations.push('trace_event_id_duplicate_or_empty')
    ids.add(event.id)
    if (!event.actionId || !event.tenantId || !event.actorId) violations.push('trace_context_incomplete')
    const timestamp = Date.parse(event.occurredAt)
    if (Number.isNaN(timestamp)) violations.push('trace_timestamp_invalid')
    else if (timestamp < previousTimestamp) violations.push('trace_time_moved_backwards')
    else previousTimestamp = timestamp
    if (event.tenantId !== contract.tenantId) violations.push('tenant_scope_changed')
    if (event.kind === 'policy.allowed' || event.kind === 'policy.denied') {
      if (event.actorId !== contract.actorId) violations.push('policy_actor_differs_from_contract_actor')
      if (decisions.has(event.actionId)) violations.push('multiple_policy_decisions_for_action')
      decisions.set(event.actionId, event)
    }
    if (event.kind === 'approval.recorded' && event.approved === true) {
      approvals.add(event.actionId)
      approvalSequence.set(event.actionId, event.sequence)
    }
    if (event.kind === 'effect.started') {
      const decision = decisions.get(event.actionId)
      if (!decision || decision.kind !== 'policy.allowed' || decision.sequence >= event.sequence) violations.push('effect_without_prior_allow')
      if (decision && decision.actorId !== event.actorId) violations.push('effect_actor_differs_from_authorized_actor')
      if (decision?.approvalRequired && (approvalSequence.get(event.actionId) ?? Number.POSITIVE_INFINITY) >= event.sequence) {
        violations.push('approval_missing_before_effect')
      }
      if (started.has(event.actionId)) violations.push('duplicate_effect_start')
      started.add(event.actionId)
    }
    if (event.kind === 'effect.completed' || event.kind === 'effect.failed') {
      if (!started.has(event.actionId)) violations.push('effect_terminal_without_start')
      if (terminal.has(event.actionId)) violations.push('multiple_effect_terminals')
      terminal.add(event.actionId)
    }
  })

  if (contract.actorId.length === 0 || contract.tenantId.length === 0) violations.push('execution_contract_context_missing')
  for (const [actionId, decision] of decisions) {
    if (decision.kind === 'policy.denied' && started.has(actionId)) violations.push('denied_action_had_effect')
    if (decision.kind === 'policy.allowed' && decision.approvalRequired && !approvals.has(actionId)) {
      violations.push('approval_missing_before_or_during_execution')
    }
  }
  for (const actionId of started) if (!terminal.has(actionId)) violations.push('effect_missing_terminal_event')
  return [...new Set(violations)]
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

export function createExecutionAttestation(
  contract: ExecutionContract,
  events: readonly ExecutionEvent[],
  issuedAt = new Date().toISOString(),
): ExecutionAttestation {
  const violations = validateExecutionTrace(contract, events)
  if (violations.length) throw new ExecutionProofError(violations)
  if (!contract.id || !contract.version || Number.isNaN(Date.parse(issuedAt))) {
    throw new Error('Valid execution contract id, version and issuedAt are required')
  }
  const traceDigest = createHash('sha256').update(canonical(events)).digest('hex')
  return {
    executionId: contract.id,
    contractVersion: contract.version,
    traceDigest,
    eventCount: events.length,
    issuedAt,
    assurance: 'trace-consistent',
  }
}
