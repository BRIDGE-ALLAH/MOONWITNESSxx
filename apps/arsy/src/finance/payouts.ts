import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
type PayoutStatus = 'pending' | 'paid' | 'failed' | 'reversed' | 'disputed'

export interface PayoutInput {
  channelId: string
  amountMinor: string
  currency: string
  expectedAt?: string
  providerReference?: string
  source: string
  idempotencyKey: string
  evidenceUrl: string
  evidenceCapturedAt: string
  evidenceSummary: string
}

export interface PayoutEvidence {
  evidenceUrl: string
  capturedAt: string
  summary: string
}

export interface PayoutRecord {
  id: string
  channelId: string | null
  channelName: string
  amountMinor: string
  currency: string
  status: PayoutStatus
  providerReference: string | null
  expectedAt: string | null
  paidAt: string | null
  source: string
  sourceEvidence: PayoutEvidence
  reconciliationEvidence: Record<string, unknown>
  createdAt: string
  recordedAt: string
  updatedAt: string
  history: Array<Record<string, unknown>>
  allowedNextStatuses: PayoutStatus[]
}

interface PayoutRow {
  id: string
  channel_id: string | null
  channel_name: string | null
  amount_minor: string
  currency: string
  status: PayoutStatus
  provider_reference: string | null
  expected_at: Date | string | null
  paid_at: Date | string | null
  source: string
  source_evidence: PayoutEvidence
  request_hash: string
  reconciliation_evidence: Record<string, unknown>
  created_at: Date | string
  recorded_at: Date | string
  updated_at: Date | string
  history?: Array<Record<string, unknown>>
  from_status?: PayoutStatus
}

export interface FxConversionInput {
  sourceEventId: string
  fromAmountMinor: string
  fromCurrency: string
  toAmountMinor: string
  toCurrency: string
  rateNumerator: string
  rateDenominator: string
  rateSource: string
  sourceUrl: string
  observedAt: string
  idempotencyKey: string
}

export interface FxConversionRecord {
  id: string
  sourceEventId: string
  fromAmountMinor: string
  fromCurrency: string
  toAmountMinor: string
  toCurrency: string
  rateNumerator: string
  rateDenominator: string
  rateSource: string
  sourceUrl: string
  observedAt: string
  recordedAt: string
}

interface FxConversionRow {
  id: string
  source_event_id: string
  from_amount_minor: string
  from_currency: string
  to_amount_minor: string
  to_currency: string
  rate_numerator: string
  rate_denominator: string
  rate_source: string
  source_url: string
  observed_at: Date | string
  recorded_at: Date | string
  request_hash: string
}

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

function allowedPayoutTransitions(status: PayoutStatus, paidAt: Date | string | null): PayoutStatus[] {
  if (status === 'pending') return ['paid', 'failed', 'disputed']
  if (status === 'paid') return ['reversed', 'disputed']
  if (status === 'failed') return ['disputed']
  if (status === 'disputed') return paidAt === null ? ['paid', 'failed'] : ['paid', 'reversed']
  return []
}

function mapPayout(row: PayoutRow): PayoutRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name ?? 'Unlinked legacy payout',
    amountMinor: row.amount_minor,
    currency: row.currency.trim(),
    status: row.status,
    providerReference: row.provider_reference,
    expectedAt: iso(row.expected_at),
    paidAt: iso(row.paid_at),
    source: row.source,
    sourceEvidence: row.source_evidence,
    reconciliationEvidence: row.reconciliation_evidence,
    createdAt: new Date(row.created_at).toISOString(),
    recordedAt: new Date(row.recorded_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    history: row.history ?? [],
    allowedNextStatuses: allowedPayoutTransitions(row.status, row.paid_at),
  }
}

function mapFx(row: FxConversionRow): FxConversionRecord {
  return {
    id: row.id,
    sourceEventId: row.source_event_id,
    fromAmountMinor: row.from_amount_minor,
    fromCurrency: row.from_currency.trim(),
    toAmountMinor: row.to_amount_minor,
    toCurrency: row.to_currency.trim(),
    rateNumerator: row.rate_numerator,
    rateDenominator: row.rate_denominator,
    rateSource: row.rate_source,
    sourceUrl: row.source_url,
    observedAt: new Date(row.observed_at).toISOString(),
    recordedAt: new Date(row.recorded_at).toISOString(),
  }
}

const payoutColumns = `p.id, p.channel_id, c.display_name AS channel_name,
  p.amount_minor::text AS amount_minor, p.currency, p.status, p.provider_reference,
  p.expected_at, p.paid_at, p.source, p.source_evidence, p.request_hash, p.reconciliation_evidence,
  p.created_at, p.recorded_at, p.updated_at,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'fromStatus', pe.from_status, 'toStatus', pe.to_status,
      'rationale', pe.rationale, 'evidence', pe.evidence,
      'actorId', pe.actor_id, 'occurredAt', pe.occurred_at,
      'recordedAt', pe.recorded_at
    ) ORDER BY pe.occurred_at ASC, pe.recorded_at ASC, pe.id ASC)
    FROM arsy_payout_events pe
    WHERE pe.owner_id = p.owner_id AND pe.payout_id = p.id
  ), '[]'::jsonb) AS history`

const fxColumns = `id, source_event_id, from_amount_minor::text AS from_amount_minor,
  from_currency, to_amount_minor::text AS to_amount_minor, to_currency,
  rate_numerator::text AS rate_numerator, rate_denominator::text AS rate_denominator,
  rate_source, source_url, observed_at, recorded_at, request_hash`

export class PayoutRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: PayoutInput): Promise<{ payout: PayoutRecord; replayed: boolean } | null> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const payoutId = randomUUID()
    const auditId = randomUUID()
    const historyId = randomUUID()
    const sourceEvidence = {
      evidenceUrl: input.evidenceUrl,
      capturedAt: input.evidenceCapturedAt,
      summary: input.evidenceSummary,
    }
    const result = await this.db.query(
      `WITH eligible_channel AS (
        SELECT id FROM arsy_channels
        WHERE id = $3
          AND owner_id = $2
          AND channel_status = 'active'
          AND capability = 'C1'
          AND account_eligibility = 'eligible'
          AND payout_setup_status = 'configured'
          AND official_policy_url IS NOT NULL
          AND policy_reviewed_at IS NOT NULL
          AND policy_recheck_at > now()
          AND EXISTS (
            SELECT 1 FROM arsy_channel_evidence evidence
            WHERE evidence.owner_id = $2 AND evidence.channel_id = arsy_channels.id
              AND evidence.evidence_type = 'official-policy'
              AND evidence.evidence_class = 'observed-fact'
          )
          AND EXISTS (
            SELECT 1 FROM arsy_channel_evidence evidence
            WHERE evidence.owner_id = $2 AND evidence.channel_id = arsy_channels.id
              AND evidence.evidence_type = 'account-eligibility'
              AND evidence.evidence_class = 'observed-fact'
          )
          AND EXISTS (
            SELECT 1 FROM arsy_channel_evidence evidence
            WHERE evidence.owner_id = $2 AND evidence.channel_id = arsy_channels.id
              AND evidence.evidence_type = 'payout-requirements'
              AND evidence.evidence_class = 'observed-fact'
          )
          AND EXISTS (
            SELECT 1 FROM arsy_channel_evidence evidence
            WHERE evidence.owner_id = $2 AND evidence.channel_id = arsy_channels.id
              AND evidence.evidence_type = 'format-requirements'
              AND evidence.evidence_class = 'observed-fact'
          )
      ), created AS (
        INSERT INTO arsy_payouts
          (id, owner_id, channel_id, amount_minor, currency, status, provider_reference,
           expected_at, source_evidence, source, idempotency_key, request_hash,
           created_by, updated_by)
        SELECT $1, $2, id, $4::bigint, $5, 'pending', $6, $7::timestamptz,
          $8::jsonb, $9, $10, $11, $12, $12
        FROM eligible_channel
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), history AS (
        INSERT INTO arsy_payout_events
          (id, owner_id, payout_id, from_status, to_status, rationale, evidence, actor_id)
        SELECT $13, owner_id, id, NULL, 'pending',
          'Payout recorded. This is not evidence that funds have been paid.',
          $8::jsonb, $12
        FROM created
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $14, owner_id, 'payout', id, 'recorded-pending', $12,
          jsonb_build_object('channelId', channel_id, 'currency', currency, 'amountMinor', amount_minor::text)
        FROM created
      )
      SELECT ${payoutColumns} FROM created p
      JOIN arsy_channels c ON c.id = p.channel_id`,
      [payoutId, ownerId, input.channelId, input.amountMinor, input.currency, input.providerReference ?? null,
        input.expectedAt ?? null, JSON.stringify(sourceEvidence), input.source, input.idempotencyKey,
        requestHash, actorId, historyId, auditId],
    )
    const inserted = rows<PayoutRow>(result)[0]
    if (inserted) return { payout: mapPayout(inserted), replayed: false }

    const existingResult = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts p
       JOIN arsy_channels c ON c.id = p.channel_id
       WHERE p.owner_id = $1 AND p.idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existing = rows<PayoutRow>(existingResult)[0]
    if (!existing) return null
    if (existing.request_hash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
    return { payout: mapPayout(existing), replayed: true }
  }

  async list(ownerId: string, limit = 100): Promise<PayoutRecord[]> {
    const result = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts p
       LEFT JOIN arsy_channels c ON c.id = p.channel_id
       WHERE p.owner_id = $1 ORDER BY p.created_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<PayoutRow>(result).map(mapPayout)
  }

  async transition(
    ownerId: string,
    actorId: string,
    id: string,
    status: Exclude<PayoutStatus, 'pending'>,
    rationale: string,
    evidenceUrl: string,
    evidenceCapturedAt: string,
    occurredAt: string,
  ): Promise<PayoutRecord | null> {
    const historyId = randomUUID()
    const auditId = randomUUID()
    const financeId = randomUUID()
    const eventType = status === 'paid' ? 'payout' : status === 'reversed' ? 'payout-reversal' : null
    const eventIdempotencyKey = `payout-${id}-${status}`
    const eventRequestHash = createHash('sha256')
      .update(JSON.stringify({ payoutId: id, status, rationale, evidenceUrl, evidenceCapturedAt, occurredAt }))
      .digest('hex')
    const evidence = {
      evidenceUrl,
      capturedAt: evidenceCapturedAt,
      occurredAt,
      rationale,
      verificationMethod: 'operator-manual-statement-review',
    }
    const result = await this.db.query(
      `WITH current AS (
        SELECT status FROM arsy_payouts WHERE owner_id = $1 AND id = $2 FOR UPDATE
      ), changed AS (
        UPDATE arsy_payouts p SET
          status = $3,
          paid_at = CASE WHEN $3 = 'paid' THEN COALESCE(p.paid_at, $5::timestamptz) ELSE p.paid_at END,
          reconciliation_evidence = $4::jsonb,
          updated_at = now(),
          updated_by = $6
        WHERE p.owner_id = $1 AND p.id = $2
          AND (
            (p.status = 'pending' AND $3 IN ('paid', 'failed', 'disputed')) OR
            (p.status = 'paid' AND $3 IN ('reversed', 'disputed')) OR
            (p.status = 'failed' AND $3 = 'disputed') OR
            (p.status = 'disputed' AND (
              (($3 IN ('paid', 'failed')) AND p.paid_at IS NULL) OR
              ($3 = 'reversed' AND p.paid_at IS NOT NULL)
            ))
          )
        RETURNING p.*, (SELECT status FROM current) AS from_status
      ), history AS (
        INSERT INTO arsy_payout_events
          (id, owner_id, payout_id, from_status, to_status, rationale, evidence, actor_id, occurred_at)
        SELECT $7, owner_id, id, from_status, status, $8, $4::jsonb, $6, $5::timestamptz
        FROM changed
      ), finance AS (
        INSERT INTO arsy_financial_events
          (id, owner_id, product_id, listing_id, event_type, amount_minor, currency,
           occurred_at, source, provider_reference, payout_id, idempotency_key,
           request_hash, reconciliation_state, metadata, created_by)
        SELECT $9, owner_id, NULL, NULL, $10, amount_minor, currency, $5::timestamptz,
          'Manual payout statement reconciliation', provider_reference, id,
          $11, $12, 'verified', $4::jsonb, $6
        FROM changed
        WHERE $10::text IS NOT NULL
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $13, owner_id, 'payout', id, 'status-' || status, $6,
          jsonb_build_object('fromStatus', from_status, 'toStatus', status, 'occurredAt', $5::timestamptz, 'evidence', $4::jsonb)
        FROM changed
      )
      SELECT ${payoutColumns} FROM changed p
      LEFT JOIN arsy_channels c ON c.id = p.channel_id`,
      [ownerId, id, status, JSON.stringify(evidence), occurredAt, actorId, historyId, rationale,
        financeId, eventType, eventIdempotencyKey, eventRequestHash, auditId],
    )
    const row = rows<PayoutRow>(result)[0]
    return row ? mapPayout(row) : null
  }
}

export function calculateConvertedMinor(
  fromAmountMinor: string,
  rateNumerator: string,
  rateDenominator: string,
): string {
  const amount = BigInt(fromAmountMinor)
  const numerator = BigInt(rateNumerator)
  const denominator = BigInt(rateDenominator)
  if (amount <= 0n || numerator <= 0n || denominator <= 0n) {
    throw new Error('FX_AMOUNT_AND_RATE_MUST_BE_POSITIVE')
  }
  return ((amount * numerator + denominator / 2n) / denominator).toString()
}

export class FxConversionRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: FxConversionInput): Promise<{ conversion: FxConversionRecord; replayed: boolean } | null> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const id = randomUUID()
    const auditId = randomUUID()
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_fx_conversions
          (id, owner_id, source_event_id, from_amount_minor, from_currency,
           to_amount_minor, to_currency, rate_numerator, rate_denominator,
           rate_source, source_url, observed_at, idempotency_key, request_hash, created_by)
        SELECT $1, $2, e.id, $4::bigint, $5::varchar(3), $6::bigint, $7::varchar(3), $8::numeric, $9::numeric,
          $10, $11, $12::timestamptz, $13, $14, $15
        FROM arsy_financial_events e
        WHERE e.owner_id = $2 AND e.id = $3 AND e.reconciliation_state = 'verified'
          AND e.amount_minor = $4::bigint AND e.currency = $5::varchar(3)
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $16, owner_id, 'fx-conversion', id, 'recorded', $15,
          jsonb_build_object('sourceEventId', source_event_id, 'fromCurrency', from_currency,
            'toCurrency', to_currency, 'fromAmountMinor', from_amount_minor::text,
            'toAmountMinor', to_amount_minor::text, 'rateSource', rate_source)
        FROM created
      )
      SELECT ${fxColumns} FROM created`,
      [id, ownerId, input.sourceEventId, input.fromAmountMinor, input.fromCurrency,
        input.toAmountMinor, input.toCurrency, input.rateNumerator, input.rateDenominator,
        input.rateSource, input.sourceUrl, input.observedAt, input.idempotencyKey,
        requestHash, actorId, auditId],
    )
    const inserted = rows<FxConversionRow>(result)[0]
    if (inserted) return { conversion: mapFx(inserted), replayed: false }

    const existingResult = await this.db.query(
      `SELECT ${fxColumns} FROM arsy_fx_conversions
       WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existing = rows<FxConversionRow>(existingResult)[0]
    if (!existing) return null
    if (existing.request_hash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
    return { conversion: mapFx(existing), replayed: true }
  }

  async list(ownerId: string, limit = 100): Promise<FxConversionRecord[]> {
    const result = await this.db.query(
      `SELECT ${fxColumns} FROM arsy_fx_conversions
       WHERE owner_id = $1 ORDER BY recorded_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<FxConversionRow>(result).map(mapFx)
  }
}
