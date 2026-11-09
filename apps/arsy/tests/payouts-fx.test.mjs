import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  calculateConvertedMinor,
  FxConversionRepository,
  PayoutRepository,
} from '../src/finance/payouts.ts'

const payoutRow = {
  id: '11111111-1111-4111-8111-111111111111',
  channel_id: '22222222-2222-4222-8222-222222222222',
  channel_name: 'Reviewed Manual Channel',
  amount_minor: '5000',
  currency: 'IDR',
  status: 'pending',
  provider_reference: 'statement-001',
  expected_at: '2026-11-08T00:00:00Z',
  paid_at: null,
  source: 'Manual provider statement',
  source_evidence: {
    evidenceUrl: 'https://example.com/statement',
    capturedAt: '2026-11-08T00:00:00Z',
    summary: 'Pending payout listed in a provider statement.',
  },
  reconciliation_evidence: {},
  request_hash: 'a'.repeat(64),
  created_at: '2026-11-08T00:00:00Z',
  recorded_at: '2026-11-08T00:01:00Z',
  updated_at: '2026-11-08T00:00:00Z',
  history: [],
}

const fxRow = {
  id: '33333333-3333-4333-8333-333333333333',
  source_event_id: '44444444-4444-4444-8444-444444444444',
  from_amount_minor: '10000',
  from_currency: 'IDR',
  to_amount_minor: '100',
  to_currency: 'USD',
  rate_numerator: '1',
  rate_denominator: '100',
  rate_source: 'Manual bank statement rate',
  source_url: 'https://example.com/fx-statement',
  observed_at: '2026-11-08T00:00:00Z',
  recorded_at: '2026-11-08T00:01:00Z',
  request_hash: 'a'.repeat(64),
}

test('exact rational FX conversion uses integer half-up rounding', () => {
  assert.equal(calculateConvertedMinor('10000', '1', '100'), '100')
  assert.equal(calculateConvertedMinor('5', '1', '2'), '3')
  assert.equal(calculateConvertedMinor('4', '1', '2'), '2')
  assert.throws(() => calculateConvertedMinor('0', '1', '2'), /POSITIVE/)
  assert.throws(() => calculateConvertedMinor('10', '1', '0'), /POSITIVE/)
})

test('payout creation is persisted as pending and includes source evidence', async () => {
  let captured
  const repository = new PayoutRepository({
    query: async (sql, values) => {
      captured = { sql, values }
      return { rows: [payoutRow] }
    },
    end: async () => undefined,
  })
  const result = await repository.create('owner-a', 'owner-a', {
    channelId: payoutRow.channel_id,
    amountMinor: '5000',
    currency: 'IDR',
    expectedAt: '2026-11-08T00:00:00Z',
    providerReference: 'statement-001',
    source: 'Manual provider statement',
    idempotencyKey: 'payout-statement-001',
    evidenceUrl: 'https://example.com/statement',
    evidenceCapturedAt: '2026-11-08T00:00:00Z',
    evidenceSummary: 'Pending payout listed in a provider statement.',
  })
  assert.equal(result?.payout.status, 'pending')
  assert.equal(result?.payout.amountMinor, '5000')
  assert.equal(result?.replayed, false)
  assert.match(captured.sql, /capability = 'C1'/)
  assert.match(captured.sql, /policy_recheck_at > now\(\)/)
  assert.match(captured.sql, /official-policy/)
  assert.match(captured.sql, /account-eligibility/)
  assert.match(captured.sql, /payout-requirements/)
  assert.match(captured.sql, /format-requirements/)
  assert.match(captured.sql, /arsy_payout_events/)
  assert.equal(captured.values[3], '5000')
})

test('payout idempotency replay compares the persisted request hash', async () => {
  const input = {
    channelId: payoutRow.channel_id,
    amountMinor: '5000',
    currency: 'IDR',
    expectedAt: '2026-11-08T00:00:00Z',
    providerReference: 'statement-001',
    source: 'Manual provider statement',
    idempotencyKey: 'payout-statement-001',
    evidenceUrl: 'https://example.com/statement',
    evidenceCapturedAt: '2026-11-08T00:00:00Z',
    evidenceSummary: 'Pending payout listed in a provider statement.',
  }
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  let calls = 0
  const repository = new PayoutRepository({
    query: async () => {
      calls += 1
      return calls === 1 ? { rows: [] } : { rows: [{ ...payoutRow, request_hash: requestHash }] }
    },
    end: async () => undefined,
  })
  const result = await repository.create('owner-a', 'owner-a', input)
  assert.equal(calls, 2)
  assert.equal(result?.replayed, true)
  assert.equal(result?.payout.id, payoutRow.id)
})

test('payout transitions append evidence and create only explicit paid/reversal ledger movements', async () => {
  let captured
  const repository = new PayoutRepository({
    query: async (sql, values) => {
      captured = { sql, values }
      return { rows: [{ ...payoutRow, status: 'paid', paid_at: '2026-11-08T01:00:00Z' }] }
    },
    end: async () => undefined,
  })
  const result = await repository.transition(
    'owner-a',
    'owner-a',
    payoutRow.id,
    'paid',
    'Matched the payout to the bank statement.',
    'https://example.com/bank-statement',
    '2026-11-08T01:00:00Z',
    '2026-11-08T00:59:30Z',
  )
  assert.equal(result?.status, 'paid')
  assert.match(captured.sql, /arsy_payout_events/)
  assert.match(captured.sql, /arsy_financial_events/)
  assert.equal(captured.values[2], 'paid')
  assert.equal(captured.values[4], '2026-11-08T00:59:30Z')
  assert.equal(captured.values[9], 'payout')
  assert.match(captured.sql, /occurred_at\)/)
  assert.match(captured.sql, /recordedAt/)
})

test('FX conversion repository links only a verified source event and preserves the rational rate', async () => {
  let captured
  const repository = new FxConversionRepository({
    query: async (sql, values) => {
      captured = { sql, values }
      return { rows: [fxRow] }
    },
    end: async () => undefined,
  })
  const result = await repository.create('owner-a', 'owner-a', {
    sourceEventId: fxRow.source_event_id,
    fromAmountMinor: '10000',
    fromCurrency: 'IDR',
    toAmountMinor: '100',
    toCurrency: 'USD',
    rateNumerator: '1',
    rateDenominator: '100',
    rateSource: 'Manual bank statement rate',
    sourceUrl: 'https://example.com/fx-statement',
    observedAt: '2026-11-08T00:00:00Z',
    idempotencyKey: 'fx-statement-line-001',
  })
  assert.equal(result?.conversion.toAmountMinor, '100')
  assert.equal(result?.conversion.rateNumerator, '1')
  assert.equal(result?.conversion.rateDenominator, '100')
  assert.match(captured.sql, /reconciliation_state = 'verified'/)
  assert.equal(captured.values[7], '1')
  assert.equal(captured.values[8], '100')
})
