import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { PortfolioMetricsRepository } from '../src/analytics/portfolio-metrics.ts'

test('PostgreSQL cohort metrics use complete persisted cohorts and source events', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `portfolio-metrics-${randomUUID()}`
  const otherOwner = `${ownerId}-other`
  const opportunityId = randomUUID()
  const productId = randomUUID()
  const versionId = randomUUID()
  const channelId = randomUUID()
  const listingId = randomUUID()
  const financialEventId = randomUUID()
  const createdAt = new Date(Date.now() - 86_400_000).toISOString()
  const retiredAt = new Date().toISOString()
  const from = new Date(Date.now() - 172_800_000).toISOString()
  const to = new Date(Date.now() + 60_000).toISOString()
  const pool = createDatabasePool()

  try {
    await pool.query(
      `INSERT INTO arsy_opportunities
        (id, owner_id, title, buyer_problem, buyer_segment, job_to_be_done,
         product_hypothesis, product_family, evidence, scores, score_details,
         hard_gates, hard_gate_details, score, decision, idempotency_key,
         request_hash, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, 'Metrics cohort opportunity',
         'A persisted opportunity fixture for cohort aggregation.',
         'PostgreSQL integration tests', 'Verify the source-backed portfolio metric contract.',
         'A product linked to this opportunity should be counted in the cohort.',
         'digital-utility', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb,
         '{}'::jsonb, '{}'::jsonb, 80, 'prototype-candidate', $3, $4,
         $2, $2, $5::timestamptz, $5::timestamptz)`,
      [opportunityId, ownerId, `opportunity-${opportunityId}`, 'a'.repeat(64), createdAt],
    )
    await pool.query(
      `INSERT INTO arsy_products
        (id, owner_id, opportunity_id, title, product_family, lifecycle_state,
         created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'Metrics cohort product', 'digital-utility', 'retired',
         $2, $2, $4::timestamptz, $5::timestamptz)`,
      [productId, ownerId, opportunityId, createdAt, retiredAt],
    )
    await pool.query(
      `INSERT INTO arsy_product_versions
        (id, product_id, version, brief, acceptance_criteria, created_by, created_at)
       VALUES ($1, $2, 1, '{}'::jsonb, '[]'::jsonb, $3, $4::timestamptz)`,
      [versionId, productId, ownerId, createdAt],
    )
    await pool.query(
      `INSERT INTO arsy_channels
        (id, slug, display_name, capability, enabled)
       VALUES ($1, $2, 'Metrics integration channel', 'C1', true)`,
      [channelId, `metrics-${channelId}`],
    )
    await pool.query(
      `INSERT INTO arsy_listings
        (id, product_version_id, channel_id, owner_id, status, listing_package,
         provider_reference, published_at, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'published', '{}'::jsonb, 'metrics-publication-fixture',
         $5::timestamptz, $4, $4, $6::timestamptz, $5::timestamptz)`,
      [listingId, versionId, channelId, ownerId, retiredAt, createdAt],
    )
    await pool.query(
      `INSERT INTO arsy_financial_events
        (id, owner_id, product_id, listing_id, event_type, amount_minor, currency,
         occurred_at, source, provider_reference, idempotency_key, request_hash,
         reconciliation_state, created_by)
       VALUES ($1, $2, $3, $4, 'gross-receipt', 10000, 'IDR', $5::timestamptz,
         'Metrics integration fixture', 'metrics-sale-fixture', $6, $7, 'verified', $2)`,
      [financialEventId, ownerId, productId, listingId, retiredAt,
        `metrics-sale-${financialEventId}`, 'b'.repeat(64)],
    )
    await pool.query(
      `INSERT INTO arsy_commerce_audit_events
        (id, owner_id, aggregate_type, aggregate_id, action, actor_id, occurred_at, metadata)
       VALUES ($1, $2, 'product', $3, 'lifecycle-changed', $2, $4::timestamptz,
         '{"from":"listed","to":"retired"}'::jsonb)`,
      [randomUUID(), ownerId, productId, retiredAt],
    )

    const repository = new PortfolioMetricsRepository(pool)
    const metrics = await repository.get(ownerId, from, to)
    assert.equal(metrics.opportunities.createdCount, '1')
    assert.equal(metrics.opportunities.promotedCount, '1')
    assert.equal(metrics.opportunities.promotionRatePercent, '100.00')
    assert.equal(metrics.products.createdCount, '1')
    assert.equal(metrics.products.publishedCount, '1')
    assert.equal(metrics.products.firstSaleCount, '1')
    assert.equal(metrics.products.firstSaleRatePercent, '100.00')
    assert.equal(metrics.products.retiredCount, '1')
    assert.ok(Number(metrics.products.averageCompletedLifetimeSeconds) > 0)
    assert.equal(metrics.unavailableMetrics.discoveryToOpportunity.available, false)

    const empty = await repository.get(otherOwner, from, to)
    assert.equal(empty.opportunities.createdCount, '0')
    assert.equal(empty.opportunities.promotionRatePercent, null)
    assert.equal(empty.products.createdCount, '0')
    assert.equal(empty.products.firstSaleRatePercent, null)
    assert.equal(empty.products.averageCompletedLifetimeSeconds, null)
  } finally {
    await pool.end()
  }
})
