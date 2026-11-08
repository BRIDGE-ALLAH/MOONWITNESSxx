import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-operator-token'
const env = { ARSY_OPERATOR_ID: 'inspection-test-owner', ARSY_OPERATOR_TOKEN: token }
const productVersionId = '11111111-1111-4111-8111-111111111111'

function createPool() {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

function payload(overrides = {}) {
  return {
    productVersionId,
    inspectionType: 'technical',
    status: 'pass',
    findings: [{ severity: 'info', description: 'The required files are readable.' }],
    ...overrides,
  }
}

test('inspection API rejects a passing result containing a blocker finding', async () => {
  const database = createPool()
  const app = await createApp({ databasePool: database, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inspections',
      headers: { 'x-arsy-operator-token': token },
      payload: payload({
        findings: [{ severity: 'blocker', description: 'The required usage rights are missing.' }],
      }),
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'VALIDATION_ERROR')
    assert.equal(database.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('passing rights and policy inspections require evidence URLs', async () => {
  const database = createPool()
  const app = await createApp({ databasePool: database, logger: false, env })
  try {
    for (const inspectionType of ['rights', 'policy']) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/inspections',
        headers: { 'x-arsy-operator-token': token },
        payload: payload({ inspectionType }),
      })
      assert.equal(response.statusCode, 400, inspectionType)
    }
    assert.equal(database.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('inspection route remains protected by the common operator guard', async () => {
  const database = createPool()
  const app = await createApp({ databasePool: database, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inspections',
      payload: payload(),
    })
    assert.equal(response.statusCode, 401)
    assert.equal(database.calls.length, 0)
  } finally {
    await app.close()
  }
})
