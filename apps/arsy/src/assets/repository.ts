import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
export type InspectionType = 'rights' | 'policy' | 'technical-qa' | 'creative-qa'
export type InspectionStatus = 'pass' | 'blocked' | 'unknown'
export type InspectionSource = 'operator-attestation' | 'automated-check' | 'independent-review'

export interface AssetProvenanceInput {
  sourceAssetId?: string
  sourceReference?: string
  creator: string
  license: string
  permissionBasis: string
  toolModel?: string
  editHistory: Array<{ action: string; actor: string; occurredAt: string; notes?: string }>
  disclosure: string
}
export interface AssetInput {
  productId: string
  productVersion: number
  fileName: string
  mediaType: string
  byteSize: number
  storageKey: string
  sha256: string
  idempotencyKey: string
  requestHash: string
  provenance: AssetProvenanceInput
}
export interface AssetRecord {
  id: string
  productId: string
  productVersion: number
  fileName: string
  mediaType: string
  byteSize: string
  sha256: string
  createdAt: string
  createdBy: string
  storageKey: string
  provenance: AssetProvenanceInput
}
export interface InspectionInput {
  inspectionType: InspectionType
  status: InspectionStatus
  inspectionSource: InspectionSource
  rationale: string
  findings: Array<{ code: string; severity: 'info' | 'warning' | 'blocking'; message: string }>
  evidence: Array<{ label: string; url?: string; reference?: string }>
}
export interface InspectionRecord extends InspectionInput {
  id: string
  assetId: string
  reviewedAt: string
  reviewedBy: string
}
interface AssetRow {
  id: string
  product_id: string
  product_version: number
  file_name: string
  media_type: string
  byte_size: string
  sha256: string
  created_at: Date | string
  created_by: string
  storage_key: string
  request_hash: string
  source_asset_id: string | null
  source_reference: string | null
  creator: string
  license: string
  permission_basis: string
  tool_model: string | null
  edit_history: AssetProvenanceInput['editHistory']
  disclosure: string
}
interface InspectionRow {
  id: string
  asset_id: string
  inspection_type: InspectionType
  status: InspectionStatus
  inspection_source: InspectionSource
  rationale: string
  findings: InspectionInput['findings']
  evidence: InspectionInput['evidence']
  reviewed_at: Date | string
  reviewed_by: string
}
function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}
function mapAsset(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productVersion: row.product_version,
    fileName: row.file_name,
    mediaType: row.media_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    storageKey: row.storage_key,
    provenance: {
      sourceAssetId: row.source_asset_id ?? undefined,
      sourceReference: row.source_reference ?? undefined,
      creator: row.creator,
      license: row.license,
      permissionBasis: row.permission_basis,
      toolModel: row.tool_model ?? undefined,
      editHistory: row.edit_history,
      disclosure: row.disclosure,
    },
  }
}
function mapInspection(row: InspectionRow): InspectionRecord {
  return {
    id: row.id,
    assetId: row.asset_id,
    inspectionType: row.inspection_type,
    status: row.status,
    inspectionSource: row.inspection_source,
    rationale: row.rationale,
    findings: row.findings,
    evidence: row.evidence,
    reviewedAt: new Date(row.reviewed_at).toISOString(),
    reviewedBy: row.reviewed_by,
  }
}
const assetColumns = `a.id, a.product_id, a.product_version, a.file_name, a.media_type,
  a.byte_size::text AS byte_size, a.sha256, a.created_at, a.created_by, a.storage_key, a.request_hash,
  p.source_asset_id, p.source_reference, p.creator, p.license, p.permission_basis,
  p.tool_model, p.edit_history, p.disclosure`
const inspectionColumns = 'id, asset_id, inspection_type, status, inspection_source, rationale, findings, evidence, reviewed_at, reviewed_by'

export class AssetRepository {
  constructor(private readonly db: DatabasePool) {}

  async create(ownerId: string, actorId: string, input: AssetInput): Promise<{ asset: AssetRecord; replayed: boolean } | null> {
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_assets
          (id, owner_id, product_id, product_version, file_name, media_type, byte_size, storage_key, sha256, idempotency_key, request_hash, created_by)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        WHERE EXISTS (
          SELECT 1 FROM arsy_products p
          JOIN arsy_product_versions v ON v.product_id = p.id
          WHERE p.owner_id = $2 AND p.id = $3 AND v.version = $4
        )
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), provenance AS (
        INSERT INTO arsy_asset_provenance
          (asset_id, owner_id, source_asset_id, source_reference, creator, license, permission_basis, tool_model, edit_history, disclosure, created_by)
        SELECT id, owner_id, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $12 FROM created
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $21, created.owner_id, 'asset', created.id, 'uploaded-with-provenance', $12,
          jsonb_build_object('productId', created.product_id, 'productVersion', created.product_version, 'sha256', created.sha256, 'byteSize', created.byte_size::text)
        FROM created JOIN provenance ON provenance.asset_id = created.id
      )
      SELECT ${assetColumns} FROM created a JOIN provenance p ON p.asset_id = a.id`,
      [randomUUID(), ownerId, input.productId, input.productVersion, input.fileName, input.mediaType,
        input.byteSize, input.storageKey, input.sha256, input.idempotencyKey, input.requestHash, actorId,
        input.provenance.sourceAssetId ?? null, input.provenance.sourceReference ?? null,
        input.provenance.creator, input.provenance.license, input.provenance.permissionBasis,
        input.provenance.toolModel ?? null, JSON.stringify(input.provenance.editHistory),
        input.provenance.disclosure, randomUUID()],
    )
    const inserted = rows<AssetRow>(result)[0]
    if (inserted) return { asset: mapAsset(inserted), replayed: false }

    const existingResult = await this.db.query(
      `SELECT ${assetColumns} FROM arsy_assets a
       JOIN arsy_asset_provenance p ON p.asset_id = a.id AND p.owner_id = a.owner_id
       WHERE a.owner_id = $1 AND a.idempotency_key = $2 LIMIT 1`,
      [ownerId, input.idempotencyKey],
    )
    const existing = rows<AssetRow>(existingResult)[0]
    if (!existing) return null
    if (existing.request_hash !== input.requestHash) throw new Error('ASSET_IDEMPOTENCY_KEY_REUSED')
    return { asset: mapAsset(existing), replayed: true }
  }

  async list(ownerId: string, productId?: string): Promise<AssetRecord[]> {
    const result = await this.db.query(
      `SELECT ${assetColumns} FROM arsy_assets a
       JOIN arsy_asset_provenance p ON p.asset_id = a.id AND p.owner_id = a.owner_id
       WHERE a.owner_id = $1 AND ($2::uuid IS NULL OR a.product_id = $2)
       ORDER BY a.created_at DESC LIMIT 100`,
      [ownerId, productId ?? null],
    )
    return rows<AssetRow>(result).map(mapAsset)
  }

  async get(ownerId: string, id: string): Promise<AssetRecord | null> {
    const result = await this.db.query(
      `SELECT ${assetColumns} FROM arsy_assets a
       JOIN arsy_asset_provenance p ON p.asset_id = a.id AND p.owner_id = a.owner_id
       WHERE a.owner_id = $1 AND a.id = $2 LIMIT 1`,
      [ownerId, id],
    )
    const row = rows<AssetRow>(result)[0]
    return row ? mapAsset(row) : null
  }

  async appendInspection(ownerId: string, actorId: string, assetId: string, input: InspectionInput): Promise<InspectionRecord | null> {
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_asset_inspections
          (id, owner_id, asset_id, inspection_type, status, inspection_source, rationale, findings, evidence, reviewed_by)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10
        WHERE EXISTS (SELECT 1 FROM arsy_assets WHERE owner_id = $2 AND id = $3)
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $11, owner_id, 'asset', asset_id, 'inspection-recorded', $10,
          jsonb_build_object('inspectionId', id, 'type', inspection_type, 'status', status, 'source', inspection_source)
        FROM created
      )
      SELECT ${inspectionColumns} FROM created`,
      [randomUUID(), ownerId, assetId, input.inspectionType, input.status, input.inspectionSource,
        input.rationale, JSON.stringify(input.findings), JSON.stringify(input.evidence), actorId, randomUUID()],
    )
    const row = rows<InspectionRow>(result)[0]
    return row ? mapInspection(row) : null
  }

  async inspections(ownerId: string, assetId: string): Promise<InspectionRecord[] | null> {
    const exists = await this.db.query(
      'SELECT id FROM arsy_assets WHERE owner_id = $1 AND id = $2',
      [ownerId, assetId],
    )
    if (!rows<{ id: string }>(exists)[0]) return null
    const result = await this.db.query(
      `SELECT ${inspectionColumns} FROM arsy_asset_inspections
       WHERE owner_id = $1 AND asset_id = $2 ORDER BY reviewed_at DESC`,
      [ownerId, assetId],
    )
    return rows<InspectionRow>(result).map(mapInspection)
  }

  async readiness(ownerId: string, assetId: string): Promise<{
    ready: boolean
    inspections: Record<InspectionType, { status: InspectionStatus; source: InspectionSource | null; reviewedAt: string | null }>
  } | null> {
    const history = await this.inspections(ownerId, assetId)
    if (!history) return null
    const required: InspectionType[] = ['rights', 'policy', 'technical-qa', 'creative-qa']
    const latest = Object.fromEntries(required.map((type) => {
      const record = history.find((item) => item.inspectionType === type)
      return [type, {
        status: record?.status ?? 'unknown',
        source: record?.inspectionSource ?? null,
        reviewedAt: record?.reviewedAt ?? null,
      }]
    })) as Record<InspectionType, { status: InspectionStatus; source: InspectionSource | null; reviewedAt: string | null }>
    const sourceAllowed: Record<InspectionType, InspectionSource[]> = {
      rights: ['independent-review'],
      policy: ['independent-review'],
      'technical-qa': ['automated-check', 'independent-review'],
      'creative-qa': ['independent-review'],
    }
    const ready = required.every((type) =>
      latest[type].status === 'pass' && latest[type].source !== null && sourceAllowed[type].includes(latest[type].source),
    )
    return { ready, inspections: latest }
  }
}
