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
      `WITH created AS (
        INSERT INTO arsy_assets
          (id, product_version_id, owner_id, filename, media_type, storage_key, checksum_sha256, provenance, rights_state, created_by)
        SELECT $1, pv.id, $2, $4, $5, $6, $7, $8::jsonb, $9, $10
        FROM arsy_product_versions pv
        JOIN arsy_products p ON p.id = pv.product_id
        WHERE p.owner_id = $2 AND pv.id = $3
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $11, $2, 'asset', id, 'uploaded', $10,
          jsonb_build_object('productVersionId', product_version_id, 'checksumSha256', checksum_sha256, 'rightsState', rights_state)
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
      `WITH changed AS (
        UPDATE arsy_assets SET archived_at = now()
        WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id)
        SELECT $3, $1, 'asset', id, 'archived', $4 FROM changed
      )
      SELECT id FROM changed`,
      [ownerId, id, randomUUID(), actorId],
    )
    return rows<{ id: string }>(result).length > 0
  }
}
