import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import {
  approvalSigningPayload,
  authorizeDeploymentOperation,
  capabilityGrantSigningPayload,
  createEd25519CapabilityVerifier,
  createTrustedPublicKeyring,
  PostgresDeploymentAuthorizationStore,
} from '../src/deployments/authorization.ts'

const ownerId = 'operator-1'
const actorId = 'operator-1'
const operationId = '11111111-1111-4111-8111-111111111111'
const deploymentId = '22222222-2222-4222-8222-222222222222'
const dockerServerId = '33333333-3333-4333-8333-333333333333'
const argumentHash = 'a'.repeat(64)
const action = 'deployment:deploy'
const resource = `docker-server:${dockerServerId}/deployment:${deploymentId}'
const now = '2026-11-08T06:00:00.000Z'

function keyPair() {
  return generateKeyPairSync('ed25519')
}

function makeGrant(privateKey) {
  const grant = {
    id: 'grant-operation-1',
    issuerId: 'deployment-root',
    subjectId: actorId,
    tenantId: ownerId,
    purpose: 'application-deployment',
    sessionId: operationId,
    actions: [action],
    resources: [resource],
    argumentHashes: [argumentHash],
    issuedAt: '2026-11-08T05:00:00.000Z',
    expiresAt: '2026-11-08T07:00:00.000Z',
    signature: '',
  }
  grant.signature = sign(null, Buffer.from(capabilityGrantSigningPayload(grant)), privateKey).toString('base64url')
  return grant
}

function makeApproval(privateKey) {
  const approval = {
    id: 'approval-operation-1',
    ownerId,
    operationId,
    requestedActorId: actorId,
    approverId: 'second-operator',
    action,
    resource,
    policyVersion: 'deploy-policy-v1',
    decision: 'approved',
    reasonCode: 'two-person-review',
    issuedAt: '2026-11-08T05:30:00.000Z',
    expiresAt: '2026-11-08T06:30:00.000Z',
    signature: '',
  }
  approval.signature = sign(null, Buffer.from(approvalSigningPayload(approval)), privateKey).toString('base64url')
  return approval
}

class FakePool {
  grantRows = []
  approvalRow = null
  decisions = []
  contextActor = actorId
  failDecisionInsert = false

  async query(statement, values = []) {
    if (statement.includes('FROM arsy_deployment_operations o')) {
      if (values[0] !== operationId || values[1] !== ownerId) return { rows: [] }
      return { rows: [{
        operation_id: operationId, owner_id: ownerId, actor_id: this.contextActor,
        deployment_id: deploymentId, docker_server_id: dockerServerId,
        kind: 'deploy', request_hash: argumentHash,
      }] }
    }
    if (statement.includes('FROM arsy_deployment_capability_grants g')) {
      return { rows: this.grantRows }
    }
    if (statement.includes('FROM arsy_deployment_approvals')) {
      return { rows: this.approvalRow ? [this.approvalRow] : [] }
    }
    if (statement.includes('INSERT INTO arsy_deployment_authorization_decisions')) {
      if (this.failDecisionInsert) throw new Error('database unavailable')
      this.decisions.push({
        allowed: values[9],
        reasonCodes: JSON.parse(values[10]),
        capabilityGrantId: values[11],
        approvalId: values[12],
      })
      return { rows: [] }
    }
    throw new Error('Unexpected SQL in authorization test fake')
  }
}

function grantRow(grant) {
  return {
    id: grant.id, parent_grant_id: null, issuer_id: grant.issuerId,
    subject_id: grant.subjectId, tenant_id: grant.tenantId,
    purpose: grant.purpose, session_id: grant.sessionId,
    actions: grant.actions, resources: grant.resources,
    argument_hashes: grant.argumentHashes, issued_at: grant.issuedAt,
    expires_at: grant.expiresAt, signature: grant.signature,
  }
}

function approvalRow(approval) {
  return {
    id: approval.id, owner_id: approval.ownerId, operation_id: approval.operationId,
    requested_actor_id: approval.requestedActorId, approver_id: approval.approverId,
    action: approval.action, resource: approval.resource,
    policy_version: approval.policyVersion, decision: approval.decision,
    reason_code: approval.reasonCode, issued_at: approval.issuedAt,
    expires_at: approval.expiresAt, signature: approval.signature,
  }
}

function dependencies(pool, { policyProvider, grantKeys, approvalKeys } = {}) {
  return {
    store: new PostgresDeploymentAuthorizationStore(pool),
    policyProvider,
    capabilityVerifier: grantKeys ? createEd25519CapabilityVerifier(grantKeys) : undefined,
    approvalKeyring: approvalKeys,
  }
}

test('deployment authorization denies when policy, signature verifier or capability is unavailable', async () => {
  const pool = new FakePool()
  const noPolicy = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool),
  )
  assert.equal(noPolicy.allowed, false)
  assert.equal(noPolicy.reasonCodes[0], 'policy_provider_unavailable')

  const policy = { evaluate: async () => ({ allowed: true, policyVersion: 'v1', reasonCode: 'allow', requiresApproval: false }) }
  const noVerifier = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy }),
  )
  assert.equal(noVerifier.allowed, false)
  assert.equal(noVerifier.reasonCodes[0], 'capability_verifier_unavailable')
  assert.equal(pool.decisions.length, 2)
  assert.equal(pool.decisions.every((decision) => decision.allowed === false), true)
})

test('a signed, operation-scoped capability and explicit policy allow produce immutable decision intent', async () => {
  const pool = new FakePool()
  const issuer = keyPair()
  const grant = makeGrant(issuer.privateKey)
  pool.grantRows = [grantRow(grant)]
  const keyring = createTrustedPublicKeyring(JSON.stringify({
    'deployment-root': issuer.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const policy = { evaluate: async () => ({
    allowed: true, policyVersion: 'deploy-policy-v1', reasonCode: 'within-policy', requiresApproval: false,
  }) }

  const decision = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy, grantKeys: keyring }),
  )
  assert.equal(decision.allowed, true)
  assert.deepEqual(decision.reasonCodes, [])
  assert.equal(decision.capabilityGrantId, grant.id)
  assert.equal(pool.decisions.at(-1).allowed, true)
})

test('a valid operator identity without a scoped capability is denied and audited', async () => {
  const pool = new FakePool()
  const issuer = keyPair()
  const keyring = createTrustedPublicKeyring(JSON.stringify({
    'deployment-root': issuer.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const policy = { evaluate: async () => ({
    allowed: true, policyVersion: 'deploy-policy-v1', reasonCode: 'within-policy', requiresApproval: false,
  }) }
  const decision = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy, grantKeys: keyring }),
  )
  assert.equal(decision.allowed, false)
  assert.equal(decision.reasonCodes[0], 'capability_chain_missing')
  assert.equal(pool.decisions.at(-1).allowed, false)
})

test('high-risk operations require a separately signed approval bound to the exact operation', async () => {
  const pool = new FakePool()
  const issuer = keyPair()
  const approver = keyPair()
  const grant = makeGrant(issuer.privateKey)
  pool.grantRows = [grantRow(grant)]
  const grantKeys = createTrustedPublicKeyring(JSON.stringify({
    'deployment-root': issuer.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const approvalKeys = createTrustedPublicKeyring(JSON.stringify({
    'second-operator': approver.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const policy = { evaluate: async () => ({
    allowed: true, policyVersion: 'deploy-policy-v1', reasonCode: 'high-risk', requiresApproval: true,
  }) }

  const missing = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy, grantKeys, approvalKeys }),
  )
  assert.equal(missing.allowed, false)
  assert.equal(missing.reasonCodes[0], 'approval_required')

  const approval = makeApproval(approver.privateKey)
  pool.approvalRow = approvalRow(approval)
  const accepted = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy, grantKeys, approvalKeys }),
  )
  assert.equal(accepted.allowed, true)
  assert.equal(accepted.approvalId, approval.id)
})

test('self-approval, forged approvals and policy denial fail closed', async () => {
  const pool = new FakePool()
  const issuer = keyPair()
  const approver = keyPair()
  const grant = makeGrant(issuer.privateKey)
  pool.grantRows = [grantRow(grant)]
  const grantKeys = createTrustedPublicKeyring(JSON.stringify({
    'deployment-root': issuer.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const approvalKeys = createTrustedPublicKeyring(JSON.stringify({
    'second-operator': approver.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const requireApproval = { evaluate: async () => ({
    allowed: true, policyVersion: 'deploy-policy-v1', reasonCode: 'high-risk', requiresApproval: true,
  }) }
  const selfApproval = makeApproval(approver.privateKey)
  selfApproval.approverId = actorId
  pool.approvalRow = approvalRow(selfApproval)
  const selfDenied = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: requireApproval, grantKeys, approvalKeys }),
  )
  assert.equal(selfDenied.allowed, false)
  assert.equal(selfDenied.reasonCodes[0], 'approval_evidence_invalid')

  const forged = makeApproval(approver.privateKey)
  forged.signature = Buffer.alloc(64, 7).toString('base64url')
  pool.approvalRow = approvalRow(forged)
  const forgedDenied = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: requireApproval, grantKeys, approvalKeys }),
  )
  assert.equal(forgedDenied.allowed, false)
  assert.equal(forgedDenied.reasonCodes[0], 'approval_evidence_invalid')

  const rejected = { ...makeApproval(approver.privateKey), decision: 'rejected', reasonCode: 'approver_rejected' }
  rejected.signature = sign(null, Buffer.from(approvalSigningPayload(rejected)), approver.privateKey).toString('base64url')
  pool.approvalRow = approvalRow(rejected)
  const rejectedDecision = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: requireApproval, grantKeys, approvalKeys }),
  )
  assert.equal(rejectedDecision.allowed, false)
  assert.deepEqual(rejectedDecision.reasonCodes, ['approval_denied', 'approver_rejected'])

    const blockedPolicy = { evaluate: async () => ({
    allowed: false, policyVersion: 'deploy-policy-v1', reasonCode: 'maintenance_window', requiresApproval: false,
  }) }
  const policyDenied = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: blockedPolicy, grantKeys, approvalKeys }),
  )
  assert.equal(policyDenied.allowed, false)
  assert.deepEqual(policyDenied.reasonCodes, ['policy_denied', 'maintenance_window'])
})

test('actor mismatch and audit-store failure never return an authorization allow', async () => {
  const pool = new FakePool()
  const actorIssuer = keyPair()
  const grant = makeGrant(actorIssuer.privateKey)
  pool.grantRows = [grantRow(grant)]
  const keyring = createTrustedPublicKeyring(JSON.stringify({
    'deployment-root': actorIssuer.publicKey.export({ type: 'spki', format: 'pem' }),
  }))
  const policy = { evaluate: async () => ({
    allowed: true, policyVersion: 'deploy-policy-v1', reasonCode: 'within-policy', requiresApproval: false,
  }) }
  pool.contextActor = 'different-actor'
  const mismatched = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy, grantKeys: keyring }),
  )
  assert.equal(mismatched.allowed, false)
  assert.equal(mismatched.reasonCodes[0], 'operation_not_found_or_actor_mismatch')

  pool.contextActor = actorId
  pool.failDecisionInsert = true
  const auditUnavailable = await authorizeDeploymentOperation(
    { operationId, ownerId, authenticatedActorId: actorId, now },
    dependencies(pool, { policyProvider: policy, grantKeys: keyring }),
  )
  assert.equal(auditUnavailable.allowed, false)
  assert.equal(auditUnavailable.reasonCodes[0], 'authorization_audit_unavailable')
})

test('trusted keyring accepts only configured public Ed25519 keys', () => {
  const pair = keyPair()
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' })
  assert.doesNotThrow(() => createTrustedPublicKeyring(JSON.stringify({ issuer: publicPem })))
  assert.throws(
    () => createTrustedPublicKeyring(JSON.stringify({ issuer: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) })),
    /public-key PEM/,
  )
})
