import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createApp } from '../src/app.ts'
import { PostgresEvidenceStore } from '../src/evidence/postgres-store.ts'
import { applyTestMigrations } from './helpers/apply-migrations.mjs'

const databaseUrl = process.env.TEST_DATABASE_URL

test('authenticated ARSY evidence API persists, scopes and verifies append-only streams across restart', {
  skip: !databaseUrl && 'TEST_DATABASE_URL is not configured; run in the Docker connector PostgreSQL CI job',
}, async () => {
  const migrationPool = new Pool({ connectionString: databaseUrl, max: 1 })
  const migration = await readFile(new URL('../migrations/001_arsy_evidence_events.sql', import.meta.url), 'utf8')
  const appendOnlyMigration = await readFile(new URL('../migrations/007_arsy_evidence_events_append_only.sql', import.meta.url), 'utf8')
  await applyTestMigrations(migrationPool, [migration, appendOnlyMigration, migration, appendOnlyMigration])
  await migrationPool.end()

  const ownerId = `evidence-owner-${randomUUID()}`
  const otherOwnerId = `evidence-owner-${randomUUID()}`
  const token = `evidence-token-${randomUUID()}-${randomUUID()}`
  const otherToken = `evidence-token-${randomUUID()}-${randomUUID()}`
  const aggregateId = `case-${randomUUID()}`
  const headers = { 'x-arsy-operator-token': token }
  const otherHeaders = { 'x-arsy-operator-token': otherToken }
  const pool = new Pool({ connectionString: databaseUrl, max: 3 })
  const app = createApp({
    databasePool: pool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  const otherPool = new Pool({ connectionString: databaseUrl, max: 2 })
  const otherApp = createApp({
    databasePool: otherPool,
    logger: false,
    env: { ARSY_OPERATOR_ID: otherOwnerId, ARSY_OPERATOR_TOKEN: otherToken },
  })

  const replicaPool = new Pool({ connectionString: databaseUrl, max: 2 })
  const replicaApp = createApp({
    databasePool: replicaPool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })

  const eventInput = {
    id: `event-${randomUUID()}`,
    kind: 'observation.recorded',
    occurredAt: '2026-11-08T08:00:00.000Z',
    payload: { content: { source: 'paper:example', page: 4 } },
    evidenceIds: ['source:paper-example'],
  }
  const eventsUrl = `/api/v1/evidence/streams/${aggregateId}/events`
  let restartedApp

  try {
    assert.equal((await app.inject({ method: 'GET', url: eventsUrl })).statusCode, 401)

    const forgedActor = await app.inject({
      method: 'POST',
      url: eventsUrl,
      headers,
      payload: { ...eventInput, actorId: 'attacker-controlled-actor' },
    })
    assert.equal(forgedActor.statusCode, 400)

    const created = await app.inject({ method: 'POST', url: eventsUrl, headers, payload: eventInput })
    assert.equal(created.statusCode, 201, created.body)
    const event = created.json().data.event
    assert.equal(event.actorId, ownerId)
    assert.equal(event.aggregateId, aggregateId)
    assert.equal(event.previousHash, null)

    const replay = await app.inject({ method: 'POST', url: eventsUrl, headers, payload: eventInput })
    assert.equal(replay.statusCode, 200, replay.body)
    assert.equal(replay.json().data.disposition, 'replayed')
    assert.equal(replay.json().data.event.hash, event.hash)

    const conflictingRetry = await app.inject({
      method: 'POST',
      url: eventsUrl,
      headers,
      payload: { ...eventInput, payload: { content: { source: 'different-source' } } },
    })
    assert.equal(conflictingRetry.statusCode, 409)

    const listed = await app.inject({ method: 'GET', url: eventsUrl, headers })
    assert.equal(listed.statusCode, 200, listed.body)
    assert.equal(listed.json().data.events.length, 1)
    assert.equal(listed.json().data.events[0].hash, event.hash)

    const verified = await app.inject({
      method: 'GET',
      url: `/api/v1/evidence/streams/${aggregateId}/verify`,
      headers,
    })
    assert.equal(verified.statusCode, 200, verified.body)
    assert.equal(verified.json().data.valid, true)

    const persisted = await pool.query(
      'SELECT aggregate_id, actor_id FROM arsy_evidence_events WHERE event_hash = $1',
      [event.hash],
    )
    assert.equal(persisted.rowCount, 1)
    assert.equal(persisted.rows[0].actor_id, ownerId)
    assert.notEqual(persisted.rows[0].aggregate_id, aggregateId)
    await assert.rejects(
      pool.query('UPDATE arsy_evidence_events SET actor_id = $1 WHERE event_hash = $2', ['tampered', event.hash]),
      /append-only/,
    )
    await assert.rejects(
      pool.query('DELETE FROM arsy_evidence_events WHERE event_hash = $1', [event.hash]),
      /append-only/,
    )
    await assert.rejects(pool.query('TRUNCATE TABLE arsy_evidence_events'), /append-only/)

    const parallelInput = {
      ...eventInput,
      id: `parallel-event-${randomUUID()}`,
      payload: { content: { source: 'concurrent-identical-retry' } },
    }
    const [parallelA, parallelB] = await Promise.all([
      app.inject({ method: 'POST', url: eventsUrl, headers, payload: parallelInput }),
      replicaApp.inject({ method: 'POST', url: eventsUrl, headers, payload: parallelInput }),
    ])
    assert.deepEqual([parallelA.statusCode, parallelB.statusCode].sort(), [200, 201])
    assert.equal(parallelA.json().data.event.hash, parallelB.json().data.event.hash)
    assert.equal(parallelA.json().data.event.hash, (await app.inject({ method: 'GET', url: eventsUrl, headers })).json().data.events[1].hash)

    const otherOwnerRead = await otherApp.inject({ method: 'GET', url: eventsUrl, headers: otherHeaders })
    assert.equal(otherOwnerRead.statusCode, 200)
    assert.equal(otherOwnerRead.json().data.events.length, 0)

    const otherOwnerWrite = await otherApp.inject({
      method: 'POST',
      url: eventsUrl,
      headers: otherHeaders,
      payload: { ...eventInput, payload: { content: { source: 'other-operator' } } },
    })
    assert.equal(otherOwnerWrite.statusCode, 201, otherOwnerWrite.body)

    const originalOwnerRead = await app.inject({ method: 'GET', url: eventsUrl, headers })
    assert.equal(originalOwnerRead.json().data.events.length, 2)

    const staleStore = new PostgresEvidenceStore(pool, ownerId)
    await assert.rejects(
      () => staleStore.append({
        ...event,
        id: `stale-${randomUUID()}`,
        previousHash: null,
        hash: 'f'.repeat(64),
      }),
      /stream head changed/,
    )
  } finally {
    await replicaApp.close()
    await otherApp.close()
    await app.close()
  }

  const restartedPool = new Pool({ connectionString: databaseUrl, max: 2 })
  restartedApp = createApp({
    databasePool: restartedPool,
    logger: false,
    env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
  })
  try {
    const afterRestart = await restartedApp.inject({ method: 'GET', url: eventsUrl, headers })
    assert.equal(afterRestart.statusCode, 200, afterRestart.body)
    assert.equal(afterRestart.json().data.events.length, 2)
    assert.equal(afterRestart.json().data.events[0].actorId, ownerId)
    const afterRestartVerify = await restartedApp.inject({
      method: 'GET',
      url: `/api/v1/evidence/streams/${aggregateId}/verify`,
      headers,
    })
    assert.equal(afterRestartVerify.json().data.valid, true)
  } finally {
    await restartedApp.close()
  }
})
