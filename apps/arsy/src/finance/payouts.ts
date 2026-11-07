import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }

export type PayoutStatus = 'pending' | 'paid' | 'failed' | 'reversed' | 'disputed'
const transitions: Record<PayoutStatus, readonly PayoutStatus[]> = {
  pending: ['paid', 'failed', 'disputed'],
  paid: ['reversed', 'disputed'],
  failed: ['disputed'],
  disputed: ['paid', 'failed', 'reversed'],
  reversed: [],
}
export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return transitions[from].includes(to)
}

export interface PayoutInput {
  channelId: string
  listingId?: string
  amountMinor: string
  currency: string
  providerReference?: string
  expectedAt: string
  source: string
  evidenceUrl: string
  idempotencyKey: string
}
export interface PayoutRecord {
  id: string
  channelId: string
  listingId: string | null
  amountMinor: string
  currency: string
  status: PayoutStatus
  providerReference: string | null
  expectedAt: string | null
  paidAt: string | null
  failedAt: string | null
  reversedAt: string | null
  disputedAt: string | null
  sourceEvidence: Record<string, unknown>
  paidFinancialEventId: string | null
  reversalFinancialEventId: string | null
  createdAt: string
  updatedAt: string
}
interface PayoutRow {
  id: string; channel_id: string; listing_id: string | null; amount_minor: string
  currency: string; status: PayoutStatus; provider_reference: string | null
  expected_at: Date | string | null; paid_at: Date | string | null; failed_at: Date | string | null
  reversed_at: Date | string | null; disputed_at: Date | string | null
  source_evidence: Record<string, unknown>; paid_financial_event_id: string | null
  reversal_financial_event_id: string | null; created_at: Date | string; updated_at: Date | string
}
export interface PayoutEventRecord {
  id: string; payoutId: string; fromStatus: PayoutStatus | null; toStatus: PayoutStatus
  amountMinor: string; currency: string; providerReference: string | null
  evidenceUrl: string | null; source: string; rationale: string | null
  occurredAt: string; recordedAt: string
}
interface PayoutEventRow {
  id: string; payout_id: string; from_status: PayoutStatus | null; to_status: PayoutStatus
  amount_minor: string; currency: string; provider_reference: string | null
  evidence_url: string | null; source: string; rationale: string | null
  occurred_at: Date | string; recorded_at: Date | string
}
const payoutColumns = `id, channel_id, listing_id, amount_minor::text AS amount_minor, currency,
  status, provider_reference, expected_at, paid_at, failed_at, reversed_at, disputed_at,
  source_evidence, paid_financial_event_id, reversal_financial_event_id, created_at, updated_at`
function iso(value: Date | string | null): string | null { return value === null ? null : new Date(value).toISOString() }
function mapPayout(row: PayoutRow): PayoutRecord {
  return {
    id: row.id, channelId: row.channel_id, listingId: row.listing_id,
    amountMinor: row.amount_minor, currency: row.currency.trim(), status: row.status,
    providerReference: row.provider_reference, expectedAt: iso(row.expected_at), paidAt: iso(row.paid_at),
    failedAt: iso(row.failed_at), reversedAt: iso(row.reversed_at), disputedAt: iso(row.disputed_at),
    sourceEvidence: row.source_evidence, paidFinancialEventId: row.paid_financial_event_id,
    reversalFinancialEventId: row.reversal_financial_event_id,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  }
}
function mapPayoutEvent(row: PayoutEventRow): PayoutEventRecord {
  return {
    id: row.id, payoutId: row.payout_id, fromStatus: row.from_status, toStatus: row.to_status,
    amountMinor: row.amount_minor, currency: row.currency, providerReference: row.provider_reference,
    evidenceUrl: row.evidence_url, source: row.source, rationale: row.rationale,
    occurredAt: new Date(row.occurred_at).toISOString(), recordedAt: new Date(row.recorded_at).toISOString(),
  }
}

export class PayoutRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: PayoutInput): Promise<{ payout: PayoutRecord; replayed: boolean } | null> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const payoutId = randomUUID()
    const result = await this.db.query(
      `WITH eligible AS (
        SELECT c.id FROM arsy_channels c
        WHERE c.id = $3 AND c.capability = 'C1' AND c.enabled = true
          AND ($4::uuid IS NULL OR EXISTS (
            SELECT 1 FROM arsy_listings l
            WHERE l.owner_id = $2 AND l.id = $4 AND l.channel_id = c.id
          ))
      ), created AS (
        INSERT INTO arsy_payouts
          (id, owner_id, channel_id, listing_id, amount_minor, currency, status,
           provider_reference, expected_at, source_evidence, created_by, updated_by,
           idempotency_key, request_hash)
        SELECT $1, $2, eligible.id, $4, $5::bigint, $6, 'pending', $7,
          $8::timestamptz, jsonb_build_object('source', $9, 'evidenceUrl', $10),
          $11, $11, $12, $13
        FROM eligible
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), history AS (
        INSERT INTO arsy_payout_events
          (id, owner_id, payout_id, from_status, to_status, amount_minor, currency,
           provider_reference, evidence_url, source, occurred_at, idempotency_key, request_hash, created_by)
        SELECT $14, $2, created.id, NULL, 'pending', created.amount_minor, created.currency,
          created.provider_reference, $10, $9, now(), $12, $13, $11
        FROM created
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $15, $2, 'payout', created.id, 'expected-payout-recorded', $11,
          jsonb_build_object('channelId', created.channel_id, 'amountMinor', created.amount_minor::text, 'currency', created.currency)
        FROM created
      )
      SELECT ${payoutColumns} FROM created`,
      [payoutId, ownerId, input.channelId, input.listingId ?? null, input.amountMinor, input.currency,
        input.providerReference ?? null, input.expectedAt, input.source, input.evidenceUrl, actorId,
        input.idempotencyKey, requestHash, randomUUID(), randomUUID()],
    )
    const created = rows<PayoutRow>(result)[0]
    if (created) return { payout: mapPayout(created), replayed: false }
    const existingResult = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existing = rows<PayoutRow>(existingResult)[0]
    if (!existing) return null
    const hashResult = await this.db.query(
      'SELECT request_hash FROM arsy_payouts WHERE owner_id = $1 AND id = $2',
      [ownerId, existing.id],
    )
    if (rows<{ request_hash: string }>(hashResult)[0]?.request_hash !== requestHash) throw new Error('PAYOUT_IDEMPOTENCY_CONFLICT')
    return { payout: mapPayout(existing), replayed: true }
  }

  async list(ownerId: string, limit = 100): Promise<PayoutRecord[]> {
    const result = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<PayoutRow>(result).map(mapPayout)
  }

  async events(ownerId: string, payoutId: string): Promise<PayoutEventRecord[]> {
    const result = await this.db.query(
      `SELECT e.* FROM arsy_payout_events e
       JOIN arsy_payouts p ON p.owner_id = e.owner_id AND p.id = e.payout_id
       WHERE e.owner_id = $1 AND e.payout_id = $2
       ORDER BY e.recorded_at ASC, e.id ASC`,
      [ownerId, payoutId],
    )
    return rows<PayoutEventRow>(result).map(mapPayoutEvent)
  }

  async transition(
    ownerId: string,
    actorId: string,
    payoutId: string,
    expectedStatus: PayoutStatus,
    nextStatus: PayoutStatus,
    rationale: string,
    evidenceUrl: string | null,
    occurredAt: string,
    source: string,
  ): Promise<PayoutRecord | null> {
    if (!canTransitionPayout(expectedStatus, nextStatus)) throw new Error('INVALID_PAYOUT_TRANSITION')
    if (['paid', 'reversed'].includes(nextStatus) && !evidenceUrl) throw new Error('PAYOUT_EVIDENCE_REQUIRED')
    const eventKey = `payout:${payoutId}:${expectedStatus}:${nextStatus}`
    const paidKey = `payout:${payoutId}:paid`
    const financialKey = `payout:${payoutId}:${nextStatus === 'reversed' ? 'reversed' : 'paid'}`
    const financialType = nextStatus === 'reversed' ? 'payout-reversal' : 'payout'
    const requestHash = createHash('sha256').update(JSON.stringify({
      payoutId, expectedStatus, nextStatus, rationale, evidenceUrl, occurredAt, source,
    })).digest('hex')
    const financialHash = createHash('sha256').update(JSON.stringify({
      payoutId, financialType, rationale, evidenceUrl, occurredAt,
    })).digest('hex')
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_payouts SET
          status = $4,
          paid_at = CASE WHEN $4 = 'paid' THEN $6::timestamptz ELSE paid_at END,
          failed_at = CASE WHEN $4 = 'failed' THEN $6::timestamptz ELSE failed_at END,
          reversed_at = CASE WHEN $4 = 'reversed' THEN $6::timestamptz ELSE reversed_at END,
          disputed_at = CASE WHEN $4 = 'disputed' THEN $6::timestamptz ELSE disputed_at END,
          failure_reason = CASE WHEN $4 = 'failed' THEN $7 ELSE failure_reason END,
          dispute_reason = CASE WHEN $4 = 'disputed' THEN $7 ELSE dispute_reason END,
          source_evidence = source_evidence || jsonb_build_object(
            'latestTransition', jsonb_build_object('source', $8, 'rationale', $7, 'evidenceUrl', $9, 'occurredAt', $6)
          ),
          updated_at = now(), updated_by = $5
        WHERE owner_id = $1 AND id = $2 AND status = $3
        RETURNING *
      ), financial_inserted AS (
        INSERT INTO arsy_financial_events
          (id, owner_id, product_id, listing_id, event_type, amount_minor, currency, occurred_at,
           source, provider_reference, idempotency_key, request_hash, reconciliation_state, metadata, created_by)
        SELECT $10, c.owner_id, pv.product_id, c.listing_id, $11, c.amount_minor, c.currency,
          $6::timestamptz, $8, c.provider_reference, $12, $13, 'verified',
          jsonb_build_object('payoutId', c.id, 'rationale', $7, 'evidenceUrl', $9), $5
        FROM changed c
        LEFT JOIN arsy_listings l ON l.owner_id = c.owner_id AND l.id = c.listing_id
        LEFT JOIN arsy_product_versions pv ON pv.id = l.product_version_id
        WHERE $4 IN ('paid', 'reversed')
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING id
      ), financial_existing AS (
        SELECT id FROM financial_inserted
        UNION ALL
        SELECT id FROM arsy_financial_events
        WHERE owner_id = $1 AND idempotency_key = $12
        LIMIT 1
      ), disputed_financial AS (
        UPDATE arsy_financial_events SET reconciliation_state = 'disputed',
          metadata = metadata || jsonb_build_object('payoutDispute', jsonb_build_object('rationale', $7, 'evidenceUrl', $9, 'recordedAt', now()))
        WHERE owner_id = $1 AND idempotency_key = $14 AND $4 = 'disputed'
        RETURNING id
      ), restored_financial AS (
        UPDATE arsy_financial_events SET reconciliation_state = 'verified',
          metadata = metadata || jsonb_build_object('payoutRestored', jsonb_build_object('rationale', $7, 'evidenceUrl', $9, 'recordedAt', now()))
        WHERE owner_id = $1 AND idempotency_key = $14 AND $4 = 'paid'
        RETURNING id
      ), linked AS (
        UPDATE arsy_payouts p SET
          paid_financial_event_id = CASE WHEN $4 = 'paid' THEN COALESCE((SELECT id FROM financial_existing), p.paid_financial_event_id) ELSE p.paid_financial_event_id END,
          reversal_financial_event_id = CASE WHEN $4 = 'reversed' THEN COALESCE((SELECT id FROM financial_existing), p.reversal_financial_event_id) ELSE p.reversal_financial_event_id END
        FROM changed c
        WHERE p.owner_id = $1 AND p.id = c.id
        RETURNING p.*
      ), history AS (
        INSERT INTO arsy_payout_events
          (id, owner_id, payout_id, from_status, to_status, amount_minor, currency, provider_reference,
           evidence_url, source, rationale, occurred_at, idempotency_key, request_hash, created_by)
        SELECT $15, $1, changed.id, $3, $4, changed.amount_minor, changed.currency,
          changed.provider_reference, $9, $8, $7, $6::timestamptz, $16, $17, $5
        FROM changed
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $18, $1, 'payout', changed.id, 'status-transitioned', $5,
          jsonb_build_object('from', $3, 'to', $4, 'rationale', $7, 'evidenceUrl', $9)
        FROM changed
      )
      SELECT ${payoutColumns} FROM linked`,
      [ownerId, payoutId, expectedStatus, nextStatus, actorId, occurredAt, rationale, source,
        evidenceUrl, randomUUID(), financialType, financialKey, financialHash, paidKey,
        randomUUID(), eventKey, requestHash, randomUUID()],
    )
    const row = rows<PayoutRow>(result)[0]
    return row ? mapPayout(row) : null
  }
}

export type FxRoundingMode = 'half-up' | 'half-even'
export function convertMinorUnits(amountMinor: string, numerator: string, denominator: string, roundingMode: FxRoundingMode): string {
  if (!/^[1-9][0-9]{0,17}$/.test(amountMinor) ||
      !/^[1-9][0-9]{0,37}$/.test(numerator) ||
      !/^[1-9][0-9]{0,37}$/.test(denominator)) throw new Error('INVALID_FX_INTEGER')
  const amount = BigInt(amountMinor)
  const rateNumerator = BigInt(numerator)
  const rateDenominator = BigInt(denominator)
  let quotient = (amount * rateNumerator) / rateDenominator
  const remainder = (amount * rateNumerator) % rateDenominator
  const twiceRemainder = remainder * 2n
  if (roundingMode === 'half-up' && twiceRemainder >= rateDenominator) quotient += 1n
  if (roundingMode === 'half-even' && (twiceRemainder > rateDenominator || (twiceRemainder === rateDenominator && quotient % 2n === 1n))) quotient += 1n
  if (quotient <= 0n || quotient > 999999999999999999n) throw new Error('FX_RESULT_OUT_OF_RANGE')
  return quotient.toString()
}

export interface FxConversionInput {
  sourceEventId: string
  toCurrency: string
  rateNumerator: string
  rateDenominator: string
  rateSource: string
  rateObservedAt: string
  evidenceUrl: string
  roundingMode: FxRoundingMode
  idempotencyKey: string
}
export interface FxConversionRecord {
  id: string
  sourceEventId: string
  fromCurrency: string
  toCurrency: string
  fromAmountMinor: string
  toAmountMinor: string
  rateNumerator: string
  rateDenominator: string
  rateSource: string
  rateObservedAt: string
  evidenceUrl: string
  roundingMode: FxRoundingMode
  createdAt: string
}
interface FxRow {
  id: string; source_event_id: string; from_currency: string; to_currency: string
  from_amount_minor: string; to_amount_minor: string; rate_numerator: string
  rate_denominator: string; rate_source: string; rate_observed_at: Date | string
  evidence_url: string; rounding_mode: FxRoundingMode; created_at: Date | string
}
function mapFx(row: FxRow): FxConversionRecord {
  return {
    id: row.id, sourceEventId: row.source_event_id, fromCurrency: row.from_currency,
    toCurrency: row.to_currency, fromAmountMinor: row.from_amount_minor, toAmountMinor: row.to_amount_minor,
    rateNumerator: row.rate_numerator, rateDenominator: row.rate_denominator, rateSource: row.rate_source,
    rateObservedAt: new Date(row.rate_observed_at).toISOString(), evidenceUrl: row.evidence_url,
    roundingMode: row.rounding_mode, createdAt: new Date(row.created_at).toISOString(),
  }
}
const fxColumns = `id, source_event_id, from_currency, to_currency, from_amount_minor::text AS from_amount_minor,
  to_amount_minor::text AS to_amount_minor, rate_numerator::text AS rate_numerator,
  rate_denominator::text AS rate_denominator, rate_source, rate_observed_at, evidence_url, rounding_mode, created_at`

export class FxConversionRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: FxConversionInput): Promise<{ conversion: FxConversionRecord; replayed: boolean } | null> {
    const sourceResult = await this.db.query(
      `SELECT id, amount_minor::text AS amount_minor, currency
       FROM arsy_financial_events
       WHERE owner_id = $1 AND id = $2 AND reconciliation_state = 'verified'`,
      [ownerId, input.sourceEventId],
    )
    const source = rows<{ id: string; amount_minor: string; currency: string }>(sourceResult)[0]
    if (!source) return null
    if (source.currency === input.toCurrency) throw new Error('FX_CURRENCY_MUST_DIFFER')
    const toAmountMinor = convertMinorUnits(source.amount_minor, input.rateNumerator, input.rateDenominator, input.roundingMode)
    const requestHash = createHash('sha256').update(JSON.stringify({ ...input, fromAmountMinor: source.amount_minor, fromCurrency: source.currency, toAmountMinor })).digest('hex')
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_fx_conversions
          (id, owner_id, source_event_id, from_currency, to_currency, from_amount_minor, to_amount_minor,
           rate_numerator, rate_denominator, rate_source, rate_observed_at, evidence_url, rounding_mode,
           idempotency_key, request_hash, created_by)
        VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::numeric, $9::numeric,
          $10, $11::timestamptz, $12, $13, $14, $15, $16)
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $17, $2, 'fx-conversion', created.id, 'source-backed-fx-conversion-recorded', $16,
          jsonb_build_object('sourceEventId', $3, 'fromCurrency', $4, 'toCurrency', $5,
            'fromAmountMinor', $6, 'toAmountMinor', $7, 'rateNumerator', $8, 'rateDenominator', $9,
            'rateSource', $10, 'evidenceUrl', $12)
        FROM created
      )
      SELECT ${fxColumns} FROM created`,
      [randomUUID(), ownerId, source.id, source.currency, input.toCurrency, source.amount_minor, toAmountMinor,
        input.rateNumerator, input.rateDenominator, input.rateSource, input.rateObservedAt, input.evidenceUrl,
        input.roundingMode, input.idempotencyKey, requestHash, actorId, randomUUID()],
    )
    const created = rows<FxRow>(result)[0]
    if (created) return { conversion: mapFx(created), replayed: false }
    const existingResult = await this.db.query(
      `SELECT ${fxColumns}, request_hash FROM arsy_fx_conversions
       WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existing = rows<FxRow & { request_hash: string }>(existingResult)[0]
    if (!existing) return null
    if (existing.request_hash !== requestHash) throw new Error('FX_IDEMPOTENCY_CONFLICT')
    return { conversion: mapFx(existing), replayed: true }
  }

  async list(ownerId: string, limit = 100): Promise<FxConversionRecord[]> {
    const result = await this.db.query(
      `SELECT ${fxColumns} FROM arsy_fx_conversions WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<FxRow>(result).map(mapFx)
  }
}
