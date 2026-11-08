import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const operatorId = 'login-limit-unit-operator'
const token = 'login-limit-unit-token-with-at-least-32-characters'

const oracleClient = {
  submitJob: async () => {
    throw new Error('ORACLE is not used by login limiter tests')
  },
  getJob: async () => {
    throw new Error('ORACLE is not used by login limiter tests')
  },
}

function createPool(handler) {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      return handler(sql, values)
    },
    end: async () => undefined,
  }
}

function createTestApp(pool) {
  return createApp({
    databasePool: pool,
    logger: false,
    oracleClient,
    env: {
      ARSY_OPERATOR_ID: operatorId,
      ARSY_OPERATOR_TOKEN: token,
    },
  })
}

async function send(app, payload, headers = { 'x-arsy-operator-token': token }) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login-attempts',
    headers,
    payload,
  })
}

test('shared login attempt API requires the authenticated ARSY service principal', async () => {
  const pool = createPool(async () => ({ rows: [] }))
  const app = createTestApp(pool)
  try {
    const response = await send(app, { action: 'attempt', networkHash: 'a'.repeat(64) }, {})
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('attempt reserves account and network buckets atomically using the authenticated principal', async () => {
  const pool = createPool(async () => ({ rows: [{ retry_after_seconds: 0 }] }))
  const app = createTestApp(pool)
  try {
    const response = await send(app, { action: 'attempt', networkHash: 'a'.repeat(64) })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, { allowed: true, retryAfterSeconds: 0 })
    assert.deepEqual(pool.calls[0].values, [operatorId, ['account', `network:${'a'.repeat(64)}`]])
    assert.match(pool.calls[0].sql, /ON CONFLICT \(owner_id, bucket_key\) DO UPDATE/)
    assert.match(pool.calls[0].sql, /FOR UPDATE|ON CONFLICT/)
    assert.match(pool.calls[0].sql, /attempt_count/)
    assert.match(pool.calls[0].sql, /interval '15 minutes'/)
    assert.equal(pool.calls.length, 2)
    assert.match(pool.calls[1].sql, /LIMIT 100/)
    assert.match(pool.calls[1].sql, /SKIP LOCKED/)
  } finally {
    await app.close()
  }
})

test('blocked account or network bucket returns a bounded retry-after duration', async () => {
  const pool = createPool(async () => ({ rows: [{ retry_after_seconds: 840 }] }))
  const app = createTestApp(pool)
  try {
    const response = await send(app, { action: 'attempt', networkHash: 'b'.repeat(64) })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, { allowed: false, retryAfterSeconds: 840 })
  } finally {
    await app.close()
  }
})

test('successful authentication clears the account and current network buckets', async () => {
  const pool = createPool(async () => ({ rows: [] }))
  const app = createTestApp(pool)
  try {
    const response = await send(app, { action: 'success', networkHash: 'c'.repeat(64) })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, { allowed: true, retryAfterSeconds: 0 })
    assert.match(pool.calls[0].sql, /DELETE FROM arsy_login_attempt_buckets/)
    assert.deepEqual(pool.calls[0].values, [operatorId, ['account', `network:${'c'.repeat(64)}`]])
  } finally {
    await app.close()
  }
})

test('malformed login limit input is rejected before database access', async () => {
  const pool = createPool(async () => ({ rows: [] }))
  const app = createTestApp(pool)
  try {
    const response = await send(app, { action: 'failure', networkHash: 'not-a-hash' })
    assert.equal(response.statusCode, 400)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('database failures do not leak query details to the login API', async () => {
  const pool = createPool(async () => {
    throw new Error('secret database host and password')
  })
  const app = createTestApp(pool)
  try {
    const response = await send(app, { action: 'attempt', networkHash: 'd'.repeat(64) })
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json().error, { code: 'LOGIN_LIMIT_UNAVAILABLE' })
    assert.equal(response.body.includes('secret database host'), false)
  } finally {
    await app.close()
  }
})
