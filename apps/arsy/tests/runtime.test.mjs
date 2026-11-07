import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { registerGracefulShutdown } from '../src/index.ts'
import { createDatabasePool } from '../src/db.ts'

function createFakePool({ fail = false } = {}) {
  let closeCount = 0

  return {
    pool: {
      query: async (statement) => {
        if (fail) throw new Error('database unavailable')
        return statement === 'SELECT 1' ? { rows: [{ ok: 1 }] } : { rows: [] }
      },
      end: async () => {
        closeCount += 1
      },
    },
    get closeCount() {
      return closeCount
    },
  }
}

test('application factory is side-effect free and serves liveness', async () => {
  const fake = createFakePool()
  const app = createApp({ databasePool: fake.pool, logger: false })

  try {
    const root = await app.inject({ method: 'GET', url: '/' })
    const live = await app.inject({ method: 'GET', url: '/health/live' })
    assert.equal(root.statusCode, 200)
    assert.equal(root.json().status, 'ok')
    assert.equal(live.statusCode, 200)
    assert.equal(live.json().status, 'alive')
  } finally {
    await app.close()
  }

  assert.equal(fake.closeCount, 1)
})

test('readiness and database health return 503 when PostgreSQL is unavailable', async () => {
  const fake = createFakePool({ fail: true })
  const app = createApp({ databasePool: fake.pool, logger: false })

  try {
    assert.equal((await app.inject('/health/ready')).statusCode, 503)
    assert.equal((await app.inject('/health/db')).statusCode, 503)
  } finally {
    await app.close()
  }
})

test('database health endpoints enforce per-client request limits', async () => {
  for (const endpoint of ['/health/ready', '/health/db']) {
    const fake = createFakePool()
    const app = createApp({ databasePool: fake.pool, logger: false })

    try {
      const responses = []
      for (let index = 0; index < 61; index += 1) {
        responses.push(await app.inject(endpoint))
      }
      assert.equal(responses.slice(0, 60).every((response) => response.statusCode === 200), true)
      assert.equal(responses[60].statusCode, 429)
    } finally {
      await app.close()
    }

    assert.equal(fake.closeCount, 1)
  }
})

test('graceful shutdown signal handlers close the Fastify app and database pool once', async () => {
  const fake = createFakePool()
  const app = createApp({ databasePool: fake.pool, logger: false })
  const handlers = new Map()
  const shutdown = registerGracefulShutdown(app, (signal, handler) => {
    handlers.set(signal, handler)
  })

  assert.deepEqual([...handlers.keys()].sort(), ['SIGINT', 'SIGTERM'])
  await handlers.get('SIGTERM')()
  await shutdown()
  assert.equal(fake.closeCount, 1)
})

test('database pool construction fails closed without DATABASE_URL', () => {
  assert.throws(() => createDatabasePool({}), /DATABASE_URL is required/)
})

test('all versioned commerce APIs fail closed without the operator service token', async () => {
  const fake = createFakePool()
  const app = createApp({ databasePool: fake.pool, logger: false, env: {} })

  try {
    for (const url of ['/api/v1/opportunities', '/api/v1/products', '/api/v1/financial-events']) {
      const response = await app.inject(url)
      assert.equal(response.statusCode, 503, `expected auth configuration failure for ${url}`)
      assert.equal(response.json().error.code, 'OPERATOR_AUTH_NOT_CONFIGURED')
    }
  } finally {
    await app.close()
  }
})

test('financial event API is registered behind the shared operator authorization boundary', async () => {
  const fake = createFakePool()
  const token = 'runtime-test-operator-token'
  const app = createApp({ databasePool: fake.pool, logger: false, env: { ARSY_OPERATOR_ID: 'operator-test', ARSY_OPERATOR_TOKEN: token } })

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/financial-events',
      headers: { 'x-arsy-operator-token': token },
    })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().data, [])
  } finally {
    await app.close()
  }
})
