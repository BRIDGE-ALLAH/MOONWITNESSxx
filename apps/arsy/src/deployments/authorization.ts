import { createPublicKey, randomUUID, verify as verifySignature, type KeyObject } from 'node:crypto'
import {
  authorizeCapability,
  type CapabilityDecision,
  type CapabilityGrant,
  type CapabilityRequest,
} from '../../../../packages/arsy-core/src/runtime-contract/capability.ts'
import type { DatabasePool } from '../db.ts'

const DEPLOYMENT_PURPOSE = 'application-deployment'
const MAX_GRANTS_PER_OPERATION = 256
const MAX_KEY_BYTES = 16 * 1024

type QueryResult<T> = { rows: T[] }

export interface DeploymentAuthorizationContext {
  operationId: string
  ownerId: string
  actorId: string
  deploymentId: string
  dockerServerId: string
  action: string
  resource: string
  argumentHash: string
  tenantId: string
  purpose: string
  sessionId: string
}

export interface DeploymentPolicyResult {
  allowed: boolean
  policyVersion: string
  reasonCode: string
  requiresApproval: boolean
}

export interface DeploymentPolicyProvider {
  evaluate(context: DeploymentAuthorizationContext): Promise<DeploymentPolicyResult>
}

export interface DeploymentAuthorizationDecision {
  allowed: boolean
  reasonCodes: string[]
  policyVersion: string | null
  capabilityGrantId: string | null
  approvalId: string | null
}

interface OperationContextRow {
  operation_id: string
  owner_id: string
  actor_id: string
  deployment_id: string
  docker_server_id: string
  kind: 'deploy' | 'stop' | 'restart' | 'rollback'
  request_hash: string
}

interface CapabilityGrantRow {
  id: string
  parent_grant_id: string | null
  issuer_id: string
  subject_id: string
  tenant_id: string
  purpose: string
  session_id: string
  actions: unknown
  resources: unknown
  argument_hashes: unknown
  issued_at: Date | string
  expires_at: Date | string
  signature: string
}

export interface DeploymentApproval {
  id: string
  ownerId: string
  operationId: string
  requestedActorId: string
  approverId: string
  action: string
  resource: string
  policyVersion: string
  decision: 'approved' | 'rejected'
  reasonCode: string
  issuedAt: string
  expiresAt: string
  signature: string
}

interface DeploymentApprovalRow extends Omit<DeploymentApproval, 'ownerId' | 'operationId' | 'requestedActorId' | 'approverId' | 'policyVersion' | 'reasonCode' | 'issuedAt' | 'expiresAt'> {
  owner_id: string
  operation_id: string
  requested_actor_id: string
  approver_id: string
  policy_version: string
  reason_code: string
  issued_at: Date | string
  expires_at: Date | string
}

export interface TrustedPublicKeyring {
  get(issuerId: string): readonly KeyObject[]
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
}

export function capabilityGrantSigningPayload(grant: CapabilityGrant): string {
  return stableJson({
    id: grant.id,
    issuerId: grant.issuerId,
    subjectId: grant.subjectId,
    tenantId: grant.tenantId,
    purpose: grant.purpose,
    sessionId: grant.sessionId,
    actions: grant.actions,
    resources: grant.resources,
    argumentHashes: grant.argumentHashes,
    issuedAt: grant.issuedAt,
    expiresAt: grant.expiresAt,
  })
}

export function approvalSigningPayload(approval: Omit<DeploymentApproval, 'signature'>): string {
  return stableJson({
    id: approval.id,
    ownerId: approval.ownerId,
    operationId: approval.operationId,
    requestedActorId: approval.requestedActorId,
    approverId: approval.approverId,
    action: approval.action,
    resource: approval.resource,
    policyVersion: approval.policyVersion,
    decision: approval.decision,
    reasonCode: approval.reasonCode,
    issuedAt: approval.issuedAt,
    expiresAt: approval.expiresAt,
  })
}

function signatureBuffer(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  const signature = Buffer.from(value, 'base64url')
  return signature.length === 64 ? signature : null
}

/** Public-key-only Ed25519 keyring. Private PEMs are rejected at load time. */
export function createTrustedPublicKeyring(encoded: string | undefined): TrustedPublicKeyring {
  const keys = new Map<string, KeyObject[]>()
  if (!encoded?.trim()) return { get: (issuerId) => keys.get(issuerId) ?? [] }
  if (Buffer.byteLength(encoded, 'utf8') > MAX_KEY_BYTES) {
    throw new Error('Deployment trust key configuration exceeds 16 KiB')
  }

  const parsed = JSON.parse(encoded) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Deployment trust key configuration must be a JSON object')
  }

  for (const [issuerId, configured] of Object.entries(parsed as Record<string, unknown>)) {
    if (!issuerId.trim()) throw new Error('Deployment trust key issuer ID must not be empty')
    const pemValues = Array.isArray(configured) ? configured : [configured]
    if (!pemValues.length || pemValues.length > 4) throw new Error(`Issuer ${issuerId} must have 1-4 public keys`)
    const issuerKeys = pemValues.map((pem) => {
      if (typeof pem !== 'string' || !pem.includes('-----BEGIN PUBLIC KEY-----')) {
        throw new Error(`Issuer ${issuerId} requires public-key PEM values`)
      }
      const key = createPublicKey(pem)
      if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519') {
        throw new Error(`Issuer ${issuerId} key must be an Ed25519 public key`)
      }
      return key
    })
    keys.set(issuerId, issuerKeys)
  }
  return { get: (issuerId) => keys.get(issuerId) ?? [] }
}

export function createEd25519CapabilityVerifier(keyring: TrustedPublicKeyring) {
  return {
    async verify(grant: CapabilityGrant): Promise<boolean> {
      const signature = signatureBuffer(grant.signature)
      if (!signature) return false
      const payload = Buffer.from(capabilityGrantSigningPayload(grant), 'utf8')
      for (const key of keyring.get(grant.issuerId)) {
        try {
          if (verifySignature(null, payload, key, signature)) return true
        } catch {
          // A malformed or incompatible trusted key never changes a deny into an allow.
        }
      }
      return false
    },
  }
}

function verifyApprovalSignature(approval: DeploymentApproval, keyring: TrustedPublicKeyring): boolean {
  const signature = signatureBuffer(approval.signature)
  if (!signature) return false
  const { signature: _signature, ...payload } = approval
  const bytes = Buffer.from(approvalSigningPayload(payload), 'utf8')
  for (const key of keyring.get(approval.approverId)) {
    try {
      if (verifySignature(null, bytes, key, signature)) return true
    } catch {
      // Invalid keys fail closed.
    }
  }
  return false
}

function rows<T>(result: unknown): T[] {
  if (!result || typeof result !== 'object' || !Array.isArray((result as QueryResult<T>).rows)) {
    throw new Error('Deployment authorization query returned an invalid result')
  }
  return (result as QueryResult<T>).rows
}

function stringArray(value: unknown, field: string): string[] {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { throw new Error(`Stored ${field} is invalid JSON`) }
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error(`Stored ${field} is not a string array`)
  }
  return parsed
}

function dateIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Stored authorization timestamp is invalid')
  return date.toISOString()
}

function operationAction(kind: OperationContextRow['kind']): string {
  switch (kind) {
    case 'deploy': return 'deployment:deploy'
    case 'stop': return 'deployment:stop'
    case 'restart': return 'deployment:restart'
    case 'rollback': return 'deployment:rollback'
  }
}

function mapGrant(row: CapabilityGrantRow): CapabilityGrant {
  return {
    id: row.id,
    issuerId: row.issuer_id,
    subjectId: row.subject_id,
    tenantId: row.tenant_id,
    purpose: row.purpose,
    sessionId: row.session_id,
    actions: stringArray(row.actions, 'capability actions'),
    resources: stringArray(row.resources, 'capability resources'),
    argumentHashes: stringArray(row.argument_hashes, 'capability argument hashes'),
    issuedAt: dateIso(row.issued_at),
    expiresAt: dateIso(row.expires_at),
    signature: row.signature,
  }
}

function mapApproval(row: DeploymentApprovalRow): DeploymentApproval {
  return {
    id: row.id,
    ownerId: row.owner_id,
    operationId: row.operation_id,
    requestedActorId: row.requested_actor_id,
    approverId: row.approver_id,
    action: row.action,
    resource: row.resource,
    policyVersion: row.policy_version,
    decision: row.decision,
    reasonCode: row.reason_code,
    issuedAt: dateIso(row.issued_at),
    expiresAt: dateIso(row.expires_at),
    signature: row.signature,
  }
}

export class PostgresDeploymentAuthorizationStore {
  private readonly pool: DatabasePool

  constructor(pool: DatabasePool) {
    this.pool = pool
  }

  async loadContext(operationId: string, ownerId: string, authenticatedActorId: string): Promise<DeploymentAuthorizationContext | null> {
    const result = await this.pool.query(
      `SELECT o.id AS operation_id, o.owner_id, o.actor_id, o.deployment_id,
         d.docker_server_id, o.kind, o.request_hash
       FROM arsy_deployment_operations o
       JOIN arsy_deployments d
         ON d.id = o.deployment_id AND d.owner_id = o.owner_id
       WHERE o.id = $1 AND o.owner_id = $2`,
      [operationId, ownerId],
    )
    const row = rows<OperationContextRow>(result)[0]
    if (!row || row.actor_id !== authenticatedActorId) return null

    return {
      operationId: row.operation_id,
      ownerId: row.owner_id,
      actorId: authenticatedActorId,
      deploymentId: row.deployment_id,
      dockerServerId: row.docker_server_id,
      action: operationAction(row.kind),
      resource: `docker-server:${row.docker_server_id}/deployment:${row.deployment_id}`,
      argumentHash: row.request_hash,
      tenantId: row.owner_id,
      purpose: DEPLOYMENT_PURPOSE,
      sessionId: row.operation_id,
    }
  }

  async loadCapabilityChains(context: DeploymentAuthorizationContext): Promise<CapabilityGrant[][]> {
    const result = await this.pool.query(
      `SELECT g.id, g.parent_grant_id, g.issuer_id, g.subject_id, g.tenant_id,
         g.purpose, g.session_id, g.actions, g.resources, g.argument_hashes,
         g.issued_at, g.expires_at, g.signature
       FROM arsy_deployment_capability_grants g
       WHERE g.owner_id = $1 AND g.tenant_id = $2 AND g.purpose = $3 AND g.session_id = $4
         AND NOT EXISTS (
           SELECT 1 FROM arsy_deployment_capability_revocations r
           WHERE r.owner_id = g.owner_id AND r.grant_id = g.id
         )
       ORDER BY g.issued_at ASC
       LIMIT $5`,
      [context.ownerId, context.tenantId, context.purpose, context.sessionId, MAX_GRANTS_PER_OPERATION + 1],
    )
    const stored = rows<CapabilityGrantRow>(result)
    if (stored.length > MAX_GRANTS_PER_OPERATION) throw new Error('Too many capability grants for one deployment operation')

    const byId = new Map<string, { grant: CapabilityGrant; parentId: string | null }>()
    for (const row of stored) byId.set(row.id, { grant: mapGrant(row), parentId: row.parent_grant_id })

    const chains: CapabilityGrant[][] = []
    const leaves = [...byId.entries()].filter(([, value]) => value.grant.subjectId === context.actorId)
    for (const [leafId] of leaves) {
      const reverse: CapabilityGrant[] = []
      const visited = new Set<string>()
      let currentId: string | null = leafId
      let complete = false
      while (currentId) {
        if (visited.has(currentId)) break
        visited.add(currentId)
        const current = byId.get(currentId)
        if (!current) break
        reverse.push(current.grant)
        if (!current.parentId) {
          complete = true
          break
        }
        currentId = current.parentId
      }
      if (complete) chains.push(reverse.reverse())
    }
    return chains
  }

  async loadApproval(context: DeploymentAuthorizationContext, policyVersion: string): Promise<DeploymentApproval | null> {
    const result = await this.pool.query(
      `SELECT id, owner_id, operation_id, requested_actor_id, approver_id,
         action, resource, policy_version, decision, reason_code,
         issued_at, expires_at, signature
       FROM arsy_deployment_approvals
       WHERE owner_id = $1 AND operation_id = $2
         AND requested_actor_id = $3 AND action = $4 AND resource = $5
         AND policy_version = $6
       LIMIT 1`,
      [context.ownerId, context.operationId, context.actorId, context.action, context.resource, policyVersion],
    )
    const row = rows<DeploymentApprovalRow>(result)[0]
    return row ? mapApproval(row) : null
  }

  async recordDecision(
    context: DeploymentAuthorizationContext,
    decision: DeploymentAuthorizationDecision,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO arsy_deployment_authorization_decisions
        (id, owner_id, operation_id, docker_server_id, actor_id, action,
         resource, argument_hash, policy_version, allowed, reason_codes,
         capability_grant_id, approval_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)`,
      [
        randomUUID(), context.ownerId, context.operationId, context.dockerServerId,
        context.actorId, context.action, context.resource, context.argumentHash,
        decision.policyVersion, decision.allowed, JSON.stringify(decision.reasonCodes),
        decision.capabilityGrantId, decision.approvalId,
      ],
    )
  }
}

export interface AuthorizeDeploymentDependencies {
  store: PostgresDeploymentAuthorizationStore
  policyProvider?: DeploymentPolicyProvider
  capabilityVerifier?: { verify(grant: CapabilityGrant): Promise<boolean> }
  approvalKeyring?: TrustedPublicKeyring
}

export async function authorizeDeploymentOperation(
  input: { operationId: string; ownerId: string; authenticatedActorId: string; now?: string },
  dependencies: AuthorizeDeploymentDependencies,
): Promise<DeploymentAuthorizationDecision> {
  let context: DeploymentAuthorizationContext | null
  try {
    context = await dependencies.store.loadContext(
      input.operationId,
      input.ownerId,
      input.authenticatedActorId,
    )
  } catch {
    return { allowed: false, reasonCodes: ['authorization_store_unavailable'], policyVersion: null, capabilityGrantId: null, approvalId: null }
  }
  if (!context) {
    return { allowed: false, reasonCodes: ['operation_not_found_or_actor_mismatch'], policyVersion: null, capabilityGrantId: null, approvalId: null }
  }

  let policy: DeploymentPolicyResult | null = null
  let decision: DeploymentAuthorizationDecision
  let selectedGrantId: string | null = null
  let selectedApprovalId: string | null = null

  try {
    if (!dependencies.policyProvider) throw new Error('policy_provider_unavailable')
    policy = await dependencies.policyProvider.evaluate(context)
    if (!policy || typeof policy.allowed !== 'boolean' ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(policy.policyVersion ?? '') ||
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(policy.reasonCode ?? '') ||
        typeof policy.requiresApproval !== 'boolean') {
      throw new Error('policy_response_invalid')
    }
    if (!policy.allowed) {
      decision = { allowed: false, reasonCodes: ['policy_denied', policy.reasonCode], policyVersion: policy.policyVersion, capabilityGrantId: null, approvalId: null }
    } else if (!dependencies.capabilityVerifier) {
      decision = { allowed: false, reasonCodes: ['capability_verifier_unavailable'], policyVersion: policy.policyVersion, capabilityGrantId: null, approvalId: null }
    } else {
      const chains = await dependencies.store.loadCapabilityChains(context)
      let capabilityDecision: CapabilityDecision = {
        allowed: false,
        reasonCodes: ['capability_chain_missing'],
      }
      const request: CapabilityRequest = {
        actorId: context.actorId,
        tenantId: context.tenantId,
        action: context.action,
        resource: context.resource,
        purpose: context.purpose,
        sessionId: context.sessionId,
        argumentHash: context.argumentHash,
        now: input.now,
      }
      for (const chain of chains) {
        const evaluated = await authorizeCapability(request, chain, dependencies.capabilityVerifier)
        if (evaluated.allowed) {
          capabilityDecision = evaluated
          break
        }
        capabilityDecision = evaluated
      }
      selectedGrantId = capabilityDecision.grantId ?? null
      if (!capabilityDecision.allowed) {
        decision = { allowed: false, reasonCodes: capabilityDecision.reasonCodes, policyVersion: policy.policyVersion, capabilityGrantId: null, approvalId: null }
      } else if (policy.requiresApproval && !dependencies.approvalKeyring) {
        decision = { allowed: false, reasonCodes: ['approval_verifier_unavailable'], policyVersion: policy.policyVersion, capabilityGrantId: selectedGrantId, approvalId: null }
      } else if (policy.requiresApproval) {
        const approval = await dependencies.store.loadApproval(context, policy.policyVersion)
        if (!approval) {
          decision = { allowed: false, reasonCodes: ['approval_required'], policyVersion: policy.policyVersion, capabilityGrantId: selectedGrantId, approvalId: null }
        } else if (approval.approverId === context.actorId ||
          approval.ownerId !== context.ownerId ||
          approval.operationId !== context.operationId ||
          approval.requestedActorId !== context.actorId ||
          approval.action !== context.action ||
          approval.resource !== context.resource ||
          approval.policyVersion !== policy.policyVersion ||
          Date.parse(approval.issuedAt) > Date.parse(input.now ?? new Date().toISOString()) ||
          Date.parse(approval.expiresAt) <= Date.parse(input.now ?? new Date().toISOString()) ||
          !verifyApprovalSignature(approval, dependencies.approvalKeyring!)) {
          decision = { allowed: false, reasonCodes: ['approval_evidence_invalid'], policyVersion: policy.policyVersion, capabilityGrantId: selectedGrantId, approvalId: approval.id }
        } else if (approval.decision !== 'approved') {
          selectedApprovalId = approval.id
          decision = { allowed: false, reasonCodes: ['approval_denied', approval.reasonCode], policyVersion: policy.policyVersion, capabilityGrantId: selectedGrantId, approvalId: approval.id }
        } else {
          selectedApprovalId = approval.id
          decision = { allowed: true, reasonCodes: [], policyVersion: policy.policyVersion, capabilityGrantId: selectedGrantId, approvalId: selectedApprovalId }
        }
      } else {
        decision = { allowed: true, reasonCodes: [], policyVersion: policy.policyVersion, capabilityGrantId: selectedGrantId, approvalId: null }
      }
    }
  } catch (error) {
    const reason = error instanceof Error && /^[a-z][a-z0-9_]{0,79}$/.test(error.message)
      ? error.message
      : 'authorization_provider_unavailable'
    decision = { allowed: false, reasonCodes: [reason], policyVersion: policy?.policyVersion ?? null, capabilityGrantId: selectedGrantId, approvalId: selectedApprovalId }
  }

  try {
    await dependencies.store.recordDecision(context, decision)
  } catch {
    return {
      allowed: false,
      reasonCodes: ['authorization_audit_unavailable'],
      policyVersion: decision.policyVersion,
      capabilityGrantId: null,
      approvalId: null,
    }
  }
  return decision
}
