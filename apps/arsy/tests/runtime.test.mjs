import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { registerGracefulShutdown } from '../src/index.ts'
import { createDatabasePool } from '../src/db.ts'

function createFakePool({ fail = false } = {}) {
  let closeCount = 0

  return {
    pool: {
      query: async () => {
        if (fail) throw new Error('database unavailable')
        return { rows: [{ ok: 1 }] }
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
