import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
export type FinancialEventType = 'gross-receipt' | 'platform-fee' | 'refund' | 'chargeback' | 'variable-cost' | 'production-cost' | 'tax-reserve' | 'fx-adjustment' | 'payout' | 'payout-reversal'
export type ReconciliationState = 'pending' | 'verified' | 'disputed' | 'reversed'

export interface FinancialEventInput {
  productId?: string
  eventType: FinancialEventType
  amountMinor: string
  currency: string
  occurredAt: string
  source: string
  providerReference?: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface FinancialEventRecord {
  id: string
  productId: string | null
  eventType: FinancialEventType
  amountMinor: string
  currency: string
  occurredAt: string
  recordedAt: string
  source: string
  providerReference: string | null
  reconciliationState: ReconciliationState
  metadata: Record<string, unknown>
}

interface FinancialEventRow {
  id: string
  product_id: string | null
  event_type: FinancialEventType
  amount_minor: string
  currency: string
  occurred_at: Date | string
  recorded_at: Date | string
  source: string
  provider_reference: string | null
  reconciliation_state: ReconciliationState
  metadata: Record<string, unknown>
  request_hash: string
}

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

function mapEvent(row: FinancialEventRow): FinancialEventRecord {
  return {
    id: row.id,
    productId: row.product_id,
    eventType: row.event_type,
    amountMinor: row.amount_minor,
    currency: row.currency.trim(),
    occurredAt: new Date(row.occurred_at).toISOString(),
    recordedAt: new Date(row.recorded_at).toISOString(),
    source: row.source,
    providerReference: row.provider_reference,
    reconciliationState: row.reconciliation_state,
    metadata: row.metadata,
  }
}

const columns = `id, product_id, event_type, amount_minor::text AS amount_minor, currency,
  occurred_at, recorded_at, source, provider_reference, reconciliation_state, metadata, request_hash`

export class FinancialRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: FinancialEventInput): Promise<{ event: FinancialEventRecord; replayed: boolean } | null> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const eventId = randomUUID()
    const auditId = randomUUID()
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_financial_events
          (id, owner_id, product_id, event_type, amount_minor, currency, occurred_at, source,
           provider_reference, idempotency_key, request_hash, reconciliation_state, metadata, created_by)
        SELECT $1, $2, $3, $4, $5::bigint, $6, $7::timestamptz, $8, $9, $10, $11,
          'pending', $12::jsonb, $13
        WHERE $3::uuid IS NULL OR EXISTS (
          SELECT 1 FROM arsy_products WHERE owner_id = $2 AND id = $3::uuid
        )
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $14, owner_id, 'financial-event', id, 'recorded-pending-reconciliation', $13,
          jsonb_build_object('eventType', event_type, 'currency', currency, 'amountMinor', amount_minor::text)
        FROM created
      )
      SELECT ${columns} FROM created`,
      [eventId, ownerId, input.productId ?? null, input.eventType, input.amountMinor, input.currency,
        input.occurredAt, input.source, input.providerReference ?? null, input.idempotencyKey,
        requestHash, JSON.stringify(input.metadata ?? {}), actorId, auditId],
    )
    const inserted = rows<FinancialEventRow>(result)[0]
    if (inserted) return { event: mapEvent(inserted), replayed: false }

    const existingResult = await this.db.query(
      `SELECT ${columns} FROM arsy_financial_events
       WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existing = rows<FinancialEventRow>(existingResult)[0]
    if (!existing) return null
    if (existing.request_hash !== requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
    return { event: mapEvent(existing), replayed: true }
  }

  async list(ownerId: string, limit = 100): Promise<FinancialEventRecord[]> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_financial_events
       WHERE owner_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<FinancialEventRow>(result).map(mapEvent)
  }

  async reconcile(ownerId: string, actorId: string, id: string, state: Exclude<ReconciliationState, 'pending'>, rationale: string, evidenceUrl: string): Promise<FinancialEventRecord | null> {
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_financial_events SET reconciliation_state = $3,
          metadata = metadata || jsonb_build_object('reconciliation', jsonb_build_object(
            'rationale', $4, 'evidenceUrl', $5, 'actorId', $6, 'recordedAt', now()
          ))
        WHERE owner_id = $1 AND id = $2 AND reconciliation_state = 'pending'
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $7, owner_id, 'financial-event', id, 'reconciled', $6,
          jsonb_build_object('state', reconciliation_state, 'rationale', $4, 'evidenceUrl', $5)
        FROM changed
      )
      SELECT ${columns} FROM changed`,
      [ownerId, id, state, rationale, evidenceUrl, actorId, randomUUID()],
    )
    const row = rows<FinancialEventRow>(result)[0]
    return row ? mapEvent(row) : null
  }

  async summary(ownerId: string): Promise<Array<Record<string, string>>> {
    const result = await this.db.query(
      `SELECT currency,
        COALESCE(SUM(amount_minor) FILTER (WHERE reconciliation_state = 'verified' AND event_type = 'gross-receipt'), 0)::text AS gross_receipts_minor,
        COALESCE(SUM(amount_minor) FILTER (WHERE reconciliation_state = 'verified' AND event_type IN ('platform-fee','refund','chargeback','variable-cost','production-cost','tax-reserve')), 0)::text AS deductions_minor,
        COALESCE(SUM(amount_minor) FILTER (WHERE reconciliation_state = 'verified' AND event_type IN ('payout','payout-reversal')), 0)::text AS payout_movements_minor,
        COALESCE(SUM(amount_minor) FILTER (WHERE reconciliation_state = 'pending'), 0)::text AS pending_minor,
        COUNT(*) FILTER (WHERE reconciliation_state = 'pending')::text AS pending_count
       FROM arsy_financial_events WHERE owner_id = $1 GROUP BY currency ORDER BY currency`,
      [ownerId],
    )
    return rows<Record<string, string>>(result).map((row) => ({
      ...row,
      net_contribution_minor: (BigInt(row.gross_receipts_minor) - BigInt(row.deductions_minor)).toString(),
    }))
  }
}
