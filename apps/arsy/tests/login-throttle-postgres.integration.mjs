import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { createApp } from '../src/app.ts'

test('PostgreSQL login throttle is shared across two ARSY instances and clears on success', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `login-throttle-integration-${randomUUID()}`
  const token = 'integration-only-arsy-service-token'
  const networkHash = 'a'.repeat(64)
  const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
  const poolA = createDatabasePool()
  const poolB = createDatabasePool()
  const appA = await createApp({ databasePool: poolA, logger: false, env })
  const appB = await createApp({ databasePool: poolB, logger: false, env })
  const headers = { 'x-arsy-operator-token': token }
  const send = (app, action) => app.inject({
    method: 'POST',
    url: '/api/v1/auth/login-attempts',
    headers,
    payload: { action, networkHash },
  })

  try {
    const initial = await send(appA, 'check')
    assert.equal(initial.statusCode, 200)
    assert.deepEqual(initial.json().data, { allowed: true, retryAfterSeconds: 0 })

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failure = await send(appA, 'failure')
      assert.equal(failure.statusCode, 200)
      assert.equal(failure.json().data.allowed, true)
    }

    const fifthFailure = await send(appB, 'failure')
    assert.equal(fifthFailure.statusCode, 200)
    assert.equal(fifthFailure.json().data.allowed, false)
    assert.ok(fifthFailure.json().data.retryAfterSeconds > 0)

    const sharedCheck = await send(appA, 'check')
    assert.equal(sharedCheck.json().data.allowed, false)
    assert.ok(sharedCheck.json().data.retryAfterSeconds > 0)

    const stored = await poolA.query(
      'SELECT bucket_key, failure_count FROM arsy_login_attempt_buckets WHERE owner_id = $1 ORDER BY bucket_key',
      [ownerId],
    )
    assert.equal(stored.rows.length, 2)
    assert.ok(stored.rows.every((row) => Number(row.failure_count) === 5))

    const success = await send(appB, 'success')
    assert.equal(success.json().data.allowed, true)
    const cleared = await send(appA, 'check')
    assert.deepEqual(cleared.json().data, { allowed: true, retryAfterSeconds: 0 })
  } finally {
    await appA.close()
    await appB.close()
  }
})
