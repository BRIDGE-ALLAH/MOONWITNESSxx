import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'listing-test-operator-token'
const env = { ARSY_OPERATOR_ID: 'listing-owner', ARSY_OPERATOR_TOKEN: token }
const productId = '11111111-1111-4111-8111-111111111111'
const channelId = '22222222-2222-4222-8222-222222222222'
const listingId = '33333333-3333-4333-8333-333333333333'

function createPool() {
  const calls = []
  return {
    calls,
    query: async (sql, values = []) => { calls.push({ sql, values }); return { rows: [] } },
    end: async () => undefined,
  }
}

test('listing routes reject anonymous access', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/listings' })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})

test('manual package generation requires an idempotency key before repository access', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/listings/packages',
      headers: { 'x-arsy-operator-token': token },
      payload: { productId, productVersion: 1, channelId, disclosure: 'This is a test listing disclosure.' },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'IDEMPOTENCY_KEY_REQUIRED')
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})

test('manual package generation is owner-scoped and does not infer a product or channel', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/listings/packages',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'listing-package-request-001' },
      payload: { productId, productVersion: 1, channelId, disclosure: 'This is a test listing disclosure.' },
    })
    assert.equal(response.statusCode, 404)
    assert.equal(response.json().error.code, 'PRODUCT_OR_CHANNEL_NOT_FOUND')
    assert.equal(pool.calls.length, 1)
  } finally { await app.close() }
})

test('publication receipts require actual-action evidence and explicit confirmation', async () => {
  const pool = createPool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: `/api/v1/listings/${listingId}/receipts`,
      headers: { 'x-arsy-operator-token': token },
      payload: {
        receiptType: 'manual-submission',
        evidence: [],
        operatorConfirmation: 'The operator says this was submitted.',
      },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})
