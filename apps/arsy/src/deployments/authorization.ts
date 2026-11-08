import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'
import type { ArsyOperatorPrincipal } from '../auth/operator-token.ts'

export type DeploymentAction = 'deploy' | 'stop' | 'restart' | 'rollback'
export type ApprovalState = 'not_required' | 'approved' | 'pending' | 'rejected' | 'unavailable'
export type DeploymentAuthorizationReason =
  | 'AUTHENTICATION_REQUIRED'
  | 'OWNER_SCOPE_DENIED'
  | 'INVALID_ACTION'
  | 'POLICY_UNAVAILABLE'
  | 'POLICY_TIMEOUT'
  | 'POLICY_DENIED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_UNAVAILABLE'
  | 'POLICY_CONTRACT_INVALID'

export type OperatorPrincipal = ArsyOperatorPrincipal

export interface DeploymentAuthorizationInput {
  principal: OperatorPrincipal | null
  operationId: string
  ownerId: string
  targetHostId: string
  action: string
  approvalReference?: string | null
}

export interface DeploymentPolicyDecision {
  effect: 'allow' | 'deny'
  reasonCode: string
  policyVersion: string
  approvalRequired: boolean
  approvalState: ApprovalState
  approvalReference?: string | null
  evidence?: Record<string, unknown>
}

export interface DeploymentPolicyProvider {
  evaluate(input: {
    actorId: string
    ownerId: string
    targetHostId: string
    action: DeploymentAction
    approvalReference: string | null
    signal: AbortSignal
  }): Promise<DeploymentPolicyDecision>
}

export interface DeploymentAuthorizationResult {
  allowed: boolean
  reasonCode: DeploymentAuthorizationReason | string
  actorId: string | null
  policyVersion: string | null
  approvalReference: string | null
}

export interface DeploymentAuthorizationRecordInput {
  operationId: string
  ownerId: string
  actorId: string
  targetHostId: string
  action: string
  effect: 'allow' | 'deny'
  reasonCode: string
  policyVersion: string | null
  approvalReference: string | null
  evidence: Record<string, unknown>
}

type QueryResult<T> = { rows: T[] }

class PolicyTimeoutError extends Error {
  constructor() {
    super('Deployment policy evaluation timed out')
    this.name = 'PolicyTimeoutError'
  }
}

function requiredText(value: string, field: string, max: number): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new TypeError(`${field} must contain 1-${max} characters`)
  return normalized
}

function assertSafeEvidence(value: unknown, depth = 0): void {
  if (depth > 8) throw new TypeError('Authorization evidence exceeds the maximum nesting depth')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Authorization evidence contains a non-finite number')
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) assertSafeEvidence(item, depth + 1)
    return
  }
  if (!value || typeof value !== 'object') throw new TypeError('Authorization evidence must be JSON-compatible')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Authorization evidence must use plain JSON objects')
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/(password|token|api.?key|private.?key|credential|certificate|secret.?value|environment|authorization|^env$)/i.test(key)) {
      throw new TypeError('Authorization evidence must not contain secret-bearing fields')
    }
    assertSafeEvidence(item, depth + 1)
  }
}

function safeEvidence(value: Record<string, unknown> | undefined): string {
  const evidence = value ?? {}
  assertSafeEvidence(evidence)
  const serialized = JSON.stringify(evidence)
  if (!serialized || Buffer.byteLength(serialized, 'utf8') > 16 * 1024) {
    throw new TypeError('Authorization evidence must be valid JSON no larger than 16 KiB')
  }
  return serialized
}

export async function recordDeploymentAuthorizationDecision(
  pool: DatabasePool,
  input: DeploymentAuthorizationRecordInput,
): Promise<{ id: string; recordedAt: string }> {
  const evidence = safeEvidence(input.evidence)
  const action = requiredText(input.action, 'action', 64)
  const reasonCode = requiredText(input.reasonCode, 'reasonCode', 120)
  const policyVersion = input.policyVersion === null ? null : requiredText(input.policyVersion, 'policyVersion', 120)
  const approvalReference = input.approvalReference === null ? null : requiredText(input.approvalReference, 'approvalReference', 200)
  const result = await pool.query(
    `INSERT INTO arsy_deployment_authorization_decisions
      (id, operation_id, owner_id, actor_id, target_host_id, action, effect,
       reason_code, policy_version, approval_reference, evidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     RETURNING id, recorded_at`,
    [
      randomUUID(),
      requiredText(input.operationId, 'operationId', 64),
      requiredText(input.ownerId, 'ownerId', 128),
      requiredText(input.actorId, 'actorId', 128),
      requiredText(input.targetHostId, 'targetHostId', 64),
      action,
      input.effect,
      reasonCode,
      policyVersion,
      approvalReference,
      evidence,
    ],
  )
  const rows = (result as QueryResult<{ id: string; recorded_at: string }>).rows
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Authorization decision was not persisted')
  return { id: rows[0].id, recordedAt: rows[0].recorded_at }
}

/**
 * Evaluates a deployment action and persists its decision before a caller may
 * invoke any provider. Missing/failed policy providers always deny.
 */
export async function authorizeAndRecordDeploymentAction(
  pool: DatabasePool,
  input: DeploymentAuthorizationInput,
  provider?: DeploymentPolicyProvider,
  policyTimeoutMs = 3_000,
): Promise<DeploymentAuthorizationResult> {
  const operationId = requiredText(input.operationId, 'operationId', 64)
  const ownerId = requiredText(input.ownerId, 'ownerId', 128)
  const targetHostId = requiredText(input.targetHostId, 'targetHostId', 64)
  const action = input.action
  const principal = input.principal
  if (!Number.isInteger(policyTimeoutMs) || policyTimeoutMs < 1 || policyTimeoutMs > 10_000) {
    throw new TypeError('policyTimeoutMs must be an integer between 1 and 10000')
  }

  let actorId = principal?.operatorId?.trim() || null
  let reasonCode: DeploymentAuthorizationReason | string = 'POLICY_UNAVAILABLE'
  let policyVersion: string | null = null
  let approvalReference: string | null = input.approvalReference?.trim() || null
  let effect: 'allow' | 'deny' = 'deny'
  let evidence: Record<string, unknown> = { decisionSource: 'fail-closed-default' }

  if (!principal || principal.kind !== 'operator' || !actorId) {
    reasonCode = 'AUTHENTICATION_REQUIRED'
  } else if (actorId !== ownerId) {
    reasonCode = 'OWNER_SCOPE_DENIED'
  } else if (!['deploy', 'stop', 'restart', 'rollback'].includes(action)) {
    reasonCode = 'INVALID_ACTION'
  } else if (!provider) {
    reasonCode = 'POLICY_UNAVAILABLE'
  } else {
    try {
      const controller = new AbortController()
      let timeout: ReturnType<typeof setTimeout> | undefined
      const decision = await Promise.race([
        provider.evaluate({
          actorId,
          ownerId,
          targetHostId,
          action: action as DeploymentAction,
          approvalReference,
          signal: controller.signal,
        }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            controller.abort()
            reject(new PolicyTimeoutError())
          }, policyTimeoutMs)
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout)
      })
      if (
        !decision ||
        !['allow', 'deny'].includes(decision.effect) ||
        !decision.reasonCode?.trim() ||
        !decision.policyVersion?.trim() ||
        typeof decision.approvalRequired !== 'boolean' ||
        !['not_required', 'approved', 'pending', 'rejected', 'unavailable'].includes(decision.approvalState)
      ) {
        reasonCode = 'POLICY_CONTRACT_INVALID'
        evidence = { decisionSource: 'invalid-policy-contract' }
      } else {
        policyVersion = decision.policyVersion.trim()
        approvalReference = decision.approvalReference?.trim() || approvalReference
        evidence = {
          decisionSource: 'deployment-policy-provider',
          policyReasonCode: decision.reasonCode.trim(),
          approvalRequired: decision.approvalRequired,
          approvalState: decision.approvalState,
          ...(decision.evidence ? { policyEvidence: decision.evidence } : {}),
        }
        if (decision.effect === 'deny') {
          reasonCode = 'POLICY_DENIED'
        } else if (decision.approvalRequired && decision.approvalState === 'unavailable') {
          reasonCode = 'APPROVAL_UNAVAILABLE'
        } else if (decision.approvalRequired && (decision.approvalState !== 'approved' || !approvalReference)) {
          reasonCode = 'APPROVAL_REQUIRED'
        } else {
          effect = 'allow'
          reasonCode = decision.reasonCode.trim()
        }
      }
    } catch (error) {
      reasonCode = error instanceof PolicyTimeoutError ? 'POLICY_TIMEOUT' : 'POLICY_UNAVAILABLE'
      evidence = { decisionSource: error instanceof PolicyTimeoutError ? 'policy-provider-timeout' : 'policy-provider-error' }
    }
  }

  // A policy exception or malformed result never becomes an allow decision.
  await recordDeploymentAuthorizationDecision(pool, {
    operationId,
    ownerId,
    actorId: actorId ?? 'unknown',
    targetHostId,
    action: action.slice(0, 64) || 'unknown',
    effect,
    reasonCode,
    policyVersion,
    approvalReference,
    evidence,
  })

  return { allowed: effect === 'allow', reasonCode, actorId, policyVersion, approvalReference }
}
