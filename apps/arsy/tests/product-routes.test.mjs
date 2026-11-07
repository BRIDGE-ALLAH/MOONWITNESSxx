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

test('product routes fail closed when operator identity is missing', async () => {
  const pool = fakePool()
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_TOKEN: token },
  })
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
    env: { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token },
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

test('product version endpoint validates and persists an append-only revision', async () => {
  const productRow = {
    id: '11111111-1111-4111-8111-111111111111',
    opportunity_id: null,
    title: 'Operator product',
    product_family: 'digital-utility',
    lifecycle_state: 'brief',
    version_id: '22222222-2222-4222-8222-222222222222',
    version: 2,
    brief: { summary: 'Revised product brief' },
    acceptance_criteria: ['A verifiable criterion'],
    created_at: '2026-11-08T00:00:00.000Z',
    updated_at: '2026-11-08T01:00:00.000Z',
  }
  const pool = {
    calls: [],
    query: async (sql) => {
      pool.calls.push(sql)
      return { rows: [productRow] }
    },
    end: async () => undefined,
  }
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/products/11111111-1111-4111-8111-111111111111/versions',
      headers: { 'x-arsy-operator-token': token },
      payload: { expectedVersion: 1, brief: { summary: 'Revised product brief' }, acceptanceCriteria: ['A verifiable criterion'] },
    })
    assert.equal(response.statusCode, 201)
    assert.equal(response.json().data.version, 2)
    assert.match(pool.calls[0], /FOR UPDATE/)
  } finally {
    await app.close()
  }
})

test('product lifecycle endpoint rejects invalid transitions as conflicts', async () => {
  const productRow = {
    id: '11111111-1111-4111-8111-111111111111',
    opportunity_id: null,
    title: 'Operator product',
    product_family: 'digital-utility',
    lifecycle_state: 'brief',
    version_id: '22222222-2222-4222-8222-222222222222',
    version: 1,
    brief: { summary: 'Product brief' },
    acceptance_criteria: ['A verifiable criterion'],
    created_at: '2026-11-08T00:00:00.000Z',
    updated_at: '2026-11-08T00:00:00.000Z',
  }
  let count = 0
  const pool = {
    query: async () => {
      count += 1
      return { rows: [productRow] }
    },
    end: async () => undefined,
  }
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/products/11111111-1111-4111-8111-111111111111/lifecycle',
      headers: { 'x-arsy-operator-token': token },
      payload: { expectedVersion: 1, state: 'listed', rationale: 'This should not be an allowed direct transition.' },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(count, 0)
  } finally {
    await app.close()
  }
})
