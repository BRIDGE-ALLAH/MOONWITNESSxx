import test from 'node:test'
import assert from 'node:assert/strict'
import { AssetRepository } from '../src/assets/repository.ts'

const asset = {
  id: '11111111-1111-4111-8111-111111111111',
  product_version_id: '22222222-2222-4222-8222-222222222222',
  filename: 'fixture.txt',
  media_type: 'text/plain',
  storage_key: 'owner/asset',
  checksum_sha256: 'a'.repeat(64),
  provenance: {
    creator: 'Test fixture',
    license: 'Original test fixture',
    originalDeclaration: 'Created only for this isolated repository test.',
    editHistory: [],
    disclosure: 'Test data only.',
  },
  rights_state: 'pass',
  created_at: '2026-11-08T00:00:00.000Z',
}

test('asset create and archive invalidate all readiness inspections on the current mutable version', async () => {
  const calls = []
  const repository = new AssetRepository({
    query: async (sql, values) => {
      calls.push({ sql, values })
      if (sql.includes('INSERT INTO arsy_assets')) return { rows: [asset] }
      if (sql.includes('UPDATE arsy_assets')) return { rows: [{ id: asset.id }] }
      return { rows: [] }
    },
    end: async () => undefined,
  })

  const created = await repository.create('owner-a', 'owner-a', {
    id: asset.id,
    productVersionId: asset.product_version_id,
    filename: asset.filename,
    mediaType: asset.media_type,
    storageKey: asset.storage_key,
    checksumSha256: asset.checksum_sha256,
    provenance: asset.provenance,
    rightsState: 'pass',
  })
  assert.equal(created?.id, asset.id)
  assert.match(calls[0].sql, /FOR UPDATE OF p/)
  assert.match(calls[0].sql, /p\.lifecycle_state IN \('brief', 'production', 'review', 'ready'\)/)
  assert.match(calls[0].sql, /INSERT INTO arsy_inspections/)
  assert.match(calls[0].sql, /'needs-review'/)
  assert.match(calls[0].sql, /VALUES \('rights'\), \('policy'\), \('technical'\), \('creative'\)/)
  assert.match(calls[0].sql, /SET lifecycle_state = 'production'/)

  assert.equal(await repository.archive('owner-a', 'owner-a', asset.id), true)
  assert.match(calls[1].sql, /FOR UPDATE OF p/)
  assert.match(calls[1].sql, /INSERT INTO arsy_inspections/)
  assert.match(calls[1].sql, /'needs-review'/)
  assert.match(calls[1].sql, /SET lifecycle_state = 'production'/)
  assert.deepEqual(calls[1].values.slice(0, 3), ['owner-a', asset.id, 'owner-a'])
  assert.match(calls[1].values[3], /^[0-9a-f-]{36}$/i)
})
