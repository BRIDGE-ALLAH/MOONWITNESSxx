import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../src/app.ts'
import { getListenConfig } from '../src/index.ts'

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

test('liveness and root routes respond without exposing database details', async () => {
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

test('readiness and database health require a successful database query', async () => {
  const fake = createFakePool()
  const app = createApp({ databasePool: fake.pool, logger: false })

  try {
    assert.equal((await app.inject('/health/ready')).statusCode, 200)
    assert.equal((await app.inject('/health/db')).statusCode, 200)
  } finally {
    await app.close()
  }
})

test('database failures return 503 and Fastify closes the pool exactly once', async () => {
  const fake = createFakePool({ fail: true })
  const app = createApp({ databasePool: fake.pool, logger: false })

  try {
    assert.equal((await app.inject('/health/ready')).statusCode, 503)
    assert.equal((await app.inject('/health/db')).statusCode, 503)
  } finally {
    await app.close()
  }

  assert.equal(fake.closeCount, 1)
})

test('listen configuration defaults to loopback and rejects invalid ports', () => {
  assert.deepEqual(getListenConfig({}), { host: '127.0.0.1', port: 3001 })
  assert.deepEqual(getListenConfig({ HOST: '0.0.0.0', PORT: '3210' }), {
    host: '0.0.0.0',
    port: 3210,
  })
  assert.throws(() => getListenConfig({ PORT: 'not-a-port' }), /PORT must be/)
  assert.throws(() => getListenConfig({ PORT: '70000' }), /PORT must be/)
})
