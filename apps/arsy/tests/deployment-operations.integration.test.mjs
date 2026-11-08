import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { applyTestMigrations } from './helpers/apply-migrations.mjs'
import {
  createDeployment,
  createDeploymentOperation,
  IdempotencyConflictError,
  transitionDeploymentOperation,
} from '../src/deployments/operation-store.ts'
import {
  acknowledgeDeploymentOutbox,
  claimDeploymentOutbox,
  reapExpiredDeploymentOutbox,
  retryDeploymentOutbox,
} from '../src/deployments/outbox-store.ts'

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
    const outboxMigration = await readFile(new URL('../migrations/005_arsy_deployment_outbox_leases.sql', import.meta.url), 'utf8')
    await applyTestMigrations(pool, [
      dockerMigration,
      deploymentMigration,
      deploymentMigration,
      outboxMigration,
      outboxMigration,
    ])

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

    const [claimedA, claimedB] = await Promise.all([
      claimDeploymentOutbox(pool, { workerId: `worker-a-${randomUUID()}`, ownerId, limit: 10 }),
      claimDeploymentOutbox(pool, { workerId: `worker-b-${randomUUID()}`, ownerId, limit: 10 }),
    ])
    const allClaims = [...claimedA, ...claimedB].filter(message => message.id === outbox.rows[0].id)
    assert.equal(allClaims.length, 1, 'one concurrent worker may own the event lease')
    const firstLease = allClaims[0]
    await pool.query(
      'UPDATE arsy_deployment_outbox SET locked_until = now() - interval \'1 second\' WHERE id = $1',
      [firstLease.id],
    )
    const secondLease = (await claimDeploymentOutbox(pool, {
      workerId: `worker-reclaim-${randomUUID()}`,
      ownerId,
      limit: 10,
    })).find(message => message.id === firstLease.id)
    assert.ok(secondLease)
    assert.notEqual(secondLease.leaseToken, firstLease.leaseToken)
    assert.equal(await acknowledgeDeploymentOutbox(pool, firstLease), false, 'expired lease token must be fenced')
    assert.equal(await acknowledgeDeploymentOutbox(pool, secondLease), true)

    const retryOperation = await createDeploymentOperation(pool, {
      ...request,
      idempotencyKey: `deploy-retry-${randomUUID()}`,
    })
    const retryOutbox = await pool.query(
      'SELECT id FROM arsy_deployment_outbox WHERE operation_id = $1 AND owner_id = $2',
      [retryOperation.operation.id, ownerId],
    )
    await pool.query(
      'UPDATE arsy_deployment_outbox SET max_attempts = 2 WHERE id = $1',
      [retryOutbox.rows[0].id],
    )
    const firstRetryLease = (await claimDeploymentOutbox(pool, {
      workerId: `worker-retry-a-${randomUUID()}`,
      ownerId,
    })).find(message => message.id === retryOutbox.rows[0].id)
    assert.ok(firstRetryLease)
    assert.equal(await retryDeploymentOutbox(pool, firstRetryLease, 'handler_failed'), 'retry_scheduled')
    const retrySchedule = await pool.query(
      'SELECT available_at > now() AS delayed FROM arsy_deployment_outbox WHERE id = $1',
      [retryOutbox.rows[0].id],
    )
    assert.equal(retrySchedule.rows[0].delayed, true, 'retry delay must use PostgreSQL time')
    await pool.query(
      'UPDATE arsy_deployment_outbox SET available_at = now() - interval \'1 second\' WHERE id = $1',
      [retryOutbox.rows[0].id],
    )
    const finalRetryLease = (await claimDeploymentOutbox(pool, {
      workerId: `worker-retry-b-${randomUUID()}`,
      ownerId,
    })).find(message => message.id === retryOutbox.rows[0].id)
    assert.ok(finalRetryLease)
    assert.equal(finalRetryLease.attemptCount, 2)
    assert.equal(await retryDeploymentOutbox(pool, finalRetryLease, 'handler_failed'), 'dead_lettered')
    const deadLetter = await pool.query(
      'SELECT dead_lettered_at, last_error_code FROM arsy_deployment_outbox WHERE id = $1',
      [retryOutbox.rows[0].id],
    )
    assert.ok(deadLetter.rows[0].dead_lettered_at)
    assert.equal(deadLetter.rows[0].last_error_code, 'handler_failed')

    const exhaustedOperations = await Promise.all([
      createDeploymentOperation(pool, { ...request, idempotencyKey: `deploy-exhausted-a-${randomUUID()}` }),
      createDeploymentOperation(pool, { ...request, idempotencyKey: `deploy-exhausted-b-${randomUUID()}` }),
      createDeploymentOperation(pool, { ...request, idempotencyKey: `deploy-exhausted-c-${randomUUID()}` }),
    ])
    const exhaustedIds = exhaustedOperations.map(item => item.operation.id)
    await pool.query(
      'UPDATE arsy_deployment_outbox SET max_attempts = 1 WHERE operation_id = ANY($1::uuid[])',
      [exhaustedIds],
    )
    const finalLeases = await claimDeploymentOutbox(pool, {
      workerId: `worker-final-attempt-${randomUUID()}`,
      ownerId,
      limit: 3,
    })
    assert.equal(finalLeases.length, 3)
    await pool.query(
      'UPDATE arsy_deployment_outbox SET locked_until = now() - interval \'1 second\' WHERE operation_id = ANY($1::uuid[])',
      [exhaustedIds],
    )
    const [reapedA, reapedB] = await Promise.all([
      reapExpiredDeploymentOutbox(pool, { ownerId, limit: 1 }),
      reapExpiredDeploymentOutbox(pool, { ownerId, limit: 1 }),
    ])
    assert.equal(reapedA + reapedB, 2, 'concurrent bounded reapers must process separate rows')
    assert.equal(await reapExpiredDeploymentOutbox(pool, { ownerId, limit: 1 }), 1)
    const exhaustedRows = await pool.query(
      'SELECT count(*)::integer AS count FROM arsy_deployment_outbox WHERE operation_id = ANY($1::uuid[]) AND dead_lettered_at IS NOT NULL',
      [exhaustedIds],
    )
    assert.equal(exhaustedRows.rows[0].count, 3)

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
