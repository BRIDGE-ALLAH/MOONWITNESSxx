import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
export type InspectionType = 'rights' | 'policy' | 'technical' | 'creative'
export type InspectionStatus = 'pass' | 'warning' | 'blocked' | 'needs-review'
export interface InspectionFinding {
  severity: 'info' | 'warning' | 'blocker'
  description: string
  evidenceUrl?: string
}
export interface InspectionInput {
  productVersionId: string
  inspectionType: InspectionType
  status: InspectionStatus
  findings: InspectionFinding[]
}
export interface InspectionRecord {
  id: string
  productVersionId: string
  inspectionType: InspectionType
  status: InspectionStatus
  findings: InspectionFinding[]
  inspectedAt: string
  inspectedBy: string
  productLifecycleState: string
  productReady: boolean
}
interface InspectionRow {
  id: string
  product_version_id: string
  inspection_type: InspectionType
  status: InspectionStatus
  findings: InspectionFinding[]
  inspected_at: Date | string
  inspected_by: string
  product_lifecycle_state?: string
  product_ready?: boolean
}
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }
function map(row: InspectionRow): InspectionRecord {
  return {
    id: row.id,
    productVersionId: row.product_version_id,
    inspectionType: row.inspection_type,
    status: row.status,
    findings: row.findings,
    inspectedAt: new Date(row.inspected_at).toISOString(),
    inspectedBy: row.inspected_by,
    productLifecycleState: row.product_lifecycle_state ?? 'review',
    productReady: row.product_ready ?? false,
  }
}
const columns = 'id, product_version_id, inspection_type, status, findings, inspected_at, inspected_by'

export class InspectionRepository {
  constructor(private readonly db: DatabasePool) {}

  async record(ownerId: string, actorId: string, input: InspectionInput): Promise<InspectionRecord | null> {
    const result = await this.db.query(
      `WITH inserted AS (
        INSERT INTO arsy_inspections
          (id, product_version_id, inspection_type, status, findings, inspected_by)
        SELECT $1, pv.id, $3, $4, $5::jsonb, $6
        FROM arsy_product_versions pv
        JOIN arsy_products p ON p.id = pv.product_id
        WHERE p.owner_id = $2 AND pv.id = $7
        RETURNING *
      ), latest AS (
        SELECT DISTINCT ON (inspection_type) inspection_type, status
        FROM arsy_inspections
        WHERE product_version_id = $7
        ORDER BY inspection_type, inspected_at DESC, id DESC
      ), readiness AS (
        SELECT COUNT(*) = 4 AND COALESCE(BOOL_AND(status = 'pass'), false) AS ready
        FROM latest
      ), product AS (
        UPDATE arsy_products p
        SET lifecycle_state = CASE WHEN readiness.ready THEN 'ready' ELSE 'review' END,
            updated_at = now(), updated_by = $6
        FROM readiness
        WHERE p.owner_id = $2 AND p.id = (
          SELECT product_id FROM inserted LIMIT 1
        )
        RETURNING p.id, p.lifecycle_state
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $8, $2, 'product-version', inserted.product_version_id, 'inspection-recorded', $6,
          jsonb_build_object('inspectionType', inserted.inspection_type, 'status', inserted.status, 'productReady', readiness.ready)
        FROM inserted CROSS JOIN readiness
      )
      SELECT inserted.*, product.lifecycle_state AS product_lifecycle_state,
        readiness.ready AS product_ready
      FROM inserted CROSS JOIN readiness JOIN product ON true`,
      [randomUUID(), ownerId, input.inspectionType, input.status, JSON.stringify(input.findings), actorId, input.productVersionId, randomUUID()],
    )
    const row = rows<InspectionRow>(result)[0]
    return row ? map(row) : null
  }

  async list(ownerId: string, productVersionId?: string): Promise<InspectionRecord[]> {
    const result = await this.db.query(
      `SELECT i.id, i.product_version_id, i.inspection_type, i.status, i.findings, i.inspected_at, i.inspected_by
       FROM arsy_inspections i
       JOIN arsy_product_versions pv ON pv.id = i.product_version_id
       JOIN arsy_products p ON p.id = pv.product_id
       WHERE p.owner_id = $1 AND ($2::uuid IS NULL OR pv.id = $2)
       ORDER BY i.inspected_at DESC, i.id DESC`,
      [ownerId, productVersionId ?? null],
    )
    return rows<InspectionRow>(result).map(map)
  }
}
