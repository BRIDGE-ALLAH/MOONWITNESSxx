import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { createDatabasePool } from '../src/db.ts'

const token = `integration-login-limiter-${randomUUID()}`
const ownerId = `login-limiter-${randomUUID()}`
const hash = () => createHash('sha256').update(randomUUID()).digest('hex')

test('shared login throttling survives separate ARSY instances, restart, and window expiry', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const operatorBucketHash = hash()
  const networkBucketHash = hash()
  const networkBuckets = [networkBucketHash]
  const env = { ...process.env, ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
  let poolA = createDatabasePool(env)
  const poolB = createDatabasePool(env)
  let appA = createApp({ databasePool: poolA, logger: false, env })
  const appB = createApp({ databasePool: poolB, logger: false, env })

  const request = async (app, operation, networkHash = networkBucketHash) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/auth/login-attempts/${operation}`,
      headers: { 'x-arsy-operator-token': token },
      payload: { operatorBucketHash, networkBucketHash: networkHash },
    })
    assert.equal(response.statusCode, 200)
    return response.json().data
  }

  try {
    assert.equal((await request(appA, 'check')).retryAfterSeconds, 0)
    for (let index = 0; index < 4; index += 1) {
      const result = await request(index % 2 ? appB : appA, 'failure')
      assert.equal(result.retryAfterSeconds, 0)
    }
    assert.ok((await request(appB, 'failure')).retryAfterSeconds > 0)
    assert.ok((await request(appA, 'check')).retryAfterSeconds > 0, 'a second instance sees the shared lockout')

    await appA.close()
    poolA = createDatabasePool(env)
    appA = createApp({ databasePool: poolA, logger: false, env })
    assert.ok((await request(appA, 'check')).retryAfterSeconds > 0, 'restarting one instance cannot reset shared lockout')

    assert.equal((await request(appB, 'success')).cleared, true)
    assert.equal((await request(appA, 'check')).retryAfterSeconds, 0)

    // The operator bucket also aggregates failures across distinct client networks.
    for (let index = 0; index < 5; index += 1) {
      const distinctNetwork = hash()
      networkBuckets.push(distinctNetwork)
      const result = await request(index % 2 ? appA : appB, 'failure', distinctNetwork)
      if (index < 4) assert.equal(result.retryAfterSeconds, 0)
      else assert.ok(result.retryAfterSeconds > 0)
    }
    assert.ok((await request(appA, 'check', hash())).retryAfterSeconds > 0, 'the operator bucket prevents IP rotation from bypassing the limit')

    await poolA.query(
      `UPDATE arsy_login_attempt_buckets
       SET window_started_at = now() - interval '16 minutes', blocked_until = now() - interval '1 second'
       WHERE bucket_type = 'operator' AND bucket_hash = $1`,
      [operatorBucketHash],
    )
    const afterExpiryNetworkHash = hash()
    networkBuckets.push(afterExpiryNetworkHash)
    assert.equal((await request(appB, 'check', afterExpiryNetworkHash)).retryAfterSeconds, 0, 'expired windows release the operator bucket')
    assert.equal((await request(appB, 'failure', afterExpiryNetworkHash)).retryAfterSeconds, 0, 'the next failure starts a fresh window')
  } finally {
    try {
      await poolA.query('DELETE FROM arsy_login_attempt_buckets WHERE bucket_hash = ANY($1::char(64)[])', [[operatorBucketHash, ...networkBuckets]])
    } finally {
      await appA.close()
      await appB.close()
    }
  }
})
