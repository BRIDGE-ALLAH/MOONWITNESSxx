import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createApp } from '../src/app.ts'

const databaseUrl = process.env.TEST_DATABASE_URL
const networkHash = 'a'.repeat(64)

const oracleClient = {
  submitJob: async () => { throw new Error('ORACLE is not used by login limiter integration tests') },
  getJob: async () => { throw new Error('ORACLE is not used by login limiter integration tests') },
}

test('PostgreSQL login limiter is atomic across ARSY instances and survives instance restart', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is not configured; run in the PostgreSQL integration workflow',
}, async () => {
  const setupPool = new Pool({ connectionString: databaseUrl, max: 2 })
  const ownerId = `login-limiter-ci-${randomUUID()}`
  const secondOwnerId = `login-limiter-other-ci-${randomUUID()}`
  const token = `login-limiter-${randomUUID()}-${randomUUID()}`
  const secondToken = `login-limiter-other-${randomUUID()}-${randomUUID()}`
  const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
  const secondEnv = { ARSY_OPERATOR_ID: secondOwnerId, ARSY_OPERATOR_TOKEN: secondToken }
  const apps = new Set()
  let migrationApplied = false

  function startInstance(instanceEnv = env) {
    const pool = new Pool({ connectionString: databaseUrl, max: 5 })
    const app = createApp({ databasePool: pool, logger: false, env: instanceEnv, oracleClient })
    apps.add(app)
    return app
  }

  async function send(app, action, serviceToken = token) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login-attempts',
      headers: { 'x-arsy-operator-token': serviceToken },
      payload: { action, networkHash },
    })
    assert.equal(response.statusCode, 200, response.body)
    return response.json().data
  }

  try {
    const migration = await readFile(
      new URL('../migrations/006_shared_login_attempts.sql', import.meta.url),
      'utf8',
    )
    await setupPool.query(migration)
    await setupPool.query(migration)
    migrationApplied = true

    const appA = startInstance()
    const appB = startInstance()

    for (let index = 0; index < 5; index += 1) {
      const result = await send(index % 2 === 0 ? appA : appB, 'attempt')
      assert.deepEqual(result, { allowed: true, retryAfterSeconds: 0 })
    }

    const sixth = await send(appB, 'attempt')
    assert.equal(sixth.allowed, false)
    assert.ok(sixth.retryAfterSeconds > 0)

    const stored = await setupPool.query(
      'SELECT bucket_key, attempt_count FROM arsy_login_attempt_buckets WHERE owner_id = $1 ORDER BY bucket_key',
      [ownerId],
    )
    assert.equal(stored.rowCount, 2)
    assert.deepEqual(stored.rows.map((row) => Number(row.attempt_count)), [6, 6])

    // Close one server and create a new instance with a new database pool.
    // The shared block must remain because PostgreSQL, not process memory, owns it.
    await appA.close()
    apps.delete(appA)
    const restartedApp = startInstance()
    const afterRestart = await send(restartedApp, 'attempt')
    assert.equal(afterRestart.allowed, false)
    const unchanged = await setupPool.query(
      'SELECT attempt_count FROM arsy_login_attempt_buckets WHERE owner_id = $1 ORDER BY bucket_key',
      [ownerId],
    )
    assert.deepEqual(unchanged.rows.map((row) => Number(row.attempt_count)), [6, 6])

    // A successful authentication clears the account and current network buckets.
    assert.deepEqual(await send(restartedApp, 'success'), { allowed: true, retryAfterSeconds: 0 })
    assert.deepEqual(await send(appB, 'attempt'), { allowed: true, retryAfterSeconds: 0 })

    // Concurrent callers across two independent Fastify instances must not
    // exceed the shared five-attempt budget.
    await send(appB, 'success')
    const concurrent = await Promise.all(
      Array.from({ length: 12 }, (_, index) => send(index % 2 ? appB : restartedApp, 'attempt')),
    )
    assert.equal(concurrent.filter((result) => result.allowed).length, 5)
    assert.equal(concurrent.filter((result) => !result.allowed).length, 7)

    const concurrentRows = await setupPool.query(
      'SELECT attempt_count FROM arsy_login_attempt_buckets WHERE owner_id = $1 ORDER BY bucket_key',
      [ownerId],
    )
    assert.deepEqual(concurrentRows.rows.map((row) => Number(row.attempt_count)), [6, 6])

    // The 15-minute window expires using database time, not a process clock.
    await setupPool.query(
      `UPDATE arsy_login_attempt_buckets
       SET window_started_at = now() - interval '16 minutes',
           blocked_until = now() - interval '1 second'
       WHERE owner_id = $1`,
      [ownerId],
    )
    assert.deepEqual(await send(appB, 'attempt'), { allowed: true, retryAfterSeconds: 0 })
    const resetRows = await setupPool.query(
      'SELECT attempt_count FROM arsy_login_attempt_buckets WHERE owner_id = $1 ORDER BY bucket_key',
      [ownerId],
    )
    assert.deepEqual(resetRows.rows.map((row) => Number(row.attempt_count)), [1, 1])

    // Identical network hashes remain isolated by the authenticated operator owner.
    const otherOwnerApp = startInstance(secondEnv)
    assert.deepEqual(await send(otherOwnerApp, 'attempt', secondToken), {
      allowed: true,
      retryAfterSeconds: 0,
    })

    // Bounded pruning removes at most 100 stale network hashes per request.
    await setupPool.query(
      `INSERT INTO arsy_login_attempt_buckets
         (owner_id, bucket_key, window_started_at, attempt_count, blocked_until, updated_at)
       SELECT $1, 'network:' || lpad(value::text, 64, '0'),
              now() - interval '2 days', 6,
              now() - interval '2 days', now() - interval '2 days'
       FROM generate_series(1, 105) AS value
       ON CONFLICT (owner_id, bucket_key) DO NOTHING`,
      [ownerId],
    )
    const staleBefore = await setupPool.query(
      'SELECT count(*)::int AS count FROM arsy_login_attempt_buckets WHERE owner_id = $1 AND updated_at < now() - interval \'1 day\'',
      [ownerId],
    )
    assert.equal(Number(staleBefore.rows[0].count), 105)
    await send(appB, 'attempt')
    const staleAfter = await setupPool.query(
      'SELECT count(*)::int AS count FROM arsy_login_attempt_buckets WHERE owner_id = $1 AND updated_at < now() - interval \'1 day\'',
      [ownerId],
    )
    assert.equal(Number(staleAfter.rows[0].count), 5)
  } finally {
    for (const app of apps) {
      await app.close()
    }
    if (migrationApplied) {
      await setupPool.query(
        'DELETE FROM arsy_login_attempt_buckets WHERE owner_id = ANY($1::text[])',
        [[ownerId, secondOwnerId]],
      )
    }
    await setupPool.end()
  }
})
