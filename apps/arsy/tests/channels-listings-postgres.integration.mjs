import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { AssetRepository } from '../src/assets/repository.ts'
import { ChannelRepository } from '../src/channels/repository.ts'
import { ListingRepository } from '../src/listings/repository.ts'

test('PostgreSQL builds a deterministic manual listing package and records real submission receipts', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `listing-integration-${randomUUID()}`
  const productId = randomUUID()
  const productVersionId = randomUUID()
  const channelKey = `ci-${randomUUID().slice(0, 8)}`
  const policyUrl = 'https://example.com/official-policy'
  let pool = createDatabasePool()
  try {
    await pool.query(
      `INSERT INTO arsy_products
        (id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_by, updated_by)
       VALUES ($1, $2, NULL, 'Listing integration product', 'digital-utility', 'review', $2, $2)`,
      [productId, ownerId],
    )
    await pool.query(
      `INSERT INTO arsy_product_versions (id, product_id, version, brief, acceptance_criteria, created_by)
       VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5)`,
      [productVersionId, productId, JSON.stringify({
        summary: 'Versioned CI listing package',
        buyerProblem: 'Small operators cannot reconcile stock movements reliably.',
        buyerSegment: 'Small online sellers',
        jobToBeDone: 'Reconcile stock movement and spot discrepancies.',
        productHypothesis: 'A localized utility template with verifiable stock movement.',
        candidateChannels: [channelKey],
      }), JSON.stringify(['A seller can reconcile stock movements']), ownerId],
    )

    const channels = new ChannelRepository(pool)
    const channel = await channels.create(ownerId, ownerId, {
      channelKey,
      displayName: 'Isolated CI Channel',
      countryCode: 'ID',
      accountEligibility: 'eligible',
      officialPolicyUrl: policyUrl,
      policyReviewedAt: '2026-11-08T00:00:00Z',
      policyRecheckAt: '2099-01-01T00:00:00Z',
      payoutRequirements: { currency: 'IDR', method: 'bank-transfer' },
      listingRequirements: { acceptedMediaTypes: ['text/plain'], acceptedProductFamilies: ['digital-utility'], maxAssetBytes: 10485760, maxTitleLength: 180, maxDescriptionLength: 2000 },
      payoutSetupStatus: 'configured',
      capability: 'C1',
      grantedScopes: [],
      quotaNotes: {},
      channelStatus: 'active',
      evidence: [
        { evidenceType: 'official-policy', sourceName: 'Official policy', sourceUrl: policyUrl, capturedAt: '2026-11-08T00:00:00Z', reviewedAt: '2026-11-08T00:00:00Z', evidenceClass: 'observed-fact', summary: 'Official channel policy was reviewed.', limitations: 'CI fixture only.' },
        { evidenceType: 'account-eligibility', sourceName: 'Account page', sourceUrl: 'https://example.com/account', capturedAt: '2026-11-08T00:00:00Z', evidenceClass: 'observed-fact', summary: 'Test account eligibility evidence.', limitations: 'CI fixture only.' },
        { evidenceType: 'payout-requirements', sourceName: 'Payout page', sourceUrl: 'https://example.com/payout', capturedAt: '2026-11-08T00:00:00Z', evidenceClass: 'observed-fact', summary: 'Test payout requirements evidence.', limitations: 'CI fixture only.' },
        { evidenceType: 'format-requirements', sourceName: 'Format page', sourceUrl: 'https://example.com/formats', capturedAt: '2026-11-08T00:00:00Z', evidenceClass: 'observed-fact', summary: 'Test accepted format requirements evidence.', limitations: 'CI fixture only.' },
      ],
    })

    const bytes = Buffer.from('CI listing asset')
    const assets = new AssetRepository(pool)
    const asset = await assets.create(ownerId, ownerId, {
      productId,
      productVersion: 1,
      fileName: 'listing-source.txt',
      mediaType: 'text/plain',
      byteSize: bytes.length,
      storageKey: randomUUID(),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      idempotencyKey: randomUUID(),
      requestHash: createHash('sha256').update('listing-asset').digest('hex'),
      provenance: {
        creator: 'CI fixture',
        license: 'Original CI fixture',
        permissionBasis: 'Generated only for the isolated integration test.',
        editHistory: [],
        disclosure: 'Synthetic CI fixture, never a production deliverable.',
      },
    })
    assert.ok(asset)
    const requiredInspections = [
      ['rights', 'independent-review'],
      ['policy', 'independent-review'],
      ['technical-qa', 'automated-check'],
      ['creative-qa', 'independent-review'],
    ]
    for (const [inspectionType, inspectionSource] of requiredInspections) {
      await assets.appendInspection(ownerId, `trusted-reviewer:${inspectionType}`, asset.asset.id, {
        inspectionType,
        status: 'pass',
        inspectionSource,
        rationale: `Trusted CI principal records the ${inspectionType} inspection for this isolated fixture.`,
        findings: [],
        evidence: [{ label: 'Isolated CI source fixture' }],
      })
    }

    const listings = new ListingRepository(pool)
    const disclosure = 'This is a test listing package generated only in isolated CI.'
    const idempotencyKey = randomUUID()
    const created = await listings.createPackage(ownerId, ownerId, productId, 1, channel.id, disclosure, idempotencyKey)
    assert.ok(created)
    assert.equal(created.listing.status, 'ready')
    assert.equal(created.listing.readinessSnapshot.ready, true)
    assert.equal(created.listing.listingPackage.assets.length, 1)
    assert.match(created.listing.packageHash, /^[a-f0-9]{64}$/)

    const replay = await listings.createPackage(ownerId, ownerId, productId, 1, channel.id, disclosure, idempotencyKey)
    assert.ok(replay)
    assert.equal(replay.replayed, true)
    assert.equal(replay.listing.id, created.listing.id)
    assert.equal(replay.listing.packageHash, created.listing.packageHash)

    const submitted = await listings.recordReceipt(ownerId, ownerId, created.listing.id, {
      receiptType: 'manual-submission',
      externalListingId: 'ci-manual-submission-001',
      evidence: [{ label: 'Isolated CI submission receipt', reference: 'ci://manual-submission/001' }],
      operatorConfirmation: 'CI fixture records that a manual submission action occurred in the isolated test environment.',
    })
    assert.equal(submitted.listing?.status, 'submitted')
    assert.equal(submitted.receipt?.receiptType, 'manual-submission')

    const published = await listings.recordReceipt(ownerId, ownerId, created.listing.id, {
      receiptType: 'publication-confirmation',
      externalListingId: 'ci-published-listing-001',
      publicUrl: 'https://example.com/listing/ci-fixture',
      evidence: [{ label: 'Isolated CI publication receipt', url: 'https://example.com/listing/ci-fixture' }],
      operatorConfirmation: 'CI fixture records a publication confirmation for the isolated test listing only.',
    })
    assert.equal(published.listing?.status, 'published')

    const withdrawn = await listings.recordReceipt(ownerId, ownerId, created.listing.id, {
      receiptType: 'withdrawal-confirmation',
      externalListingId: 'ci-published-listing-001',
      evidence: [{ label: 'Isolated CI withdrawal receipt', reference: 'ci://withdrawal/001' }],
      operatorConfirmation: 'CI fixture records a withdrawal confirmation for the isolated test listing only.',
    })
    assert.equal(withdrawn.listing?.status, 'withdrawn')
    assert.equal((await listings.receipts(ownerId, created.listing.id))?.length, 3)
    assert.equal(await listings.get(`${ownerId}-other`, created.listing.id), null)
  } finally {
    await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_publication_receipts WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_listings WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_channel_evidence WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_channels WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_asset_inspections WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_asset_provenance WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_assets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_product_versions WHERE product_id IN (SELECT id FROM arsy_products WHERE owner_id = $1)', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_products WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.end()
  }
})
