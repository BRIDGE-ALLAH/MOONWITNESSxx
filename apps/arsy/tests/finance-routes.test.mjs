import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const env = { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token }
const input = {
  eventType: 'gross-receipt',
  amountMinor: '9007199254740993',
  currency: 'IDR',
  occurredAt: '2026-11-08T00:00:00Z',
  source: 'Provider statement line 001',
  idempotencyKey: 'provider-statement-line-001',
}
const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
const event = {
  id: '11111111-1111-4111-8111-111111111111',
  product_id: null,
  event_type: input.eventType,
  amount_minor: input.amountMinor,
  currency: input.currency,
  occurred_at: input.occurredAt,
  recorded_at: '2026-11-08T00:01:00Z',
  source: input.source,
  provider_reference: null,
  reconciliation_state: 'pending',
  metadata: {},
  request_hash: hash,
}

function fakePool() {
  const calls = []
  return {
    calls,
    query: async (sql) => {
      calls.push(sql)
      if (sql.includes('INSERT INTO arsy_financial_events')) return { rows: [event] }
      if (sql.includes('FROM arsy_financial_events') && sql.includes('GROUP BY currency')) return { rows: [{
        currency: 'IDR', gross_receipts_minor: '0', deductions_minor: '0',
        tax_reserve_minor: '0', payout_movements_minor: '0', pending_minor: input.amountMinor, pending_count: '1',
      }] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('financial event API requires operator identity and token', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env: { ARSY_OPERATOR_TOKEN: token } })
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/financial-events', payload: input })
    assert.equal(response.statusCode, 503)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})

test('financial event API records exact amount as pending and returns exact summary', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/financial-events',
      headers: { 'x-arsy-operator-token': token },
      payload: input,
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().data.amountMinor, '9007199254740993')
    assert.equal(created.json().data.reconciliationState, 'pending')

    const summary = await app.inject({
      method: 'GET',
      url: '/api/v1/financial-summary',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(summary.statusCode, 200)
    assert.equal(summary.json().data[0].pending_minor, '9007199254740993')
    assert.equal(summary.json().data[0].net_contribution_minor, '0')
    assert.equal(summary.json().data[0].tax_reserve_minor, '0')
  } finally { await app.close() }
})

test('financial event API rejects malformed amount, currency and idempotency keys', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/financial-events',
      headers: { 'x-arsy-operator-token': token },
      payload: { ...input, amountMinor: '1.25', currency: 'ID', idempotencyKey: 'short' },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(pool.calls.length, 0)
  } finally { await app.close() }
})
