import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { AssetRepository } from '../src/assets/repository.ts'
import { LocalAssetStorage } from '../src/assets/storage.ts'

test('PostgreSQL persists asset bytes, provenance and append-only inspections across reconnects', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `asset-integration-${randomUUID()}`
  const productId = randomUUID()
  const versionId = randomUUID()
  const assetIdempotency = randomUUID()
  const root = await mkdtemp(path.join(os.tmpdir(), 'arsy-asset-integration-'))
  const storage = new LocalAssetStorage(root)
  let pool = createDatabasePool()
  try {
    await pool.query(
      `INSERT INTO arsy_products
        (id, owner_id, opportunity_id, title, product_family, lifecycle_state, created_by, updated_by)
       VALUES ($1, $2, NULL, 'Asset integration product', 'digital-utility', 'brief', $2, $2)`,
      [productId, ownerId],
    )
    await pool.query(
      `INSERT INTO arsy_product_versions (id, product_id, version, brief, acceptance_criteria, created_by)
       VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5)`,
      [versionId, productId, JSON.stringify({ summary: 'Asset test fixture' }), JSON.stringify(['A verified asset is downloadable']), ownerId],
    )

    const bytes = Buffer.from('PostgreSQL-backed original asset bytes')
    const storageKey = randomUUID()
    await storage.put(storageKey, bytes)
    const repository = new AssetRepository(pool)
    const asset = await repository.create(ownerId, ownerId, {
      productId,
      productVersion: 1,
      fileName: 'source.txt',
      mediaType: 'text/plain',
      byteSize: bytes.length,
      storageKey,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      provenance: {
        creator: 'Integration fixture author',
        license: 'Original test fixture',
        permissionBasis: 'Generated only inside the isolated PostgreSQL integration test.',
        toolModel: 'Node.js test fixture',
        editHistory: [{ action: 'Created test source', actor: ownerId, occurredAt: new Date().toISOString() }],
        disclosure: 'Synthetic fixture used only in isolated CI.',
      },
    })
    assert.ok(asset)
    assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(asset.provenance.license, 'Original test fixture')
    assert.equal(await repository.get(`${ownerId}-other`, asset.id), null)

    const required = ['rights', 'policy', 'technical-qa', 'creative-qa']
    for (const inspectionType of required) {
      const inspection = await repository.appendInspection(ownerId, ownerId, asset.id, {
        inspectionType,
        status: 'pass',
        inspectionSource: 'operator-attestation',
        rationale: `CI fixture attests the ${inspectionType} check for isolated test bytes.`,
        findings: [],
        evidence: [{ label: 'Isolated CI fixture' }],
      })
      assert.ok(inspection)
      assert.equal(inspection.inspectionSource, 'operator-attestation')
    }
    assert.equal((await repository.readiness(ownerId, asset.id))?.ready, true)

    await pool.end()
    pool = createDatabasePool()
    const persisted = new AssetRepository(pool)
    const reloaded = await persisted.get(ownerId, asset.id)
    assert.ok(reloaded)
    assert.equal(reloaded.fileName, 'source.txt')
    assert.equal(reloaded.provenance.creator, 'Integration fixture author')
    assert.deepEqual(await storage.get(reloaded.storageKey), bytes)
    assert.equal((await persisted.inspections(ownerId, asset.id))?.length, 4)
    assert.equal((await persisted.readiness(ownerId, asset.id))?.ready, true)
    assert.equal((await persisted.list(ownerId, productId)).length, 1)
  } finally {
    await pool.end()
    await rm(root, { recursive: true, force: true })
  }
})
