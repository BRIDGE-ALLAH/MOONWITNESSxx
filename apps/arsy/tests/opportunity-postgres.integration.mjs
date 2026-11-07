import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createDatabasePool } from '../src/db.ts'
import { createApp } from '../src/app.ts'
import { evaluateOpportunity, opportunityInputSchema } from '../src/opportunities/domain.ts'
import { OpportunityRepository } from '../src/opportunities/repository.ts'
import { ProductRepository } from '../src/products/repository.ts'
import { FinancialRepository } from '../src/finance/repository.ts'
import { ChannelRepository } from '../src/channels/repository.ts'
import { InspectionRepository } from '../src/inspections/repository.ts'
import { ListingRepository } from '../src/listings/repository.ts'
import { AssetRepository } from '../src/assets/repository.ts'
import { LocalAssetStorage } from '../src/assets/storage.ts'

test('PostgreSQL commerce lifecycle persists opportunities, products, and reconciled finance across reconnects', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `integration-${randomUUID()}`
  let pool = createDatabasePool()
  const channelSlug = `integration-${randomUUID()}`
  const assetStorageDir = await mkdtemp(path.join(tmpdir(), 'arsy-asset-integration-'))
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
    const transitionedProduct = await products.transitionLifecycle(ownerId, ownerId, product.id, 'brief', 'production')
    assert.equal(transitionedProduct?.lifecycleState, 'production')
    assert.deepEqual(transitionedProduct?.allowedNextLifecycleStates, ['review', 'retired'])
    const promotedOpportunity = await new OpportunityRepository(pool).get(ownerId, created.id)
    assert.equal(promotedOpportunity?.version, 4, 'creating a product brief must advance the opportunity version')
    assert.equal(await products.createFromOpportunity(ownerId, ownerId, created.id, ['Duplicate must be blocked']), null)
    assert.equal(await new OpportunityRepository(pool).update(ownerId, ownerId, created.id, revisedInput, revisedEvaluation, promotedOpportunity.version), null, 'promoted opportunities must reject edits')


    assert.ok(transitionedProduct)
    const revisedProduct = await products.createVersion(ownerId, ownerId, product.id, transitionedProduct.version, {
      buyerProblem: input.buyerProblem,
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

    const assetStorage = new LocalAssetStorage(assetStorageDir)
    const assets = new AssetRepository(pool)
    const storeAsset = async (filename, bytes) => {
      const id = randomUUID()
      const stored = await assetStorage.write(ownerId, id, bytes)
      const record = await assets.create(ownerId, ownerId, {
        id,
        productVersionId: revisedProduct.versionId,
        filename,
        mediaType: 'text/plain',
        storageKey: stored.storageKey,
        checksumSha256: stored.checksumSha256,
        provenance: {
          creator: 'Integration test fixture',
          license: 'Original test fixture',
          originalDeclaration: 'Created only for the isolated PostgreSQL asset integration test.',
          editHistory: ['Created as a test fixture.'],
          disclosure: 'Test data only.',
        },
        rightsState: 'pass',
      })
      assert.ok(record)
      assert.equal(record.checksumSha256, createHash('sha256').update(bytes).digest('hex'))
      const loaded = await assets.get(ownerId, id)
      assert.ok(loaded)
      assert.deepEqual(await assetStorage.read(loaded.storageKey), bytes)
      return { id, record, storageKey: stored.storageKey }
    }

    const initialAssetBytes = Buffer.from('Persisted initial integration asset binary')
    const initialAsset = await storeAsset('integration-asset-v1.txt', initialAssetBytes)
    assert.equal((await assets.list(ownerId, revisedProduct.versionId)).length, 1)

    const inspections = new InspectionRepository(pool)
    assert.equal(
      await inspections.record(ownerId, ownerId, {
        productVersionId: product.versionId,
        inspectionType: 'technical',
        status: 'pass',
        findings: [{ severity: 'info', description: 'A superseded product version must not be inspected.' }],
      }),
      null,
      'only the current product version may receive inspections',
    )
    const inspectionTypes = ['rights', 'policy', 'technical', 'creative']
    let finalInspection
    for (const inspectionType of inspectionTypes) {
      finalInspection = await inspections.record(ownerId, ownerId, {
        productVersionId: revisedProduct.versionId,
        inspectionType,
        status: 'pass',
        findings: [{
          severity: 'info',
          description: 'Integration fixture confirms the ' + inspectionType + ' inspection contract.',
          ...(['rights', 'policy'].includes(inspectionType) ? { evidenceUrl: 'https://example.com/' + inspectionType + '-review' } : {}),
        }],
      })
      assert.ok(finalInspection)
    }
    assert.equal(finalInspection.productReady, true)
    assert.equal(finalInspection.productLifecycleState, 'ready')
    assert.equal((await inspections.list(ownerId, revisedProduct.versionId)).length, 8)

    const blockedInspection = await inspections.record(ownerId, ownerId, {
      productVersionId: revisedProduct.versionId,
      inspectionType: 'technical',
      status: 'blocked',
      findings: [{
        severity: 'blocker',
        description: 'The generated package contains an executable file that failed the safety review.',
        evidenceUrl: 'https://example.com/blocker-review',
      }],
    })
    assert.equal(blockedInspection?.productReady, false)
    assert.equal(blockedInspection?.productLifecycleState, 'review')
    const recoveredInspection = await inspections.record(ownerId, ownerId, {
      productVersionId: revisedProduct.versionId,
      inspectionType: 'technical',
      status: 'pass',
      findings: [{
        severity: 'info',
        description: 'The revised package passed the repeatable technical checklist.',
      }],
    })
    assert.equal(recoveredInspection?.productReady, true)
    assert.equal(recoveredInspection?.productLifecycleState, 'ready')

    // Archiving the only active asset must invalidate READY and all four latest inspections.
    assert.equal(await assets.archive(ownerId, ownerId, initialAsset.id), true)
    assert.equal(await assets.get(ownerId, initialAsset.id), null)
    assert.equal((await assets.list(ownerId, revisedProduct.versionId)).length, 0)
    assert.equal((await products.get(ownerId, product.id))?.lifecycleState, 'production')
    const afterArchive = await pool.query(
      `SELECT DISTINCT ON (inspection_type) inspection_type, status
       FROM arsy_inspections WHERE product_version_id = $1
       ORDER BY inspection_type, inspected_at DESC, id DESC`,
      [revisedProduct.versionId],
    )
    assert.equal(afterArchive.rows.length, 4)
    assert.ok(afterArchive.rows.every((row) => row.status === 'needs-review'))

    // Uploading a replacement asset also resets the inspection set.
    const replacementBytes = Buffer.from('Persisted replacement integration asset binary')
    const replacementAsset = await storeAsset('integration-asset-v2.txt', replacementBytes)
    assert.equal((await assets.list(ownerId, revisedProduct.versionId)).length, 1)
    const afterReplacement = await pool.query(
      `SELECT DISTINCT ON (inspection_type) inspection_type, status
       FROM arsy_inspections WHERE product_version_id = $1
       ORDER BY inspection_type, inspected_at DESC, id DESC`,
      [revisedProduct.versionId],
    )
    assert.equal(afterReplacement.rows.length, 4)
    assert.ok(afterReplacement.rows.every((row) => row.status === 'needs-review'))

    // The replacement asset must be inspected again before the product can become READY.
    for (const inspectionType of inspectionTypes) {
      finalInspection = await inspections.record(ownerId, ownerId, {
        productVersionId: revisedProduct.versionId,
        inspectionType,
        status: 'pass',
        findings: [{
          severity: 'info',
          description: 'Final asset inventory review fixture for ' + inspectionType + '.',
          ...(['rights', 'policy'].includes(inspectionType) ? { evidenceUrl: 'https://example.com/final-' + inspectionType + '-review' } : {}),
        }],
      })
      assert.ok(finalInspection)
    }
    assert.equal(finalInspection.productReady, true)
    assert.equal(finalInspection.productLifecycleState, 'ready')
    const currentInspectionSet = await pool.query(
      `SELECT DISTINCT ON (inspection_type) inspection_type, status
       FROM arsy_inspections WHERE product_version_id = $1
       ORDER BY inspection_type, inspected_at DESC, id DESC`,
      [revisedProduct.versionId],
    )
    assert.equal(currentInspectionSet.rows.length, 4)
    assert.ok(currentInspectionSet.rows.every((row) => row.status === 'pass'))
    const loadedReplacement = await assets.get(ownerId, replacementAsset.id)
    assert.ok(loadedReplacement)
    assert.deepEqual(await assetStorage.read(loadedReplacement.storageKey), replacementBytes)

    const channels = new ChannelRepository(pool)
    const channel = await channels.create(ownerId, channelSlug, 'Integration Manual Channel')
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
    assert.equal((await products.get(ownerId, product.id))?.lifecycleState, 'listed')


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
    const taxReserveInput = {
      productId: product.id,
      eventType: 'tax-reserve',
      amountMinor: '300',
      currency: 'IDR',
      occurredAt: new Date().toISOString(),
      source: 'Isolated PostgreSQL tax reserve fixture',
      idempotencyKey: `tax-reserve-${randomUUID()}`,
      metadata: { fixture: true },
    }
    const taxReserve = await finance.create(ownerId, ownerId, taxReserveInput)
    assert.ok(taxReserve)
    assert.equal((await finance.summary(ownerId))[0].pending_minor, '5800')

    assert.ok(await finance.reconcile(ownerId, ownerId, gross.event.id, 'verified', 'Matched to the isolated test statement.', 'https://example.com/gross-receipt'))
    assert.ok(await finance.reconcile(ownerId, ownerId, fee.event.id, 'verified', 'Matched to the isolated test fee statement.', 'https://example.com/platform-fee'))
    assert.ok(await finance.reconcile(ownerId, ownerId, taxReserve.event.id, 'verified', 'Matched to the isolated tax reserve statement.', 'https://example.com/tax-reserve'))

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
    assert.equal(reloadedOpportunity.version, 4)
    const promotionMarker = await pool.query(
      'SELECT product_promoted_at FROM arsy_opportunities WHERE owner_id = $1 AND id = $2',
      [ownerId, created.id],
    )
    assert.ok(promotionMarker.rows[0]?.product_promoted_at, 'promotion marker must persist after reconnect')
    const financialEvents = await persistedFinance.list(ownerId)
    assert.equal(financialEvents.length, 3)
    assert.equal(financialEvents.find((event) => event.id === gross.event.id)?.amountMinor, '5000')
    const [summary] = await persistedFinance.summary(ownerId)
    assert.equal(summary.currency, 'IDR')
    assert.equal(summary.gross_receipts_minor, '5000')
    assert.equal(summary.deductions_minor, '500')
    assert.equal(summary.tax_reserve_minor, '300')
    assert.equal(summary.net_contribution_minor, '4500')
    assert.equal(summary.pending_minor, '0')

    const decided = await new OpportunityRepository(pool).decide(
      ownerId,
      ownerId,
      created.id,
      'research-more',
      'Recheck the evidence before any product promotion.',
    )
    assert.equal(decided, null, 'promoted opportunities must reject decision changes')
    assert.equal(await new OpportunityRepository(pool).archive(ownerId, ownerId, created.id), true)
    assert.equal(await new OpportunityRepository(pool).get(ownerId, created.id), null)

    const persistedInspections = new InspectionRepository(pool)
    const retired = await persistedProducts.transitionLifecycle(ownerId, ownerId, product.id, 'listed', 'retired')
    assert.equal(retired?.lifecycleState, 'retired')
    assert.deepEqual(retired?.allowedNextLifecycleStates, [])
    assert.equal(
      await persistedInspections.record(ownerId, ownerId, {
        productVersionId: revisedProduct.versionId,
        inspectionType: 'technical',
        status: 'pass',
        findings: [{ severity: 'info', description: 'A retired product must remain terminal.' }],
      }),
      null,
      'retired products must reject new inspections',
    )
    assert.equal((await persistedProducts.get(ownerId, product.id))?.lifecycleState, 'retired')

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
      'promoted-to-product-brief',
      'version-created',
      'recorded-pending-reconciliation',
      'reconciled',
      'decision-changed',
      'archived',
      'created-c0',
      'reviewed',
      'inspection-recorded',
      'manual-listing-package-created',
      'manual-publication-receipt-recorded',
      'listed',
      'uploaded',
      'archived',
    ]) {
      assert.ok(actions.includes(expected), `missing audit action: ${expected}`)
    }
  } finally {
    await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_financial_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_assets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_listings WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_inspections WHERE product_version_id IN (SELECT pv.id FROM arsy_product_versions pv JOIN arsy_products p ON p.id = pv.product_id WHERE p.owner_id = $1)', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_payouts WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_channels WHERE slug = $1', [channelSlug]).catch(() => undefined)
    await pool.query(
      'DELETE FROM arsy_product_versions WHERE product_id IN (SELECT id FROM arsy_products WHERE owner_id = $1)',
      [ownerId],
    ).catch(() => undefined)
    await pool.query('DELETE FROM arsy_products WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_opportunities WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.end()
    await rm(assetStorageDir, { recursive: true, force: true })
  }
})


test('shared PostgreSQL login throttling is consistent across two ARSY instances', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `login-limit-${randomUUID()}`
  const token = 'integration-shared-login-token'
  const networkHash = createHash('sha256').update(ownerId).digest('hex')
  let poolA = createDatabasePool()
  const poolB = createDatabasePool()
  let appA = createApp({ databasePool: poolA, logger: false, env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token } })
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

    // Recreate one ARSY app and database pool; the shared lockout must survive a process restart.
    await appA.close()
    poolA = createDatabasePool()
    appA = createApp({ databasePool: poolA, logger: false, env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token } })
    await appA.ready()
    const blockedAfterRestart = await send(appA, 'check')
    assert.equal(blockedAfterRestart.json().data.allowed, false)
    assert.ok(blockedAfterRestart.json().data.retryAfterSeconds > 0)

    // Expire both the block and the rolling failure window, then prove the next
    // attempt starts a fresh window rather than inheriting the old failure count.
    await poolA.query(
      `UPDATE arsy_login_attempt_buckets
       SET window_started_at = now() - interval '16 minutes',
           blocked_until = now() - interval '1 second'
       WHERE owner_id = $1`,
      [ownerId],
    )
    const allowedAfterWindowExpiry = await send(appA, 'check')
    assert.equal(allowedAfterWindowExpiry.json().data.allowed, true)
    const firstFailureInNewWindow = await send(appB, 'failure')
    assert.equal(firstFailureInNewWindow.json().data.allowed, true)
    const restartedBuckets = await poolA.query(
      'SELECT failure_count, blocked_until FROM arsy_login_attempt_buckets WHERE owner_id = $1',
      [ownerId],
    )
    assert.equal(restartedBuckets.rows.length, 2)
    assert.ok(restartedBuckets.rows.every((row) => Number(row.failure_count) === 1 && row.blocked_until === null))

    // A parallel burst shared across both application instances still trips the DB limit.
    const burst = await Promise.all(Array.from({ length: 7 }, (_, index) =>
      send(index % 2 === 0 ? appA : appB, 'failure'),
    ))
    assert.ok(burst.some((response) => response.json().data.allowed === false))
    const blockedAfterBurst = await send(appA, 'check')
    assert.equal(blockedAfterBurst.json().data.allowed, false)

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
