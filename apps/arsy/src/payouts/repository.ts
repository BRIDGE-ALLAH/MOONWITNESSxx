import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
type PayoutStatus = 'expected' | 'paid' | 'failed' | 'reversed' | 'disputed'
export interface StatementRowInput {
  providerReference: string
  amountMinor: string
  currency: string
  occurredAt: string
  description: string
}
export interface PayoutStatementInput {
  channelId: string
  providerName: string
  statementReference: string
  currency: string
  periodStart: string
  periodEnd: string
  evidenceUrl: string
  rows: StatementRowInput[]
  idempotencyKey: string
}
export interface PayoutStatementRecord {
  id: string
  channelId: string
  providerName: string
  statementReference: string
  currency: string
  periodStart: string
  periodEnd: string
  evidenceUrl: string
  rowCount: number
  capturedAt: string
  createdBy: string
}
export interface PayoutRecord {
  id: string
  channelId: string
  statementId: string
  statementRowId: string
  providerName: string
  providerReference: string
  currency: string
  amountMinor: string
  status: PayoutStatus
  expectedAt: string | null
  paidAt: string | null
  failedAt: string | null
  disputedAt: string | null
  reversedAt: string | null
  paidFinancialEventId: string | null
  reversalFinancialEventId: string | null
  revision: number
  createdAt: string
  updatedAt: string
}
export interface PayoutEventInput {
  status: Exclude<PayoutStatus, 'expected'>
  rationale: string
  evidence: Array<{ label: string; url?: string; reference?: string }>
  occurredAt: string
  idempotencyKey: string
}
export interface PayoutEventRecord {
  id: string
  payoutId: string
  fromStatus: PayoutStatus | null
  toStatus: PayoutStatus
  rationale: string
  evidence: Array<{ label: string; url?: string; reference?: string }>
  occurredAt: string
  recordedAt: string
  recordedBy: string
}
interface StatementRow {
  id: string; channel_id: string; provider_name: string; statement_reference: string; currency: string
  period_start: Date | string; period_end: Date | string; evidence_url: string; row_count: number
  captured_at: Date | string; created_by: string; request_hash?: string
}
interface PayoutRow {
  id: string; channel_id: string; statement_id: string; statement_row_id: string; provider_name: string
  provider_reference: string; currency: string; amount_minor: string; status: PayoutStatus
  expected_at: Date | string | null; paid_at: Date | string | null; failed_at: Date | string | null
  disputed_at: Date | string | null; reversed_at: Date | string | null
  paid_financial_event_id: string | null; reversal_financial_event_id: string | null
  revision: number; created_at: Date | string; updated_at: Date | string
}
interface PayoutEventRow {
  id: string; payout_id: string; from_status: PayoutStatus | null; to_status: PayoutStatus
  rationale: string; evidence: PayoutEventRecord['evidence']; occurred_at: Date | string
  recorded_at: Date | string; recorded_by: string; request_hash: string
}
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }
function iso(value: Date | string | null): string | null { return value === null ? null : new Date(value).toISOString() }
function mapStatement(row: StatementRow): PayoutStatementRecord {
  return {
    id: row.id, channelId: row.channel_id, providerName: row.provider_name,
    statementReference: row.statement_reference, currency: row.currency.trim(),
    periodStart: new Date(row.period_start).toISOString(), periodEnd: new Date(row.period_end).toISOString(),
    evidenceUrl: row.evidence_url, rowCount: row.row_count,
    capturedAt: new Date(row.captured_at).toISOString(), createdBy: row.created_by,
  }
}
function mapPayout(row: PayoutRow): PayoutRecord {
  return {
    id: row.id, channelId: row.channel_id, statementId: row.statement_id, statementRowId: row.statement_row_id,
    providerName: row.provider_name, providerReference: row.provider_reference,
    currency: row.currency.trim(), amountMinor: row.amount_minor, status: row.status,
    expectedAt: iso(row.expected_at), paidAt: iso(row.paid_at), failedAt: iso(row.failed_at),
    disputedAt: iso(row.disputed_at), reversedAt: iso(row.reversed_at),
    paidFinancialEventId: row.paid_financial_event_id, reversalFinancialEventId: row.reversal_financial_event_id,
    revision: row.revision, createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}
function mapPayoutEvent(row: PayoutEventRow): PayoutEventRecord {
  return {
    id: row.id, payoutId: row.payout_id, fromStatus: row.from_status, toStatus: row.to_status,
    rationale: row.rationale, evidence: row.evidence, occurredAt: new Date(row.occurred_at).toISOString(),
    recordedAt: new Date(row.recorded_at).toISOString(), recordedBy: row.recorded_by,
  }
}
const statementColumns = `id, channel_id, provider_name, statement_reference, currency, period_start, period_end,
  evidence_url, row_count, captured_at, created_by`
const payoutColumns = `id, channel_id, statement_id, statement_row_id, provider_name, provider_reference,
  currency, amount_minor::text AS amount_minor, status, expected_at, paid_at, failed_at, disputed_at,
  reversed_at, paid_financial_event_id, reversal_financial_event_id, revision, created_at, updated_at`
const payoutEventColumns = `id, payout_id, from_status, to_status, rationale, evidence, occurred_at, recorded_at, recorded_by, request_hash`

export class PayoutRepository {
  constructor(private readonly db: DatabasePool) {}

  async importStatement(ownerId: string, actorId: string, input: PayoutStatementInput): Promise<{
    statement: PayoutStatementRecord
    payouts: PayoutRecord[]
    replayed: boolean
  } | null> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const statementId = randomUUID()
    const importedRows = input.rows.map((row, index) => {
      const rowId = randomUUID()
      const payoutId = randomUUID()
      const eventId = randomUUID()
      const eventKey = `statement:${statementId}:row:${index + 1}:expected`
      const eventHash = createHash('sha256').update(JSON.stringify({ payoutId, status: 'expected', statementId, row })).digest('hex')
      return { ...row, id: rowId, payoutId, eventId, eventKey, eventHash, rowNumber: index + 1 }
    })
    const result = await this.db.query(
      `WITH statement AS (
        INSERT INTO arsy_payout_statements
          (id, owner_id, channel_id, provider_name, statement_reference, currency, period_start, period_end,
           evidence_url, row_count, idempotency_key, request_hash, created_by)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        WHERE EXISTS (SELECT 1 FROM arsy_channels WHERE owner_id = $2 AND id = $3 AND channel_status = 'active')
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), statement_rows AS (
        INSERT INTO arsy_payout_statement_rows
          (id, owner_id, statement_id, row_number, provider_reference, amount_minor, currency, occurred_at, description, raw_data)
        SELECT (r.item->>'id')::uuid, $2, statement.id, (r.item->>'rowNumber')::integer,
          r.item->>'providerReference', (r.item->>'amountMinor')::bigint, r.item->>'currency',
          (r.item->>'occurredAt')::timestamptz, r.item->>'description', '{}'::jsonb
        FROM statement CROSS JOIN LATERAL jsonb_array_elements($14::jsonb) AS r(item)
        RETURNING *
      ), payouts AS (
        INSERT INTO arsy_payouts
          (id, owner_id, channel_id, statement_id, statement_row_id, provider_name, provider_reference,
           currency, amount_minor, status, revision, created_by, updated_by)
        SELECT (r.item->>'payoutId')::uuid, $2, statement.channel_id, statement.id, row.id,
          statement.provider_name, row.provider_reference, row.currency, row.amount_minor, 'expected', 1, $13, $13
        FROM statement_rows row JOIN statement ON statement.id = row.statement_id
        JOIN LATERAL (
          SELECT item FROM jsonb_array_elements($14::jsonb) AS j(item)
          WHERE (j.item->>'id')::uuid = row.id
        ) r ON true
        RETURNING *
      ), payout_events AS (
        INSERT INTO arsy_payout_events
          (id, owner_id, payout_id, from_status, to_status, rationale, evidence, occurred_at,
           idempotency_key, request_hash, recorded_by)
        SELECT (r.item->>'eventId')::uuid, $2, payout.id, NULL, 'expected',
          'Imported from a manual statement; no paid/failed status is inferred.',
          jsonb_build_array(jsonb_build_object('label', 'Manual statement evidence', 'url', statement.evidence_url,
            'reference', payout.provider_reference)),
          (r.item->>'occurredAt')::timestamptz, r.item->>'eventKey', r.item->>'eventHash', $13
        FROM payouts payout JOIN statement ON statement.id = payout.statement_id
        JOIN LATERAL (
          SELECT item FROM jsonb_array_elements($14::jsonb) AS j(item)
          WHERE (j.item->>'payoutId')::uuid = payout.id
        ) r ON true
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $15, $2, 'payout-statement', statement.id, 'manual-statement-imported', $13,
          jsonb_build_object('provider', statement.provider_name, 'statementReference', statement.statement_reference, 'rowCount', statement.row_count)
        FROM statement
      )
      SELECT ${statementColumns} FROM statement`,
      [statementId, ownerId, input.channelId, input.providerName, input.statementReference, input.currency,
        input.periodStart, input.periodEnd, input.evidenceUrl, input.rows.length, input.idempotencyKey,
        requestHash, actorId, JSON.stringify(importedRows), randomUUID()],
    )
    let statement = rows<StatementRow>(result)[0]
    let replayed = false
    if (!statement) {
      const existingResult = await this.db.query(
        `SELECT ${statementColumns}, request_hash FROM arsy_payout_statements
         WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [ownerId, input.idempotencyKey],
      )
      const existing = rows<StatementRow>(existingResult)[0]
      if (!existing) return null
      if (existing.request_hash !== requestHash) throw new Error('PAYOUT_STATEMENT_IDEMPOTENCY_REUSED')
      statement = existing
      replayed = true
    }
    const payouts = await this.listByStatement(ownerId, statement.id)
    return { statement: mapStatement(statement), payouts, replayed }
  }

  async listStatements(ownerId: string, limit = 100): Promise<PayoutStatementRecord[]> {
    const result = await this.db.query(
      `SELECT ${statementColumns} FROM arsy_payout_statements
       WHERE owner_id = $1 ORDER BY captured_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<StatementRow>(result).map(mapStatement)
  }

  async listPayouts(ownerId: string, limit = 100): Promise<PayoutRecord[]> {
    const result = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts
       WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [ownerId, limit],
    )
    return rows<PayoutRow>(result).map(mapPayout)
  }

  async listByStatement(ownerId: string, statementId: string): Promise<PayoutRecord[]> {
    const result = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts
       WHERE owner_id = $1 AND statement_id = $2 ORDER BY provider_reference ASC`,
      [ownerId, statementId],
    )
    return rows<PayoutRow>(result).map(mapPayout)
  }

  async get(ownerId: string, payoutId: string): Promise<PayoutRecord | null> {
    const result = await this.db.query(
      `SELECT ${payoutColumns} FROM arsy_payouts WHERE owner_id = $1 AND id = $2 LIMIT 1`,
      [ownerId, payoutId],
    )
    const row = rows<PayoutRow>(result)[0]
    return row ? mapPayout(row) : null
  }

  async events(ownerId: string, payoutId: string): Promise<PayoutEventRecord[] | null> {
    const payout = await this.get(ownerId, payoutId)
    if (!payout) return null
    const result = await this.db.query(
      `SELECT ${payoutEventColumns} FROM arsy_payout_events
       WHERE owner_id = $1 AND payout_id = $2 ORDER BY recorded_at DESC`,
      [ownerId, payoutId],
    )
    return rows<PayoutEventRow>(result).map(mapPayoutEvent)
  }

  async transition(ownerId: string, actorId: string, payoutId: string, input: PayoutEventInput): Promise<{
    payout: PayoutRecord | null
    replayed: boolean
    conflict: boolean
  }> {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const paidEventId = randomUUID()
    const reversalEventId = randomUUID()
    const result = await this.db.query(
      `WITH locked AS (
        SELECT * FROM arsy_payouts WHERE owner_id = $1 AND id = $2 FOR UPDATE
      ), eligible AS (
        SELECT * FROM locked WHERE
          ($3 = 'paid' AND status IN ('expected', 'disputed')) OR
          ($3 = 'failed' AND status IN ('expected', 'disputed') AND paid_financial_event_id IS NULL) OR
          ($3 = 'disputed' AND status IN ('expected', 'paid')) OR
          ($3 = 'reversed' AND status IN ('paid', 'disputed') AND paid_financial_event_id IS NOT NULL)
      ), payout_event AS (
        INSERT INTO arsy_payout_events
          (id, owner_id, payout_id, from_status, to_status, rationale, evidence, occurred_at, idempotency_key, request_hash, recorded_by)
        SELECT $10, $1, eligible.id, eligible.status, $3, $4, $5::jsonb, $6::timestamptz, $7, $8, $9
        FROM eligible
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), paid_created AS (
        INSERT INTO arsy_financial_events
          (id, owner_id, product_id, event_type, amount_minor, currency, occurred_at, source,
           provider_reference, idempotency_key, request_hash, reconciliation_state, metadata, created_by)
        SELECT $11, $1, NULL, 'payout', eligible.amount_minor, eligible.currency, $6::timestamptz,
          'manual-payout-reconciliation', eligible.provider_reference, 'payout:' || eligible.id::text || ':paid',
          $12, 'verified', jsonb_build_object('payoutId', eligible.id, 'payoutEventId', payout_event.id, 'rationale', $4, 'evidence', $5::jsonb), $9
        FROM eligible JOIN payout_event ON payout_event.payout_id = eligible.id
        WHERE $3 = 'paid' AND eligible.paid_financial_event_id IS NULL
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING id
      ), paid_restored AS (
        UPDATE arsy_financial_events f SET reconciliation_state = 'verified',
          metadata = f.metadata || jsonb_build_object('payoutResolution', jsonb_build_object('status', $3, 'rationale', $4, 'evidence', $5::jsonb))
        FROM eligible JOIN payout_event ON payout_event.payout_id = eligible.id
        WHERE $3 IN ('paid', 'reversed') AND eligible.paid_financial_event_id = f.id
        RETURNING f.id
      ), paid_disputed AS (
        UPDATE arsy_financial_events f SET reconciliation_state = 'disputed',
          metadata = f.metadata || jsonb_build_object('payoutDispute', jsonb_build_object('rationale', $4, 'evidence', $5::jsonb))
        FROM eligible JOIN payout_event ON payout_event.payout_id = eligible.id
        WHERE $3 = 'disputed' AND eligible.paid_financial_event_id = f.id
        RETURNING f.id
      ), reversal_created AS (
        INSERT INTO arsy_financial_events
          (id, owner_id, product_id, event_type, amount_minor, currency, occurred_at, source,
           provider_reference, idempotency_key, request_hash, reconciliation_state, metadata, created_by)
        SELECT $13, $1, NULL, 'payout-reversal', eligible.amount_minor, eligible.currency, $6::timestamptz,
          'manual-payout-reconciliation', eligible.provider_reference, 'payout:' || eligible.id::text || ':reversed',
          $14, 'verified', jsonb_build_object('payoutId', eligible.id, 'payoutEventId', payout_event.id, 'rationale', $4, 'evidence', $5::jsonb), $9
        FROM eligible JOIN payout_event ON payout_event.payout_id = eligible.id
        WHERE $3 = 'reversed' AND eligible.paid_financial_event_id IS NOT NULL
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING id
      ), changed AS (
        UPDATE arsy_payouts p SET
          status = $3,
          paid_at = CASE WHEN $3 = 'paid' THEN COALESCE(p.paid_at, $6::timestamptz) ELSE p.paid_at END,
          failed_at = CASE WHEN $3 = 'failed' THEN $6::timestamptz ELSE p.failed_at END,
          disputed_at = CASE WHEN $3 = 'disputed' THEN $6::timestamptz ELSE p.disputed_at END,
          reversed_at = CASE WHEN $3 = 'reversed' THEN $6::timestamptz ELSE p.reversed_at END,
          paid_financial_event_id = COALESCE(p.paid_financial_event_id, (SELECT id FROM paid_created)),
          reversal_financial_event_id = COALESCE(p.reversal_financial_event_id, (SELECT id FROM reversal_created)),
          revision = revision + 1, updated_at = now(), updated_by = $9
        FROM payout_event WHERE p.id = payout_event.payout_id AND p.owner_id = $1
        RETURNING p.*
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $15, $1, 'payout', changed.id, 'payout-state-transitioned', $9,
          jsonb_build_object('fromStatus', payout_event.from_status, 'toStatus', changed.status, 'payoutEventId', payout_event.id)
        FROM changed JOIN payout_event ON payout_event.payout_id = changed.id
      )
      SELECT ${payoutColumns} FROM changed`,
      [ownerId, payoutId, input.status, input.rationale, JSON.stringify(input.evidence), input.occurredAt,
        input.idempotencyKey, requestHash, actorId, randomUUID(), paidEventId,
        createHash('sha256').update(`payout-paid:${payoutId}`).digest('hex'),
        reversalEventId, createHash('sha256').update(`payout-reversal:${payoutId}`).digest('hex'), randomUUID()],
    )
    const changed = rows<PayoutRow>(result)[0]
    if (changed) return { payout: mapPayout(changed), replayed: false, conflict: false }

    const eventResult = await this.db.query(
      `SELECT ${payoutEventColumns} FROM arsy_payout_events
       WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existingEvent = rows<PayoutEventRow>(eventResult)[0]
    if (existingEvent) {
      if (existingEvent.request_hash !== requestHash) throw new Error('PAYOUT_IDEMPOTENCY_KEY_REUSED')
      return { payout: await this.get(ownerId, payoutId), replayed: true, conflict: false }
    }
    return { payout: await this.get(ownerId, payoutId), replayed: false, conflict: true }
  }
}
