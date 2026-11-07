import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { evaluateOpportunity, opportunityInputSchema } from '../src/opportunities/domain.ts'
import { OpportunityRepository } from '../src/opportunities/repository.ts'
import { ProductRepository } from '../src/products/repository.ts'
import { FinancialRepository } from '../src/finance/repository.ts'

test('PostgreSQL commerce lifecycle persists opportunities, products, and reconciled finance across reconnects', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `integration-${randomUUID()}`
  let pool = createDatabasePool()
  try {
    const evidence = [{
      evidenceId: 'integration-evidence-1',
      sourceName: 'Official product documentation',
      sourceUrl: 'https://example.com/product-documentation',
      sourceType: 'official-documentation',
      capturedAt: new Date().toISOString(),
      evidenceClass: 'observed-fact',
      summary: 'The source describes a documented product capability.',
      reliability: 'high',
      limitations: 'Single-source integration fixture; not market validation.',
      collectionMethod: 'Automated integration-test fixture',
      permissionBasis: 'Public documentation URL used as test data only',
    }]
    const scores = {
      demandEvidence: 20,
      competitionGap: 16,
      usefulnessDifferentiation: 12,
      marketplaceFit: 12,
      productionFeasibility: 8,
      durability: 8,
      distributionReadiness: 4,
    }
    const hardGates = {
      rights: 'pass',
      countryEligibility: 'pass',
      channelPolicy: 'pass',
      payoutFeasibility: 'pass',
    }
    const input = opportunityInputSchema.parse({
      title: 'PostgreSQL commerce integration fixture',
      buyerProblem: 'Integration tests must verify actual commerce persistence after reconnect.',
      buyerSegment: 'Repository integration tests',
      jobToBeDone: 'Verify opportunity, product, financial event, reconciliation, and audit persistence.',
      productHypothesis: 'A PostgreSQL-backed integration test catches SQL and mapping regressions.',
      productFamily: 'digital-utility',
      candidateChannels: ['manual-review'],
      evidence,
      scores,
      scoreDetails: Object.fromEntries(Object.keys(scores).map((dimension) => [dimension, {
        rationale: 'The score is a deterministic fixture for exercising persistence, not a market claim.',
        confidence: 'high',
        evidenceIds: ['integration-evidence-1'],
      }])),
      hardGates,
      hardGateDetails: Object.fromEntries(Object.entries(hardGates).map(([gate, status]) => [gate, {
        status,
        rationale: 'The gate state is fixture data used only to test repository persistence.',
        evidenceIds: ['integration-evidence-1'],
      }])),
    })
    const evaluation = evaluateOpportunity(input)
    assert.equal(evaluation.score, 80)
    assert.equal(evaluation.decision, 'prototype-candidate')

    const opportunities = new OpportunityRepository(pool)
    const created = await opportunities.create(ownerId, ownerId, input, evaluation)
    assert.ok(created.id)
    assert.equal(created.evaluation.score, 80)

    // A fresh connection proves the opportunity is not merely in process memory.
    await pool.end()
    pool = createDatabasePool()
    const persistedOpportunities = new OpportunityRepository(pool)
    const loaded = await persistedOpportunities.get(ownerId, created.id)
    assert.ok(loaded)
    assert.equal(loaded.title, input.title)
    assert.deepEqual(loaded.evidence, evidence)
    assert.deepEqual(loaded.scoreDetails, input.scoreDetails)
    assert.equal(loaded.evaluation.score, 80)
    assert.equal((await persistedOpportunities.list(ownerId)).length, 1)
    assert.equal((await persistedOpportunities.list(`${ownerId}-other`)).length, 0)

    const products = new ProductRepository(pool)
    const product = await products.createFromOpportunity(ownerId, ownerId, created.id, [
      'Imports a CSV without losing source rows',
      'Highlights low-stock items using configurable thresholds',
    ])
    assert.ok(product)
    assert.equal(product.version, 1)
    assert.equal(product.lifecycleState, 'brief')
    assert.equal(await products.createFromOpportunity(ownerId, ownerId, created.id, ['Duplicate must be blocked']), null)

    const finance = new FinancialRepository(pool)
    const grossInput = {
      productId: product.id,
      eventType: 'gross-receipt',
      amountMinor: '5000',
      currency: 'IDR',
      occurredAt: new Date().toISOString(),
      source: 'Isolated PostgreSQL integration fixture',
      idempotencyKey: `gross-${randomUUID()}`,
      metadata: { fixture: true },
    }
    const gross = await finance.create(ownerId, ownerId, grossInput)
    assert.ok(gross)
    assert.equal(gross.replayed, false)
    const replay = await finance.create(ownerId, ownerId, grossInput)
    assert.equal(replay?.replayed, true)
    assert.equal(replay?.event.id, gross.event.id)
    await assert.rejects(
      finance.create(ownerId, ownerId, { ...grossInput, amountMinor: '5001' }),
      /IDEMPOTENCY_KEY_REUSED/,
    )

    const feeInput = {
      productId: product.id,
      eventType: 'platform-fee',
      amountMinor: '500',
      currency: 'IDR',
      occurredAt: new Date().toISOString(),
      source: 'Isolated PostgreSQL integration fixture',
      idempotencyKey: `fee-${randomUUID()}`,
      metadata: { fixture: true },
    }
    const fee = await finance.create(ownerId, ownerId, feeInput)
    assert.ok(fee)
    assert.equal((await finance.summary(ownerId))[0].pending_minor, '5500')

    assert.ok(await finance.reconcile(ownerId, ownerId, gross.event.id, 'verified', 'Matched to the isolated test statement.', 'https://example.com/gross-receipt'))
    assert.ok(await finance.reconcile(ownerId, ownerId, fee.event.id, 'verified', 'Matched to the isolated test fee statement.', 'https://example.com/platform-fee'))

    // Reconnect again so product versions and financial events are read from PostgreSQL.
    await pool.end()
    pool = createDatabasePool()
    const persistedProducts = new ProductRepository(pool)
    const persistedFinance = new FinancialRepository(pool)
    const reloadedProduct = await persistedProducts.get(ownerId, product.id)
    assert.ok(reloadedProduct)
    assert.equal(reloadedProduct.brief.buyerProblem, input.buyerProblem)
    const financialEvents = await persistedFinance.list(ownerId)
    assert.equal(financialEvents.length, 2)
    assert.equal(financialEvents.find((event) => event.id === gross.event.id)?.amountMinor, '5000')
    const [summary] = await persistedFinance.summary(ownerId)
    assert.equal(summary.currency, 'IDR')
    assert.equal(summary.gross_receipts_minor, '5000')
    assert.equal(summary.deductions_minor, '500')
    assert.equal(summary.net_contribution_minor, '4500')
    assert.equal(summary.pending_minor, '0')

    const decided = await new OpportunityRepository(pool).decide(
      ownerId,
      ownerId,
      created.id,
      'research-more',
      'Recheck the evidence before any product promotion.',
    )
    assert.equal(decided?.evaluation.decision, 'research-more')
    assert.equal(await new OpportunityRepository(pool).archive(ownerId, ownerId, created.id), true)
    assert.equal(await new OpportunityRepository(pool).get(ownerId, created.id), null)

    const audit = await pool.query(
      'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 ORDER BY occurred_at, action',
      [ownerId],
    )
    const actions = audit.rows.map((row) => row.action)
    for (const expected of [
      'created',
      'created-from-opportunity',
      'recorded-pending-reconciliation',
      'reconciled',
      'decision-changed',
      'archived',
    ]) {
      assert.ok(actions.includes(expected), `missing audit action: ${expected}`)
    }
  } finally {
    await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_financial_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query(
      'DELETE FROM arsy_product_versions WHERE product_id IN (SELECT id FROM arsy_products WHERE owner_id = $1)',
      [ownerId],
    ).catch(() => undefined)
    await pool.query('DELETE FROM arsy_products WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_opportunities WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.end()
  }
})
