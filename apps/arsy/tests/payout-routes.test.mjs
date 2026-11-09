import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const env = { ARSY_OPERATOR_ID: 'operator-payout-test', ARSY_OPERATOR_TOKEN: token }
const payoutId = '11111111-1111-4111-8111-111111111111'
const channelId = '22222222-2222-4222-8222-222222222222'
const sourceEventId = '33333333-3333-4333-8333-333333333333'
const payoutRow = {
  id: payoutId,
  channel_id: channelId,
  channel_name: 'Reviewed Manual Channel',
  amount_minor: '5000',
  currency: 'IDR',
  status: 'pending',
  provider_reference: 'provider-statement-001',
  expected_at: '2026-11-08T00:00:00Z',
  paid_at: null,
  source: 'Manual provider statement',
  source_evidence: { evidenceUrl: 'https://example.com/payout', capturedAt: '2026-11-08T00:00:00Z', summary: 'Pending payout from statement.' },
  reconciliation_evidence: {},
  created_at: '2026-11-08T00:00:00Z',
  recorded_at: '2026-11-08T00:01:00Z',
  updated_at: '2026-11-08T00:00:00Z',
  history: [],
}
const fxRow = {
  id: '44444444-4444-4444-8444-444444444444',
  source_event_id: sourceEventId,
  from_amount_minor: '10000',
  from_currency: 'IDR',
  to_amount_minor: '100',
  to_currency: 'USD',
  rate_numerator: '1',
  rate_denominator: '100',
  rate_source: 'Bank statement',
  source_url: 'https://example.com/fx',
  observed_at: '2026-11-08T00:00:00Z',
  recorded_at: '2026-11-08T00:01:00Z',
  request_hash: 'a'.repeat(64),
}

function fakePool() {
  const calls = []
  return {
    calls,
    query: async (sql) => {
      calls.push(sql)
      if (sql.includes('INSERT INTO arsy_payouts')) return { rows: [payoutRow] }
      if (sql.includes('UPDATE arsy_payouts')) return { rows: [{ ...payoutRow, status: 'paid', paid_at: '2026-11-08T01:00:00Z' }] }
      if (sql.includes('INSERT INTO arsy_fx_conversions')) return { rows: [fxRow] }
      if (sql.includes('FROM arsy_fx_conversions')) return { rows: [fxRow] }
      if (sql.includes('FROM arsy_payouts')) return { rows: [payoutRow] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

test('payout and FX APIs require the operator token', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const payout = await app.inject({
      method: 'POST',
      url: '/api/v1/payouts',
      payload: { channelId, amountMinor: '5000', currency: 'IDR' },
    })
    const fx = await app.inject({ method: 'GET', url: '/api/v1/fx-conversions' })
    assert.equal(payout.statusCode, 401)
    assert.equal(fx.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('payout API records pending payout and requires evidence for status transitions', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  const headers = { 'x-arsy-operator-token': token }
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/payouts',
      headers,
      payload: {
        channelId,
        amountMinor: '5000',
        currency: 'IDR',
        expectedAt: '2026-11-08T00:00:00Z',
        source: 'Manual provider statement',
        idempotencyKey: 'payout-statement-001',
        evidenceUrl: 'https://example.com/payout',
        evidenceCapturedAt: '2026-11-08T00:00:00Z',
        evidenceSummary: 'Pending payout from a provider statement.',
      },
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().data.status, 'pending')

    const missingEvidence = await app.inject({
      method: 'PATCH',
      url: `/api/v1/payouts/${payoutId}/status`,
      headers,
      payload: { status: 'paid', rationale: 'Marked paid without evidence.' },
    })
    assert.equal(missingEvidence.statusCode, 400)

    const paid = await app.inject({
      method: 'PATCH',
      url: `/api/v1/payouts/${payoutId}/status`,
      headers,
      payload: {
        status: 'paid',
        rationale: 'Matched against the bank statement.',
        evidenceUrl: 'https://example.com/bank-statement',
        evidenceCapturedAt: '2026-11-08T01:00:00Z',
        occurredAt: '2026-11-08T00:59:30Z',
      },
    })
    assert.equal(paid.statusCode, 200)
    assert.equal(paid.json().data.status, 'paid')
    assert.ok(pool.calls.some((sql) => sql.includes('arsy_financial_events')))
  } finally {
    await app.close()
  }
})

test('FX API verifies exact rational conversion and refuses inconsistent converted amounts', async () => {
  const pool = fakePool()
  const app = await createApp({ databasePool: pool, logger: false, env })
  const headers = { 'x-arsy-operator-token': token }
  const input = {
    sourceEventId,
    fromAmountMinor: '10000',
    fromCurrency: 'IDR',
    toAmountMinor: '100',
    toCurrency: 'USD',
    rateNumerator: '1',
    rateDenominator: '100',
    rateSource: 'Bank statement rate',
    sourceUrl: 'https://example.com/fx',
    observedAt: '2026-11-08T00:00:00Z',
    idempotencyKey: 'fx-statement-line-001',
  }
  try {
    const mismatch = await app.inject({
      method: 'POST',
      url: '/api/v1/fx-conversions',
      headers,
      payload: { ...input, toAmountMinor: '101' },
    })
    assert.equal(mismatch.statusCode, 400)
    assert.equal(mismatch.json().error.code, 'FX_AMOUNT_MISMATCH')
    assert.equal(pool.calls.length, 0)

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/fx-conversions',
      headers,
      payload: input,
    })
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().data.toAmountMinor, '100')
    assert.equal(created.json().data.rateNumerator, '1')
  } finally {
    await app.close()
  }
})
