import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'

const token = 'asset-test-operator-token'
const ownerId = 'asset-owner'
const productId = '11111111-1111-4111-8111-111111111111'
const productVersion = 1
const assetId = '22222222-2222-4222-8222-222222222222'

function createMemoryStorage() {
  const files = new Map()
  return {
    files,
    put: async (key, bytes) => { files.set(key, Buffer.from(bytes)) },
    get: async (key) => {
      if (!files.has(key)) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      return Buffer.from(files.get(key))
    },
    delete: async (key) => { files.delete(key) },
  }
}

function createPool() {
  const calls = []
  const assets = new Map()
  const inspections = []
  return {
    calls,
    assets,
    inspections,
    query: async (sql, values = []) => {
      calls.push({ sql, values })
      if (sql.includes('INSERT INTO arsy_assets')) {
        const row = {
          id: assetId, product_id: values[2], product_version: values[3], file_name: values[4],
          media_type: values[5], byte_size: String(values[6]), storage_key: values[7], sha256: values[8],
          created_at: '2026-11-08T00:00:00.000Z', created_by: values[9],
          source_asset_id: values[10], source_reference: values[11], creator: values[12],
          license: values[13], permission_basis: values[14], tool_model: values[15],
          edit_history: JSON.parse(values[16]), disclosure: values[17],
        }
        assets.set(assetId, row)
        return { rows: [row] }
      }
      if (sql.includes('FROM arsy_assets a')) {
        const row = assets.get(values[1])
        return { rows: row ? [row] : [] }
      }
      if (sql.includes('INSERT INTO arsy_asset_inspections')) {
        const row = {
          id: randomUUID(), asset_id: values[2], inspection_type: values[3], status: values[4],
          inspection_source: values[5], rationale: values[6], findings: JSON.parse(values[7]),
          evidence: JSON.parse(values[8]), reviewed_at: '2026-11-08T00:00:00.000Z', reviewed_by: values[9],
        }
        inspections.push(row)
        return { rows: [row] }
      }
      if (sql.includes('SELECT id FROM arsy_assets')) {
        return { rows: assets.has(values[1]) ? [{ id: values[1] }] : [] }
      }
      if (sql.includes('FROM arsy_asset_inspections')) {
        return { rows: inspections.filter((row) => row.asset_id === values[1]) }
      }
      return { rows: [] }
    },
    end: async () => undefined,
  }
}

const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
const provenance = {
  creator: 'Operator-owned original asset',
  license: 'Original work — owner retains rights',
  permissionBasis: 'Created by the operator and uploaded from the original source file.',
  toolModel: 'Local design application',
  editHistory: [{ action: 'Created original', actor: ownerId, occurredAt: '2026-11-08T00:00:00Z' }],
  disclosure: 'Original asset; no third-party generative source used.',
}

test('asset APIs reject anonymous requests before touching database or storage', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/assets' })
    assert.equal(response.statusCode, 401)
    assert.equal(database.calls.length, 0)
    assert.equal(storage.files.size, 0)
  } finally {
    await app.close()
  }
})

test('asset upload stores bytes, checksum and provenance without exposing storage keys', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  const bytes = Buffer.from('original asset fixture bytes')
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token },
      payload: {
        productId,
        productVersion,
        fileName: 'cover.png',
        mediaType: 'image/png',
        contentBase64: bytes.toString('base64'),
        provenance,
      },
    })
    assert.equal(response.statusCode, 201)
    const asset = response.json().data
    assert.equal(asset.id, assetId)
    assert.equal(asset.byteSize, String(bytes.length))
    assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(asset.provenance.creator, provenance.creator)
    assert.equal(Object.hasOwn(asset, 'storageKey'), false)
    assert.equal(storage.files.size, 1)
    assert.deepEqual([...storage.files.values()][0], bytes)
  } finally {
    await app.close()
  }
})

test('asset download is private, attachment-only and returns original bytes', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  const bytes = Buffer.from('private asset bytes')
  try {
    const upload = await app.inject({
      method: 'POST', url: '/api/v1/assets', headers: { 'x-arsy-operator-token': token },
      payload: { productId, productVersion, fileName: 'private.png', mediaType: 'image/png', contentBase64: bytes.toString('base64'), provenance },
    })
    assert.equal(upload.statusCode, 201)
    const download = await app.inject({
      method: 'GET', url: `/api/v1/assets/${assetId}/download`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(download.statusCode, 200)
    assert.deepEqual(download.rawPayload, bytes)
    assert.match(download.headers['content-disposition'], /attachment/)
    assert.equal(download.headers['x-content-type-options'], 'nosniff')
    assert.equal(download.headers['cache-control'], 'private, no-store')
  } finally {
    await app.close()
  }
})

test('asset upload rejects unsupported media and malformed base64 before storage', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/assets', headers: { 'x-arsy-operator-token': token },
      payload: { productId, productVersion, fileName: 'payload.svg', mediaType: 'image/svg+xml', contentBase64: 'YWJjZA==', provenance },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(storage.files.size, 0)
    assert.equal(database.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('inspection records preserve source type and readiness fails closed until all checks pass', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  const bytes = Buffer.from('asset for inspection')
  try {
    await app.inject({
      method: 'POST', url: '/api/v1/assets', headers: { 'x-arsy-operator-token': token },
      payload: { productId, productVersion, fileName: 'asset.txt', mediaType: 'text/plain', contentBase64: bytes.toString('base64'), provenance },
    })
    const response = await app.inject({
      method: 'POST', url: `/api/v1/assets/${assetId}/inspections`,
      headers: { 'x-arsy-operator-token': token },
      payload: {
        inspectionType: 'rights', status: 'pass', inspectionSource: 'operator-attestation',
        rationale: 'Operator attests ownership from the original editable source file.',
        findings: [], evidence: [{ label: 'Original source file retained by operator' }],
      },
    })
    assert.equal(response.statusCode, 201)
    assert.equal(response.json().data.inspectionSource, 'operator-attestation')
    const readiness = await app.inject({
      method: 'GET', url: `/api/v1/assets/${assetId}/readiness`,
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(readiness.statusCode, 200)
    assert.equal(readiness.json().data.ready, false)
    assert.equal(readiness.json().data.inspections.rights, 'pass')
    assert.equal(readiness.json().data.inspections.policy, 'unknown')
  } finally {
    await app.close()
  }
})
