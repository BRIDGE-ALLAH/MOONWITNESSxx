import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acknowledgeDeploymentOutbox,
  claimDeploymentOutbox,
  reapExpiredDeploymentOutbox,
  retryDeploymentOutbox,
} from '../src/deployments/outbox-store.ts'

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  operation_id: '22222222-2222-4222-8222-222222222222',
  owner_id: 'owner-1',
  event_type: 'deployment.operation.queued',
  payload: { operationId: '22222222-2222-4222-8222-222222222222' },
  attempt_count: 1,
  max_attempts: 8,
  created_at: '2026-11-08T00:00:00.000Z',
  locked_by: 'worker-a',
  lease_token: '33333333-3333-4333-8333-333333333333',
  locked_until: '2026-11-08T00:05:00.000Z',
}

class FakePool {
  statements = []
  nextRows = [row]
  async query(statement, values) {
    this.statements.push({ statement, values })
    return { rows: this.nextRows }
  }
}

test('claim uses one atomic SKIP LOCKED statement and returns a fenced lease', async () => {
  const pool = new FakePool()
  const claimed = await claimDeploymentOutbox(pool, { workerId: 'worker-a', limit: 5, leaseSeconds: 30 })
  assert.equal(claimed.length, 1)
  assert.equal(claimed[0].id, row.id)
  assert.equal(claimed[0].leaseOwner, 'worker-a')
  assert.equal(claimed[0].leaseToken, row.lease_token)
  assert.equal(claimed[0].attemptCount, 1)
  assert.deepEqual(claimed[0].payload, row.payload)
  assert.match(pool.statements[0].statement, /FOR UPDATE SKIP LOCKED/)
  assert.match(pool.statements[0].statement, /gen_random_uuid\(\)/)
  assert.match(pool.statements[0].statement, /dead_lettered_at/)
})

test('claim rejects invalid worker, batch and lease bounds before querying', async () => {
  const pool = new FakePool()
  await assert.rejects(claimDeploymentOutbox(pool, { workerId: '', limit: 1, leaseSeconds: 30 }), /workerId/)
  await assert.rejects(claimDeploymentOutbox(pool, { workerId: 'worker-a', limit: 51, leaseSeconds: 30 }), /limit/)
  await assert.rejects(claimDeploymentOutbox(pool, { workerId: 'worker-a', limit: 1, leaseSeconds: 4 }), /lease/)
  assert.equal(pool.statements.length, 0)
})

test('expired exhausted leases are reaped in bounded owner-scoped batches', async () => {
  const pool = new FakePool()
  pool.nextRows = [{ id: row.id }]
  assert.equal(await reapExpiredDeploymentOutbox(pool, { ownerId: 'owner-1', limit: 10 }), 1)
  assert.match(pool.statements[0].statement, /attempt_count >= max_attempts/)
  assert.match(pool.statements[0].statement, /FOR UPDATE SKIP LOCKED/)
  assert.match(pool.statements[0].statement, /dead_lettered_at = now\(\)/)
  assert.equal(pool.statements[0].values[1], 'owner-1')
  await assert.rejects(reapExpiredDeploymentOutbox(pool, { limit: 51 }), /reaper limit/)
})

test('acknowledgement requires the exact unexpired worker lease token', async () => {
  const pool = new FakePool()
  pool.nextRows = [{ id: row.id }]
  assert.equal(await acknowledgeDeploymentOutbox(pool, {
    id: row.id,
    operationId: row.operation_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    payload: row.payload,
    attemptCount: 1,
    maxAttempts: 8,
    createdAt: row.created_at,
    leaseOwner: 'worker-a',
    leaseToken: row.lease_token,
    leaseUntil: row.locked_until,
  }), true)
  assert.match(pool.statements[0].statement, /lease_token = \$3/)
  assert.match(pool.statements[0].statement, /locked_until > now\(\)/)
})

test('acknowledgement reports a stale or stolen lease without mutating a row', async () => {
  const pool = new FakePool()
  pool.nextRows = []
  const message = {
    id: row.id,
    operationId: row.operation_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    payload: row.payload,
    attemptCount: 1,
    maxAttempts: 8,
    createdAt: row.created_at,
    leaseOwner: 'worker-a',
    leaseToken: row.lease_token,
    leaseUntil: row.locked_until,
  }
  assert.equal(await acknowledgeDeploymentOutbox(pool, message), false)
})

test('retry schedules bounded backoff and never stores raw error text', async () => {
  const pool = new FakePool()
  pool.nextRows = [{ dead_lettered_at: null }]
  const message = {
    id: row.id,
    operationId: row.operation_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    payload: row.payload,
    attemptCount: 1,
    maxAttempts: 8,
    createdAt: row.created_at,
    leaseOwner: 'worker-a',
    leaseToken: row.lease_token,
    leaseUntil: row.locked_until,
  }
  assert.equal(await retryDeploymentOutbox(pool, message, 'handler_failed'), 'retry_scheduled')
  assert.match(pool.statements[0].statement, /make_interval/)
  assert.equal(pool.statements[0].values[3], 'handler_failed')
  assert.doesNotMatch(pool.statements[0].values.join(' '), /password|secret|bearer/i)
})

test('retry dead-letters exhausted attempts and reports lost fencing tokens', async () => {
  const pool = new FakePool()
  const message = {
    id: row.id,
    operationId: row.operation_id,
    ownerId: row.owner_id,
    eventType: row.event_type,
    payload: row.payload,
    attemptCount: 8,
    maxAttempts: 8,
    createdAt: row.created_at,
    leaseOwner: 'worker-a',
    leaseToken: row.lease_token,
    leaseUntil: row.locked_until,
  }
  pool.nextRows = [{ dead_lettered_at: '2026-11-08T00:00:00.000Z' }]
  assert.equal(await retryDeploymentOutbox(pool, message, 'handler_failed'), 'dead_lettered')
  pool.nextRows = []
  assert.equal(await retryDeploymentOutbox(pool, message, 'handler_failed'), 'lease_lost')
})
