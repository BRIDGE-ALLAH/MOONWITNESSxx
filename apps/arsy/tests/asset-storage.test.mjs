import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { LocalAssetStorage } from '../src/assets/storage.ts'

test('local asset storage writes, checksums, reads and deletes only validated asset keys', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'arsy-assets-'))
  const storage = new LocalAssetStorage(root)
  const content = Buffer.from('MoonWitness original digital asset')
  const assetId = randomUUID()
  try {
    const stored = await storage.write('owner-a', assetId, content)
    assert.equal(stored.checksumSha256, createHash('sha256').update(content).digest('hex'))
    assert.deepEqual(await storage.read(stored.storageKey), content)
    await assert.rejects(storage.read('../outside'))
    await storage.delete(stored.storageKey)
    await assert.rejects(storage.read(stored.storageKey), { code: 'ENOENT' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('asset storage fails closed when its persistent root is not configured', async () => {
  const storage = new LocalAssetStorage(undefined)
  await assert.rejects(storage.write('owner-a', randomUUID(), Buffer.from('x')), /ARSY_ASSET_STORAGE_DIR_NOT_CONFIGURED/)
})
