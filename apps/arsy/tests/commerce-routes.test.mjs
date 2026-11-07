import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
function pool() {
  return { query: async () => ({ rows: [] }), end: async () => undefined }
}

test('all commerce endpoints require the operator token, not only opportunities', async () => {
  const app = await createApp({ databasePool: pool(), logger: false, env: { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token } })
  try {
    for (const url of ['/api/v1/opportunities', '/api/v1/products', '/api/v1/financial-events', '/api/v1/financial-summary']) {
      const response = await app.inject({ method: 'GET', url })
      assert.equal(response.statusCode, 401, url)
    }
  } finally {
    await app.close()
  }
})

test('all commerce endpoints fail closed when operator identity is missing', async () => {
  const app = await createApp({ databasePool: pool(), logger: false, env: { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token } })
  try {
    for (const url of ['/api/v1/opportunities', '/api/v1/products', '/api/v1/financial-events', '/api/v1/financial-summary']) {
      const response = await app.inject({ method: 'GET', url, headers: { 'x-arsy-operator-token': token } })
      assert.equal(response.statusCode, 503, url)
      assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED', url)
    }
  } finally {
    await app.close()
  }
})

test('authenticated product and finance list routes return real empty states', async () => {
  const app = await createApp({ databasePool: pool(), logger: false, env: { ARSY_OPERATOR_TOKEN: token } })
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
