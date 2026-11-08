import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'

const operatorId = 'governance-route-operator'
const operatorToken = 'governance-route-test-token-with-more-than-32-bytes'
const headers = { 'x-arsy-operator-token': operatorToken }
const timestamp = '2026-11-08T00:00:00.000Z'

function validInput() {
  return {
    label: 'Route test snapshot',
    graph: {
      id: 'graph-1',
      version: 1,
      createdAt: timestamp,
      nodes: [{ id: 'd1', kind: 'decision', label: 'Decide', createdAt: timestamp }],
      edges: [],
    },
    gateInput: {
      metrics: [],
      requiredEvidenceCount: 0,
      verifiedEvidenceCount: 0,
      staleEvidenceCount: 0,
      contradictionCount: 0,
      unresolvedAssumptionCount: 0,
    },
    scenarioBaseline: [{ id: 'm1', label: 'Metric', value: 1 }],
    scenario: {
      id: 's1',
      title: 'Scenario',
      basedOnSnapshotId: 'graph-1',
      assumptions: [],
      operations: [],
    },
  }
}

function createFakePool(options = {}) {
  const rows = new Map()
  const calls = []
  return {
    calls,
    rows,
    async query(sql, values = []) {
      calls.push({ sql, values })
      if (options.fail) throw new Error('simulated store failure')
      if (sql.includes('INSERT INTO arsy_governance_snapshots')) {
        const row = {
          id: values[0],
          owner_id: values[1],
          label: values[2],
          graph: JSON.parse(values[3]),
          gate_input: JSON.parse(values[4]),
          scenario_baseline: JSON.parse(values[5]),
          scenario: JSON.parse(values[6]),
          created_at: new Date(timestamp),
          archived_at: null,
        }
        rows.set(row.id, row)
        return { rows: [row] }
      }
      if (sql.includes('SELECT id, label, created_at, archived_at')) {
        return { rows: [...rows.values()].filter((row) => row.owner_id === values[0]) }
      }
      if (sql.includes('UPDATE arsy_governance_snapshots')) {
        const row = rows.get(values[0])
        if (row && row.owner_id === values[1] && row.archived_at === null) {
          row.archived_at = new Date('2026-11-09T00:00:00.000Z')
          return { rows: [row] }
        }
        return { rows: [] }
      }
      if (sql.includes('SELECT * FROM arsy_governance_snapshots')) {
        const row = rows.get(values[0])
        return { rows: row && row.owner_id === values[1] ? [row] : [] }
      }
      if (sql === 'SELECT 1') return { rows: [] }
      throw new Error(`Unexpected SQL in fake pool: ${sql}`)
    },
    async end() {},
  }
}

function buildApp(pool, env = {}) {
  return createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: operatorId, ARSY_OPERATOR_TOKEN: operatorToken, ...env },
  })
}

test('governance API rejects unauthenticated requests', async () => {
  const app = buildApp(createFakePool())
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/governance/snapshots' })
    assert.equal(response.statusCode, 401)
  } finally {
    await app.close()
  }
})

test('governance API fails closed when operator identity is not configured', async () => {
  const app = buildApp(createFakePool(), { ARSY_OPERATOR_TOKEN: '', ARSY_OPERATOR_ID: '' })
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/snapshots',
      headers,
    })
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
  } finally {
    await app.close()
  }
})

test('create persists a validated owner-scoped snapshot and read endpoints return it', async () => {
  const pool = createFakePool()
  const app = buildApp(pool)
  try {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/snapshots',
      headers,
      payload: { label: 'x' },
    })
    assert.equal(invalid.statusCode, 400)
    assert.equal(invalid.json().error.code, 'VALIDATION_ERROR')

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/snapshots',
      headers,
      payload: validInput(),
    })
    assert.equal(created.statusCode, 201, created.body)
    const snapshot = created.json().data.snapshot
    assert.equal(snapshot.ownerId, operatorId)
    assert.equal(snapshot.label, 'Route test snapshot')
    assert.equal(snapshot.archivedAt, null)
    assert.ok(snapshot.id)
    assert.deepEqual(snapshot.graph, validInput().graph)

    const list = await app.inject({ method: 'GET', url: '/api/v1/governance/snapshots', headers })
    assert.equal(list.statusCode, 200)
    assert.equal(list.json().data.snapshots.length, 1)
    assert.equal(list.json().data.snapshots[0].id, snapshot.id)

    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/snapshots/${snapshot.id}`,
      headers,
    })
    assert.equal(read.statusCode, 200)
    assert.deepEqual(read.json().data.snapshot.gateInput, validInput().gateInput)

    const badId = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/snapshots/not-a-uuid',
      headers,
    })
    assert.equal(badId.statusCode, 400)

    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/snapshots/${randomUUID()}`,
      headers,
    })
    assert.equal(missing.statusCode, 404)
  } finally {
    await app.close()
  }
})

test('archive is owner-scoped, idempotent and keeps the payload', async () => {
  const pool = createFakePool()
  const app = buildApp(pool)
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/snapshots',
      headers,
      payload: validInput(),
    })
    const id = created.json().data.snapshot.id

    const archived = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/snapshots/${id}/archive`,
      headers,
    })
    assert.equal(archived.statusCode, 200)
    assert.ok(archived.json().data.snapshot.archivedAt)

    const again = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/snapshots/${id}/archive`,
      headers,
    })
    assert.equal(again.statusCode, 200)
    assert.equal(again.json().data.snapshot.archivedAt, archived.json().data.snapshot.archivedAt)
    assert.deepEqual(again.json().data.snapshot.graph, validInput().graph)

    const missing = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/snapshots/${randomUUID()}/archive`,
      headers,
    })
    assert.equal(missing.statusCode, 404)
  } finally {
    await app.close()
  }
})

test('store failures surface as 503 instead of fake success', async () => {
  const app = buildApp(createFakePool({ fail: true }))
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/snapshots',
      headers,
      payload: validInput(),
    })
    assert.equal(created.statusCode, 503)
    assert.equal(created.json().error.code, 'GOVERNANCE_STORE_UNAVAILABLE')
    const list = await app.inject({ method: 'GET', url: '/api/v1/governance/snapshots', headers })
    assert.equal(list.statusCode, 503)
  } finally {
    await app.close()
  }
})
