import type { DatabasePool } from '../db.ts'

type QueryResult<T> = { rows: T[] }

export interface PortfolioMetricDefinition {
  numerator: string
  denominator: string
  source: string
  interpretation: string
  currency: 'not-applicable' | 'product-count'
}

export interface PortfolioMetrics {
  window: {
    from: string
    to: string
    timezone: 'UTC'
    semantics: '[from, to)'
    outcomeCutoffExclusive: string
  }
  generatedAt: string
  freshness: {
    basis: 'arsy-postgresql-records'
    note: string
  }
  metricDefinitions: {
    opportunityPromotionRate: PortfolioMetricDefinition
    productPublicationCount: PortfolioMetricDefinition
    productFirstSaleRate: PortfolioMetricDefinition
    productRetirementCount: PortfolioMetricDefinition
    averageCompletedProductLifetimeSeconds: PortfolioMetricDefinition
  }
  opportunities: {
    createdCount: string
    promotedCount: string
    promotionNumerator: string
    promotionDenominator: string
    promotionRatePercent: string | null
  }
  products: {
    createdCount: string
    publishedCount: string
    firstSaleCount: string
    firstSaleNumerator: string
    firstSaleDenominator: string
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
              AND p.created_at >= o.created_at
              AND p.created_at < $3::timestamptz
          ) AS promoted
        FROM arsy_opportunities o
        WHERE o.owner_id = $1 AND o.archived_at IS NULL
          AND o.created_at >= $2::timestamptz AND o.created_at < $3::timestamptz
      ), product_cohort AS (
        SELECT p.id, p.created_at,
          (
            SELECT MIN(l.published_at)
            FROM arsy_listings l
            JOIN arsy_product_versions pv ON pv.product_id = l.product_id AND pv.version = l.product_version
            WHERE l.owner_id = p.owner_id AND l.product_id = p.id
              AND l.status = 'published' AND l.published_at IS NOT NULL
              AND l.published_at >= p.created_at
              AND l.published_at < $3::timestamptz
          ) AS first_published_at,
          (
            SELECT MIN(fe.occurred_at)
            FROM arsy_financial_events fe
            WHERE fe.owner_id = p.owner_id AND fe.product_id = p.id
              AND fe.event_type = 'gross-receipt' AND fe.reconciliation_state = 'verified'
              AND fe.occurred_at >= p.created_at
              AND fe.occurred_at < $3::timestamptz
          ) AS first_sale_at,
          (
            SELECT MIN(a.occurred_at)
            FROM arsy_commerce_audit_events a
            WHERE a.owner_id = p.owner_id AND a.aggregate_type = 'product'
              AND a.aggregate_id = p.id AND a.action = 'lifecycle-changed'
              AND a.metadata ->> 'to' = 'retired'
              AND a.occurred_at >= p.created_at
              AND a.occurred_at < $3::timestamptz
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
        (SELECT COUNT(*) FILTER (WHERE first_sale_at IS NOT NULL)::text FROM product_cohort) AS product_first_sale_count,
        (
          SELECT CASE WHEN COUNT(*) = 0 THEN NULL
            ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE first_sale_at IS NOT NULL) / COUNT(*), 2)::text
          END FROM product_cohort
        ) AS product_first_sale_rate_percent,
        (SELECT COUNT(*) FILTER (WHERE retired_at IS NOT NULL)::text FROM product_cohort) AS product_retired_count,
        (
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (retired_at - created_at)))::numeric, 2)::text
          FROM product_cohort
          WHERE retired_at IS NOT NULL
        ) AS average_completed_lifetime_seconds`,
      [ownerId, from, to],
    )
    const row = (result as QueryResult<MetricsRow>).rows[0]
    const generatedAt = new Date().toISOString()
    const opportunityCreated = row?.opportunity_created_count ?? '0'
    const opportunityPromoted = row?.opportunity_promoted_count ?? '0'
    const productCreated = row?.product_created_count ?? '0'
    const productFirstSale = row?.product_first_sale_count ?? '0'

    return {
      window: { from, to, timezone: 'UTC', semantics: '[from, to)', outcomeCutoffExclusive: to },
      generatedAt,
      freshness: {
        basis: 'arsy-postgresql-records',
        note: 'Computed at response time from persisted ARSY records. External provider synchronization is not implied; provider facts appear only after an operator or an authorized integration records them.',
      },
      metricDefinitions: {
        opportunityPromotionRate: {
          numerator: 'Non-archived opportunities in the cohort with at least one linked product created on or after the opportunity and before window.to.',
          denominator: 'Non-archived opportunities created in [window.from, window.to).',
          source: 'arsy_opportunities.created_at/archived_at and arsy_products.owner_id/opportunity_id/created_at.',
          interpretation: 'A cohort outcome rate observed only through the exclusive window.to cutoff; later product creation is not counted.',
          currency: 'not-applicable',
        },
        productPublicationCount: {
          numerator: 'Products in the creation cohort with at least one published listing whose published_at is on or after product creation and before window.to.',
          denominator: 'Products created in [window.from, window.to).',
          source: 'arsy_products.created_at, arsy_listings.status/published_at, and the matching arsy_product_versions product/version pair.',
          interpretation: 'Counts products, not listings; multiple published listings for one product count once.',
          currency: 'not-applicable',
        },
        productFirstSaleRate: {
          numerator: 'Products in the creation cohort with at least one verified gross-receipt event on or after product creation and before window.to.',
          denominator: 'Products created in [window.from, window.to).',
          source: 'arsy_products.created_at and arsy_financial_events.event_type/reconciliation_state/occurred_at.',
          interpretation: 'Counts products with a first verified sale, not revenue. Each product counts once regardless of sale count. Amounts and currencies are not combined.',
          currency: 'product-count',
        },
        productRetirementCount: {
          numerator: 'Products in the creation cohort with an audited lifecycle-changed event to retired on or after product creation and before window.to.',
          denominator: 'Products created in [window.from, window.to).',
          source: 'arsy_commerce_audit_events.aggregate_type/aggregate_id/action/metadata/occurred_at.',
          interpretation: 'Only explicit retirement audit events count; recommendations do not mutate lifecycle.',
          currency: 'not-applicable',
        },
        averageCompletedProductLifetimeSeconds: {
          numerator: 'Sum of elapsed seconds from product creation to its first audited retirement in the reporting window.',
          denominator: 'Products in the creation cohort with a qualifying audited retirement before window.to.',
          source: 'arsy_products.created_at and arsy_commerce_audit_events.occurred_at.',
          interpretation: 'Open or not-yet-retired products are right-censored and excluded; this is the mean of completed lifetimes only.',
          currency: 'not-applicable',
        },
      },
      opportunities: {
        createdCount: opportunityCreated,
        promotedCount: opportunityPromoted,
        promotionNumerator: opportunityPromoted,
        promotionDenominator: opportunityCreated,
        promotionRatePercent: row?.opportunity_promotion_rate_percent ?? null,
      },
      products: {
        createdCount: productCreated,
        publishedCount: row?.product_published_count ?? '0',
        firstSaleCount: productFirstSale,
        firstSaleNumerator: productFirstSale,
        firstSaleDenominator: productCreated,
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
