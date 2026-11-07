import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { evaluateOpportunity, opportunityInputSchema } from '../src/opportunities/domain.ts'
import { OpportunityRepository } from '../src/opportunities/repository.ts'
import { ProductRepository } from '../src/products/repository.ts'
import { FinancialRepository } from '../src/finance/repository.ts'
import { ChannelRepository } from '../src/channels/repository.ts'
import { InspectionRepository } from '../src/inspections/repository.ts'
import { ListingRepository } from '../src/listings/repository.ts'

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
    const opportunityIdempotencyKey = `opportunity-${randomUUID()}`
    const createResult = await opportunities.create(ownerId, ownerId, input, evaluation, opportunityIdempotencyKey)
    const created = createResult.opportunity
    assert.ok(created.id)
    assert.equal(created.evaluation.score, 80)
    assert.equal(createResult.replayed, false)
    const createReplay = await opportunities.create(ownerId, ownerId, input, evaluation, opportunityIdempotencyKey)
    assert.equal(createReplay.replayed, true)
    assert.equal(createReplay.opportunity.id, created.id)

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
    assert.equal(loaded.version, 1)
    assert.equal((await persistedOpportunities.list(ownerId)).length, 1)
    assert.equal((await persistedOpportunities.list(`${ownerId}-other`)).length, 0)

    const revisedInput = opportunityInputSchema.parse({
      ...input,
      title: 'Updated PostgreSQL commerce integration fixture',
      productHypothesis: 'A revised PostgreSQL-backed integration test catches persisted update regressions.',
    })
    const revisedEvaluation = evaluateOpportunity(revisedInput)
    const updated = await persistedOpportunities.update(
      ownerId,
      ownerId,
      created.id,
      revisedInput,
      revisedEvaluation,
      loaded.version,
    )
    assert.ok(updated)
    assert.equal(updated.title, revisedInput.title)
    assert.equal(updated.version, 2)
    assert.equal(updated.evaluation.decision, 'research-more')
    assert.equal(await persistedOpportunities.update(
      ownerId,
      ownerId,
      created.id,
      input,
      evaluation,
      loaded.version,
    ), null, 'stale versions must not overwrite newer opportunity data')

    const promoted = await persistedOpportunities.decide(
      ownerId,
      ownerId,
      created.id,
      'prototype-candidate',
      'Updated evidence and hard-gate notes were reviewed before promotion.',
    )
    assert.ok(promoted)
    assert.equal(promoted.version, 3)

    const products = new ProductRepository(pool)
    const product = await products.createFromOpportunity(ownerId, ownerId, created.id, [
      'Imports a CSV without losing source rows',
      'Highlights low-stock items using configurable thresholds',
    ])
    assert.ok(product)
    assert.equal(product.version, 1)
    assert.equal(product.lifecycleState, 'brief')
    assert.equal(await products.createFromOpportunity(ownerId, ownerId, created.id, ['Duplicate must be blocked']), null)


    const revisedProduct = await products.createVersion(ownerId, ownerId, product.id, {
      revisionNotes: 'Version two adds clear reorder threshold behavior.',
      sourceOpportunityId: created.id,
    }, [
      'Imports a CSV without losing source rows',
      'Highlights low-stock items using configurable thresholds',
      'Documents reorder threshold behavior',
    ])
    assert.ok(revisedProduct)
    assert.equal(revisedProduct.version, 2)
    assert.equal(revisedProduct.lifecycleState, 'production')

    const inspections = new InspectionRepository(pool)
    const inspectionTypes = ['rights', 'policy', 'technical', 'creative']
    let finalInspection
    for (const inspectionType of inspectionTypes) {
      finalInspection = await inspections.record(ownerId, ownerId, {
        productVersionId: revisedProduct.versionId,
        inspectionType,
        status: 'pass',
        findings: [{
          severity: 'info',
          description: `Integration fixture confirms the ${inspectionType} inspection contract.`,
          ...(['rights', 'policy'].includes(inspectionType) ? { evidenceUrl: `https://example.com/${inspectionType}-review` } : {}),
        }],
      })
      assert.ok(finalInspection)
    }
    assert.equal(finalInspection.productReady, true)
    assert.equal(finalInspection.productLifecycleState, 'ready')
    assert.equal((await inspections.list(ownerId, revisedProduct.versionId)).length, 4)

    const channels = new ChannelRepository(pool)
    const channel = await channels.create(ownerId, `integration-${randomUUID()}`, 'Integration Manual Channel')
    assert.equal(channel.capability, 'C0')
    const reviewedChannel = await channels.review(channel.id, ownerId, {
      countryEligibility: [{ country: 'ID', status: 'pass', sourceUrl: 'https://example.com/id-eligibility', checkedAt: new Date().toISOString() }],
      payoutRequirements: { status: 'pass', sourceUrl: 'https://example.com/payout-eligibility', checkedAt: new Date().toISOString(), notes: 'Integration fixture confirms payout setup requirements.' },
      policyStatus: 'pass',
      policyUrl: 'https://example.com/channel-policy',
      policyCheckedAt: new Date().toISOString(),
      manualFallback: 'The operator uploads the package manually and records the provider listing receipt.',
    })
    assert.equal(reviewedChannel?.capability, 'C1')
    assert.equal(reviewedChannel?.enabled, true)

    const listings = new ListingRepository(pool)
    const listing = await listings.create(ownerId, ownerId, {
      productVersionId: revisedProduct.versionId,
      channelId: channel.id,
      title: 'Integration product listing',
      description: 'A manual listing package used to test the channel eligibility and publication receipt workflow.',
      tags: ['integration', 'digital-utility'],
      priceMinor: '25000',
      currency: 'IDR',
      disclosures: ['Digital product; no physical shipment.'],
      manualUploadInstructions: 'Upload manually, review the public preview and confirm the price and disclosures before publishing.',
    })
    assert.ok(listing)
    assert.equal(listing.status, 'ready')
    const published = await listings.recordPublication(
      ownerId, ownerId, listing.id, 'provider-listing-fixture-001',
      'https://example.com/publication-receipt', new Date().toISOString(),
    )
    assert.equal(published?.status, 'published')
    assert.equal(published?.providerReference, 'provider-listing-fixture-001')

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
    const reloadedOpportunity = await new OpportunityRepository(pool).get(ownerId, created.id)
    assert.ok(reloadedOpportunity)
    assert.equal(reloadedOpportunity.title, revisedInput.title)
    assert.equal(reloadedOpportunity.version, 3)
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
      'updated',
      'decision-changed',
      'created-from-opportunity',
      'recorded-pending-reconciliation',
      'reconciled',
      'decision-changed',
      'archived',
      'channel-created-c0',
      'reviewed',
      'inspection-recorded',
      'manual-listing-package-created',
      'manual-publication-receipt-recorded',
    ]) {
      assert.ok(actions.includes(expected), `missing audit action: ${expected}`)
    }
  } finally {
    await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_financial_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_listings WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_inspections WHERE product_version_id IN (SELECT pv.id FROM arsy_product_versions pv JOIN arsy_products p ON p.id = pv.product_id WHERE p.owner_id = $1)', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_channels WHERE slug LIKE $1', [`integration-%`]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_payouts WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query(
      'DELETE FROM arsy_product_versions WHERE product_id IN (SELECT id FROM arsy_products WHERE owner_id = $1)',
      [ownerId],
    ).catch(() => undefined)
    await pool.query('DELETE FROM arsy_products WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_opportunities WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.end()
  }
})
