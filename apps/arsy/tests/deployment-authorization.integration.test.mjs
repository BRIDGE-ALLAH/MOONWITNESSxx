import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { createDeployment, createDeploymentOperation } from '../src/deployments/operation-store.ts'
import { authorizeAndRecordDeploymentAction } from '../src/deployments/authorization.ts'

const databaseUrl = process.env.TEST_DATABASE_URL

test('deployment authorization persists append-only policy evidence with owner and operation constraints', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is not configured; run in the PostgreSQL integration job',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 })
  const ownerId = `authorization-ci-${randomUUID()}`
  const hostId = randomUUID()
  const otherOwnerId = `authorization-other-${randomUUID()}`
  try {
    for (const file of [
      '../migrations/002_docker_connector.sql',
      '../migrations/003_arsy_deployment_operations.sql',
      '../migrations/004_arsy_deployment_authorization.sql',
    ]) {
      const migration = await readFile(new URL(file, import.meta.url), 'utf8')
      await pool.query(migration)
      await pool.query(migration)
    }

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
    const operation = await createDeploymentOperation(pool, {
      ownerId,
      actorId: ownerId,
      deploymentId: deployment.id,
      kind: 'deploy',
      idempotencyKey: `authorization-${randomUUID()}`,
    })

    const result = await authorizeAndRecordDeploymentAction(
      pool,
      {
        principal: { kind: 'operator', operatorId: ownerId },
        operationId: operation.operation.id,
        deploymentId: deployment.id,
        ownerId,
        targetHostId: hostId,
        action: 'deploy',
      },
      {
        evaluate: async () => ({
          effect: 'allow',
          reasonCode: 'INTEGRATION_POLICY_ALLOW',
          policyVersion: 'integration-policy-v1',
          approvalRequired: false,
          approvalState: 'not_required',
          evidence: { policyRule: 'test-host-only', evaluationId: randomUUID() },
        }),
      },
    )
    assert.equal(result.allowed, true)

    const stored = await pool.query(
      'SELECT operation_id, deployment_id, owner_id, actor_id, target_host_id, action, effect, policy_version FROM arsy_deployment_authorization_decisions WHERE operation_id = $1 AND owner_id = $2',
      [operation.operation.id, ownerId],
    )
    assert.equal(stored.rowCount, 1)
    assert.equal(stored.rows[0].deployment_id, deployment.id)
    assert.equal(stored.rows[0].target_host_id, hostId)
    assert.equal(stored.rows[0].actor_id, ownerId)
    assert.equal(stored.rows[0].effect, 'allow')
    assert.equal(stored.rows[0].policy_version, 'integration-policy-v1')

    await assert.rejects(
      pool.query(
        'INSERT INTO arsy_deployment_authorization_decisions (id, operation_id, deployment_id, owner_id, actor_id, target_host_id, action, effect, reason_code, evidence) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)',
        [randomUUID(), operation.operation.id, deployment.id, otherOwnerId, otherOwnerId, hostId, 'deploy', 'allow', 'CROSS_OWNER', '{}'],
      ),
    )
    await assert.rejects(
      pool.query(
        'UPDATE arsy_deployment_authorization_decisions SET effect = $1 WHERE operation_id = $2',
        ['allow', operation.operation.id],
      ),
      /append-only/,
    )
    await assert.rejects(
      pool.query(
        'DELETE FROM arsy_deployment_authorization_decisions WHERE operation_id = $1',
        [operation.operation.id],
      ),
      /append-only/,
    )
  } finally {
    await pool.end()
  }
})
