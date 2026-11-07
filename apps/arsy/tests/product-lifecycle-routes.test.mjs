import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const productId = '11111111-1111-4111-8111-111111111111'
const productRow = {
  id: productId,
  opportunity_id: '22222222-2222-4222-8222-222222222222',
  title: 'Inventory reconciliation utility',
  product_family: 'digital-utility',
  lifecycle_state: 'brief',
  version_id: '33333333-3333-4333-8333-333333333333',
  version: 1,
  brief: { buyerProblem: 'Inventory mismatches.' },
  acceptance_criteria: ['Imports source rows'],
  created_at: '2026-11-08T00:00:00.000Z',
  updated_at: '2026-11-08T00:00:00.000Z',
}

function fakePool() {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('UPDATE arsy_products')) {
        return { rows: [{ ...productRow, lifecycle_state: values[3], updated_at: '2026-11-08T01:00:00.000Z' }] }
      }
      if (sql.includes('FROM arsy_products p')) return { rows: [productRow] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('lifecycle endpoint requires the operator service token', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/products/${productId}/lifecycle`,
      payload: { lifecycleState: 'production' },
    })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('lifecycle endpoint rejects skipped states without writing', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/products/${productId}/lifecycle`,
      headers: { 'x-arsy-operator-token': token },
      payload: { lifecycleState: 'ready' },
    })
    assert.equal(response.statusCode, 409)
    assert.equal(response.json().error.code, 'INVALID_LIFECYCLE_TRANSITION')
    assert.equal(pool.calls.length, 1)
  } finally {
    await app.close()
  }
})

test('lifecycle endpoint persists an allowed transition and returns the updated record', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/products/${productId}/lifecycle`,
      headers: { 'x-arsy-operator-token': token },
      payload: { lifecycleState: 'production' },
    })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.lifecycleState, 'production')
    assert.deepEqual(response.json().data.allowedNextLifecycleStates, ['review'])
    assert.equal(pool.calls.length, 2)
    assert.match(pool.calls[1].sql, /INSERT INTO arsy_commerce_audit_events/)
  } finally {
    await app.close()
  }
})
