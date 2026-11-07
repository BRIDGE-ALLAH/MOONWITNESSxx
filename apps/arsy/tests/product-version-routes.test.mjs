import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const productId = '11111111-1111-4111-8111-111111111111'
const productRow = {
  id: productId,
  opportunity_id: null,
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
      if (sql.includes('INSERT INTO arsy_product_versions')) {
        return { rows: [{ ...productRow, version_id: '44444444-4444-4444-8444-444444444444', version: 2, brief: JSON.parse(values[4]), acceptance_criteria: JSON.parse(values[5]), updated_at: '2026-11-08T01:00:00.000Z' }] }
      }
      if (sql.includes('SELECT v.id, v.version')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333', version: 1, brief: productRow.brief, acceptance_criteria: productRow.acceptance_criteria, created_at: productRow.created_at, created_by: 'owner-a' }] }\n      if (sql.includes('FROM arsy_products p')) return { rows: [productRow] }
      if (sql.includes('FROM arsy_products') && sql.includes('FOR UPDATE')) return { rows: [] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('product version routes require operator authentication', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({ method: 'GET', url: `/api/v1/products/${productId}/versions` })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('product version history is owner-scoped', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/versions`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 200)
    assert.equal(pool.calls.length, 2)
    assert.deepEqual(pool.calls[1].values, ['owner-a', productId])
  } finally {
    await app.close()
  }
})

test('product version endpoint rejects stale expected version before insert', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${productId}/versions`,
      headers: { 'x-arsy-operator-token': token },
      payload: { expectedVersion: 2, brief: { buyerProblem: 'Changed' }, acceptanceCriteria: ['A valid criterion'] },
    })
    assert.equal(response.statusCode, 409)
    assert.equal(response.json().error.code, 'VERSION_CONFLICT')
    assert.equal(pool.calls.some((call) => call.sql.includes('INSERT INTO arsy_product_versions')), false)
  } finally {
    await app.close()
  }
})

test('product version endpoint creates a new immutable version and audits it', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${productId}/versions`,
      headers: { 'x-arsy-operator-token': token },
      payload: { expectedVersion: 1, brief: { buyerProblem: 'Updated inventory mismatches.' }, acceptanceCriteria: ['Imports source rows', 'Exports a reconciliation report'] },
    })
    assert.equal(response.statusCode, 201)
    assert.equal(response.json().data.version, 2)
    const insert = pool.calls.find((call) => call.sql.includes('INSERT INTO arsy_product_versions'))
    assert.ok(insert)
    assert.match(insert.sql, /INSERT INTO arsy_commerce_audit_events/)
    assert.deepEqual(insert.values.slice(0, 2), ['owner-a', productId])
  } finally {
    await app.close()
  }
})
