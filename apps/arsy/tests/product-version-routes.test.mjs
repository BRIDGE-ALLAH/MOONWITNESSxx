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
const versionRows = [{
  id: '33333333-3333-4333-8333-333333333333',
  version: 1,
  brief: productRow.brief,
  acceptance_criteria: productRow.acceptance_criteria,
  created_at: productRow.created_at,
  created_by: 'operator-a',
}]

function fakePool() {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('INSERT INTO arsy_product_versions')) {
        return { rows: [{
          ...productRow,
          lifecycle_state: 'production',
          version_id: '44444444-4444-4444-8444-444444444444',
          version: 2,
          brief: JSON.parse(values[4]),
          acceptance_criteria: JSON.parse(values[5]),
          updated_at: '2026-11-08T01:00:00.000Z',
        }] }
      }
      if (sql.includes('SELECT v.id, v.version, v.brief')) return { rows: versionRows }
      if (sql.includes('SELECT p.id, p.opportunity_id')) return { rows: [productRow] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

function makeApp(pool) {
  return createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: 'owner-a', ARSY_OPERATOR_TOKEN: token },
  })
}

test('product version history route returns only owner-scoped persisted versions', async () => {
  const pool = fakePool()
  const app = await makeApp(pool)
  try {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${productId}/versions`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data.map((version) => version.version), [1])
    assert.ok(pool.calls.some((call) => call.sql.includes('WHERE p.owner_id = $1 AND p.id = $2')))
  } finally {
    await app.close()
  }
})

test('product version route rejects stale expected versions without inserting', async () => {
  const pool = fakePool()
  const app = await makeApp(pool)
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${productId}/versions`,
      headers: { 'x-arsy-operator-token': token },
      payload: {
        expectedVersion: 2,
        brief: { buyerProblem: 'Stale revision.' },
        acceptanceCriteria: ['A valid acceptance criterion'],
      },
    })
    assert.equal(response.statusCode, 409)
    assert.equal(response.json().error.code, 'VERSION_CONFLICT')
    assert.equal(pool.calls.length, 1, 'a stale write may read the current product but must not insert a version')
  } finally {
    await app.close()
  }
})

test('product version route creates the next immutable version when expected version matches', async () => {
  const pool = fakePool()
  const app = await makeApp(pool)
  try {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${productId}/versions`,
      headers: { 'x-arsy-operator-token': token },
      payload: {
        expectedVersion: 1,
        brief: { buyerProblem: 'Updated inventory reconciliation.' },
        acceptanceCriteria: ['Imports source rows', 'Exports an audit report'],
      },
    })
    assert.equal(response.statusCode, 201)
    assert.equal(response.json().data.version, 2)
    assert.equal(pool.calls.length, 2)
    assert.match(pool.calls[1].sql, /current_version.version = \$3/)
  } finally {
    await app.close()
  }
})
