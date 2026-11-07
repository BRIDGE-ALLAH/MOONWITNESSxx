import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }
type ProductRow = {
  id: string
  opportunity_id: string | null
  title: string
  product_family: string
  lifecycle_state: string
  version_id: string
  version: number
  brief: Record<string, unknown>
  acceptance_criteria: string[]
  created_at: Date | string
  updated_at: Date | string
}
type VersionRow = {
  id: string
  version: number
  brief: Record<string, unknown>
  acceptance_criteria: string[]
  created_at: Date | string
  created_by: string
}

export interface ProductRecord {
  id: string
  opportunityId: string | null
  title: string
  productFamily: string
  lifecycleState: string
  version: number
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
  createdAt: string
  updatedAt: string
}
export interface ProductVersionRecord {
  id: string
  version: number
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
  createdAt: string
  createdBy: string
}
export type ProductLifecycleState = 'brief' | 'production' | 'review' | 'retired'

function rows<T>(result: unknown): T[] {
  return (result as QueryResult<T>).rows
}
function mapProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    title: row.title,
    productFamily: row.product_family,
    lifecycleState: row.lifecycle_state,
    version: row.version,
    brief: row.brief,
    acceptanceCriteria: row.acceptance_criteria,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}
function mapVersion(row: VersionRow): ProductVersionRecord {
  return {
    id: row.id,
    version: row.version,
    brief: row.brief,
    acceptanceCriteria: row.acceptance_criteria,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
  }
}
const columns = `p.id, p.opportunity_id, p.title, p.product_family, p.lifecycle_state,
  v.id AS version_id, v.version, v.brief, v.acceptance_criteria, p.created_at, p.updated_at`
const versionColumns = 'id, version, brief, acceptance_criteria, created_at, created_by'

export class ProductRepository {
  constructor(private readonly db: DatabasePool) {}

  async createFromOpportunity(ownerId: string, actorId: string, opportunityId: string, acceptanceCriteria: string[]): Promise<ProductRecord | null> {
    const productId = randomUUID()
    const versionId = randomUUID()
    const auditId = randomUUID()
    const result = await this.db.query(
      `WITH eligible AS (
        SELECT * FROM arsy_opportunities
        WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL
          AND decision = 'prototype-candidate' AND score >= 80
          AND hard_gates @> '{"rights":"pass","countryEligibility":"pass","channelPolicy":"pass","payoutFeasibility":"pass"}'::jsonb
        FOR UPDATE
      ), created AS (
        INSERT INTO arsy_products
          (id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_by, updated_by)
        SELECT $3, $1, eligible.id, eligible.title, eligible.product_family, 'brief', $4, $4
        FROM eligible
        ON CONFLICT (opportunity_id) WHERE opportunity_id IS NOT NULL DO NOTHING
        RETURNING *
      ), versioned AS (
        INSERT INTO arsy_product_versions
          (id, product_id, version, brief, acceptance_criteria, created_by)
        SELECT $5, created.id, 1,
          jsonb_build_object(
            'buyerProblem', eligible.buyer_problem,
            'buyerSegment', eligible.buyer_segment,
            'jobToBeDone', eligible.job_to_be_done,
            'productHypothesis', eligible.product_hypothesis,
            'productFamily', eligible.product_family,
            'evidence', eligible.evidence,
            'candidateChannels', eligible.candidate_channels
          ),
          $6::jsonb, $4
        FROM created JOIN eligible ON eligible.id = created.opportunity_id
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $7, $1, 'product', created.id, 'created-from-opportunity', $4,
          jsonb_build_object('opportunityId', created.opportunity_id, 'version', 1)
        FROM created
      )
      SELECT ${columns} FROM created p JOIN versioned v ON v.product_id = p.id`,
      [ownerId, opportunityId, productId, actorId, versionId, JSON.stringify(acceptanceCriteria), auditId],
    )
    const row = rows<ProductRow>(result)[0]
    return row ? mapProduct(row) : null
  }

  async list(ownerId: string, limit = 50): Promise<ProductRecord[]> {
    const result = await this.db.query(
      `SELECT DISTINCT ON (p.id) ${columns}
       FROM arsy_products p
       JOIN arsy_product_versions v ON v.product_id = p.id
       WHERE p.owner_id = $1
       ORDER BY p.id, v.version DESC
       LIMIT $2`,
      [ownerId, limit],
    )
    return rows<ProductRow>(result).map(mapProduct)
  }

  async get(ownerId: string, id: string): Promise<ProductRecord | null> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_products p
       JOIN arsy_product_versions v ON v.product_id = p.id
       WHERE p.owner_id = $1 AND p.id = $2
       ORDER BY v.version DESC LIMIT 1`,
      [ownerId, id],
    )
    const row = rows<ProductRow>(result)[0]
    return row ? mapProduct(row) : null
  }

  async history(ownerId: string, id: string): Promise<ProductVersionRecord[] | null> {
    const exists = await this.db.query(
      'SELECT id FROM arsy_products WHERE owner_id = $1 AND id = $2',
      [ownerId, id],
    )
    if (!rows<{ id: string }>(exists)[0]) return null
    const result = await this.db.query(
      `SELECT ${versionColumns} FROM arsy_product_versions v
       JOIN arsy_products p ON p.id = v.product_id
       WHERE p.owner_id = $1 AND p.id = $2 ORDER BY v.version DESC`,
      [ownerId, id],
    )
    return rows<VersionRow>(result).map(mapVersion)
  }

  async createVersion(
    ownerId: string,
    actorId: string,
    id: string,
    expectedVersion: number,
    brief: Record<string, unknown>,
    acceptanceCriteria: string[],
  ): Promise<{ product: ProductRecord | null; conflict: boolean }> {
    const result = await this.db.query(
      `WITH locked AS (
        SELECT p.* FROM arsy_products p
        WHERE p.owner_id = $1 AND p.id = $2
          AND p.lifecycle_state IN ('brief', 'production', 'review')
          AND (SELECT COALESCE(MAX(version), 0) FROM arsy_product_versions WHERE product_id = p.id) = $3
        FOR UPDATE
      ), versioned AS (
        INSERT INTO arsy_product_versions (id, product_id, version, brief, acceptance_criteria, created_by)
        SELECT $4, locked.id, $3 + 1, $5::jsonb, $6::jsonb, $7 FROM locked
        RETURNING *
      ), changed AS (
        UPDATE arsy_products p SET updated_at = now(), updated_by = $7
        FROM versioned v WHERE p.id = v.product_id AND p.owner_id = $1
        RETURNING p.*
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $8, $1, 'product', changed.id, 'version-created', $7,
          jsonb_build_object('version', versioned.version, 'previousVersion', $3)
        FROM changed JOIN versioned ON versioned.product_id = changed.id
      )
      SELECT ${columns} FROM changed p JOIN versioned v ON v.product_id = p.id`,
      [ownerId, id, expectedVersion, randomUUID(), JSON.stringify(brief), JSON.stringify(acceptanceCriteria), actorId, randomUUID()],
    )
    const row = rows<ProductRow>(result)[0]
    if (row) return { product: mapProduct(row), conflict: false }
    const current = await this.get(ownerId, id)
    return { product: current, conflict: Boolean(current) }
  }

  async transition(
    ownerId: string,
    actorId: string,
    id: string,
    fromVersion: number,
    nextState: ProductLifecycleState,
    rationale: string,
  ): Promise<{ product: ProductRecord | null; conflict: boolean }> {
    const allowed: Record<string, ProductLifecycleState[]> = {
      brief: ['production', 'retired'],
      production: ['review', 'retired'],
      review: ['production', 'retired'],
    }
    const current = await this.get(ownerId, id)
    if (!current) return { product: null, conflict: false }
    if (current.version !== fromVersion || !allowed[current.lifecycleState]?.includes(nextState)) {
      return { product: current, conflict: true }
    }
    const result = await this.db.query(
      `WITH changed AS (
        UPDATE arsy_products SET lifecycle_state = $4, updated_at = now(), updated_by = $5
        WHERE owner_id = $1 AND id = $2 AND lifecycle_state = $3
          AND (SELECT COALESCE(MAX(version), 0) FROM arsy_product_versions WHERE product_id = $2) = $6
        RETURNING *
      ), latest AS (
        SELECT DISTINCT ON (product_id) * FROM arsy_product_versions
        WHERE product_id = $2 ORDER BY product_id, version DESC
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $7, $1, 'product', changed.id, 'lifecycle-transition', $5,
          jsonb_build_object('from', $3, 'to', $4, 'rationale', $8, 'version', $6)
        FROM changed
      )
      SELECT ${columns} FROM changed p JOIN latest v ON v.product_id = p.id`,
      [ownerId, id, current.lifecycleState, nextState, actorId, fromVersion, randomUUID(), rationale],
    )
    const row = rows<ProductRow>(result)[0]
    if (row) return { product: mapProduct(row), conflict: false }
    const latest = await this.get(ownerId, id)
    return { product: latest, conflict: Boolean(latest) }
  }

  async findByOpportunity(ownerId: string, opportunityId: string): Promise<ProductRecord | null> {
    const result = await this.db.query(
      `SELECT ${columns} FROM arsy_products p
       JOIN arsy_product_versions v ON v.product_id = p.id
       WHERE p.owner_id = $1 AND p.opportunity_id = $2
       ORDER BY v.version DESC LIMIT 1`,
      [ownerId, opportunityId],
    )
    const row = rows<ProductRow>(result)[0]
    return row ? mapProduct(row) : null
  }
}
