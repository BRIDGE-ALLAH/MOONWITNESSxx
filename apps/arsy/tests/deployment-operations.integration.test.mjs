import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import {
  createDeployment,
  createDeploymentOperation,
  IdempotencyConflictError,
  transitionDeploymentOperation,
} from '../src/deployments/operation-store.ts'

const databaseUrl = process.env.TEST_DATABASE_URL

test('deployment journal migrations are repeatable and persist owner-bound operations atomically', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is not configured; run in the PostgreSQL integration job',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 })
  const ownerId = `deployment-ci-${randomUUID()}`
  const hostId = randomUUID()
  try {
    const dockerMigration = await readFile(new URL('../migrations/002_docker_connector.sql', import.meta.url), 'utf8')
    const deploymentMigration = await readFile(new URL('../migrations/003_arsy_deployment_operations.sql', import.meta.url), 'utf8')
    await pool.query(dockerMigration)
    await pool.query(deploymentMigration)
    await pool.query(deploymentMigration)

    await pool.query(
      'INSERT INTO docker_connector_servers (id, owner_id, name, kind, endpoint_url, encrypted_credentials) VALUES ($1, $2, $3, $4, NULL, NULL)',
      [hostId, ownerId, 'Deployment integration host', 'local'],
    )
    const deployment = await createDeployment(pool, {
      ownerId, actorId: ownerId, dockerServerId: hostId, name: 'integration-app',
      desiredImageDigest: `sha256:${'a'.repeat(64)}`,
      desiredConfig: { port: 8080, secretRefs: ['vault://integration/db'] },
    })
    const request = {
      ownerId, actorId: ownerId, deploymentId: deployment.id,
      kind: 'deploy', idempotencyKey: `deploy-${randomUUID()}`,
      requestPayload: { imageDigest: `sha256:${'a'.repeat(64)}` },
    }
    const first = await createDeploymentOperation(pool, request)
    const replay = await createDeploymentOperation(pool, request)
    assert.equal(first.disposition, 'created')
    assert.equal(replay.disposition, 'replayed')
    assert.equal(replay.operation.id, first.operation.id)

    await assert.rejects(
      createDeploymentOperation(pool, {
        ...request,
        requestPayload: { imageDigest: `sha256:${'b'.repeat(64)}` },
      }),
      IdempotencyConflictError,
    )
    await transitionDeploymentOperation(pool, {
      operationId: first.operation.id, ownerId, actorId: ownerId,
      expectedStatus: 'queued', nextStatus: 'running',
      eventType: 'operation.started', details: { worker: 'integration' },
    })

    const operationRows = await pool.query(
      'SELECT id, status FROM arsy_deployment_operations WHERE id = $1 AND owner_id = $2',
      [first.operation.id, ownerId],
    )
    const events = await pool.query(
      'SELECT sequence FROM arsy_deployment_operation_events WHERE operation_id = $1 AND owner_id = $2 ORDER BY sequence',
      [first.operation.id, ownerId],
    )
    const outbox = await pool.query(
      'SELECT id FROM arsy_deployment_outbox WHERE operation_id = $1 AND owner_id = $2',
      [first.operation.id, ownerId],
    )
    assert.equal(operationRows.rows[0].status, 'running')
    assert.deepEqual(events.rows.map(row => Number(row.sequence)), [1, 2])
    assert.equal(outbox.rowCount, 1)
    await assert.rejects(
      pool.query('UPDATE arsy_deployment_operation_events SET event_type = $1 WHERE operation_id = $2', ['tampered', first.operation.id]),
      /append-only/,
    )
    await assert.rejects(
      pool.query('DELETE FROM arsy_deployment_operation_events WHERE operation_id = $1', [first.operation.id]),
      /append-only/,
    )

    await assert.rejects(
      createDeployment(pool, {
        ownerId: 'different-owner', actorId: 'different-owner',
        dockerServerId: hostId, name: 'cross-owner-app',
      }),
    )
  } finally {
    await pool.end()
  }
})
