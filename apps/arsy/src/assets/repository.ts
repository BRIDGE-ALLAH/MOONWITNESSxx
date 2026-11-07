import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
export interface AssetProvenance {
  creator: string
  license: string
  sourceUrl?: string
  originalDeclaration?: string
  toolModel?: string
  editHistory: string[]
  disclosure: string
  derivativeOf?: string
}
export interface AssetRecord {
  id: string
  productVersionId: string
  filename: string
  mediaType: string
  checksumSha256: string | null
  provenance: AssetProvenance
  rightsState: 'pass' | 'blocked' | 'unknown'
  createdAt: string
  storageKey?: string
}
interface AssetRow {
  id: string
  product_version_id: string
  filename: string
  media_type: string
  storage_key: string
  checksum_sha256: string | null
  provenance: AssetProvenance
  rights_state: 'pass' | 'blocked' | 'unknown'
  created_at: Date | string
}
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }
function map(row: AssetRow, includeStorageKey = false): AssetRecord {
  return {
    id: row.id, productVersionId: row.product_version_id, filename: row.filename,
    mediaType: row.media_type, checksumSha256: row.checksum_sha256,
    provenance: row.provenance, rightsState: row.rights_state,
    createdAt: new Date(row.created_at).toISOString(),
    ...(includeStorageKey ? { storageKey: row.storage_key } : {}),
  }
}
const columns = 'id, product_version_id, filename, media_type, storage_key, checksum_sha256, provenance, rights_state, created_at'

export class AssetRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: {
    id: string; productVersionId: string; filename: string; mediaType: string;
    storageKey: string; checksumSha256: string; provenance: AssetProvenance;
    rightsState: 'pass' | 'blocked' | 'unknown'
  }): Promise<AssetRecord | null> {
    const result = await this.db.query(
      `WITH eligible AS MATERIALIZED (
        SELECT pv.id AS product_version_id, p.id AS product_id
        FROM arsy_product_versions pv
        JOIN arsy_products p ON p.id = pv.product_id
        WHERE p.owner_id = $2 AND pv.id = $3
          AND pv.version = (SELECT MAX(latest.version) FROM arsy_product_versions latest WHERE latest.product_id = p.id)
          AND p.lifecycle_state IN ('brief', 'production', 'review', 'ready')
        FOR UPDATE OF p
      ), created AS (
        INSERT INTO arsy_assets
          (id, product_version_id, owner_id, filename, media_type, storage_key, checksum_sha256, provenance, rights_state, created_by)
        SELECT $1, eligible.product_version_id, $2, $4, $5, $6, $7, $8::jsonb, $9, $10
        FROM eligible
        RETURNING *
      ), invalidated AS (
        INSERT INTO arsy_inspections
          (id, product_version_id, inspection_type, status, findings, inspected_by)
        SELECT gen_random_uuid(), created.product_version_id, required.inspection_type, 'needs-review',
          jsonb_build_array(jsonb_build_object(
            'severity', 'warning',
            'description', 'The asset inventory changed. Recheck rights, policy, technical and creative readiness before listing.'
          )), $10
        FROM created
        CROSS JOIN (VALUES ('rights'), ('policy'), ('technical'), ('creative')) AS required(inspection_type)
        RETURNING id
      ), product_reset AS (
        UPDATE arsy_products p
        SET lifecycle_state = 'production', updated_at = now(), updated_by = $10
        FROM eligible, created
        WHERE p.id = eligible.product_id AND p.owner_id = $2
        RETURNING p.id
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $11, $2, 'asset', id, 'uploaded', $10,
          jsonb_build_object('productVersionId', product_version_id, 'checksumSha256', checksum_sha256,
            'rightsState', rights_state, 'readinessReset', true)
        FROM created
      )
      SELECT ${columns} FROM created`,
      [input.id, ownerId, input.productVersionId, input.filename, input.mediaType, input.storageKey,
        input.checksumSha256, JSON.stringify(input.provenance), input.rightsState, actorId, randomUUID()],
    )
    const row = rows<AssetRow>(result)[0]
    return row ? map(row) : null
  }

  async list(ownerId: string, productVersionId?: string): Promise<AssetRecord[]> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_assets
       WHERE owner_id = $1 AND archived_at IS NULL AND ($2::uuid IS NULL OR product_version_id = $2)
       ORDER BY created_at DESC`,
      [ownerId, productVersionId ?? null],
    )
    return rows<AssetRow>(result).map((row) => map(row))
  }

  async get(ownerId: string, id: string): Promise<(AssetRecord & { storageKey: string }) | null> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_assets
       WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL LIMIT 1`,
      [ownerId, id],
    )
    const row = rows<AssetRow>(result)[0]
    return row ? map(row, true) as AssetRecord & { storageKey: string } : null
  }

  async archive(ownerId: string, actorId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `WITH eligible AS MATERIALIZED (
        SELECT pv.id AS product_version_id, p.id AS product_id
        FROM arsy_assets asset
        JOIN arsy_product_versions pv ON pv.id = asset.product_version_id
        JOIN arsy_products p ON p.id = pv.product_id
        WHERE asset.owner_id = $1 AND asset.id = $2 AND asset.archived_at IS NULL
          AND pv.version = (SELECT MAX(latest.version) FROM arsy_product_versions latest WHERE latest.product_id = p.id)
          AND p.lifecycle_state IN ('brief', 'production', 'review', 'ready')
        FOR UPDATE OF p
      ), changed AS (
        UPDATE arsy_assets asset SET archived_at = now()
        FROM eligible
        WHERE asset.owner_id = $1 AND asset.id = $2 AND asset.archived_at IS NULL
          AND asset.product_version_id = eligible.product_version_id
        RETURNING asset.*
      ), invalidated AS (
        INSERT INTO arsy_inspections
          (id, product_version_id, inspection_type, status, findings, inspected_by)
        SELECT gen_random_uuid(), changed.product_version_id, required.inspection_type, 'needs-review',
          jsonb_build_array(jsonb_build_object(
            'severity', 'warning',
            'description', 'The asset inventory changed. Recheck rights, policy, technical and creative readiness before listing.'
          )), $3
        FROM changed
        CROSS JOIN (VALUES ('rights'), ('policy'), ('technical'), ('creative')) AS required(inspection_type)
        RETURNING id
      ), product_reset AS (
        UPDATE arsy_products p
        SET lifecycle_state = 'production', updated_at = now(), updated_by = $3
        FROM eligible, changed
        WHERE p.id = eligible.product_id AND p.owner_id = $1
        RETURNING p.id
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $4, $1, 'asset', id, 'archived', $3,
          jsonb_build_object('productVersionId', product_version_id, 'readinessReset', true)
        FROM changed
      )
      SELECT id FROM changed`,
      [ownerId, id, actorId, randomUUID()],
    )
    return rows<{ id: string }>(result).length > 0
  }
}
