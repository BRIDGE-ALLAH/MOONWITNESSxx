import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { FinancialRepository } from '../src/finance/repository.ts'

const input = {
  eventType: 'gross-receipt',
  amountMinor: '9007199254740993',
  currency: 'IDR',
  occurredAt: '2026-11-08T00:00:00Z',
  source: 'Manual operator entry with provider statement reference',
  idempotencyKey: 'statement-line-0001',
  metadata: { statementLine: '0001' },
}
const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
const row = {
  id: '11111111-1111-4111-8111-111111111111',
  product_id: null,
  event_type: 'gross-receipt',
  amount_minor: input.amountMinor,
  currency: 'IDR',
  occurred_at: input.occurredAt,
  recorded_at: '2026-11-08T00:01:00Z',
  source: input.source,
  provider_reference: null,
  reconciliation_state: 'pending',
  metadata: input.metadata,
  request_hash: hash,
}

test('stores financial amounts as exact minor-unit strings and defaults to pending', async () => {
  let call
  const repository = new FinancialRepository({
    query: async (sql, values) => {
      call = { sql, values }
      return { rows: [row] }
    },
    end: async () => undefined,
  })
  const result = await repository.create('owner-a', 'owner-a', input)
  assert.equal(result?.event.amountMinor, '9007199254740993')
  assert.equal(result?.event.reconciliationState, 'pending')
  assert.equal(result?.replayed, false)
  assert.match(call.sql, /amount_minor/)
  assert.match(call.sql, /\$5::bigint/)
  assert.equal(call.values[4], '9007199254740993')
})

test('idempotent replay returns the existing event and rejects key reuse with a different payload', async () => {
  const replayRepo = new FinancialRepository({
    query: async (sql) => sql.includes('INSERT INTO arsy_financial_events') ? { rows: [] } : { rows: [row] },
    end: async () => undefined,
  })
  const replay = await replayRepo.create('owner-a', 'owner-a', input)
  assert.equal(replay?.replayed, true)
  const conflictRepo = new FinancialRepository({
    query: async (sql) => sql.includes('INSERT INTO arsy_financial_events') ? { rows: [] } : { rows: [{ ...row, request_hash: '0'.repeat(64) }] },
    end: async () => undefined,
  })
  await assert.rejects(conflictRepo.create('owner-a', 'owner-a', input), /IDEMPOTENCY_KEY_REUSED/)
})

test('contribution summary uses exact bigint arithmetic and excludes pending events', async () => {
  const repository = new FinancialRepository({
    query: async () => ({ rows: [{
      currency: 'IDR',
      gross_receipts_minor: '9007199254740993',
      deductions_minor: '200',
      tax_reserve_minor: '50',
      payout_movements_minor: '100',
      pending_minor: '500',
      pending_count: '2',
    }] }),
    end: async () => undefined,
  })
  const [summary] = await repository.summary('owner-a')
  assert.equal(summary.net_contribution_minor, '9007199254740793')
  assert.equal(summary.tax_reserve_minor, '50')
  assert.equal(summary.payout_movements_minor, '100')
  assert.equal(summary.pending_minor, '500')
})
