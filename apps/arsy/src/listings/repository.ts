import { createHash, randomUUID } from 'node:crypto'
import type { DatabasePool } from '../db.ts'
import { AssetRepository } from '../assets/repository.ts'
import { ChannelRepository, type ChannelRecord } from '../channels/repository.ts'

type QueryResult<T> = { rows: T[] }
export type ListingStatus = 'blocked' | 'ready' | 'submitted' | 'published' | 'withdrawn'
export type ReadinessStatus = 'pass' | 'blocked' | 'unknown'
export interface ReadinessGate {
  key: string
  status: ReadinessStatus
  rationale: string
  evidence: string[]
}
export interface ListingPackage {
  schemaVersion: 1
  product: {
    id: string
    version: number
    title: string
    productFamily: string
    brief: Record<string, unknown>
    acceptanceCriteria: string[]
  }
  channel: {
    id: string
    channelKey: string
    displayName: string
    countryCode: string
    capability: string
    officialPolicyUrl: string | null
    policyReviewedAt: string | null
    policyRecheckAt: string | null
    payoutRequirements: Record<string, unknown>
    listingRequirements: Record<string, unknown>
  }
  assets: Array<{
    id: string
    fileName: string
    mediaType: string
    byteSize: string
    sha256: string
    provenance: Record<string, unknown>
  }>
  disclosure: string
  instructions: string[]
  readiness: { ready: boolean; gates: ReadinessGate[] }
}
export interface ListingRecord {
  id: string
  productId: string
  productVersion: number
  channelId: string
  status: ListingStatus
  listingPackage: ListingPackage
  packageHash: string
  readinessSnapshot: { ready: boolean; gates: ReadinessGate[] }
  disclosure: string
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  publishedAt: string | null
  createdBy: string
}
export interface ReceiptInput {
  receiptType: 'manual-submission' | 'publication-confirmation' | 'withdrawal-confirmation'
  externalListingId?: string
  publicUrl?: string
  evidence: Array<{ label: string; url?: string; reference?: string }>
  operatorConfirmation: string
}
export interface PublicationReceipt extends ReceiptInput {
  id: string
  listingId: string
  capturedAt: string
  recordedBy: string
}
interface ProductRow {
  id: string
  title: string
  product_family: string
  lifecycle_state: string
  version: number
  brief: Record<string, unknown>
  acceptance_criteria: string[]
}
interface ListingRow {
  id: string
  product_id: string
  product_version: number
  channel_id: string
  status: ListingStatus
  listing_package: ListingPackage
  package_hash: string
  readiness_snapshot: { ready: boolean; gates: ReadinessGate[] }
  disclosure: string
  created_at: Date | string
  updated_at: Date | string
  submitted_at: Date | string | null
  published_at: Date | string | null
  created_by: string
}
interface ReceiptRow {
  id: string
  listing_id: string
  receipt_type: ReceiptInput['receiptType']
  external_listing_id: string | null
  public_url: string | null
  evidence: ReceiptInput['evidence']
  operator_confirmation: string
  captured_at: Date | string
  recorded_by: string
}
function rows<T>(result: unknown): T[] { return (result as QueryResult<T>).rows }
function iso(value: Date | string | null): string | null { return value === null ? null : new Date(value).toISOString() }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  }
  return value
}
function mapListing(row: ListingRow): ListingRecord {
  return {
    id: row.id,
    productId: row.product_id,
    productVersion: row.product_version,
    channelId: row.channel_id,
    status: row.status,
    listingPackage: row.listing_package,
    packageHash: row.package_hash,
    readinessSnapshot: row.readiness_snapshot,
    disclosure: row.disclosure,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    submittedAt: iso(row.submitted_at),
    publishedAt: iso(row.published_at),
    createdBy: row.created_by,
  }
}
function mapReceipt(row: ReceiptRow): PublicationReceipt {
  return {
    id: row.id,
    listingId: row.listing_id,
    receiptType: row.receipt_type,
    externalListingId: row.external_listing_id ?? undefined,
    publicUrl: row.public_url ?? undefined,
    evidence: row.evidence,
    operatorConfirmation: row.operator_confirmation,
    capturedAt: new Date(row.captured_at).toISOString(),
    recordedBy: row.recorded_by,
  }
}
const listingColumns = `id, product_id, product_version, channel_id, status, listing_package,
  package_hash, readiness_snapshot, disclosure, created_at, updated_at, submitted_at, published_at, created_by`
const receiptColumns = 'id, listing_id, receipt_type, external_listing_id, public_url, evidence, operator_confirmation, captured_at, recorded_by'

export class ListingRepository {
  private readonly channels: ChannelRepository
  private readonly assets: AssetRepository

  constructor(private readonly db: DatabasePool) {
    this.channels = new ChannelRepository(db)
    this.assets = new AssetRepository(db)
  }

  private async evaluate(ownerId: string, productId: string, productVersion: number, channel: ChannelRecord, disclosure: string): Promise<{
    product: ProductRow | null
    assets: Awaited<ReturnType<AssetRepository['list']>>
    package: ListingPackage | null
  }> {
    const productResult = await this.db.query(
      `SELECT p.id, p.title, p.product_family, p.lifecycle_state,
        v.version, v.brief, v.acceptance_criteria
       FROM arsy_products p JOIN arsy_product_versions v ON v.product_id = p.id
       WHERE p.owner_id = $1 AND p.id = $2 AND v.version = $3 LIMIT 1`,
      [ownerId, productId, productVersion],
    )
    const product = rows<ProductRow>(productResult)[0] ?? null
    if (!product) return { product: null, assets: [], package: null }

    const evidence = await this.channels.evidence(ownerId, channel.id) ?? []
    const assets = (await this.assets.list(ownerId, productId)).filter((asset) => asset.productVersion === productVersion)
    const assetReadiness = await Promise.all(assets.map((asset) => this.assets.readiness(ownerId, asset.id)))
    const now = Date.now()
    const officialPolicy = evidence.find((item) =>
      item.evidenceType === 'official-policy' &&
      item.sourceUrl === channel.officialPolicyUrl &&
      item.evidenceClass === 'observed-fact',
    )
    const accountEvidence = evidence.find((item) => item.evidenceType === 'account-eligibility' && item.evidenceClass !== 'unknown')
    const payoutEvidence = evidence.find((item) => item.evidenceType === 'payout-requirements' && item.evidenceClass !== 'unknown')
    const candidateChannels = Array.isArray(product.brief.candidateChannels) ? product.brief.candidateChannels.map((value) => String(value).toLowerCase()) : []
    const channelCandidate = candidateChannels.includes(channel.channelKey.toLowerCase()) || candidateChannels.includes(channel.displayName.toLowerCase())
    const configuredMetadata = Array.isArray(channel.listingRequirements.requiredMetadata) ? channel.listingRequirements.requiredMetadata.map(String) : []
    const requiredBrief = [...new Set(['buyerProblem', 'buyerSegment', 'jobToBeDone', 'productHypothesis', ...configuredMetadata])]
    const titleMaxLength = typeof channel.listingRequirements.maxTitleLength === 'number' ? channel.listingRequirements.maxTitleLength : null
    const descriptionMaxLength = typeof channel.listingRequirements.maxDescriptionLength === 'number' ? channel.listingRequirements.maxDescriptionLength : null
    const metadataLengthExceeded = (titleMaxLength !== null && product.title.length > titleMaxLength) || (descriptionMaxLength !== null && String(product.brief.summary ?? '').length > descriptionMaxLength)
    const missingBrief = requiredBrief.filter((key) => typeof product.brief[key] !== 'string' || !String(product.brief[key]).trim())
    const allAssetChecksPass = assets.length > 0 && assetReadiness.every((item) => item?.ready === true)
    const hasBlockedAssetCheck = assetReadiness.some((item) => item && Object.values(item.inspections).some((inspection) => inspection.status === 'blocked'))
    const gates: ReadinessGate[] = [
      {
        key: 'product-review',
        status: product.lifecycle_state === 'review' ? 'pass' : 'blocked',
        rationale: product.lifecycle_state === 'review' ? 'The selected immutable product version is in review.' : 'The product must reach review before a manual listing package can be ready.',
        evidence: [`product:${product.id}:version:${product.version}`],
      },
      {
        key: 'channel-capability',
        status: channel.channelStatus !== 'active' ? 'blocked' : channel.capability === 'C1' ? 'pass' : 'blocked',
        rationale: channel.channelStatus !== 'active' ? 'Channel is paused.' : channel.capability === 'C1' ? 'C1 permits preparation of a manual package; no API publishing is implied.' : 'C0 is research-only; manual listing is not enabled.',
        evidence: [`channel:${channel.id}:capability:${channel.capability}`],
      },
      {
        key: 'country-eligibility',
        status: channel.accountEligibility === 'eligible' && accountEvidence ? 'pass' : channel.accountEligibility === 'ineligible' ? 'blocked' : 'unknown',
        rationale: channel.accountEligibility === 'eligible' && accountEvidence ? 'Account eligibility is recorded with dated evidence.' : 'Country/account eligibility is not verified by current evidence.',
        evidence: accountEvidence ? [accountEvidence.sourceUrl] : [],
      },
      {
        key: 'policy-current',
        status: officialPolicy && channel.policyReviewedAt && channel.policyRecheckAt && new Date(channel.policyRecheckAt).getTime() > now ? 'pass' : 'unknown',
        rationale: officialPolicy && channel.policyReviewedAt && channel.policyRecheckAt && new Date(channel.policyRecheckAt).getTime() > now ? 'Official policy evidence is current within its recheck window.' : 'Official policy evidence is missing, not observed, or past its recheck date.',
        evidence: officialPolicy ? [officialPolicy.sourceUrl] : [],
      },
      {
        key: 'payout-setup',
        status: channel.payoutSetupStatus === 'unavailable' ? 'blocked' : channel.payoutSetupStatus === 'configured' && payoutEvidence ? 'pass' : 'unknown',
        rationale: channel.payoutSetupStatus === 'configured' && payoutEvidence ? 'Payout setup is recorded with evidence.' : 'Payout requirements or account payout setup remain unverified.',
        evidence: payoutEvidence ? [payoutEvidence.sourceUrl] : [],
      },
      {
        key: 'candidate-channel',
        status: channelCandidate ? 'pass' : 'blocked',
        rationale: channelCandidate ? 'The product brief explicitly names this channel.' : 'The selected channel is not in the product version candidate-channel list.',
        evidence: [`product-version:${product.version}:candidateChannels`],
      },
      {
        key: 'product-metadata',
        status: missingBrief.length === 0 && product.acceptance_criteria.length > 0 && !metadataLengthExceeded ? 'pass' : 'blocked',
        rationale: missingBrief.length === 0 && product.acceptance_criteria.length > 0 && !metadataLengthExceeded ? 'Required buyer and product metadata is present and within channel limits.' : `Missing fields: ${missingBrief.join(', ') || (metadataLengthExceeded ? 'channel title/description length limit' : 'acceptance criteria')}.`,
        evidence: [`product:${product.id}:version:${product.version}`],
      },
      {
        key: 'asset-exists',
        status: assets.length > 0 ? 'pass' : 'blocked',
        rationale: assets.length > 0 ? `${assets.length} version-bound asset(s) are attached.` : 'At least one asset for the selected product version is required.',
        evidence: assets.map((asset) => `asset:${asset.id}:sha256:${asset.sha256}`),
      },
      {
        key: 'format-compatibility',
        status: (() => {
          const acceptedTypes = channel.listingRequirements.acceptedMediaTypes
          const acceptedFamilies = channel.listingRequirements.acceptedProductFamilies
          if (!Array.isArray(acceptedTypes) || acceptedTypes.length === 0 || !Array.isArray(acceptedFamilies) || acceptedFamilies.length === 0) return 'unknown'
          if (!acceptedFamilies.map(String).includes(product.product_family)) return 'blocked'
          const maxBytes = typeof channel.listingRequirements.maxAssetBytes === 'number' ? channel.listingRequirements.maxAssetBytes : null
          return assets.length > 0 && assets.every((asset) =>
            acceptedTypes.map(String).includes(asset.mediaType) && (maxBytes === null || Number(asset.byteSize) <= maxBytes),
          ) ? 'pass' : assets.length === 0 ? 'blocked' : 'blocked'
        })(),
        rationale: (() => {
          const acceptedTypes = channel.listingRequirements.acceptedMediaTypes
          const acceptedFamilies = channel.listingRequirements.acceptedProductFamilies
          if (!Array.isArray(acceptedTypes) || acceptedTypes.length === 0 || !Array.isArray(acceptedFamilies) || acceptedFamilies.length === 0) return 'Channel format requirements are not documented.'
          if (!acceptedFamilies.map(String).includes(product.product_family)) return 'This product family is not accepted by the channel.'
          const maxBytes = typeof channel.listingRequirements.maxAssetBytes === 'number' ? channel.listingRequirements.maxAssetBytes : null
          const incompatible = assets.filter((asset) => !acceptedTypes.map(String).includes(asset.mediaType) || (maxBytes !== null && Number(asset.byteSize) > maxBytes))
          return assets.length === 0 ? 'No assets exist to validate against channel format requirements.' : incompatible.length ? `${incompatible.length} asset(s) do not meet accepted media/size requirements.` : 'All version-bound assets meet the recorded channel format requirements.'
        })(),
        evidence: [`channel:${channel.id}:format-requirements`, ...assets.map((asset) => `asset:${asset.id}:${asset.mediaType}:${asset.byteSize}`)],
      },
      {
        key: 'asset-inspections',
        status: allAssetChecksPass ? 'pass' : hasBlockedAssetCheck ? 'blocked' : 'unknown',
        rationale: allAssetChecksPass ? 'All required asset inspection gates have qualified records.' : hasBlockedAssetCheck ? 'At least one required asset inspection is blocked.' : 'Asset inspection gates are missing or not recorded by a trusted non-owner reviewer/automation actor.',
        evidence: assets.map((asset) => `asset:${asset.id}:inspection-readiness`),
      },
      {
        key: 'listing-disclosure',
        status: disclosure.trim().length >= 10 ? 'pass' : 'blocked',
        rationale: disclosure.trim().length >= 10 ? 'A channel listing disclosure has been supplied.' : 'A channel-specific disclosure of at least 10 characters is required.',
        evidence: [],
      },
    ]
    const ready = gates.every((gate) => gate.status === 'pass')
    const listingPackage: ListingPackage = {
      schemaVersion: 1,
      product: {
        id: product.id,
        version: product.version,
        title: product.title,
        productFamily: product.product_family,
        brief: product.brief,
        acceptanceCriteria: product.acceptance_criteria,
      },
      channel: {
        id: channel.id,
        channelKey: channel.channelKey,
        displayName: channel.displayName,
        countryCode: channel.countryCode,
        capability: channel.capability,
        officialPolicyUrl: channel.officialPolicyUrl,
        policyReviewedAt: channel.policyReviewedAt,
        policyRecheckAt: channel.policyRecheckAt,
        payoutRequirements: channel.payoutRequirements,
        listingRequirements: channel.listingRequirements,
      },
      assets: assets.map((asset) => ({
        id: asset.id,
        fileName: asset.fileName,
        mediaType: asset.mediaType,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
        provenance: asset.provenance as unknown as Record<string, unknown>,
      })),
      disclosure: disclosure.trim(),
      instructions: [
        'This is a manual listing package. Upload files and enter metadata yourself in the channel account.',
        'Do not share passwords, session cookies, recovery codes or API secrets with an agent.',
        'Record a submission receipt only after the real manual submission has occurred.',
        'A package hash proves package integrity, not channel approval or publication.',
      ],
      readiness: { ready, gates },
    }
    return { product, assets, package: listingPackage }
  }

  async createPackage(
    ownerId: string,
    actorId: string,
    productId: string,
    productVersion: number,
    channelId: string,
    disclosure: string,
    idempotencyKey: string,
  ): Promise<{ listing: ListingRecord; replayed: boolean } | null> {
    const channel = await this.channels.get(ownerId, channelId)
    if (!channel) return null
    const evaluated = await this.evaluate(ownerId, productId, productVersion, channel, disclosure)
    if (!evaluated.product || !evaluated.package) return null
    const stablePackage = canonical(evaluated.package)
    const packageJson = JSON.stringify(stablePackage)
    const packageHash = createHash('sha256').update(packageJson).digest('hex')
    const requestHash = createHash('sha256').update(JSON.stringify({ productId, productVersion, channelId, disclosure: disclosure.trim(), packageHash })).digest('hex')
    const result = await this.db.query(
      `WITH created AS (
        INSERT INTO arsy_listings
          (id, owner_id, product_id, product_version, channel_id, status, listing_package, package_hash,
           readiness_snapshot, disclosure, idempotency_key, request_hash, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13, $13)
        ON CONFLICT (owner_id, idempotency_key) DO NOTHING
        RETURNING *
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $14, $2, 'listing', id, 'manual-package-generated', $13,
          jsonb_build_object('productId', product_id, 'productVersion', product_version, 'channelId', channel_id, 'status', status, 'packageHash', package_hash)
        FROM created
      )
      SELECT ${listingColumns} FROM created`,
      [randomUUID(), ownerId, productId, productVersion, channelId,
        evaluated.package.readiness.ready ? 'ready' : 'blocked', packageJson, packageHash,
        JSON.stringify(evaluated.package.readiness), disclosure.trim(), idempotencyKey, requestHash, actorId, randomUUID()],
    )
    const inserted = rows<ListingRow>(result)[0]
    if (inserted) return { listing: mapListing(inserted), replayed: false }
    const existingResult = await this.db.query(
      `SELECT ${listingColumns}, request_hash FROM arsy_listings
       WHERE owner_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [ownerId, idempotencyKey],
    )
    const existing = rows<ListingRow & { request_hash: string }>(existingResult)[0]
    if (!existing) return null
    if (existing.request_hash !== requestHash) throw new Error('LISTING_IDEMPOTENCY_KEY_REUSED')
    return { listing: mapListing(existing), replayed: true }
  }

  async list(ownerId: string, productId?: string): Promise<ListingRecord[]> {
    const result = await this.db.query(
      `SELECT ${listingColumns} FROM arsy_listings
       WHERE owner_id = $1 AND ($2::uuid IS NULL OR product_id = $2)
       ORDER BY updated_at DESC LIMIT 100`,
      [ownerId, productId ?? null],
    )
    return rows<ListingRow>(result).map(mapListing)
  }

  async get(ownerId: string, id: string): Promise<ListingRecord | null> {
    const result = await this.db.query(
      `SELECT ${listingColumns} FROM arsy_listings WHERE owner_id = $1 AND id = $2 LIMIT 1`,
      [ownerId, id],
    )
    const row = rows<ListingRow>(result)[0]
    return row ? mapListing(row) : null
  }

  async receipts(ownerId: string, listingId: string): Promise<PublicationReceipt[] | null> {
    const listing = await this.get(ownerId, listingId)
    if (!listing) return null
    const result = await this.db.query(
      `SELECT ${receiptColumns} FROM arsy_publication_receipts
       WHERE owner_id = $1 AND listing_id = $2 ORDER BY captured_at DESC`,
      [ownerId, listingId],
    )
    return rows<ReceiptRow>(result).map(mapReceipt)
  }

  async recordReceipt(ownerId: string, actorId: string, listingId: string, input: ReceiptInput): Promise<{ listing: ListingRecord | null; receipt: PublicationReceipt | null; conflict: boolean }> {
    const current = await this.get(ownerId, listingId)
    if (!current) return { listing: null, receipt: null, conflict: false }
    const expected: Record<ReceiptInput['receiptType'], ListingStatus> = {
      'manual-submission': 'ready',
      'publication-confirmation': 'submitted',
      'withdrawal-confirmation': 'published',
    }
    const next: Record<ReceiptInput['receiptType'], ListingStatus> = {
      'manual-submission': 'submitted',
      'publication-confirmation': 'published',
      'withdrawal-confirmation': 'withdrawn',
    }
    if (current.status !== expected[input.receiptType]) return { listing: current, receipt: null, conflict: true }
    const result = await this.db.query(
      `WITH locked AS (
        SELECT * FROM arsy_listings WHERE owner_id = $1 AND id = $2 AND status = $3 FOR UPDATE
      ), receipt AS (
        INSERT INTO arsy_publication_receipts
          (id, owner_id, listing_id, receipt_type, external_listing_id, public_url, evidence, operator_confirmation, recorded_by)
        SELECT $4, $1, locked.id, $5, $6, $7, $8::jsonb, $9, $10 FROM locked
        RETURNING *
      ), changed AS (
        UPDATE arsy_listings l SET
          status = $11,
          submitted_at = CASE WHEN $11 = 'submitted' THEN now() ELSE l.submitted_at END,
          published_at = CASE WHEN $11 = 'published' THEN now() ELSE l.published_at END,
          updated_at = now(), updated_by = $10
        FROM receipt WHERE l.id = receipt.listing_id AND l.owner_id = $1
        RETURNING l.*
      ), audited AS (
        INSERT INTO arsy_commerce_audit_events
          (id, owner_id, aggregate_type, aggregate_id, action, actor_id, metadata)
        SELECT $12, $1, 'listing', changed.id, 'publication-receipt-recorded', $10,
          jsonb_build_object('receiptId', receipt.id, 'receiptType', receipt.receipt_type, 'status', changed.status)
        FROM changed JOIN receipt ON receipt.listing_id = changed.id
      )
      SELECT changed.*, receipt.id AS receipt_id, receipt.listing_id, receipt.receipt_type,
        receipt.external_listing_id, receipt.public_url, receipt.evidence, receipt.operator_confirmation,
        receipt.captured_at, receipt.recorded_by
      FROM changed JOIN receipt ON receipt.listing_id = changed.id`,
      [ownerId, listingId, expected[input.receiptType], randomUUID(), input.receiptType,
        input.externalListingId ?? null, input.publicUrl ?? null, JSON.stringify(input.evidence),
        input.operatorConfirmation, actorId, next[input.receiptType], randomUUID()],
    )
    const row = rows<ListingRow & {
      receipt_id: string; listing_id: string; receipt_type: ReceiptInput['receiptType'];
      external_listing_id: string | null; public_url: string | null;
      evidence: ReceiptInput['evidence']; operator_confirmation: string;
      captured_at: Date | string; recorded_by: string;
    }>(result)[0]
    if (!row) {
      const latest = await this.get(ownerId, listingId)
      return { listing: latest, receipt: null, conflict: Boolean(latest) }
    }
    return {
      listing: mapListing(row),
      receipt: mapReceipt({
        id: row.receipt_id, listing_id: row.listing_id, receipt_type: row.receipt_type,
        external_listing_id: row.external_listing_id, public_url: row.public_url,
        evidence: row.evidence, operator_confirmation: row.operator_confirmation,
        captured_at: row.captured_at, recorded_by: row.recorded_by,
      }),
      conflict: false,
    }
  }
}
