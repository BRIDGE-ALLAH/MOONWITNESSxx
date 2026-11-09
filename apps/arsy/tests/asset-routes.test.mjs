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
          idempotency_key: values[9], request_hash: values[10],
          created_at: '2026-11-08T00:00:00.000Z', created_by: values[11],
          source_asset_id: values[12], source_reference: values[13], creator: values[14],
          license: values[15], permission_basis: values[16], tool_model: values[17],
          edit_history: JSON.parse(values[18]), disclosure: values[19],
        }
        if (assets.has(assetId)) return { rows: [] }
        assets.set(assetId, row)
        return { rows: [row] }
      }
      if (sql.includes('WHERE a.owner_id = $1 AND a.idempotency_key = $2')) {
        const row = [...assets.values()].find((asset) => asset.idempotency_key === values[1])
        return { rows: row ? [row] : [] }
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
  const bytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('original asset fixture bytes')])
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'asset-upload-key-0001' },
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

test('asset upload idempotency replays identical content without retaining duplicate bytes', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  const bytes = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('repeatable asset')])
  const payload = { productId, productVersion, fileName: 'repeat.png', mediaType: 'image/png', contentBase64: bytes.toString('base64'), provenance }
  const headers = { 'x-arsy-operator-token': token, 'idempotency-key': 'same-asset-request-0001' }
  try {
    const first = await app.inject({ method: 'POST', url: '/api/v1/assets', headers, payload })
    const replay = await app.inject({ method: 'POST', url: '/api/v1/assets', headers, payload })
    assert.equal(first.statusCode, 201)
    assert.equal(replay.statusCode, 200)
    assert.equal(replay.json().replayed, true)
    assert.equal(replay.json().data.id, first.json().data.id)
    assert.equal(storage.files.size, 1)
    assert.equal(database.assets.size, 1)
  } finally {
    await app.close()
  }
})

test('asset upload rejects bytes whose signature does not match the declared media type', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'bad-signature-request-01' },
      payload: { productId, productVersion, fileName: 'cover.png', mediaType: 'image/png', contentBase64: Buffer.from('not a png - deliberately invalid image signature').toString('base64'), provenance },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'ASSET_CONTENT_TYPE_MISMATCH')
    assert.equal(storage.files.size, 0)
    assert.equal(database.calls.length, 0)
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
      method: 'POST', url: '/api/v1/assets', headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'asset-upload-key-0001' },
      payload: { productId, productVersion, fileName: 'private.txt', mediaType: 'text/plain', contentBase64: bytes.toString('base64'), provenance },
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

test('asset upload fails closed when storage is unavailable or stored checksum differs', async () => {
  const database = createPool()
  let deleted = false
  const storage = {
    put: async () => undefined,
    get: async () => Buffer.from('corrupted bytes'),
    delete: async () => { deleted = true },
  }
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  try {
    const bytes = Buffer.from('valid text bytes')
    const response = await app.inject({
      method: 'POST', url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'checksum-mismatch-0001' },
      payload: { productId, productVersion, fileName: 'asset.txt', mediaType: 'text/plain', contentBase64: bytes.toString('base64'), provenance },
    })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'ASSET_STORAGE_CHECKSUM_MISMATCH')
    assert.equal(deleted, true)
    assert.equal(database.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('asset upload rejects a product version not owned by the current operator and cleans stored bytes', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const originalQuery = database.query
  database.query = async (sql, values) => {
    database.calls.push({ sql, values })
    if (sql.includes('INSERT INTO arsy_assets')) return { rows: [] }
    if (sql.includes('idempotency_key')) return { rows: [] }
    return originalQuery(sql, values)
  }
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  try {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'missing-product-version-01' },
      payload: { productId, productVersion, fileName: 'asset.txt', mediaType: 'text/plain', contentBase64: Buffer.from('valid text').toString('base64'), provenance },
    })
    assert.equal(response.statusCode, 409)
    assert.equal(response.json().error.code, 'PRODUCT_VERSION_NOT_FOUND')
    assert.equal(storage.files.size, 0)
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
      method: 'POST', url: '/api/v1/assets', headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'asset-upload-key-0001' },
      payload: { productId, productVersion, fileName: 'payload.svg', mediaType: 'image/svg+xml', contentBase64: 'YWJjZA==', provenance },
    })
    assert.equal(response.statusCode, 400)
    const malformed = await app.inject({
      method: 'POST', url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'malformed-base64-0001' },
      payload: { productId, productVersion, fileName: 'bad.txt', mediaType: 'text/plain', contentBase64: '!!!!', provenance },
    })
    assert.equal(malformed.statusCode, 400)
    assert.equal(malformed.json().error.code, 'INVALID_ASSET_BYTES')
    assert.equal(storage.files.size, 0)
    assert.equal(database.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('inspection evidence URLs reject non-HTTP schemes and embedded credentials before persistence', async () => {
  const database = createPool()
  const storage = createMemoryStorage()
  const app = await createApp({ databasePool: database, assetStorage: storage, logger: false, env })
  const bytes = Buffer.from('asset for URL validation')
  try {
    await app.inject({
      method: 'POST',
      url: '/api/v1/assets',
      headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'asset-url-validation-0001' },
      payload: { productId, productVersion, fileName: 'asset.txt', mediaType: 'text/plain', contentBase64: bytes.toString('base64'), provenance },
    })
    const inspectionUrl = `/api/v1/assets/${assetId}/inspections`
    const headers = { 'x-arsy-operator-token': token }
    const invalidValues = [
      'javascript:alert(1)',
      'data:text/html,unsafe',
      'file:///etc/passwd',
      'ftp://example.com/evidence',
      'https://operator:secret@example.com/evidence',
      'not-a-url',
    ]
    const callsBeforeInvalidRequests = database.calls.length
    for (const url of invalidValues) {
      const response = await app.inject({
        method: 'POST',
        url: inspectionUrl,
        headers,
        payload: {
          inspectionType: 'rights',
          status: 'pass',
          inspectionSource: 'operator-attestation',
          rationale: 'Evidence URL validation must reject non-canonical sources.',
          findings: [],
          evidence: [{ label: 'External evidence', url }],
        },
      })
      assert.equal(response.statusCode, 400, url)
      assert.equal(response.json().error.code, 'VALIDATION_ERROR', url)
    }
    assert.equal(database.calls.length, callsBeforeInvalidRequests, 'invalid URLs must be rejected before an inspection insert')

    const accepted = await app.inject({
      method: 'POST',
      url: inspectionUrl,
      headers,
      payload: {
        inspectionType: 'rights',
        status: 'pass',
        inspectionSource: 'operator-attestation',
        rationale: 'Evidence URL validation accepts canonical public web sources.',
        findings: [],
        evidence: [{ label: 'Public source document', url: 'https://example.org/source/evidence' }],
      },
    })
    assert.equal(accepted.statusCode, 201)
    assert.equal(accepted.json().data.evidence[0].url, 'https://example.org/source/evidence')
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
      method: 'POST', url: '/api/v1/assets', headers: { 'x-arsy-operator-token': token, 'idempotency-key': 'asset-upload-key-0001' },
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
    assert.equal(readiness.json().data.inspections.rights.status, 'pass')
    assert.equal(readiness.json().data.inspections.rights.source, 'operator-attestation')
    assert.equal(readiness.json().data.inspections.policy.status, 'unknown')
  } finally {
    await app.close()
  }
})
