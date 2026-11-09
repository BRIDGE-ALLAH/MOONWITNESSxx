import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { PortfolioMetricsRepository } from '../src/analytics/portfolio-metrics.ts'

test('PostgreSQL portfolio metrics join current listing product/version columns and count verified sales', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `portfolio-metrics-${randomUUID()}`
  const productId = randomUUID()
  const productVersionId = randomUUID()
  const channelId = randomUUID()
  const listingId = randomUUID()
  const financialEventId = randomUUID()
  const now = new Date()
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  let pool = createDatabasePool()

  try {
    await pool.query(
      `INSERT INTO arsy_products
        (id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_at, created_by, updated_by)
       VALUES ($1, $2, NULL, 'Portfolio metrics CI product', 'digital-utility', 'listed', $3, $2, $2)`,
      [productId, ownerId, now],
    )
    await pool.query(
      `INSERT INTO arsy_product_versions
        (id, product_id, version, brief, acceptance_criteria, created_at, created_by)
       VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5, $6)`,
      [productVersionId, productId, JSON.stringify({ summary: 'Isolated portfolio metrics fixture' }), JSON.stringify(['The published listing is counted']), now, ownerId],
    )
    await pool.query(
      `INSERT INTO arsy_channels
        (id, owner_id, channel_key, display_name, country_code, account_eligibility,
         payout_setup_status, capability, created_by, updated_by)
       VALUES ($1, $2, 'portfolio-ci', 'Portfolio CI Channel', 'ID', 'unknown',
         'unknown', 'C0', $2, $2)`,
      [channelId, ownerId],
    )
    await pool.query(
      `INSERT INTO arsy_listings
        (id, owner_id, product_id, product_version, channel_id, status,
         listing_package, package_hash, readiness_snapshot, disclosure, idempotency_key,
         request_hash, created_at, updated_at, published_at, created_by, updated_by)
       VALUES ($1, $2, $3, 1, $4, 'published',
         '{}'::jsonb, $5, '{"ready":true,"gates":[]}'::jsonb, 'Synthetic CI fixture only',
         $6, $7, $8, $8, $8, $2, $2)`,
      [
        listingId,
        ownerId,
        productId,
        channelId,
        'a'.repeat(64),
        `portfolio-listing-${randomUUID()}`,
        'b'.repeat(64),
        now,
      ],
    )
    await pool.query(
      `INSERT INTO arsy_financial_events
        (id, owner_id, product_id, listing_id, event_type, amount_minor, currency,
         occurred_at, source, idempotency_key, request_hash, reconciliation_state, created_by)
       VALUES ($1, $2, $3, $4, 'gross-receipt', 100, 'IDR',
         $5, 'isolated-ci-fixture', $6, $7, 'verified', $2)`,
      [
        financialEventId,
        ownerId,
        productId,
        listingId,
        now,
        `portfolio-sale-${randomUUID()}`,
        'c'.repeat(64),
      ],
    )

    const metrics = await new PortfolioMetricsRepository(pool).get(ownerId, from, to)
    assert.equal(metrics.products.createdCount, '1')
    assert.equal(metrics.products.publishedCount, '1')
    assert.equal(metrics.products.firstSaleCount, '1')
    assert.equal(metrics.products.firstSaleRatePercent, '100.00')
    assert.equal(metrics.products.retiredCount, '0')
    assert.equal(metrics.products.averageCompletedLifetimeSeconds, null)
  } finally {
    await pool.query('DELETE FROM arsy_financial_events WHERE owner_id = $1 AND id = $2', [ownerId, financialEventId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_listings WHERE owner_id = $1 AND id = $2', [ownerId, listingId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_product_versions WHERE product_id = $1', [productId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_products WHERE owner_id = $1 AND id = $2', [ownerId, productId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_channels WHERE owner_id = $1 AND id = $2', [ownerId, channelId]).catch(() => undefined)
    await pool.end()
  }
})
