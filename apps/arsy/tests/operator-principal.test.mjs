import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const operatorId = 'principal-test-operator'
const token = 'principal-test-token-with-at-least-32-characters'

test('ARSY attaches a trusted operator principal only after valid service authentication', async () => {
  const pool = { query: async () => ({ rows: [{ ok: 1 }] }), end: async () => undefined }
  const app = createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: token },
  })
  app.get('/api/v1/test-principal', async (request) => ({ principal: request.arsyPrincipal }))
  try {
    const anonymous = await app.inject('/api/v1/test-principal')
    assert.equal(anonymous.statusCode, 401)

    const authenticated = await app.inject({
      url: '/api/v1/test-principal',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(authenticated.statusCode, 200)
    assert.deepEqual(authenticated.json().principal, { kind: 'operator', operatorId })
  } finally {
    await app.close()
  }
})

test('ARSY does not attach an operator principal when identity or token configuration is absent', async () => {
  const pool = { query: async () => ({ rows: [{ ok: 1 }] }), end: async () => undefined }
  const app = createApp({ databasePool: pool, logger: false, env: {} })
  app.get('/api/v1/test-principal', async (request) => ({ principal: request.arsyPrincipal }))
  try {
    const response = await app.inject({
      url: '/api/v1/test-principal',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
  } finally {
    await app.close()
  }
})
