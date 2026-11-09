import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const env = { ARSY_OPERATOR_ID: 'metrics-owner', ARSY_OPERATOR_TOKEN: token }
const row = {
  opportunity_created_count: '10',
  opportunity_promoted_count: '4',
  opportunity_promotion_rate_percent: '40.00',
  product_created_count: '5',
  product_published_count: '3',
  product_first_sale_count: '2',
  product_first_sale_rate_percent: '40.00',
  product_retired_count: '1',
  average_completed_lifetime_seconds: '86400.00',
}

function pool() {
  const calls = []
  return {
    calls,
    query: async (sql, values) => {
      calls.push({ sql, values })
      return { rows: [row] }
    },
    end: async () => undefined,
  }
}

test('portfolio metrics API is protected by the operator service token', async () => {
  const db = pool()
  const app = await createApp({ databasePool: db, logger: false, env })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio-metrics?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z',
    })
    assert.equal(response.statusCode, 401)
    assert.equal(db.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('portfolio metrics require an offset-aware non-empty UTC reporting window', async () => {
  const db = pool()
  const app = await createApp({ databasePool: db, logger: false, env })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio-metrics?from=2026-11-01T00:00:00Z&to=2026-10-01T00:00:00Z',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(db.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('portfolio metrics return database cohort aggregates and preserve unavailable denominators', async () => {
  const db = pool()
  const app = await createApp({ databasePool: db, logger: false, env })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio-metrics?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.opportunities.promotionRatePercent, '40.00')
    assert.equal(response.json().data.products.firstSaleRatePercent, '40.00')
    assert.equal(response.json().data.products.averageCompletedLifetimeSeconds, '86400.00')
    assert.equal(response.json().data.unavailableMetrics.discoveryToOpportunity.available, false)
    assert.deepEqual(db.calls[0].values, ['metrics-owner', '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z'])
    assert.match(db.calls[0].sql, /JOIN arsy_product_versions pv ON pv.product_id = l.product_id AND pv.version = l.product_version/)
    assert.doesNotMatch(db.calls[0].sql, /l\.product_version_id/)
    assert.match(db.calls[0].sql, /reconciliation_state = 'verified'/)
    assert.match(db.calls[0].sql, /metadata ->> 'to' = 'retired'/)
  } finally {
    await app.close()
  }
})
