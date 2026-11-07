import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const ownerId = 'login-throttle-test-owner'

function poolWith(query) {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      return query(sql, values)
    },
    end: async () => undefined,
  }
}

test('shared login attempt endpoint requires the ARSY service token', async () => {
  const pool = poolWith(async () => ({ rows: [] }))
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login-attempts',
      payload: { action: 'check', networkHash: 'a'.repeat(64) },
    })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('shared login check reads both account-wide and network buckets', async () => {
  const pool = poolWith(async () => ({ rows: [{ retry_after_seconds: 240 }] }))
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login-attempts',
      headers: { 'x-arsy-operator-token': token },
      payload: { action: 'check', networkHash: 'a'.repeat(64) },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, { allowed: false, retryAfterSeconds: 240 })
    assert.deepEqual(pool.calls[0].values, [ownerId, ['account', `network:${'a'.repeat(64)}`]])
  } finally {
    await app.close()
  }
})

test('shared login failure increments both buckets with a bounded window', async () => {
  const pool = poolWith(async () => ({ rows: [{ retry_after_seconds: 900 }] }))
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login-attempts',
      headers: { 'x-arsy-operator-token': token },
      payload: { action: 'failure', networkHash: 'b'.repeat(64) },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, { allowed: false, retryAfterSeconds: 900 })
    assert.match(pool.calls[0].sql, /ON CONFLICT \(owner_id, bucket_key\) DO UPDATE/)
    assert.match(pool.calls[0].sql, /interval '15 minutes'/)
    assert.deepEqual(pool.calls[0].values, [ownerId, ['account', `network:${'b'.repeat(64)}`]])
  } finally {
    await app.close()
  }
})

test('successful login clears both shared buckets', async () => {
  const pool = poolWith(async () => ({ rows: [] }))
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login-attempts',
      headers: { 'x-arsy-operator-token': token },
      payload: { action: 'success', networkHash: 'c'.repeat(64) },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, { allowed: true, retryAfterSeconds: 0 })
    assert.match(pool.calls[0].sql, /DELETE FROM arsy_login_attempt_buckets/)
  } finally {
    await app.close()
  }
})

test('shared login attempt endpoint rejects invalid or unbounded network fingerprints', async () => {
  const pool = poolWith(async () => ({ rows: [] }))
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    for (const networkHash of ['not-a-hash', 'A'.repeat(64), 'a'.repeat(65)]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login-attempts',
        headers: { 'x-arsy-operator-token': token },
        payload: { action: 'check', networkHash },
      })
      assert.equal(response.statusCode, 400)
    }
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})
