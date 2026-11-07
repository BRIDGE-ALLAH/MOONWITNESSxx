import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-lifecycle-operator-token'
const productId = '11111111-1111-4111-8111-111111111111'

function createPool(initialState) {
  const calls = []
  const row = {
    id: productId,
    opportunity_id: '22222222-2222-4222-8222-222222222222',
    title: 'Lifecycle test product',
    product_family: 'digital-utility',
    lifecycle_state: initialState,
    version_id: '33333333-3333-4333-8333-333333333333',
    version: 1,
    brief: { buyerProblem: 'Testing guarded lifecycle state changes.' },
    acceptance_criteria: ['Reject manual derived-state changes'],
    created_at: '2026-11-08T00:00:00.000Z',
    updated_at: '2026-11-08T00:00:00.000Z',
  }

  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('UPDATE arsy_products')) {
        return { rows: [{ ...row, lifecycle_state: values[3], updated_at: '2026-11-08T01:00:00.000Z' }] }
      }
      if (sql.includes('FROM arsy_products p')) return { rows: [row] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

async function patchLifecycle(initialState, requestedState) {
  const pool = createPool(initialState)
  const app = await createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'lifecycle-test-owner', ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/products/${productId}/lifecycle`,
      headers: { 'x-arsy-operator-token': token },
      payload: { lifecycleState: requestedState },
    })
    return { response, calls: pool.calls }
  } finally {
    await app.close()
  }
}

test('manual lifecycle API cannot set READY without the four inspection records', async () => {
  const { response, calls } = await patchLifecycle('review', 'ready')
  assert.equal(response.statusCode, 409)
  assert.equal(response.json().error.code, 'INVALID_LIFECYCLE_TRANSITION')
  assert.equal(calls.length, 1, 'only the owner-scoped read is allowed; no lifecycle write should run')
})

test('manual lifecycle API cannot set LISTED without a publication receipt', async () => {
  const { response, calls } = await patchLifecycle('ready', 'listed')
  assert.equal(response.statusCode, 409)
  assert.equal(response.json().error.code, 'INVALID_LIFECYCLE_TRANSITION')
  assert.equal(calls.length, 1, 'only the owner-scoped read is allowed; publication receipt remains the only listing path')
})

test('operator can return a product from REVIEW to PRODUCTION for a new version of work', async () => {
  const { response, calls } = await patchLifecycle('review', 'production')
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().data.lifecycleState, 'production')
  assert.equal(calls.length, 2)
  assert.match(calls[1].sql, /lifecycle_state = \$5/)
  assert.match(calls[1].sql, /INSERT INTO arsy_commerce_audit_events/)
})
