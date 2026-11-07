export type SideEffectClass = 'pure' | 'idempotent' | 'compensatable' | 'irreversible'
export type ActionRisk = 'low' | 'medium' | 'high' | 'critical'

export interface ReplayCapsule {
  id: string
  createdAt: string
  actorId: string
  tenantId: string
  registryFingerprint: string
  policyVersion: string
  evidenceIds: string[]
  input: unknown
  toolVersions: Record<string, string>
  trace: ReplayTraceEvent[]
}

export interface ReplayTraceEvent {
  id: string
  name: string
  sequence: number
  sideEffect: SideEffectClass
  inputHash: string
  outputHash?: string
  occurredAt: string
}

export interface ActionProposal {
  action: string
  risk: ActionRisk
  sideEffect: SideEffectClass
  actorAuthorized: boolean
  evidenceFresh: boolean
  approvalRequired?: boolean
  approved?: boolean
}

export interface ActionGateResult {
  allowed: boolean
  requiresApproval: boolean
  reasons: string[]
}

export class ReplaySideEffectError extends Error {
  constructor(readonly action: string, readonly sideEffect: SideEffectClass) {
    super(`Replay blocked ${sideEffect} side effect for action "${action}"`)
    this.name = 'ReplaySideEffectError'
  }
}

/** Deny-by-default action gate. Approval never overrides missing authorization. */
export function evaluateAction(proposal: ActionProposal): ActionGateResult {
  const reasons: string[] = []
  if (!proposal.actorAuthorized) reasons.push('Actor is not authorized')
  if (!proposal.evidenceFresh) reasons.push('Evidence is stale or unverified')
  if (proposal.sideEffect === 'irreversible') reasons.push('Irreversible actions require an explicit live-execution boundary')
  const requiresApproval =
    proposal.approvalRequired === true ||
    proposal.risk === 'high' ||
    proposal.risk === 'critical' ||
    proposal.sideEffect === 'compensatable'
  if (requiresApproval && proposal.approved !== true) reasons.push('Human approval is required')
  return { allowed: reasons.length === 0, requiresApproval, reasons }
}

/** Replay can run pure computations only; all external effects must be replaced by recorded fixtures. */
export function assertReplaySafe(event: ReplayTraceEvent): void {
  if (event.sideEffect !== 'pure') throw new ReplaySideEffectError(event.name, event.sideEffect)
}

export function createReplayCapsule(input: Omit<ReplayCapsule, 'trace'> & { trace?: ReplayTraceEvent[] }): ReplayCapsule {
  const trace = [...(input.trace ?? [])].sort((a, b) => a.sequence - b.sequence)
  const seenIds = new Set<string>()
  for (let index = 0; index < trace.length; index += 1) {
    if (trace[index].sequence !== index) throw new Error('Replay trace sequence must be contiguous from zero')
    if (seenIds.has(trace[index].id)) throw new Error('Replay trace event ids must be unique')
    seenIds.add(trace[index].id)
  }
  return { ...input, trace }
}
