import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
export interface ListingPackageInput {
  productVersionId: string
  channelId: string
  title: string
  description: string
  tags: string[]
  priceMinor: string
  currency: string
  disclosures: string[]
  manualUploadInstructions: string
}
export interface ListingRecord {
  id: string
  productVersionId: string
  channelId: string
  channelName: string
  productTitle: string
  status: string
  listingPackage: Record<string, unknown>
  providerReference: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}
interface ListingRow {
  id: string
  product_version_id: string
  channel_id: string
  channel_name: string
  product_title: string
  status: string
  listing_package: Record<string, unknown>
  provider_reference: string | null
  published_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }
function iso(value: Date | string | null): string | null { return value ? new Date(value).toISOString() : null }
function map(row: ListingRow): ListingRecord {
  return {
    id: row.id, productVersionId: row.product_version_id, channelId: row.channel_id,
    channelName: row.channel_name, productTitle: row.product_title, status: row.status,
    listingPackage: row.listing_package, providerReference: row.provider_reference,
    publishedAt: iso(row.published_at), createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}
const columns = `l.id, l.product_version_id, l.channel_id, c.display_name AS channel_name,
  p.title AS product_title, l.status, l.listing_package, l.provider_reference,
  l.published_at, l.created_at, l.updated_at`

export class ListingRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: ListingPackageInput): Promise<ListingRecord | null> {
    const result = await this.db.query(
      `WITH eligible AS (
        SELECT pv.id AS product_version_id, p.id AS product_id, p.title, c.id AS channel_id, c.display_name
        FROM arsy_product_versions pv
        JOIN arsy_products p ON p.id = pv.product_id
        JOIN arsy_channels c ON c.id = $3
        WHERE p.owner_id = $1 AND pv.id = $2
          AND p.lifecycle_state = 'ready'
          AND c.capability = 'C1' AND c.enabled = true
      ), created AS (
        INSERT INTO arsy_listings
          (id, product_version_id, channel_id, owner_id, status, listing_package, created_by, updated_by)
        SELECT $4, eligible.product_version_id, eligible.channel_id, $1, 'ready', $5::jsonb, $6, $6
        FROM eligible
        ON CONFLICT (product_version_id, channel_id) DO NOTHING
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $7, $1, 'listing', created.id, 'manual-listing-package-created', $6,
          jsonb_build_object('productVersionId', created.product_version_id, 'channelId', created.channel_id)
        FROM created
      )
      SELECT ${columns} FROM created l
      JOIN arsy_channels c ON c.id = l.channel_id
      JOIN arsy_product_versions pv ON pv.id = l.product_version_id
      JOIN arsy_products p ON p.id = pv.product_id`,
      [ownerId, input.productVersionId, input.channelId, randomUUID(), JSON.stringify({
        title: input.title, description: input.description, tags: input.tags,
        priceMinor: input.priceMinor, currency: input.currency,
        disclosures: input.disclosures, manualUploadInstructions: input.manualUploadInstructions,
        packageCapability: 'C1-manual-only',
      }), actorId, randomUUID()],
    )
    const row = rows<ListingRow>(result)[0]
    return row ? map(row) : null
  }

  async list(ownerId: string): Promise<ListingRecord[]> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_listings l
       JOIN arsy_channels c ON c.id = l.channel_id
       JOIN arsy_product_versions pv ON pv.id = l.product_version_id
       JOIN arsy_products p ON p.id = pv.product_id
       WHERE l.owner_id = $1 ORDER BY l.updated_at DESC`,
      [ownerId],
    )
    return rows<ListingRow>(result).map(map)
  }

  async recordPublication(ownerId: string, actorId: string, id: string, providerReference: string, evidenceUrl: string, publishedAt: string): Promise<ListingRecord | null> {
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_listings SET status = 'published', provider_reference = $3,
          published_at = $4::timestamptz, updated_at = now(), updated_by = $5,
          listing_package = listing_package || jsonb_build_object('publicationReceipt', jsonb_build_object(
            'providerReference', $3, 'evidenceUrl', $6, 'recordedAt', now(), 'recordedBy', $5
          ))
        WHERE owner_id = $1 AND id = $2 AND status IN ('ready', 'submitted')
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $7, $1, 'listing', changed.id, 'manual-publication-receipt-recorded', $5,
          jsonb_build_object('providerReference', $3, 'evidenceUrl', $6, 'publishedAt', $4)
        FROM changed
      )
      SELECT ${columns} FROM changed l
      JOIN arsy_channels c ON c.id = l.channel_id
      JOIN arsy_product_versions pv ON pv.id = l.product_version_id
      JOIN arsy_products p ON p.id = pv.product_id`,
      [ownerId, id, providerReference, publishedAt, actorId, evidenceUrl, randomUUID()],
    )
    const row = rows<ListingRow>(result)[0]
    return row ? map(row) : null
  }
}
