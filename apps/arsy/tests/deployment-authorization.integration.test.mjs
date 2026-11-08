import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import {
  approvalSigningPayload,
  authorizeDeploymentOperation,
  capabilityGrantSigningPayload,
  createEd25519CapabilityVerifier,
  createTrustedPublicKeyring,
  PostgresDeploymentAuthorizationStore,
} from '../src/deployments/authorization.ts'
import {
  createDeployment,
  createDeploymentOperation,
} from '../src/deployments/operation-store.ts'

const databaseUrl = process.env.TEST_DATABASE_URL

test('signed deployment authorization persists an immutable, owner-bound decision in PostgreSQL', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is not configured; run in the Docker connector PostgreSQL CI job',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4 })
  const ownerId = `authorization-ci-${randomUUID()}`
  const hostId = randomUUID()
  const now = new Date()
  const nowIso = now.toISOString()
  const issuedAt = new Date(now.getTime() - 30_000).toISOString()
  const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString()
  const issuer = generateKeyPairSync('ed25519')
  const approver = generateKeyPairSync('ed25519')
  try {
    const dockerMigration = await readFile(new URL('../migrations/002_docker_connector.sql', import.meta.url), 'utf8')
    const operationMigration = await readFile(new URL('../migrations/003_arsy_deployment_operations.sql', import.meta.url), 'utf8')
    const authorizationMigration = await readFile(new URL('../migrations/004_arsy_deployment_authorization.sql', import.meta.url), 'utf8')
    await pool.query(dockerMigration)
    await pool.query(operationMigration)
    await pool.query(authorizationMigration)
    await pool.query(authorizationMigration)

    await pool.query(
      'INSERT INTO docker_connector_servers (id, owner_id, name, kind, endpoint_url, encrypted_credentials) VALUES ($1, $2, $3, $4, NULL, NULL)',
      [hostId, ownerId, 'Authorization integration host', 'local'],
    )
    const deployment = await createDeployment(pool, {
      ownerId,
      actorId: ownerId,
      dockerServerId: hostId,
      name: 'authorization-integration-app',
    })
    const created = await createDeploymentOperation(pool, {
      ownerId,
      actorId: ownerId,
      deploymentId: deployment.id,
      kind: 'deploy',
      idempotencyKey: `authorization-${randomUUID()}`,
      requestPayload: { imageDigest: `sha256:${'a'.repeat(64)}` },
    })
    const operation = created.operation
    const action = 'deployment:deploy'
    const resource = `docker-server:${hostId}/deployment:${deployment.id}`

    const grant = {
      id: `grant-${randomUUID()}`,
      issuerId: 'ci-deployment-root',
      subjectId: ownerId,
      tenantId: ownerId,
      purpose: 'application-deployment',
      sessionId: operation.id,
      actions: [action],
      resources: [resource],
      argumentHashes: [operation.request_hash],
      issuedAt,
      expiresAt,
      signature: '',
    }
    grant.signature = sign(
      null,
      Buffer.from(capabilityGrantSigningPayload(grant)),
      issuer.privateKey,
    ).toString('base64url')
    await pool.query(
      `INSERT INTO arsy_deployment_capability_grants
        (id, owner_id, issuer_id, subject_id, tenant_id, purpose, session_id,
         actions, resources, argument_hashes, issued_at, expires_at, signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, $13)`,
      [
        grant.id, ownerId, grant.issuerId, grant.subjectId, grant.tenantId,
        grant.purpose, grant.sessionId, JSON.stringify(grant.actions),
        JSON.stringify(grant.resources), JSON.stringify(grant.argumentHashes),
        grant.issuedAt, grant.expiresAt, grant.signature,
      ],
    )

    const approval = {
      id: `approval-${randomUUID()}`,
      ownerId,
      operationId: operation.id,
      requestedActorId: ownerId,
      approverId: 'separate-approver',
      action,
      resource,
      policyVersion: 'deployment-policy-ci-v1',
      decision: 'approved',
      reasonCode: 'two-person-review',
      issuedAt,
      expiresAt,
      signature: '',
    }
    approval.signature = sign(
      null,
      Buffer.from(approvalSigningPayload(approval)),
      approver.privateKey,
    ).toString('base64url')
    await pool.query(
      `INSERT INTO arsy_deployment_approvals
        (id, owner_id, operation_id, requested_actor_id, approver_id, action,
         resource, policy_version, decision, reason_code, issued_at, expires_at, signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        approval.id, ownerId, approval.operationId, approval.requestedActorId,
        approval.approverId, approval.action, approval.resource, approval.policyVersion,
        approval.decision, approval.reasonCode, approval.issuedAt, approval.expiresAt,
        approval.signature,
      ],
    )

    const capabilityKeys = createTrustedPublicKeyring(JSON.stringify({
      [grant.issuerId]: issuer.publicKey.export({ type: 'spki', format: 'pem' }),
    }))
    const approvalKeys = createTrustedPublicKeyring(JSON.stringify({
      [approval.approverId]: approver.publicKey.export({ type: 'spki', format: 'pem' }),
    }))
    const decision = await authorizeDeploymentOperation(
      { operationId: operation.id, ownerId, authenticatedActorId: ownerId, now: nowIso },
      {
        store: new PostgresDeploymentAuthorizationStore(pool),
        capabilityVerifier: createEd25519CapabilityVerifier(capabilityKeys),
        approvalKeyring: approvalKeys,
        policyProvider: {
          evaluate: async () => ({
            allowed: true,
            policyVersion: 'deployment-policy-ci-v1',
            reasonCode: 'within-policy',
            requiresApproval: true,
          }),
        },
      },
    )
    assert.equal(decision.allowed, true)
    assert.equal(decision.capabilityGrantId, grant.id)
    assert.equal(decision.approvalId, approval.id)

    const persisted = await pool.query(
      `SELECT allowed, actor_id, docker_server_id, action, reason_codes,
         capability_grant_id, approval_id
       FROM arsy_deployment_authorization_decisions
       WHERE operation_id = $1 AND owner_id = $2`,
      [operation.id, ownerId],
    )
    assert.equal(persisted.rowCount, 1)
    assert.equal(persisted.rows[0].allowed, true)
    assert.equal(persisted.rows[0].actor_id, ownerId)
    assert.equal(persisted.rows[0].docker_server_id, hostId)
    assert.equal(persisted.rows[0].action, action)
    assert.deepEqual(persisted.rows[0].reason_codes, [])
    assert.equal(persisted.rows[0].capability_grant_id, grant.id)
    assert.equal(persisted.rows[0].approval_id, approval.id)

    await assert.rejects(
      pool.query('UPDATE arsy_deployment_authorization_decisions SET allowed = false WHERE operation_id = $1', [operation.id]),
      /append-only/,
    )
    await assert.rejects(
      pool.query('UPDATE arsy_deployment_capability_grants SET expires_at = now() WHERE owner_id = $1 AND id = $2', [ownerId, grant.id]),
      /append-only/,
    )
    await assert.rejects(
      pool.query('DELETE FROM arsy_deployment_approvals WHERE owner_id = $1 AND id = $2', [ownerId, approval.id]),
      /append-only/,
    )
  } finally {
    await pool.end()
  }
})
