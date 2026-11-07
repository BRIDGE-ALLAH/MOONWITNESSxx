import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createAssetStorage, LocalAssetStorage, S3CompatibleAssetStorage } from '../src/assets/storage.ts'

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


test('S3-compatible asset storage signs PUT/GET/DELETE and verifies the object checksum', async () => {
  const originalFetch = globalThis.fetch
  const content = Buffer.from('S3-compatible test asset')
  const requests = []
  const storage = new S3CompatibleAssetStorage({
    endpoint: 'https://objects.example.test',
    bucket: 'moonwitness-assets',
    region: 'ap-southeast-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  })
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), method: init.method, headers: init.headers })
    if (init.method === 'GET') return new Response(content, { status: 200 })
    return new Response(null, { status: init.method === 'PUT' ? 200 : 204 })
  }
  try {
    const stored = await storage.write('owner-a', randomUUID(), content)
    assert.equal(stored.checksumSha256, createHash('sha256').update(content).digest('hex'))
    assert.match(stored.storageKey, /^[a-f0-9]{64}\/[0-9a-f-]{36}$/)
    assert.match(requests[0].headers.authorization, /^AWS4-HMAC-SHA256 Credential=test-access-key\//)
    assert.deepEqual(await storage.read(stored.storageKey), content)
    await storage.delete(stored.storageKey)
    assert.deepEqual(requests.map((request) => request.method), ['PUT', 'GET', 'DELETE'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('production asset storage requires HTTPS S3 and forbids local filesystem storage', () => {
  assert.throws(() => createAssetStorage({
    NODE_ENV: 'production',
    ARSY_ASSET_STORAGE_DRIVER: 'local',
    ARSY_ASSET_STORAGE_DIR: '/tmp/assets',
  }), /LOCAL_ASSET_STORAGE_FORBIDDEN_IN_PRODUCTION/)
  assert.throws(() => createAssetStorage({ NODE_ENV: 'production' }), /S3_ASSET_STORAGE_NOT_CONFIGURED/)
  assert.throws(() => createAssetStorage({
    NODE_ENV: 'production',
    ARSY_ASSET_STORAGE_DRIVER: 's3',
    ARSY_ASSET_STORAGE_ENDPOINT: 'http://objects.example.test',
    ARSY_ASSET_STORAGE_BUCKET: 'assets',
    ARSY_ASSET_STORAGE_ACCESS_KEY_ID: 'key',
    ARSY_ASSET_STORAGE_SECRET_ACCESS_KEY: 'secret',
  }), /S3_ASSET_STORAGE_REQUIRES_HTTPS/)
})
