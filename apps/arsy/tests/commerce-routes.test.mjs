import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const operatorId = 'operator-test'
function pool() {
  let queryCount = 0
  return {
    query: async () => {
      queryCount += 1
      return { rows: [] }
    },
    end: async () => undefined,
    get queryCount() { return queryCount },
  }
}

test('all versioned commerce endpoints fail closed without an explicit operator identity', async () => {
  const database = pool()
  const app = await createApp({ databasePool: database, logger: false, env: { ARSY_OPERATOR_TOKEN: token } })
  try {
    const requests = [
      ['GET', '/api/v1/opportunities'],
      ['GET', '/api/v1/products'],
      ['GET', '/api/v1/products/11111111-1111-4111-8111-111111111111'],
      ['POST', '/api/v1/products/from-opportunity'],
      ['GET', '/api/v1/financial-events'],
      ['POST', '/api/v1/financial-events'],
      ['GET', '/api/v1/financial-summary'],
      ['PATCH', '/api/v1/financial-events/11111111-1111-4111-8111-111111111111/reconciliation'],
    ]
    for (const [method, url] of requests) {
      const response = await app.inject({ method, url, payload: method === 'GET' ? undefined : {} })
      assert.equal(response.statusCode, 503, url)
      assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED', url)
    }
    assert.equal(database.queryCount, 0)
  } finally {
    await app.close()
  }
})

test('all versioned commerce endpoints require a valid operator token', async () => {
  const database = pool()
  const app = await createApp({
    databasePool: database,
    logger: false,
    env: { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const requests = [
      ['GET', '/api/v1/opportunities'],
      ['GET', '/api/v1/products'],
      ['GET', '/api/v1/products/11111111-1111-4111-8111-111111111111'],
      ['POST', '/api/v1/products/from-opportunity'],
      ['GET', '/api/v1/financial-events'],
      ['POST', '/api/v1/financial-events'],
      ['GET', '/api/v1/financial-summary'],
      ['PATCH', '/api/v1/financial-events/11111111-1111-4111-8111-111111111111/reconciliation'],
    ]
    for (const [method, url] of requests) {
      const response = await app.inject({ method, url, payload: method === 'GET' ? undefined : {} })
      assert.equal(response.statusCode, 401, url)
      assert.equal(response.json().error.code, 'UNAUTHORIZED', url)
    }
    assert.equal(database.queryCount, 0)
  } finally {
    await app.close()
  }
})

test('authenticated product and finance list routes return real empty states', async () => {
  const app = await createApp({
    databasePool: pool(),
    logger: false,
    env: { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    for (const url of ['/api/v1/products', '/api/v1/financial-events', '/api/v1/financial-summary']) {
      const response = await app.inject({ method: 'GET', url, headers: { 'x-arsy-operator-token': token } })
      assert.equal(response.statusCode, 200, url)
      assert.deepEqual(response.json().data, [], url)
    }
  } finally {
    await app.close()
  }
})
