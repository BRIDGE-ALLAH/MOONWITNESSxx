import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
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
    assert.equal(loaded.revision, 1)
    assert.equal((await persistedOpportunities.list(ownerId)).length, 1)
    assert.equal((await persistedOpportunities.list(`${ownerId}-other`)).length, 0)

    const revisedInput = { ...input, title: 'PostgreSQL commerce revision fixture' }
    const revised = await persistedOpportunities.update(ownerId, ownerId, created.id, loaded.revision, revisedInput, evaluation)
    assert.equal(revised.status, 'updated')
    assert.equal(revised.opportunity.revision, 2)
    assert.equal(revised.opportunity.title, revisedInput.title)

    const stale = await persistedOpportunities.update(ownerId, ownerId, created.id, loaded.revision, input, evaluation)
    assert.equal(stale.status, 'stale')
    assert.equal(stale.opportunity.revision, 2)
    assert.equal(stale.opportunity.title, revisedInput.title)

    const afterRevision = await persistedOpportunities.get(ownerId, created.id)
    assert.ok(afterRevision)
    assert.equal(afterRevision.title, revisedInput.title)

    const researchDecision = await persistedOpportunities.decide(
      ownerId, ownerId, created.id, 'research-more',
      'Capture one additional independent source before product promotion.',
      afterRevision.revision,
    )
    assert.ok(researchDecision)
    assert.equal(researchDecision.revision, afterRevision.revision + 1)
    assert.equal(researchDecision.evaluation.decision, 'research-more')

    const promotionDecision = await persistedOpportunities.decide(
      ownerId, ownerId, created.id, 'prototype-candidate',
      'The completed fixture evidence now passes the test promotion gate.',
      researchDecision.revision,
    )
    assert.ok(promotionDecision)
    assert.equal(promotionDecision.revision, researchDecision.revision + 1)
    assert.equal(promotionDecision.evaluation.decision, 'prototype-candidate')
    const readyToPromote = await persistedOpportunities.get(ownerId, created.id)
    assert.ok(readyToPromote)

    const products = new ProductRepository(pool)
    const product = await products.createFromOpportunity(ownerId, ownerId, created.id, [
      'Imports a CSV without losing source rows',
      'Highlights low-stock items using configurable thresholds',
    ])
    assert.ok(product)
    assert.equal(product.version, 1)
    assert.equal(product.lifecycleState, 'brief')
    assert.deepEqual(product.allowedNextLifecycleStates, ['production'])

    const inProduction = await products.transitionLifecycle(ownerId, ownerId, product.id, 'brief', 'production')
    assert.equal(inProduction?.lifecycleState, 'production')
    const inReview = await products.transitionLifecycle(ownerId, ownerId, product.id, 'production', 'review')
    assert.equal(inReview?.lifecycleState, 'review')
    const readyProduct = await products.transitionLifecycle(ownerId, ownerId, product.id, 'review', 'ready')
    assert.equal(readyProduct?.lifecycleState, 'ready')
    assert.deepEqual(readyProduct?.allowedNextLifecycleStates, ['production', 'listed'])

    const versionTwo = await products.createVersion(
      ownerId,
      ownerId,
      product.id,
      1,
      { ...product.brief, productHypothesis: 'Version two adds a verified reconciliation report.' },
      ['Imports a CSV without losing source rows', 'Exports a reconciliation report'],
    )
    assert.equal(versionTwo?.version, 2)
    const versionHistory = await products.listVersions(ownerId, product.id)
    assert.deepEqual(versionHistory.map((version) => version.version), [2, 1])
    assert.equal(versionHistory[1].brief.productHypothesis, product.brief.productHypothesis)

    const locked = await new OpportunityRepository(pool).update(
      ownerId,
      ownerId,
      created.id,
      readyToPromote.revision,
      revisedInput,
      evaluation,
    )
    assert.equal(locked.status, 'promoted')
    const lockedDecision = await new OpportunityRepository(pool).decide(
      ownerId, ownerId, created.id, 'research-more',
      'A promoted source opportunity must no longer be editable.',
      readyToPromote.revision,
    )
    assert.equal(lockedDecision, null)
    assert.equal(await new OpportunityRepository(pool).isPromoted(ownerId, created.id), true)

    // Race a real opportunity edit against promotion. Exactly one ordering is valid:
    // either the edit wins and the product freezes its new content, or promotion wins
    // and the stale edit is rejected. A mixed/overwritten snapshot is never acceptable.
    const raceOpportunity = await opportunities.create(
      ownerId,
      ownerId,
      input,
      evaluation,
      `race-opportunity-${randomUUID()}`,
    )
    const raceInput = {
      ...input,
      title: 'Concurrent opportunity revision fixture',
      buyerProblem: 'The concurrent edit is allowed only when it wins before the product lock.',
    }
    const [raceEdit, raceProduct] = await Promise.all([
      opportunities.update(ownerId, ownerId, raceOpportunity.opportunity.id, 1, raceInput, evaluation),
      products.createFromOpportunity(ownerId, ownerId, raceOpportunity.opportunity.id, ['Concurrent promotion preserves an atomic source snapshot.']),
    ])
    assert.ok(raceProduct)
    assert.ok(raceEdit.status === 'updated' || raceEdit.status === 'promoted')
    if (raceEdit.status === 'updated') {
      assert.equal(raceEdit.opportunity.revision, 2)
      assert.equal(raceProduct.title, raceInput.title)
      assert.equal(raceProduct.brief.buyerProblem, raceInput.buyerProblem)
    } else {
      assert.equal(raceProduct.title, input.title)
      assert.equal(raceProduct.brief.buyerProblem, input.buyerProblem)
    }
    assert.equal(await new OpportunityRepository(pool).isPromoted(ownerId, raceOpportunity.opportunity.id), true)

    const otherOwnerId = randomUUID()
    await assert.rejects(
      pool.query(
        `INSERT INTO arsy_products
          (id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_by, updated_by)
         VALUES ($1, $2, $3, 'Cross-owner product', 'digital-utility', 'brief', $2, $2)`,
        [randomUUID(), otherOwnerId, created.id],
      ),
      (error) => error.code === '23503',
      'database must reject linking a product to another operator opportunity',
    )
    await assert.rejects(
      pool.query(
        `INSERT INTO arsy_financial_events
          (id, owner_id, product_id, event_type, amount_minor, currency, occurred_at,
           source, idempotency_key, request_hash, reconciliation_state, created_by)
         VALUES ($1, $2, $3, 'gross-receipt', 100, 'IDR', now(),
           'tenant isolation test', $4, $5, 'pending', $2)`,
        [randomUUID(), otherOwnerId, product.id, `cross-owner-${randomUUID()}`, 'a'.repeat(64)],
      ),
      (error) => error.code === '23503',
      'database must reject financial events linked to another operator product',
    )
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
    const additionalInputs = [
      { ...grossInput, eventType: 'refund', amountMinor: '100', idempotencyKey: `refund-${randomUUID()}` },
      { ...grossInput, eventType: 'chargeback', amountMinor: '50', idempotencyKey: `chargeback-${randomUUID()}` },
      { ...grossInput, eventType: 'tax-reserve', amountMinor: '300', idempotencyKey: `tax-${randomUUID()}` },
      { ...grossInput, eventType: 'payout', amountMinor: '150', idempotencyKey: `payout-${randomUUID()}` },
      { ...grossInput, eventType: 'payout-reversal', amountMinor: '50', idempotencyKey: `payout-reversal-${randomUUID()}` },
      { ...grossInput, eventType: 'gross-receipt', amountMinor: '750', currency: 'USD', idempotencyKey: `usd-gross-${randomUUID()}` },
    ]
    const additionalEvents = []
    for (const eventInput of additionalInputs) {
      const createdEvent = await finance.create(ownerId, ownerId, eventInput)
      assert.ok(createdEvent)
      additionalEvents.push(createdEvent.event)
    }
    const pendingByCurrency = await finance.summary(ownerId)
    assert.equal(pendingByCurrency.find((item) => item.currency === 'IDR')?.pending_minor, '6150')
    assert.equal(pendingByCurrency.find((item) => item.currency === 'USD')?.pending_minor, '750')

    for (const record of [gross.event, fee.event, ...additionalEvents]) {
      assert.ok(await finance.reconcile(ownerId, ownerId, record.id, 'verified', 'Matched to the isolated test statement.', 'https://example.com/finance-event'))
      assert.equal(await finance.reconcile(ownerId, ownerId, record.id, 'verified', 'A verified event must not be reconciled twice.', 'https://example.com/finance-event'), null)
    }

    // Reconnect again so product versions and financial events are read from PostgreSQL.
    await pool.end()
    pool = createDatabasePool()
    const persistedProducts = new ProductRepository(pool)
    const persistedFinance = new FinancialRepository(pool)
    const reloadedProduct = await persistedProducts.get(ownerId, product.id)
    assert.ok(reloadedProduct)
    assert.equal(reloadedProduct.brief.buyerProblem, input.buyerProblem)
    assert.equal(reloadedProduct.version, 2)
    assert.equal(reloadedProduct.lifecycleState, 'ready')
    assert.deepEqual((await persistedProducts.listVersions(ownerId, product.id)).map((version) => version.version), [2, 1])
    const financialEvents = await persistedFinance.list(ownerId)
    assert.equal(financialEvents.length, 8)
    assert.equal(financialEvents.find((event) => event.id === gross.event.id)?.amountMinor, '5000')
    const summaries = await persistedFinance.summary(ownerId)
    const idr = summaries.find((item) => item.currency === 'IDR')
    const usd = summaries.find((item) => item.currency === 'USD')
    assert.ok(idr)
    assert.ok(usd)
    assert.equal(idr.gross_receipts_minor, '5000')
    assert.equal(idr.deductions_minor, '650')
    assert.equal(idr.tax_reserve_minor, '300')
    assert.equal(idr.payout_movements_minor, '100')
    assert.equal(idr.net_contribution_minor, '4350')
    assert.equal(idr.pending_minor, '0')
    assert.equal(usd.gross_receipts_minor, '750')
    assert.equal(usd.deductions_minor, '0')
    assert.equal(usd.tax_reserve_minor, '0')
    assert.equal(usd.net_contribution_minor, '750')
    assert.equal(usd.pending_minor, '0')

    assert.equal(await new OpportunityRepository(pool).archive(ownerId, ownerId, created.id), true)
    assert.equal(await new OpportunityRepository(pool).get(ownerId, created.id), null)

    const audit = await pool.query(
      'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1 ORDER BY occurred_at, action',
      [ownerId],
    )
    const actions = audit.rows.map((row) => row.action)
    for (const expected of [
      'created',
      'content-updated',
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


test('shared PostgreSQL login throttling is consistent across two ARSY instances', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `login-limit-${randomUUID()}`
  const token = 'integration-shared-login-token'
  const networkHash = createHash('sha256').update(ownerId).digest('hex')
  const poolA = createDatabasePool()
  const poolB = createDatabasePool()
  const appA = createApp({ databasePool: poolA, logger: false, env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token } })
  const appB = createApp({ databasePool: poolB, logger: false, env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token } })
  const send = (app, action) => app.inject({
    method: 'POST',
    url: '/api/v1/auth/login-attempts',
    headers: { 'x-arsy-operator-token': token },
    payload: { action, networkHash },
  })

  try {
    for (let index = 0; index < 4; index += 1) {
      const response = await send(index % 2 === 0 ? appA : appB, 'failure')
      assert.equal(response.statusCode, 200)
      assert.equal(response.json().data.allowed, true)
    }
    const fifth = await send(appB, 'failure')
    assert.equal(fifth.statusCode, 200)
    assert.equal(fifth.json().data.allowed, false)
    assert.ok(fifth.json().data.retryAfterSeconds > 0)

    const blockedFromOtherInstance = await send(appA, 'check')
    assert.equal(blockedFromOtherInstance.json().data.allowed, false)

    const successfulLoginClearsBuckets = await send(appB, 'success')
    assert.equal(successfulLoginClearsBuckets.json().data.allowed, true)
    const clearedFromOtherInstance = await send(appA, 'check')
    assert.equal(clearedFromOtherInstance.json().data.allowed, true)
  } finally {
    await poolA.query('DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await appA.close()
    await appB.close()
  }
})
