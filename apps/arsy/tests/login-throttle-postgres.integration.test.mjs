import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { createApp } from '../src/app.ts'

test('PostgreSQL login throttle is shared across two ARSY instances and reserves concurrent attempts', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `login-throttle-integration-${randomUUID()}`
  const token = 'integration-only-arsy-service-token'
  const networkHash = 'a'.repeat(64)
  const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
  const poolA = createDatabasePool()
  const poolB = createDatabasePool()
  const oracleClient = { submitJob: async () => { throw new Error('not used by this test') }, getJob: async () => { throw new Error('not used by this test') } }
  const appA = await createApp({ databasePool: poolA, logger: false, env, oracleClient })
  const appB = await createApp({ databasePool: poolB, logger: false, env, oracleClient })
  const headers = { 'x-arsy-operator-token': token }
  const send = (app, action, hash = networkHash) => app.inject({
    method: 'POST',
    url: '/api/v1/auth/login-attempts',
    headers,
    payload: { action, networkHash: hash },
  })
  const failedAttempt = async (app) => {
    const reserved = await send(app, 'attempt')
    assert.equal(reserved.statusCode, 200)
    assert.equal(reserved.json().data.allowed, true)
    return send(app, 'failure')
  }

  try {
    const migration = await readFile(new URL('../migrations/006_shared_login_attempts.sql', import.meta.url), 'utf8')
    await poolA.query(migration)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failure = await failedAttempt(appA)
      assert.equal(failure.statusCode, 200)
      assert.equal(failure.json().data.allowed, true)
    }

    const fifthAttempt = await send(appB, 'attempt')
    assert.equal(fifthAttempt.json().data.allowed, true)
    const fifthFailure = await send(appB, 'failure')
    assert.equal(fifthFailure.json().data.allowed, false)
    assert.ok(fifthFailure.json().data.retryAfterSeconds > 0)
    assert.equal((await send(appA, 'attempt')).json().data.allowed, false)

    // Account bucket applies even when the network identity changes.
    assert.equal((await send(appA, 'attempt', 'b'.repeat(64))).json().data.allowed, false)

    // Expire the window and prove a new attempt starts a fresh counter.
    await poolA.query(
      "UPDATE arsy_login_attempt_buckets SET window_started_at = now() - interval '16 minutes', attempt_count = 0, blocked_until = NULL WHERE owner_id = $1",
      [ownerId],
    )
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failure = await failedAttempt(appA)
      assert.equal(failure.json().data.allowed, true)
    }
    const fifthAfterExpiry = await send(appA, 'attempt')
    assert.equal(fifthAfterExpiry.json().data.allowed, true)
    assert.equal((await send(appA, 'failure')).json().data.allowed, false)

    const success = await send(appB, 'success')
    assert.equal(success.json().data.allowed, true)
    const clearedBuckets = await poolA.query(
      'SELECT COUNT(*)::int AS count FROM arsy_login_attempt_buckets WHERE owner_id = $1',
      [ownerId],
    )
    assert.equal(clearedBuckets.rows[0].count, 0)

    // A burst across two independent ARSY instances reserves at most five KDF slots.
    const concurrentAttempts = await Promise.all(
      Array.from({ length: 10 }, (_, index) => send(index % 2 === 0 ? appA : appB, 'attempt')),
    )
    assert.equal(concurrentAttempts.length, 10)
    assert.ok(concurrentAttempts.every((response) => response.statusCode === 200))
    assert.equal(concurrentAttempts.filter((response) => response.json().data.allowed).length, 5)
    assert.equal(concurrentAttempts.filter((response) => !response.json().data.allowed).length, 5)
    assert.equal((await send(appA, 'attempt')).json().data.allowed, false)
  } finally {
    await poolA.query('DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await appA.close()
    await appB.close()
  }
})
