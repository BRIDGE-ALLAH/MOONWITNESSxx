import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  acknowledgeDeploymentOutbox,
  claimDeploymentOutbox,
  reapExpiredDeploymentOutbox,
  retryDeploymentOutbox,
} from '../src/deployments/outbox-store.ts'
import { dispatchDeploymentOutboxBatch } from '../src/deployments/outbox-dispatcher.ts'

class FakePool {
  messages = []
  statements = []

  add({ ownerId = 'operator-1', id, attemptCount = 0, maxAttempts = 8, eventType = 'deployment.operation.queued', payload = { operationId: 'op-1' } } = {}) {
    this.messages.push({
      id: id ?? `outbox-${this.messages.length + 1}`,
      operation_id: 'op-1',
      owner_id: ownerId,
      event_type: eventType,
      payload,
      attempt_count: attemptCount,
      max_attempts: maxAttempts,
      created_at: new Date().toISOString(),
      available_at: Date.now(),
      locked_by: null,
      locked_until: null,
      lease_token: null,
      delivered_at: null,
      dead_lettered_at: null,
      last_error_code: null,
    })
  }

  async query(statement, values = []) {
    this.statements.push({ statement, values })
    if (statement.includes('WITH expired AS')) {
      const [limit, ownerId] = values
      const candidates = this.messages
        .filter(row => !row.delivered_at && !row.dead_lettered_at &&
          row.attempt_count >= row.max_attempts &&
          (!row.locked_until || row.locked_until.getTime() <= Date.now()) &&
          (!ownerId || row.owner_id === ownerId))
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, limit)
      for (const row of candidates) {
        row.dead_lettered_at = new Date()
        row.locked_by = null
        row.locked_until = null
        row.lease_token = null
        row.last_error_code ??= 'attempts_exhausted'
      }
      return { rows: candidates.map(row => ({ id: row.id })) }
    }
    if (statement.includes('WITH candidates AS')) {
      const [workerId, limit, leaseSeconds, ownerId] = values
      const candidates = this.messages
        .filter(row => !row.delivered_at && !row.dead_lettered_at &&
          row.available_at <= Date.now() &&
          (!row.locked_until || row.locked_until.getTime() <= Date.now()) &&
          row.attempt_count < row.max_attempts &&
          (!ownerId || row.owner_id === ownerId))
        .sort((a, b) => a.available_at - b.available_at)
        .slice(0, limit)
      for (const row of candidates) {
        row.locked_by = workerId
        row.locked_until = new Date(Date.now() + leaseSeconds * 1000)
        row.lease_token = randomUUID()
        row.attempt_count += 1
      }
      return { rows: candidates.map(row => ({
        id: row.id,
        operation_id: row.operation_id,
        owner_id: row.owner_id,
        event_type: row.event_type,
        payload: row.payload,
        attempt_count: row.attempt_count,
        max_attempts: row.max_attempts,
        created_at: row.created_at,
        locked_until: row.locked_until,
        lease_token: row.lease_token,
      })) }
    }
    if (statement.includes('SET delivered_at = now()')) {
      const [id, workerId, token] = values
      const row = this.messages.find(item => item.id === id)
      if (!row || row.locked_by !== workerId || row.lease_token !== token ||
          !row.locked_until || row.locked_until.getTime() <= Date.now() ||
          row.delivered_at || row.dead_lettered_at) return { rows: [] }
      row.delivered_at = new Date()
      row.locked_by = null
      row.locked_until = null
      row.lease_token = null
      row.last_error_code = null
      return { rows: [{ id }] }
    }
    if (statement.includes('SET locked_by = NULL') && statement.includes('available_at = CASE')) {
      const [id, workerId, token, errorCode] = values
      const row = this.messages.find(item => item.id === id)
      if (!row || row.locked_by !== workerId || row.lease_token !== token ||
          !row.locked_until || row.locked_until.getTime() <= Date.now() ||
          row.delivered_at || row.dead_lettered_at) return { rows: [] }
      row.locked_by = null
      row.locked_until = null
      row.lease_token = null
      row.last_error_code = errorCode
      if (row.attempt_count >= row.max_attempts) {
        row.dead_lettered_at = new Date()
      } else {
        const delaySeconds = Math.min(3600, 5 * (2 ** Math.max(0, row.attempt_count - 1)))
        row.available_at = Date.now() + delaySeconds * 1000
      }
      return { rows: [{ dead_lettered_at: row.dead_lettered_at }] }
    }
    throw new Error('Unexpected fake outbox SQL')
  }
}

test('concurrent workers cannot claim the same outbox event', async () => {
  const pool = new FakePool()
  pool.add()
  const [first, second] = await Promise.all([
    claimDeploymentOutbox(pool, { workerId: 'worker-a', limit: 5 }),
    claimDeploymentOutbox(pool, { workerId: 'worker-b', limit: 5 }),
  ])
  assert.equal(first.length + second.length, 1)
})

test('claim can be scoped to one owner without changing the global default', async () => {
  const pool = new FakePool()
  pool.add({ id: 'owner-a-message', ownerId: 'owner-a' })
  pool.add({ id: 'owner-b-message', ownerId: 'owner-b' })
  const claimed = await claimDeploymentOutbox(pool, { workerId: 'worker-a', ownerId: 'owner-a', limit: 10 })
  assert.deepEqual(claimed.map(message => message.id), ['owner-a-message'])
  assert.equal(pool.messages[1].locked_by, null)
  assert.equal(pool.statements[0].values[3], 'owner-a')
})

test('an expired lease is reclaimed with a new fencing token; stale ack and retry fail', async () => {
  const pool = new FakePool()
  pool.add()
  const first = (await claimDeploymentOutbox(pool, { workerId: 'worker-a' }))[0]
  assert.ok(first)

  pool.messages[0].locked_until = new Date(Date.now() - 1000)
  const second = (await claimDeploymentOutbox(pool, { workerId: 'worker-b' }))[0]
  assert.ok(second)
  assert.notEqual(second.leaseToken, first.leaseToken)
  assert.equal(await acknowledgeDeploymentOutbox(pool, first), false)
  assert.equal(await retryDeploymentOutbox(pool, first, 'handler_failed'), 'lease_lost')
  assert.equal(await acknowledgeDeploymentOutbox(pool, second), true)
})

test('retry uses a safe error code and the final failed attempt is dead-lettered', async () => {
  const pool = new FakePool()
  pool.add({ maxAttempts: 2 })
  const first = (await claimDeploymentOutbox(pool, { workerId: 'worker-a' }))[0]
  assert.equal(await retryDeploymentOutbox(pool, first, 'HANDLER ERROR WITH SECRETS'), 'retry_scheduled')
  const retryStatement = pool.statements.at(-1)
  assert.match(retryStatement.statement, /now\(\) \+ make_interval/)
  assert.equal(retryStatement.values.length, 4)
  assert.equal(pool.messages[0].last_error_code, 'handler_failed')
  assert.ok(pool.messages[0].available_at > Date.now())

  pool.messages[0].available_at = Date.now() - 1
  const second = (await claimDeploymentOutbox(pool, { workerId: 'worker-b' }))[0]
  assert.equal(second.attemptCount, 2)
  assert.equal(await retryDeploymentOutbox(pool, second, 'handler_failed'), 'dead_lettered')
  assert.ok(pool.messages[0].dead_lettered_at)
  assert.equal((await claimDeploymentOutbox(pool, { workerId: 'worker-c' })).length, 0)
})

test('a worker that dies on its final attempt is dead-lettered after lease expiry', async () => {
  const pool = new FakePool()
  pool.add({ maxAttempts: 1 })
  const first = (await claimDeploymentOutbox(pool, { workerId: 'worker-a' }))[0]
  pool.messages[0].locked_until = new Date(Date.now() - 1000)
  assert.equal(await reapExpiredDeploymentOutbox(pool, { limit: 10 }), 1)
  assert.deepEqual(await claimDeploymentOutbox(pool, { workerId: 'worker-b' }), [])
  assert.ok(pool.messages[0].dead_lettered_at)
  assert.equal(pool.messages[0].last_error_code, 'attempts_exhausted')
  assert.equal(await acknowledgeDeploymentOutbox(pool, first), false)
})

test('expired final-attempt reaping is bounded and owner-scoped', async () => {
  const pool = new FakePool()
  pool.add({ id: 'expired-owner-a', ownerId: 'owner-a', maxAttempts: 1, attemptCount: 1 })
  pool.add({ id: 'expired-owner-b', ownerId: 'owner-a', maxAttempts: 1, attemptCount: 1 })
  pool.add({ id: 'expired-owner-c', ownerId: 'owner-b', maxAttempts: 1, attemptCount: 1 })
  const first = await reapExpiredDeploymentOutbox(pool, { ownerId: 'owner-a', limit: 1 })
  const second = await reapExpiredDeploymentOutbox(pool, { ownerId: 'owner-a', limit: 1 })
  assert.equal(first, 1)
  assert.equal(second, 1)
  assert.ok(pool.messages[0].dead_lettered_at)
  assert.ok(pool.messages[1].dead_lettered_at)
  assert.equal(pool.messages[2].dead_lettered_at, null)
  assert.match(pool.statements[0].statement, /FOR UPDATE SKIP LOCKED/)
  assert.equal(pool.statements[0].values[1], 'owner-a')
})

test('retry scheduling is delegated to PostgreSQL time rather than a worker timestamp', async () => {
  const pool = new FakePool()
  pool.add({ maxAttempts: 2 })
  const message = (await claimDeploymentOutbox(pool, { workerId: 'worker-a' }))[0]
  await retryDeploymentOutbox(pool, message, 'handler_failed')
  const retryStatement = pool.statements.at(-1)
  assert.match(retryStatement.statement, /now\(\) \+ make_interval/)
  assert.equal(retryStatement.values.length, 4)
  assert.equal(retryStatement.values[3], 'handler_failed')
})

test('dispatcher reports expired dead letters in its bounded result', async () => {
  const pool = new FakePool()
  pool.add({ id: 'expired-final', maxAttempts: 1 })
  const lease = (await claimDeploymentOutbox(pool, { workerId: 'worker-a' }))[0]
  pool.messages[0].locked_until = new Date(Date.now() - 1000)
  const result = await dispatchDeploymentOutboxBatch(pool, {
    workerId: 'reaper-worker',
    limit: 1,
    handlers: {},
  })
  assert.equal(result.deadLettered, 1)
  assert.equal(result.claimed, 0)
  assert.equal(pool.messages[0].dead_lettered_at !== null, true)
  assert.equal(await acknowledgeDeploymentOutbox(pool, lease), false)
})

test('dispatcher acknowledges success, retries handler failures and never treats missing handlers as delivered', async () => {
  const pool = new FakePool()
  pool.add({ id: 'outbox-ok' })
  pool.add({ id: 'outbox-fail' })
  pool.add({ id: 'outbox-missing', eventType: 'unknown.event' })
  const result = await dispatchDeploymentOutboxBatch(pool, {
    workerId: 'dispatcher-1',
    handlers: {
      'deployment.operation.queued': async message => {
        if (message.id === 'outbox-fail') {
          const error = new Error('Sensitive error text must not be persisted')
          error.code = 'provider_unavailable'
          throw error
        }
      },
    },
  })
  assert.deepEqual(result, {
    claimed: 3,
    delivered: 1,
    retryScheduled: 2,
    deadLettered: 0,
    leaseLost: 0,
  })
  assert.ok(pool.messages.find(row => row.id === 'outbox-ok').delivered_at)
  assert.equal(pool.messages.find(row => row.id === 'outbox-fail').last_error_code, 'provider_unavailable')
  assert.equal(pool.messages.find(row => row.id === 'outbox-missing').last_error_code, 'handler_not_registered')
  assert.equal(pool.messages.find(row => row.id === 'outbox-fail').delivered_at, null)
})
