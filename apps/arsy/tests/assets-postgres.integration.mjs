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
    const createdAsset = await repository.create(ownerId, ownerId, {
      productId,
      productVersion: 1,
      fileName: 'source.txt',
      mediaType: 'text/plain',
      byteSize: bytes.length,
      storageKey,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      idempotencyKey: randomUUID(),
      requestHash: createHash('sha256').update('asset-integration-request').digest('hex'),
      provenance: {
        creator: 'Integration fixture author',
        license: 'Original test fixture',
        permissionBasis: 'Generated only inside the isolated PostgreSQL integration test.',
        toolModel: 'Node.js test fixture',
        editHistory: [{ action: 'Created test source', actor: ownerId, occurredAt: new Date().toISOString() }],
        disclosure: 'Synthetic fixture used only in isolated CI.',
      },
    })
    assert.ok(createdAsset)
    assert.equal(createdAsset.replayed, false)
    const asset = createdAsset.asset
    assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(asset.provenance.license, 'Original test fixture')
    assert.equal(await repository.get(`${ownerId}-other`, asset.id), null)

    const operatorAttestation = await repository.appendInspection(ownerId, ownerId, asset.id, {
      inspectionType: 'rights',
      status: 'pass',
      inspectionSource: 'operator-attestation',
      rationale: 'The test operator records a rights attestation for isolated fixture bytes.',
      findings: [],
      evidence: [{ label: 'Isolated CI fixture' }],
    })
    assert.ok(operatorAttestation)
    assert.equal((await repository.readiness(ownerId, asset.id))?.ready, false)

    const required = [
      ['rights', 'independent-review'],
      ['policy', 'independent-review'],
      ['technical-qa', 'automated-check'],
      ['creative-qa', 'independent-review'],
    ]
    for (const [inspectionType, inspectionSource] of required) {
      // Repository-level fixture simulates a trusted reviewer/automation principal.
      // The public operator API cannot impersonate this actor.
      const inspection = await repository.appendInspection(ownerId, 'trusted-inspection-service', asset.id, {
        inspectionType,
        status: 'pass',
        inspectionSource,
        rationale: `CI fixture records the qualified ${inspectionType} check for isolated test bytes.`,
        findings: [],
        evidence: [{ label: 'Isolated CI fixture' }],
      })
      assert.ok(inspection)
      assert.equal(inspection.inspectionSource, inspectionSource)
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
    assert.equal((await persisted.inspections(ownerId, asset.id))?.length, 5)
    assert.equal((await persisted.readiness(ownerId, asset.id))?.ready, true)

    const derivativeBytes = Buffer.from('Derivative asset bytes linked to the original asset.')
    const derivativeStorageKey = randomUUID()
    await storage.put(derivativeStorageKey, derivativeBytes)
    const derivativeCreated = await persisted.create(ownerId, ownerId, {
      productId,
      productVersion: 1,
      fileName: 'derivative.txt',
      mediaType: 'text/plain',
      byteSize: derivativeBytes.length,
      storageKey: derivativeStorageKey,
      sha256: createHash('sha256').update(derivativeBytes).digest('hex'),
      idempotencyKey: randomUUID(),
      requestHash: createHash('sha256').update('asset-derivative-request').digest('hex'),
      provenance: {
        sourceAssetId: asset.id,
        sourceReference: asset.id,
        creator: 'Integration fixture author',
        license: 'Derivative permitted by original fixture terms',
        permissionBasis: 'Derivative is linked to the original owner-scoped fixture asset.',
        toolModel: 'Node.js test fixture',
        editHistory: [{ action: 'Created derivative', actor: ownerId, occurredAt: new Date().toISOString() }],
        disclosure: 'Derivative fixture linked to the original source asset.',
      },
    })
    assert.ok(derivativeCreated)
    assert.equal(derivativeCreated.asset.provenance.sourceAssetId, asset.id)
    assert.equal((await persisted.list(ownerId, productId)).length, 2)

    const audit = await pool.query(
      'SELECT action FROM arsy_commerce_audit_events WHERE owner_id = $1',
      [ownerId],
    )
    const actions = audit.rows.map((row) => row.action)
    assert.ok(actions.includes('uploaded-with-provenance'))
    assert.equal(actions.filter((action) => action === 'inspection-recorded').length, 5)
  } finally {
    await pool.query('DELETE FROM arsy_commerce_audit_events WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_asset_inspections WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_asset_provenance WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query('DELETE FROM arsy_assets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.query(
      'DELETE FROM arsy_product_versions WHERE product_id IN (SELECT id FROM arsy_products WHERE owner_id = $1)',
      [ownerId],
    ).catch(() => undefined)
    await pool.query('DELETE FROM arsy_products WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await pool.end()
    await rm(root, { recursive: true, force: true })
  }
})
