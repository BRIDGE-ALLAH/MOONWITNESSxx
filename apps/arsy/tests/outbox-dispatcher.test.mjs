import test from 'node:test'
import assert from 'node:assert/strict'
import { dispatchDeploymentOutboxBatch } from '../src/deployments/outbox-dispatcher.ts'

const claimedRow = {
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
  claimRows = [claimedRow]
  ackRows = [{ id: claimedRow.id }]
  retryRows = [{ dead_lettered_at: null }]
  async query(statement, values) {
    this.statements.push({ statement, values })
    if (statement.includes('WITH exhausted_candidates AS')) return { rows: this.claimRows }
    if (statement.includes('SET delivered_at')) return { rows: this.ackRows }
    if (statement.includes('SET last_error_code')) return { rows: this.retryRows }
    throw new Error('Unexpected outbox SQL statement')
  }
}

test('dispatcher calls a registered handler and acknowledges its exact lease', async () => {
  const pool = new FakePool()
  let received
  const result = await dispatchDeploymentOutboxBatch(pool, {
    workerId: 'worker-a',
    limit: 1,
    leaseSeconds: 30,
    handlers: {
      'deployment.operation.queued': async (message) => { received = message },
    },
  })
  assert.equal(received.id, claimedRow.id)
  assert.equal('leaseToken' in received, false)
  assert.deepEqual(result, { claimed: 1, delivered: 1, retryScheduled: 0, deadLettered: 0, leaseLost: 0 })
})

test('dispatcher retries an unregistered event without invoking a handler', async () => {
  const pool = new FakePool()
  const result = await dispatchDeploymentOutboxBatch(pool, {
    workerId: 'worker-a',
    limit: 1,
    leaseSeconds: 30,
    handlers: {},
  })
  assert.deepEqual(result, { claimed: 1, delivered: 0, retryScheduled: 1, deadLettered: 0, leaseLost: 0 })
  assert.equal(pool.statements.at(-1).values[3], 'handler_not_registered')
})

test('dispatcher stores only stable error codes, never handler exception messages', async () => {
  const pool = new FakePool()
  const result = await dispatchDeploymentOutboxBatch(pool, {
    workerId: 'worker-a',
    limit: 1,
    leaseSeconds: 30,
    handlers: {
      'deployment.operation.queued': async () => {
        const error = new Error('password=do-not-persist')
        throw error
      },
    },
  })
  assert.deepEqual(result, { claimed: 1, delivered: 0, retryScheduled: 1, deadLettered: 0, leaseLost: 0 })
  assert.equal(pool.statements.at(-1).values[3], 'handler_failed')
  assert.doesNotMatch(pool.statements.at(-1).values.join(' '), /password|do-not-persist/i)
})

test('dispatcher reports fencing loss when acknowledgement or retry no longer owns the lease', async () => {
  const pool = new FakePool()
  pool.ackRows = []
  const result = await dispatchDeploymentOutboxBatch(pool, {
    workerId: 'worker-a',
    limit: 1,
    leaseSeconds: 30,
    handlers: { 'deployment.operation.queued': async () => undefined },
  })
  assert.deepEqual(result, { claimed: 1, delivered: 0, retryScheduled: 0, deadLettered: 0, leaseLost: 1 })
})
