import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'

const operatorId = 'deployment-route-operator'
const operatorToken = 'deployment-route-test-token-with-more-than-32-bytes'

function createPool(options = {}) {
  const calls = []
  const authorizationRows = []
  const pool = {
    calls,
    authorizationRows,
    async query(sql, values = []) {
      calls.push({ sql, values })
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] }
      if (sql.includes('WITH inserted AS')) {
        return {
          rows: [
            {
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
            },
          ],
        }
      }
      if (sql.includes('JOIN arsy_deployments d')) {
        return {
          rows: [
            {
              operation_id: '20000000-0000-4000-8000-000000000001',
              owner_id: operatorId,
              actor_id: operatorId,
              deployment_id: '10000000-0000-4000-8000-000000000001',
              docker_server_id: '30000000-0000-4000-8000-000000000001',
              kind: 'deploy',
              request_hash: 'b'.repeat(64),
            },
          ],
        }
      }
      if (sql.includes('INSERT INTO arsy_deployment_authorization_decisions')) {
        if (options.failDecisionInsert) throw new Error('simulated authorization evidence failure')
        authorizationRows.push({
          allowed: false,
          reason_codes: ['policy_provider_unavailable'],
          policy_version: null,
          recorded_at: new Date('2026-11-08T10:00:00.000Z'),
        })
        return { rows: [] }
      }
      if (
        sql.includes(
          'SELECT allowed, reason_codes, policy_version, recorded_at FROM arsy_deployment_authorization_decisions'
        )
      ) {
        return { rows: authorizationRows }
      }
      if (sql.includes('INSERT INTO arsy_deployment_outbox')) return { rows: [{ id: values[0] }] }
      if (sql.includes('WITH changed AS')) {
        return {
          rows: [
            {
              id: '20000000-0000-4000-8000-000000000001',
              deployment_id: '10000000-0000-4000-8000-000000000001',
              owner_id: operatorId,
              actor_id: operatorId,
              kind: 'deploy',
              status: 'blocked',
              idempotency_key: 'deployment-route-idempotency',
              request_hash: 'b'.repeat(64),
              request_payload: {
                source: {
                  repository: 'https://github.com/example/app',
                  commit: 'a'.repeat(40),
                  dockerfile: 'Dockerfile',
                },
              },
              attempt_count: 0,
              created_at: new Date('2026-11-08T10:00:00.000Z'),
              updated_at: new Date('2026-11-08T10:00:01.000Z'),
            },
          ],
        }
      }
      throw new Error('Unexpected SQL in deployment-route test')
    },
    async connect() {
      return {
        query: (sql, values = []) => pool.query(sql, values),
        release() {},
      }
    },
    async end() {},
  }
  return pool
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
    assert.deepEqual(response.json().dispatch, {
      outbox: 'not_enqueued',
      worker: 'disabled',
      providerSideEffects: 'not_started',
    })
    assert.equal(
      pool.calls.some((call) =>
        call.sql.includes('INSERT INTO arsy_deployment_authorization_decisions')
      ),
      true
    )
    assert.equal(
      pool.calls.some((call) => call.sql.includes('UPDATE arsy_deployment_operations')),
      true
    )
    assert.equal(
      pool.calls.some((call) => call.sql.includes('INSERT INTO arsy_deployment_outbox')),
      false
    )
    assert.deepEqual(
      pool.calls
        .filter((call) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(call.sql))
        .map((call) => call.sql),
      ['BEGIN', 'COMMIT']
    )
    assert.equal(
      pool.calls.some((call) => call.sql.includes('/containers/')),
      false
    )
  } finally {
    await app.close()
  }
})

test('deployment operation rolls back when authorization evidence cannot be persisted', async () => {
  const pool = createPool({ failDecisionInsert: true })
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
    assert.equal(response.statusCode, 503)
    assert.equal(response.json().error.code, 'DEPLOYMENT_STORE_UNAVAILABLE')
    assert.deepEqual(
      pool.calls
        .filter((call) => ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(call.sql))
        .map((call) => call.sql),
      ['BEGIN', 'ROLLBACK']
    )
    assert.equal(
      pool.calls.some((call) => call.sql.includes('INSERT INTO arsy_deployment_outbox')),
      false
    )
  } finally {
    await app.close()
  }
})


const officialImageRepository = 'ghcr.io/bridge-allah/moonwitness-headquarter'
const officialImageDigest = 'sha256:' + 'a'.repeat(64)
const officialImageReference = officialImageRepository + '@' + officialImageDigest

test('prebuilt deployment intent stores an allowlisted immutable GHCR image without enabling provider side effects', async () => {
  const pool = createPool()
  const app = createTestApp(pool, {
    ARSY_DEPLOYMENT_IMAGE_ALLOWLIST: officialImageRepository,
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
      headers: {
        'x-arsy-operator-token': operatorToken,
        'idempotency-key': 'prebuilt-image-intent-0001',
      },
      payload: { kind: 'deploy', image: officialImageReference },
    })
    assert.equal(response.statusCode, 202)
    assert.equal(response.json().data.status, 'blocked')
    assert.deepEqual(response.json().data.request_payload, { image: officialImageReference })
    assert.equal(response.json().authorization.allowed, false)
    assert.deepEqual(response.json().dispatch, {
      outbox: 'not_enqueued',
      worker: 'disabled',
      providerSideEffects: 'not_started',
    })
    assert.equal(
      pool.calls.some((call) => call.sql.includes('INSERT INTO arsy_deployment_outbox')),
      false
    )
  } finally {
    await app.close()
  }
})

test('prebuilt image deployment fails closed when its trusted allowlist is absent or malformed', async () => {
  for (const allowlist of [
    undefined,
    'ghcr.io/Bridge-ALLAH/moonwitness-headquarter',
    'ghcr.io/bridge-allah/moonwitness-aegis',
    'ghcr.io/bridge-allah/moonwitness-arsy',
  ]) {
    const pool = createPool()
    const app = createTestApp(
      pool,
      allowlist === undefined ? {} : { ARSY_DEPLOYMENT_IMAGE_ALLOWLIST: allowlist }
    )
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
        headers: {
          'x-arsy-operator-token': operatorToken,
          'idempotency-key': 'prebuilt-image-allowlist-0001',
        },
        payload: { kind: 'deploy', image: officialImageReference },
      })
      assert.equal(response.statusCode, 503)
      assert.equal(response.json().error.code, 'DEPLOYMENT_IMAGE_ALLOWLIST_NOT_CONFIGURED')
      assert.equal(pool.calls.length, 0)
    } finally {
      await app.close()
    }
  }
})

test('prebuilt image deployment rejects repositories outside the trusted allowlist before database access', async () => {
  const pool = createPool()
  const app = createTestApp(pool, {
    ARSY_DEPLOYMENT_IMAGE_ALLOWLIST: officialImageRepository,
  })
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
      headers: {
        'x-arsy-operator-token': operatorToken,
        'idempotency-key': 'prebuilt-image-unlisted-0001',
      },
      payload: {
        kind: 'deploy',
        image: 'ghcr.io/bridge-allah/rogue-app@' + officialImageDigest,
      },
    })
    assert.equal(response.statusCode, 400)
    assert.equal(response.json().error.code, 'DEPLOYMENT_IMAGE_NOT_ALLOWLISTED')
    assert.equal(pool.calls.length, 0)
  } finally {
    await app.close()
  }
})

test('prebuilt image deployment rejects tags, non-GHCR registries and non-canonical digests', async () => {
  const invalidImages = [
    'ghcr.io/bridge-allah/moonwitness-headquarter:latest',
    officialImageRepository + '@sha256:' + 'A'.repeat(64),
    'docker.io/bridge-allah/moonwitness-headquarter@' + officialImageDigest,
    officialImageRepository + ':v1.2.0@' + officialImageDigest,
    'ghcr.io/other-owner/moonwitness-headquarter@' + officialImageDigest,
  ]
  for (const image of invalidImages) {
    const pool = createPool()
    const app = createTestApp(pool, {
      ARSY_DEPLOYMENT_IMAGE_ALLOWLIST: officialImageRepository,
    })
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
        headers: {
          'x-arsy-operator-token': operatorToken,
          'idempotency-key': 'prebuilt-image-invalid-0001',
        },
        payload: { kind: 'deploy', image },
      })
      assert.equal(response.statusCode, 400, image)
      assert.equal(pool.calls.length, 0, image)
    } finally {
      await app.close()
    }
  }
})

test('deployment API requires exactly one deploy input and rejects image fields for other operations', async () => {
  const invalidPayloads = [
    { kind: 'deploy' },
    {
      kind: 'deploy',
      source: {
        repository: 'https://github.com/example/app',
        commit: 'a'.repeat(40),
        dockerfile: 'Dockerfile',
      },
      image: officialImageReference,
    },
    { kind: 'stop', image: officialImageReference },
  ]
  for (const payload of invalidPayloads) {
    const pool = createPool()
    const app = createTestApp(pool, {
      ARSY_DEPLOYMENT_IMAGE_ALLOWLIST: officialImageRepository,
    })
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/deployments/10000000-0000-4000-8000-000000000001/operations',
        headers: {
          'x-arsy-operator-token': operatorToken,
          'idempotency-key': 'prebuilt-image-shape-0001',
        },
        payload,
      })
      assert.equal(response.statusCode, 400)
      assert.equal(pool.calls.length, 0)
    } finally {
      await app.close()
    }
  }
})
