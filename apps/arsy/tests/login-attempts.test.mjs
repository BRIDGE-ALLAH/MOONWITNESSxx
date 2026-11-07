import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { LoginAttemptRepository } from '../src/auth/login-attempts.ts'

const token = 'test-only-shared-login-limiter-token'
const operatorHash = 'a'.repeat(64)
const networkHash = 'b'.repeat(64)

function fakePool(result = { rows: [{ retry_after_seconds: 0 }] }) {
  const calls = []
  return {
    calls,
    query: async (sql, values) => { calls.push({ sql, values }); return result },
    end: async () => undefined,
  }
}

test('shared limiter checks both operator and network buckets without storing identity values', async () => {
  const pool = fakePool({ rows: [{ retry_after_seconds: 840 }] })
  const repository = new LoginAttemptRepository(pool)
  assert.equal(await repository.check(operatorHash, networkHash), 840)
  assert.match(pool.calls[0].sql, /bucket_type = 'operator'/)
  assert.match(pool.calls[0].sql, /bucket_type = 'network'/)
  assert.deepEqual(pool.calls[0].values, [operatorHash, networkHash])
})

test('shared limiter failure writes both buckets with an atomic upsert and bounded lockout', async () => {
  const pool = fakePool({ rows: [{ retry_after_seconds: 900 }] })
  const repository = new LoginAttemptRepository(pool)
  assert.equal(await repository.recordFailure(operatorHash, networkHash), 900)
  assert.match(pool.calls[0].sql, /ON CONFLICT \(bucket_type, bucket_hash\) DO UPDATE/)
  assert.match(pool.calls[0].sql, /failure_count \+ 1/)
  assert.match(pool.calls[0].sql, /interval '15 minutes'/)
  assert.deepEqual(pool.calls[0].values, [operatorHash, networkHash])
})

test('shared limiter success clears only the matching operator and network buckets', async () => {
  const pool = fakePool({ rows: [] })
  const repository = new LoginAttemptRepository(pool)
  await repository.clear(operatorHash, networkHash)
  assert.match(pool.calls[0].sql, /DELETE FROM arsy_login_attempt_buckets/)
  assert.deepEqual(pool.calls[0].values, [operatorHash, networkHash])
})

test('login limiter routes are behind operator authorization and validate hashed keys', async () => {
  const pool = fakePool()
  const app = createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token } })
  try {
    const unauthorized = await app.inject({ method: 'POST', url: '/api/v1/auth/login-attempts/check', payload: { operatorBucketHash: operatorHash, networkBucketHash: networkHash } })
    assert.equal(unauthorized.statusCode, 401)
    assert.equal(pool.calls.length, 0)
    const invalid = await app.inject({
      method: 'POST', url: '/api/v1/auth/login-attempts/check',
      headers: { 'x-arsy-operator-token': token },
      payload: { operatorBucketHash: 'raw-operator-id', networkBucketHash: networkHash },
    })
    assert.equal(invalid.statusCode, 400)
    assert.equal(pool.calls.length, 0)
    const checked = await app.inject({
      method: 'POST', url: '/api/v1/auth/login-attempts/check',
      headers: { 'x-arsy-operator-token': token },
      payload: { operatorBucketHash: operatorHash, networkBucketHash: networkHash },
    })
    assert.equal(checked.statusCode, 200)
    assert.equal(checked.json().data.retryAfterSeconds, 0)
    assert.equal(pool.calls.length, 1)
  } finally {
    await app.close()
  }
})
