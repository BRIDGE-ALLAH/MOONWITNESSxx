import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }

export interface PortfolioMetrics {
  window: {
    from: string
    to: string
    timezone: 'UTC'
    semantics: '[from, to)'
  }
  opportunities: {
    createdCount: string
    promotedCount: string
    promotionRatePercent: string | null
  }
  products: {
    createdCount: string
    publishedCount: string
    firstSaleCount: string
    firstSaleRatePercent: string | null
    retiredCount: string
    averageCompletedLifetimeSeconds: string | null
  }
  unavailableMetrics: {
    discoveryToOpportunity: { available: false; reason: string }
    supportBurden: { available: false; reason: string }
  }
}

interface MetricsRow {
  opportunity_created_count: string
  opportunity_promoted_count: string
  opportunity_promotion_rate_percent: string | null
  product_created_count: string
  product_published_count: string
  product_first_sale_count: string
  product_first_sale_rate_percent: string | null
  product_retired_count: string
  average_completed_lifetime_seconds: string | null
}

export class PortfolioMetricsRepository {
  constructor(private readonly db: DatabasePool) {}

  async get(ownerId: string, from: string, to: string): Promise<PortfolioMetrics> {
    const result = await this.db.query(
      `WITH opportunity_cohort AS (
        SELECT o.id,
          EXISTS (
            SELECT 1 FROM arsy_products p
            WHERE p.owner_id = o.owner_id AND p.opportunity_id = o.id
          ) AS promoted
        FROM arsy_opportunities o
        WHERE o.owner_id = $1 AND o.archived_at IS NULL
          AND o.created_at >= $2::timestamptz AND o.created_at < $3::timestamptz
      ), product_cohort AS (
        SELECT p.id, p.created_at,
          (
            SELECT MIN(l.published_at)
            FROM arsy_listings l
            JOIN arsy_product_versions pv ON pv.id = l.product_version_id
            WHERE l.owner_id = p.owner_id AND pv.product_id = p.id
              AND l.status = 'published' AND l.published_at IS NOT NULL
          ) AS first_published_at,
          (
            SELECT MIN(fe.occurred_at)
            FROM arsy_financial_events fe
            WHERE fe.owner_id = p.owner_id AND fe.product_id = p.id
              AND fe.event_type = 'gross-receipt' AND fe.reconciliation_state = 'verified'
          ) AS first_sale_at,
          (
            SELECT MIN(a.occurred_at)
            FROM arsy_commerce_audit_events a
            WHERE a.owner_id = p.owner_id AND a.aggregate_type = 'product'
              AND a.aggregate_id = p.id AND a.action = 'lifecycle-changed'
              AND a.metadata ->> 'to' = 'retired'
          ) AS retired_at
        FROM arsy_products p
        WHERE p.owner_id = $1
          AND p.created_at >= $2::timestamptz AND p.created_at < $3::timestamptz
      )
      SELECT
        (SELECT COUNT(*)::text FROM opportunity_cohort) AS opportunity_created_count,
        (SELECT COUNT(*) FILTER (WHERE promoted)::text FROM opportunity_cohort) AS opportunity_promoted_count,
        (
          SELECT CASE WHEN COUNT(*) = 0 THEN NULL
            ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE promoted) / COUNT(*), 2)::text
          END FROM opportunity_cohort
        ) AS opportunity_promotion_rate_percent,
        (SELECT COUNT(*)::text FROM product_cohort) AS product_created_count,
        (SELECT COUNT(*) FILTER (WHERE first_published_at IS NOT NULL)::text FROM product_cohort) AS product_published_count,
        (SELECT COUNT(*) FILTER (WHERE first_sale_at IS NOT NULL AND first_sale_at >= created_at)::text FROM product_cohort) AS product_first_sale_count,
        (
          SELECT CASE WHEN COUNT(*) = 0 THEN NULL
            ELSE ROUND(
              100.0 * COUNT(*) FILTER (WHERE first_sale_at IS NOT NULL AND first_sale_at >= created_at) / COUNT(*),
              2
            )::text
          END FROM product_cohort
        ) AS product_first_sale_rate_percent,
        (SELECT COUNT(*) FILTER (WHERE retired_at IS NOT NULL AND retired_at >= created_at)::text FROM product_cohort) AS product_retired_count,
        (
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (retired_at - created_at)))::numeric, 2)::text
          FROM product_cohort
          WHERE retired_at IS NOT NULL AND retired_at >= created_at
        ) AS average_completed_lifetime_seconds`,
      [ownerId, from, to],
    )
    const row = (result as QueryResult<MetricsRow>).rows[0]
    return {
      window: { from, to, timezone: 'UTC', semantics: '[from, to)' },
      opportunities: {
        createdCount: row?.opportunity_created_count ?? '0',
        promotedCount: row?.opportunity_promoted_count ?? '0',
        promotionRatePercent: row?.opportunity_promotion_rate_percent ?? null,
      },
      products: {
        createdCount: row?.product_created_count ?? '0',
        publishedCount: row?.product_published_count ?? '0',
        firstSaleCount: row?.product_first_sale_count ?? '0',
        firstSaleRatePercent: row?.product_first_sale_rate_percent ?? null,
        retiredCount: row?.product_retired_count ?? '0',
        averageCompletedLifetimeSeconds: row?.average_completed_lifetime_seconds ?? null,
      },
      unavailableMetrics: {
        discoveryToOpportunity: {
          available: false,
          reason: 'No verified impression or exposure event source exists. Opportunity evidence is not an impression denominator.',
        },
        supportBurden: {
          available: false,
          reason: 'No persisted support or maintenance case workflow exists yet.',
        },
      },
    }
  }
}
