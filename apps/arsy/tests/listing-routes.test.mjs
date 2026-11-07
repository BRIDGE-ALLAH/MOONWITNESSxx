import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../src/app.ts'

const token = 'test-only-listing-url-token'
const env = { ARSY_OPERATOR_ID: 'listing-test-owner', ARSY_OPERATOR_TOKEN: token }

test('publication receipts reject non-web evidence URLs before database writes', async () => {
  let queryCount = 0
  const pool = {
    query: async () => { queryCount += 1; return { rows: [] } },
    end: async () => undefined,
  }
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/listings/11111111-1111-4111-8111-111111111111/publication-receipt',
      headers: { 'x-arsy-operator-token': token },
      payload: {
        providerReference: 'manual-receipt-001',
        evidenceUrl: 'javascript:alert(1)',
        publishedAt: '2026-11-08T00:00:00Z',
      },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(queryCount, 0)
  } finally {
    await app.close()
  }
})
