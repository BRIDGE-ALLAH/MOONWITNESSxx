import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
export type ChannelCapability = 'C0' | 'C1'
export type ChannelEligibility = 'eligible' | 'ineligible' | 'unknown'
export type PayoutSetupStatus = 'configured' | 'not-configured' | 'unavailable' | 'unknown'
export type ChannelEvidenceType = 'official-policy' | 'account-eligibility' | 'payout-requirements' | 'api-capability' | 'other'
export type ChannelEvidenceClass = 'observed-fact' | 'operator-attestation' | 'inference' | 'unknown'

export interface ChannelEvidenceInput {
  evidenceType: ChannelEvidenceType
  sourceName: string
  sourceUrl: string
  capturedAt: string
  reviewedAt?: string | null
  evidenceClass: ChannelEvidenceClass
  summary: string
  limitations: string
}
export interface ChannelInput {
  channelKey: string
  displayName: string
  countryCode: string
  accountEligibility: ChannelEligibility
  officialPolicyUrl?: string | null
  policyReviewedAt?: string | null
  policyRecheckAt?: string | null
  payoutRequirements: Record<string, unknown>
  payoutSetupStatus: PayoutSetupStatus
  capability: ChannelCapability
  grantedScopes: string[]
  quotaNotes: Record<string, unknown>
  channelStatus: 'active' | 'paused'
  evidence: ChannelEvidenceInput[]
}
export interface ChannelRecord extends Omit<ChannelInput, 'evidence'> {
  id: string
  revision: number
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}
export interface ChannelEvidenceRecord extends ChannelEvidenceInput {
  id: string
  channelId: string
  createdAt: string
  createdBy: string
}
interface ChannelRow {
  id: string
  channel_key: string
  display_name: string
  country_code: string
  account_eligibility: ChannelEligibility
  official_policy_url: string | null
  policy_reviewed_at: Date | string | null
  policy_recheck_at: Date | string | null
  payout_requirements: Record<string, unknown>
  payout_setup_status: PayoutSetupStatus
  capability: ChannelCapability
  granted_scopes: string[]
  quota_notes: Record<string, unknown>
  channel_status: 'active' | 'paused'
  revision: number
  created_at: Date | string
  updated_at: Date | string
  created_by: string
  updated_by: string
}
interface EvidenceRow {
  id: string
  channel_id: string
  evidence_type: ChannelEvidenceType
  source_name: string
  source_url: string
  captured_at: Date | string
  reviewed_at: Date | string | null
  evidence_class: ChannelEvidenceClass
  summary: string
  limitations: string
  created_at: Date | string
  created_by: string
}
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }
function iso(value: Date | string | null): string | null { return value === null ? null : new Date(value).toISOString() }
function mapChannel(row: ChannelRow): ChannelRecord {
  return {
    id: row.id,
    channelKey: row.channel_key,
    displayName: row.display_name,
    countryCode: row.country_code,
    accountEligibility: row.account_eligibility,
    officialPolicyUrl: row.official_policy_url,
    policyReviewedAt: iso(row.policy_reviewed_at),
    policyRecheckAt: iso(row.policy_recheck_at),
    payoutRequirements: row.payout_requirements,
    payoutSetupStatus: row.payout_setup_status,
    capability: row.capability,
    grantedScopes: row.granted_scopes,
    quotaNotes: row.quota_notes,
    channelStatus: row.channel_status,
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  }
}
function mapEvidence(row: EvidenceRow): ChannelEvidenceRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    evidenceType: row.evidence_type,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    capturedAt: new Date(row.captured_at).toISOString(),
    reviewedAt: iso(row.reviewed_at),
    evidenceClass: row.evidence_class,
    summary: row.summary,
    limitations: row.limitations,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
  }
}
const channelColumns = `id, channel_key, display_name, country_code, account_eligibility,
  official_policy_url, policy_reviewed_at, policy_recheck_at, payout_requirements,
  payout_setup_status, capability, granted_scopes, quota_notes, channel_status,
  revision, created_at, updated_at, created_by, updated_by`
const evidenceColumns = `id, channel_id, evidence_type, source_name, source_url, captured_at,
  reviewed_at, evidence_class, summary, limitations, created_at, created_by`

export class ChannelRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: ChannelInput): Promise<ChannelRecord> {
    const evidence = input.evidence.map((item) => ({ ...item, id: randomUUID() }))
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_channels
          (id, owner_id, channel_key, display_name, country_code, account_eligibility,
           official_policy_url, policy_reviewed_at, policy_recheck_at, payout_requirements,
           payout_setup_status, capability, granted_scopes, quota_notes, channel_status, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14::jsonb, $15, $16, $16)
        RETURNING *
      ), evidence_rows AS (
        INSERT INTO arsy_channel_evidence
          (id, owner_id, channel_id, evidence_type, source_name, source_url, captured_at, reviewed_at, evidence_class, summary, limitations, created_by)
        SELECT (e.item->>'id')::uuid, $2, created.id, e.item->>'evidenceType', e.item->>'sourceName',
          e.item->>'sourceUrl', (e.item->>'capturedAt')::timestamptz,
          NULLIF(e.item->>'reviewedAt', '')::timestamptz, e.item->>'evidenceClass',
          e.item->>'summary', e.item->>'limitations', $16
        FROM created CROSS JOIN LATERAL jsonb_array_elements($17::jsonb) AS e(item)
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $18, $2, 'channel', created.id, 'channel-registered', $16,
          jsonb_build_object('channelKey', created.channel_key, 'capability', created.capability, 'evidenceCount', (SELECT count(*) FROM evidence_rows))
        FROM created
      )
      SELECT ${channelColumns} FROM created`,
      [randomUUID(), ownerId, input.channelKey, input.displayName, input.countryCode, input.accountEligibility,
        input.officialPolicyUrl ?? null, input.policyReviewedAt ?? null, input.policyRecheckAt ?? null,
        JSON.stringify(input.payoutRequirements), input.payoutSetupStatus, input.capability,
        JSON.stringify(input.grantedScopes), JSON.stringify(input.quotaNotes), input.channelStatus,
        actorId, JSON.stringify(evidence), randomUUID()],
    )
    const row = rows<ChannelRow>(result)[0]
    if (!row) throw new Error('CHANNEL_CREATE_FAILED')
    return mapChannel(row)
  }

  async list(ownerId: string): Promise<ChannelRecord[]> {
    const result = await this.db.query(
      `SELECT ${channelColumns} FROM arsy_channels
       WHERE owner_id = $1 ORDER BY display_name ASC LIMIT 100`,
      [ownerId],
    )
    return rows<ChannelRow>(result).map(mapChannel)
  }

  async get(ownerId: string, id: string): Promise<ChannelRecord | null> {
    const result = await this.db.query(
      `SELECT ${channelColumns} FROM arsy_channels WHERE owner_id = $1 AND id = $2 LIMIT 1`,
      [ownerId, id],
    )
    const row = rows<ChannelRow>(result)[0]
    return row ? mapChannel(row) : null
  }

  async evidence(ownerId: string, channelId: string): Promise<ChannelEvidenceRecord[] | null> {
    const channel = await this.get(ownerId, channelId)
    if (!channel) return null
    const result = await this.db.query(
      `SELECT ${evidenceColumns} FROM arsy_channel_evidence
       WHERE owner_id = $1 AND channel_id = $2 ORDER BY captured_at DESC`,
      [ownerId, channelId],
    )
    return rows<EvidenceRow>(result).map(mapEvidence)
  }

  async update(ownerId: string, actorId: string, id: string, expectedRevision: number, input: ChannelInput): Promise<{ channel: ChannelRecord | null; conflict: boolean }> {
    const evidence = input.evidence.map((item) => ({ ...item, id: randomUUID() }))
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_channels SET
          channel_key = $3, display_name = $4, country_code = $5, account_eligibility = $6,
          official_policy_url = $7, policy_reviewed_at = $8, policy_recheck_at = $9,
          payout_requirements = $10::jsonb, payout_setup_status = $11, capability = $12,
          granted_scopes = $13::jsonb, quota_notes = $14::jsonb, channel_status = $15,
          revision = revision + 1, updated_at = now(), updated_by = $16
        WHERE owner_id = $1 AND id = $2 AND revision = $17
        RETURNING *
      ), evidence_rows AS (
        INSERT INTO arsy_channel_evidence
          (id, owner_id, channel_id, evidence_type, source_name, source_url, captured_at, reviewed_at, evidence_class, summary, limitations, created_by)
        SELECT (e.item->>'id')::uuid, $1, changed.id, e.item->>'evidenceType', e.item->>'sourceName',
          e.item->>'sourceUrl', (e.item->>'capturedAt')::timestamptz,
          NULLIF(e.item->>'reviewedAt', '')::timestamptz, e.item->>'evidenceClass',
          e.item->>'summary', e.item->>'limitations', $16
        FROM changed CROSS JOIN LATERAL jsonb_array_elements($18::jsonb) AS e(item)
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $19, $1, 'channel', changed.id, 'channel-updated', $16,
          jsonb_build_object('revision', changed.revision, 'capability', changed.capability, 'evidenceCount', (SELECT count(*) FROM evidence_rows))
        FROM changed
      )
      SELECT ${channelColumns} FROM changed`,
      [ownerId, id, input.channelKey, input.displayName, input.countryCode, input.accountEligibility,
        input.officialPolicyUrl ?? null, input.policyReviewedAt ?? null, input.policyRecheckAt ?? null,
        JSON.stringify(input.payoutRequirements), input.payoutSetupStatus, input.capability,
        JSON.stringify(input.grantedScopes), JSON.stringify(input.quotaNotes), input.channelStatus,
        actorId, expectedRevision, JSON.stringify(evidence), randomUUID()],
    )
    const updated = rows<ChannelRow>(result)[0]
    if (updated) return { channel: mapChannel(updated), conflict: false }
    const current = await this.get(ownerId, id)
    return { channel: current, conflict: Boolean(current) }
  }

  async appendEvidence(ownerId: string, actorId: string, channelId: string, input: ChannelEvidenceInput): Promise<ChannelEvidenceRecord | null> {
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_channel_evidence
          (id, owner_id, channel_id, evidence_type, source_name, source_url, captured_at, reviewed_at, evidence_class, summary, limitations, created_by)
        SELECT $1, $2, c.id, $4, $5, $6, $7, $8, $9, $10, $11, $12
        FROM arsy_channels c WHERE c.owner_id = $2 AND c.id = $3
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $13, $2, 'channel', channel_id, 'channel-evidence-added', $12,
          jsonb_build_object('evidenceId', id, 'type', evidence_type)
        FROM created
      )
      SELECT ${evidenceColumns} FROM created`,
      [randomUUID(), ownerId, channelId, input.evidenceType, input.sourceName, input.sourceUrl,
        input.capturedAt, input.reviewedAt ?? null, input.evidenceClass, input.summary,
        input.limitations, actorId, randomUUID()],
    )
    const row = rows<EvidenceRow>(result)[0]
    return row ? mapEvidence(row) : null
  }
}
