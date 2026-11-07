import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
type ChannelRow = {
  id: string
  slug: string
  display_name: string
  capability: 'C0' | 'C1' | 'C2' | 'C3' | 'C4'
  country_eligibility: Array<Record<string, unknown>>
  policy_url: string | null
  policy_checked_at: Date | string | null
  payout_requirements: Record<string, unknown>
  capability_evidence: Record<string, unknown>
  reviewed_at: Date | string | null
  reviewed_by: string | null
  enabled: boolean
  created_at: Date | string
  updated_at: Date | string
}

export interface ChannelRecord {
  id: string
  slug: string
  displayName: string
  capability: ChannelRow['capability']
  countryEligibility: ChannelRow['country_eligibility']
  policyUrl: string | null
  policyCheckedAt: string | null
  payoutRequirements: Record<string, unknown>
  capabilityEvidence: Record<string, unknown>
  reviewedAt: string | null
  reviewedBy: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ChannelReviewInput {
  countryEligibility: Array<{ country: string; status: 'pass' | 'blocked' | 'unknown'; sourceUrl?: string; checkedAt?: string }>
  payoutRequirements: { status: 'pass' | 'blocked' | 'unknown'; sourceUrl?: string; checkedAt?: string; notes: string }
  policyUrl?: string
  policyCheckedAt?: string
  manualFallback: string
}

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}

function toIso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

function mapChannel(row: ChannelRow): ChannelRecord {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    capability: row.capability,
    countryEligibility: row.country_eligibility,
    policyUrl: row.policy_url,
    policyCheckedAt: toIso(row.policy_checked_at),
    payoutRequirements: row.payout_requirements,
    capabilityEvidence: row.capability_evidence,
    reviewedAt: toIso(row.reviewed_at),
    reviewedBy: row.reviewed_by,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

const columns = `id, slug, display_name, capability, country_eligibility, policy_url,
  policy_checked_at, payout_requirements, capability_evidence, reviewed_at, reviewed_by,
  enabled, created_at, updated_at`

export class ChannelRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(slug: string, displayName: string): Promise<ChannelRecord> {
    const result = await this.db.query(
      `INSERT INTO arsy_channels (id, slug, display_name, capability, enabled)
       VALUES ($1, $2, $3, 'C0', false)
       RETURNING ${columns}`,
      [randomUUID(), slug, displayName],
    )
    return mapChannel(rows<ChannelRow>(result)[0])
  }

  async list(): Promise<ChannelRecord[]> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_channels ORDER BY display_name ASC`,
    )
    return rows<ChannelRow>(result).map(mapChannel)
  }

  async review(id: string, reviewerId: string, input: ChannelReviewInput): Promise<ChannelRecord | null> {
    const eligibleCountry = input.countryEligibility.some((item) => item.country === 'ID' && item.status === 'pass')
    const payoutVerified = input.payoutRequirements.status === 'pass' &&
      Boolean(input.payoutRequirements.sourceUrl && input.payoutRequirements.checkedAt)
    const policyVerified = Boolean(input.policyUrl && input.policyCheckedAt)
    const capability = eligibleCountry && payoutVerified && policyVerified ? 'C1' : 'C0'
    const enabled = capability === 'C1'
    const evidence = {
      manualFallback: input.manualFallback,
      reviewScope: 'C1 manual listing package only; no marketplace API authorization is implied.',
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewerId,
      capabilityEvidence: 'operator-attested; recheck before each channel launch',
    }
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_channels SET
          capability = $2,
          country_eligibility = $3::jsonb,
          payout_requirements = $4::jsonb,
          policy_url = $5,
          policy_checked_at = $6::timestamptz,
          capability_evidence = $7::jsonb,
          reviewed_at = now(),
          reviewed_by = $8,
          enabled = $9,
          updated_at = now()
        WHERE id = $1
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $10, $11, 'channel', id, 'reviewed', $8,
          jsonb_build_object('capability', capability, 'enabled', enabled)
        FROM changed
      )
      SELECT ${columns} FROM changed`,
      [id, capability, JSON.stringify(input.countryEligibility), JSON.stringify(input.payoutRequirements),
        input.policyUrl, input.policyCheckedAt, JSON.stringify(evidence), reviewerId, enabled, randomUUID(), reviewerId],
    )
    const row = rows<ChannelRow>(result)[0]
    return row ? mapChannel(row) : null
  }
}
