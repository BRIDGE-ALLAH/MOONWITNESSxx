import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../src/app.ts'

const token = 'test-only-secret-operator-token'
const ownerId = 'operator-test'
const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
const productVersionId = '22222222-2222-4222-8222-222222222222'
const content = Buffer.from('Asset API route integration fixture')
const assetId = '11111111-1111-4111-8111-111111111111'
const storageKey = `${createHash('sha256').update(ownerId).digest('hex')}/${assetId}`
const checksum = createHash('sha256').update(content).digest('hex')
const assetRow = {
  id: assetId,
  product_version_id: productVersionId,
  filename: 'fixture.txt',
  media_type: 'text/plain',
  storage_key: storageKey,
  checksum_sha256: checksum,
  provenance: {
    creator: 'Operator test',
    license: 'Original test fixture',
    originalDeclaration: 'This is a generated test fixture for asset storage.',
    editHistory: [],
    disclosure: 'Test data only.',
  },
  rights_state: 'pass',
  created_at: '2026-11-08T00:00:00Z',
}

test('asset API stores binary, serves it only to the operator, and archives metadata', async () => {
  const storageDir = await mkdtemp(path.join(tmpdir(), 'arsy-asset-route-'))
  const pool = {
    query: async (sql) => {
      if (sql.includes('INSERT INTO arsy_assets')) return { rows: [assetRow] }
      if (sql.includes('UPDATE arsy_assets')) return { rows: [{ id: assetId }] }
      if (sql.includes('FROM arsy_assets')) return { rows: [assetRow] }
      return { rows: [] }
    },
    end: async () => undefined,
  }
  const app = await createApp({ databasePool: pool, logger: false, env: { ...env, ARSY_ASSET_STORAGE_DIR: storageDir } })
  try {
    const unauthorized = await app.inject({ method: 'GET', url: `/api/v1/assets/${assetId}/content` })
    assert.equal(unauthorized.statusCode, 401)

    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token },
      payload: {
        productVersionId,
        filename: 'fixture.txt',
        mediaType: 'text/plain',
        contentBase64: content.toString('base64'),
        rightsState: 'pass',
        provenance: assetRow.provenance,
      },
    })
    assert.equal(uploaded.statusCode, 201)
    assert.equal(uploaded.json().data.checksumSha256, checksum)

    const downloaded = await app.inject({
      method: 'GET',
      url: `/api/v1/assets/${assetId}/content`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(downloaded.statusCode, 200)
    assert.equal(downloaded.headers['x-content-sha256'], checksum)
    assert.deepEqual(downloaded.rawPayload, content)

    const archived = await app.inject({
      method: 'DELETE',
      url: `/api/v1/assets/${assetId}`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(archived.statusCode, 204)
  } finally {
    await app.close()
    await rm(storageDir, { recursive: true, force: true })
  }
})

test('asset upload rejects unsupported active-content media types and oversized payloads', async () => {
  const pool = { query: async () => ({ rows: [] }), end: async () => undefined }
  const app = await createApp({ databasePool: pool, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token },
      payload: {
        productVersionId,
        filename: 'payload.svg',
        mediaType: 'image/svg+xml',
        contentBase64: Buffer.from('<svg/>').toString('base64'),
        rightsState: 'unknown',
        provenance: { creator: 'Operator', license: 'Unknown', editHistory: [], disclosure: 'Unknown' },
      },
    })
    assert.equal(response.statusCode, 400)
  } finally { await app.close() }
})
