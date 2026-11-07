import { randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'
import type { ProductLifecycleState } from './lifecycle.ts'

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

const columns = `p.id, p.opportunity_id, p.title, p.product_family, p.lifecycle_state,
  v.id AS version_id, v.version, v.brief, v.acceptance_criteria, p.created_at, p.updated_at`

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

  async transitionLifecycle(
    ownerId: string,
    actorId: string,
    id: string,
    expectedState: ProductLifecycleState,
    nextState: ProductLifecycleState,
  ): Promise<ProductRecord | null> {
    const auditId = randomUUID()
    const result = await this.db.query(
      `WITH updated AS (
        UPDATE arsy_products
        SET lifecycle_state = $4, updated_at = now(), updated_by = $3
        WHERE owner_id = $1 AND id = $2 AND lifecycle_state = $5
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $6, $1, 'product', updated.id, 'lifecycle-changed', $3,
          jsonb_build_object('from', $5, 'to', $4)
        FROM updated
      )
      SELECT ${columns}
      FROM updated p
      JOIN arsy_product_versions v ON v.product_id = p.id
      WHERE v.version = (
        SELECT MAX(latest.version)
        FROM arsy_product_versions latest
        WHERE latest.product_id = p.id
      )`,
      [ownerId, id, actorId, nextState, expectedState, auditId],
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
