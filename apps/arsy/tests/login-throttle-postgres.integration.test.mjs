import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createDatabasePool } from '../src/db.ts'
import { createApp } from '../src/app.ts'

test('PostgreSQL login throttle is shared across two ARSY instances and clears on success', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const ownerId = `login-throttle-integration-${randomUUID()}`
  const token = 'integration-only-arsy-service-token'
  const networkHash = 'a'.repeat(64)
  const env = { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token }
  const poolA = createDatabasePool()
  const poolB = createDatabasePool()
  const appA = await createApp({ databasePool: poolA, logger: false, env })
  const appB = await createApp({ databasePool: poolB, logger: false, env })
  const headers = { 'x-arsy-operator-token': token }
  const send = (app, action, hash = networkHash) => app.inject({
    method: 'POST',
    url: '/api/v1/auth/login-attempts',
    headers,
    payload: { action, networkHash: hash },
  })

  try {
    const migration = await readFile(new URL('../migrations/006_shared_login_attempts.sql', import.meta.url), 'utf8')
    await poolA.query(migration)

    assert.equal((await send(appA, 'check')).json().data.allowed, true)
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failure = await send(appA, 'failure')
      assert.equal(failure.statusCode, 200)
      assert.equal(failure.json().data.allowed, true)
    }

    const fifthFailure = await send(appB, 'failure')
    assert.equal(fifthFailure.statusCode, 200)
    assert.equal(fifthFailure.json().data.allowed, false)
    assert.ok(fifthFailure.json().data.retryAfterSeconds > 0)
    assert.equal((await send(appA, 'check')).json().data.allowed, false)

    // Account bucket applies even when the network identity changes.
    assert.equal((await send(appA, 'check', 'b'.repeat(64))).json().data.allowed, false)

    // Expire the window and prove a new attempt starts a fresh counter.
    await poolA.query(
      "UPDATE arsy_login_attempt_buckets SET window_started_at = now() - interval '16 minutes', blocked_until = NULL WHERE owner_id = $1",
      [ownerId],
    )
    assert.equal((await send(appA, 'check')).json().data.allowed, true)
    assert.equal((await send(appA, 'failure')).json().data.allowed, true)
    for (let attempt = 0; attempt < 4; attempt += 1) await send(appA, 'failure')
    assert.equal((await send(appB, 'check')).json().data.allowed, false)

    const success = await send(appB, 'success')
    assert.equal(success.json().data.allowed, true)
    assert.equal((await send(appA, 'check')).json().data.allowed, true)
  } finally {
    await poolA.query('DELETE FROM arsy_login_attempt_buckets WHERE owner_id = $1', [ownerId]).catch(() => undefined)
    await appA.close()
    await appB.close()
  }
})
