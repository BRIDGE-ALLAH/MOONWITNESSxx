import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createApp } from '../src/app.ts'
import { createDatabasePool } from '../src/db.ts'

test('shared login throttle is visible across independent ARSY instances and restarts', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `login-throttle-${randomUUID()}`
  const networkHash = createHash('sha256').update(randomUUID()).digest('hex')
  const token = 'integration-only-login-throttle-token'
  const env = { ...process.env, ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }

  let poolA
  let poolB
  let poolC
  let appA
  let appB
  let appC

  const request = (app, action) => app.inject({
    method: 'POST',
    url: '/api/v1/auth/login-attempts',
    headers: { 'x-arsy-operator-token': token },
    payload: { action, networkHash },
  })

  try {
    poolA = createDatabasePool(env)
    poolB = createDatabasePool(env)
    appA = createApp({ databasePool: poolA, logger: false, env })
    appB = createApp({ databasePool: poolB, logger: false, env })
    await Promise.all([appA.ready(), appB.ready()])

    for (let index = 1; index <= 5; index += 1) {
      const failure = await request(appA, 'failure')
      assert.equal(failure.statusCode, 200)
      assert.equal(failure.json().data.allowed, index < 5)
    }

    const blockedOnSecondInstance = await request(appB, 'check')
    assert.equal(blockedOnSecondInstance.statusCode, 200)
    assert.equal(blockedOnSecondInstance.json().data.allowed, false)
    assert.ok(blockedOnSecondInstance.json().data.retryAfterSeconds > 0)

    // Restart the writer instance with a fresh pool. The bucket remains shared
    // because it lives in PostgreSQL rather than process memory.
    await appA.close()
    appA = undefined
    poolA = undefined

    poolC = createDatabasePool(env)
    appC = createApp({ databasePool: poolC, logger: false, env })
    await appC.ready()
    const blockedAfterRestart = await request(appC, 'check')
    assert.equal(blockedAfterRestart.statusCode, 200)
    assert.equal(blockedAfterRestart.json().data.allowed, false)

    const cleared = await request(appC, 'success')
    assert.equal(cleared.statusCode, 200)
    assert.deepEqual(cleared.json().data, { allowed: true, retryAfterSeconds: 0 })

    const allowedAgain = await request(appB, 'check')
    assert.equal(allowedAgain.statusCode, 200)
    assert.equal(allowedAgain.json().data.allowed, true)

    await poolC.query('DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1', [ownerId])
  } finally {
    if (appA) await appA.close()
    else if (poolA) await poolA.end().catch(() => undefined)
    if (appC) await appC.close()
    else if (poolC) await poolC.end().catch(() => undefined)
    if (appB) {
      await poolB.query('DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
      await appB.close()
    } else if (poolB) {
      await poolB.end().catch(() => undefined)
    }
  }
})
