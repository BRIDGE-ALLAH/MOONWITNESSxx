import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const operatorId = 'deployment-route-operator'
const operatorToken = 'deployment-route-test-token-with-more-than-32-bytes'

function createPool() {
  const calls = []
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values })
      if (sql.includes('WITH inserted AS')) {
        return { rows: [{
          id: '20000000-0000-4000-8000-000000000001',
          deployment_id: '10000000-0000-4000-8000-000000000001',
          owner_id: operatorId,
          actor_id: operatorId,
          kind: 'deploy',
          status: 'queued',
          idempotency_key: values[5],
          request_hash: values[6],
          request_payload: JSON.parse(values[7]),
          attempt_count: 0,
          created_at: new Date('2026-11-08T10:00:00.000Z'),
          updated_at: new Date('2026-11-08T10:00:00.000Z'),
        }] }
      }
      if (sql.includes('JOIN arsy_deployments d')) {
        return { rows: [{
          operation_id: '20000000-0000-4000-8000-000000000001',
          owner_id: operatorId,
          actor_id: operatorId,
          deployment_id: '10000000-0000-4000-8000-000000000001',
          docker_server_id: '30000000-0000-4000-8000-000000000001',
          kind: 'deploy',
          request_hash: 'b'.repeat(64),
        }] }
      }
      if (sql.includes('INSERT INTO arsy_deployment_authorization_decisions')) return { rows: [] }
      if (sql.includes('WITH changed AS')) {
        return { rows: [{
          id: '20000000-0000-4000-8000-000000000001',
          deployment_id: '10000000-0000-4000-8000-000000000001',
          owner_id: operatorId,
          actor_id: operatorId,
          kind: 'deploy',
          status: 'blocked',
          idempotency_key: 'deployment-route-idempotency',
          request_hash: 'b'.repeat(64),
          request_payload: { source: { repository: 'https://github.com/example/app', commit: 'a'.repeat(40), dockerfile: 'Dockerfile' } },
          attempt_count: 0,
          created_at: new Date('2026-11-08T10:00:00.000Z'),
          updated_at: new Date('2026-11-08T10:00:01.000Z'),
        }] }
      }
      throw new Error('Unexpected SQL in deployment-route test')
    },
    async end() {},
  }
}

function createTestApp(pool, env = {}) {
  return createApp({
    databasePool: pool,
    logger: false,
    env: {
      ARSY_OPERATOR_ID: operatorId,
      ARSY_OPERATOR_TOKEN: operatorToken,
      ...env,
    },
  })
}

test('deployment operation API requires the authenticated ARSY principal', async () => {
  const pool = createPool()
  const app = createTestApp(pool)
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
      payload: { kind: 'deploy' },
    })
    assert.equal(response.statusCode, 401)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('deployment API rejects caller-supplied actor and owner fields', async () => {
  const pool = createPool()
  const app = createTestApp(pool)
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments',
      headers: { 'x-arsy-operator-token': operatorToken },
      payload: {
        dockerServerId: '30000000-0000-4000-8000-000000000001',
        name: 'forged-owner',
        ownerId: 'another-operator',
        actorId: 'another-operator',
      },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('deploy requests are recorded durably but fail closed when policy provider is absent', async () => {
  const pool = createPool()
  const app = createTestApp(pool)
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
      headers: {
        'x-arsy-operator-token': operatorToken,
        'idempotency-key': 'deployment-route-idempotency',
      },
      payload: {
        kind: 'deploy',
        source: {
          repository: 'https://github.com/example/app',
          commit: 'a'.repeat(40),
          dockerfile: 'Dockerfile',
        },
      },
    })
    assert.equal(response.statusCode, 202)
    assert.equal(response.json().data.status, 'blocked')
    assert.equal(response.json().authorization.allowed, false)
    assert.deepEqual(response.json().authorization.reasonCodes, ['policy_provider_unavailable'])
    assert.equal(response.json().dispatch.workerEnabled, false)
    assert.equal(pool.calls.some((call) => call.sql.includes('INSERT INTO arsy_deployment_authorization_decisions')), true)
    assert.equal(pool.calls.some((call) => call.sql.includes('UPDATE arsy_deployment_operations')), true)
    assert.equal(pool.calls.some((call) => call.sql.includes('/containers/')), false)
  } finally {
    await app.close()
  }
})
