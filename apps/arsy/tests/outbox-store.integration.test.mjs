import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createDeployment, createDeploymentOperation } from '../src/deployments/operation-store.ts'
import {
  acknowledgeDeploymentOutbox,
  claimDeploymentOutbox,
  retryDeploymentOutbox,
} from '../src/deployments/outbox-store.ts'

const databaseUrl = process.env.TEST_DATABASE_URL

test('deployment outbox claims are concurrent, fenced, retry-bounded and dead-letter exhausted work', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is not configured; run in the PostgreSQL integration job',
  timeout: 60_000,
}, async () => {
  const adminPool = new Pool({ connectionString: databaseUrl, max: 1 })
  const schemaName = `arsy_outbox_${randomUUID().replaceAll('-', '')}`
  await adminPool.query(`CREATE SCHEMA "${schemaName}"`)
  const pool = new Pool({ connectionString: databaseUrl, max: 8, options: `-c search_path=${schemaName}` })
  const ownerId = `outbox-ci-${randomUUID()}`
  const hostId = randomUUID()
  try {
    for (const path of [
      '../migrations/002_docker_connector.sql',
      '../migrations/003_arsy_deployment_operations.sql',
      '../migrations/005_arsy_deployment_outbox_leases.sql',
    ]) {
      const sql = await readFile(new URL(path, import.meta.url), 'utf8')
      await pool.query(sql)
      await pool.query(sql)
    }

    await pool.query(
      'INSERT INTO docker_connector_servers (id, owner_id, name, kind, endpoint_url, encrypted_credentials) VALUES ($1, $2, $3, $4, NULL, NULL)',
      [hostId, ownerId, 'Outbox integration host', 'local'],
    )
    const deployment = await createDeployment(pool, {
      ownerId,
      actorId: ownerId,
      dockerServerId: hostId,
      name: 'outbox-integration-app',
    })

    const createOperation = async (suffix) => createDeploymentOperation(pool, {
      ownerId,
      actorId: ownerId,
      deploymentId: deployment.id,
      kind: 'deploy',
      idempotencyKey: `outbox-integration-${suffix}-${randomUUID()}`,
    })

    await Promise.all([
      createOperation('concurrent-a'),
      createOperation('concurrent-b'),
    ])
    const [claimA, claimB] = await Promise.all([
      claimDeploymentOutbox(pool, { workerId: 'worker-a', ownerId, limit: 1, leaseSeconds: 30 }),
      claimDeploymentOutbox(pool, { workerId: 'worker-b', ownerId, limit: 1, leaseSeconds: 30 }),
    ])
    assert.equal(claimA.length, 1)
    assert.equal(claimB.length, 1)
    assert.notEqual(claimA[0].id, claimB[0].id)
    assert.notEqual(claimA[0].leaseToken, claimB[0].leaseToken)
    assert.equal(await acknowledgeDeploymentOutbox(pool, claimA[0]), true)
    assert.equal(await acknowledgeDeploymentOutbox(pool, claimB[0]), true)

    const expiring = await createOperation('lease-expiry')
    const oldLease = (await claimDeploymentOutbox(pool, {
      workerId: 'worker-old',
      ownerId,
      limit: 1,
      leaseSeconds: 5,
    }))[0]
    assert.ok(oldLease)
    assert.equal(oldLease.operationId, expiring.operation.id)
    await new Promise((resolve) => setTimeout(resolve, 5_200))
    const newLease = (await claimDeploymentOutbox(pool, {
      workerId: 'worker-new',
      ownerId,
      limit: 1,
      leaseSeconds: 30,
    }))[0]
    assert.ok(newLease)
    assert.equal(newLease.id, oldLease.id)
    assert.notEqual(newLease.leaseToken, oldLease.leaseToken)
    assert.equal(await acknowledgeDeploymentOutbox(pool, oldLease), false)
    assert.equal(await retryDeploymentOutbox(pool, oldLease, 'stale_worker'), 'lease_lost')
    assert.equal(await acknowledgeDeploymentOutbox(pool, newLease), true)

    const retrying = await createOperation('retry-dead-letter')
    await pool.query('UPDATE arsy_deployment_outbox SET max_attempts = 2 WHERE operation_id = $1', [retrying.operation.id])
    const firstAttempt = (await claimDeploymentOutbox(pool, {
      workerId: 'worker-retry-a',
      ownerId,
      limit: 1,
      leaseSeconds: 30,
    }))[0]
    assert.equal(firstAttempt.operationId, retrying.operation.id)
    assert.equal(await retryDeploymentOutbox(pool, firstAttempt, 'handler_failed'), 'retry_scheduled')
    const retrySchedule = await pool.query(
      'SELECT available_at > now() AS delayed FROM arsy_deployment_outbox WHERE id = $1',
      [firstAttempt.id],
    )
    assert.equal(retrySchedule.rows[0].delayed, true)

    await pool.query('UPDATE arsy_deployment_outbox SET available_at = now() WHERE id = $1', [firstAttempt.id])
    const secondAttempt = (await claimDeploymentOutbox(pool, {
      workerId: 'worker-retry-b',
      ownerId,
      limit: 1,
      leaseSeconds: 30,
    }))[0]
    assert.equal(secondAttempt.id, firstAttempt.id)
    assert.equal(secondAttempt.attemptCount, 2)
    assert.equal(await retryDeploymentOutbox(pool, secondAttempt, 'handler_failed'), 'dead_lettered')

    const exhausted = await createOperation('crashed-final-attempt')
    await pool.query('UPDATE arsy_deployment_outbox SET max_attempts = 1 WHERE operation_id = $1', [exhausted.operation.id])
    const finalLease = (await claimDeploymentOutbox(pool, {
      workerId: 'worker-crashed',
      ownerId,
      limit: 1,
      leaseSeconds: 5,
    }))[0]
    assert.equal(finalLease.operationId, exhausted.operation.id)
    await new Promise((resolve) => setTimeout(resolve, 5_200))
    const noClaim = await claimDeploymentOutbox(pool, {
      workerId: 'reaper',
      ownerId,
      limit: 1,
      leaseSeconds: 30,
    })
    assert.equal(noClaim.length, 0)
    const deadLetter = await pool.query(
      'SELECT dead_lettered_at IS NOT NULL AS dead FROM arsy_deployment_outbox WHERE id = $1',
      [finalLease.id],
    )
    assert.equal(deadLetter.rows[0].dead, true)
  } finally {
    await pool.end()
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
    await adminPool.end()
  }
})
