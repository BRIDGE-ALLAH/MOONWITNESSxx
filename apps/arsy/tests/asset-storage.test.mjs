import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { LocalAssetStorage } from '../src/assets/storage.ts'

test('local asset storage persists bytes and rejects unsafe storage keys', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arsy-assets-'))
  const storage = new LocalAssetStorage(root)
  const key = randomUUID()
  const bytes = Buffer.from('original digital asset bytes')
  try {
    await storage.put(key, bytes)
    assert.deepEqual(await storage.get(key), bytes)
    assert.deepEqual(await readFile(path.join(root, key)), bytes)
    await assert.rejects(storage.get('../escape'), /INVALID_STORAGE_KEY/)
    await storage.delete(key)
    await assert.rejects(storage.get(key), { code: 'ENOENT' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
