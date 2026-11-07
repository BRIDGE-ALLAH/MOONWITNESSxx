import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'

function fakePool() {
  const calls = []
  return {
    calls,
    query: async (sql) => {
      calls.push(sql)
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('product routes fail closed when operator auth is not configured', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: {} })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/products' })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('product routes reject missing and invalid operator credentials before database access', async () => {
  const pool = fakePool()
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/products' })
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/products/from-opportunity',
      headers: { 'x-arsy-operator-token': 'wrong' },
      payload: {
        opportunityId: '11111111-1111-4111-8111-111111111111',
        acceptanceCriteria: ['A valid acceptance criterion'],
      },
    })
    assert.equal(missing.statusCode, 401)
    assert.equal(invalid.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('authenticated product list is owner-scoped and reaches the repository', async () => {
  const pool = fakePool()
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json(), { data: [] })
    assert.equal(pool.calls.length, 1)
    assert.match(pool.calls[0], /WHERE p.owner_id = \$1/)
  } finally {
    await app.close()
  }
})
