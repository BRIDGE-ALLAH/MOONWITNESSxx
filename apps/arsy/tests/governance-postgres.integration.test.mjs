import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createApp } from '../src/app.ts'
import { applyTestMigrations } from './helpers/apply-migrations.mjs'

const databaseUrl = process.env.TEST_DATABASE_URL

test(
  'governance snapshots persist, stay owner-scoped and survive an application restart',
  {
    skip:
      !databaseUrl &&
      'TEST_DATABASE_URL is not configured; run in the Docker connector PostgreSQL CI job',
  },
  async () => {
    const migrationPool = new Pool({ connectionString: databaseUrl, max: 1 })
    const migration = await readFile(
      new URL('../migrations/008_governance_snapshots.sql', import.meta.url),
      'utf8'
    )
    await applyTestMigrations(migrationPool, [migration, migration])
    await migrationPool.end()

    const ownerId = `governance-owner-${randomUUID()}`
    const otherOwnerId = `governance-owner-${randomUUID()}`
    const token = `governance-token-${randomUUID()}-${randomUUID()}`
    const otherToken = `governance-token-${randomUUID()}-${randomUUID()}`
    const headers = { 'x-arsy-operator-token': token }
    const otherHeaders = { 'x-arsy-operator-token': otherToken }
    const timestamp = '2026-11-08T00:00:00.000Z'
    const input = {
      label: 'Integration review snapshot',
      graph: {
        id: 'graph-integration',
        version: 1,
        createdAt: timestamp,
        nodes: [
          { id: 'd1', kind: 'decision', label: 'Approve preparation', createdAt: timestamp },
          { id: 'e1', kind: 'evidence', label: 'Policy source', createdAt: timestamp },
        ],
        edges: [{ id: 'edge-1', from: 'e1', to: 'd1', relation: 'supports' }],
      },
      gateInput: {
        metrics: [
          {
            id: 'm1',
            label: 'Throughput',
            low: 10,
            base: 12,
            high: 15,
            unit: 'items',
            sourceQuality: 'estimated',
          },
        ],
        requiredEvidenceCount: 2,
        verifiedEvidenceCount: 1,
        staleEvidenceCount: 0,
        contradictionCount: 0,
        unresolvedAssumptionCount: 0,
      },
      scenarioBaseline: [{ id: 'm1', label: 'Throughput', value: 12, unit: 'items' }],
      scenario: {
        id: 's1',
        title: 'Capacity gain',
        basedOnSnapshotId: 'graph-integration',
        assumptions: ['Capacity improves'],
        operations: [
          {
            id: 'o1',
            metricId: 'm1',
            operation: 'multiply',
            operand: 1.05,
            rationale: 'Model capacity gain',
          },
        ],
      },
    }

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
    let snapshotId

    try {
      assert.equal(
        (await app.inject({ method: 'GET', url: '/api/v1/governance/snapshots' })).statusCode,
        401
      )

      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/governance/snapshots',
        headers,
        payload: input,
      })
      assert.equal(created.statusCode, 201, created.body)
      const snapshot = created.json().data.snapshot
      snapshotId = snapshot.id
      assert.equal(snapshot.ownerId, ownerId)
      assert.deepEqual(snapshot.graph, input.graph)
      assert.deepEqual(snapshot.gateInput, input.gateInput)

      const forgedOwner = await app.inject({
        method: 'POST',
        url: '/api/v1/governance/snapshots',
        headers,
        payload: { ...input, ownerId: 'attacker-controlled-owner' },
      })
      assert.equal(forgedOwner.statusCode, 400)

      const list = await app.inject({ method: 'GET', url: '/api/v1/governance/snapshots', headers })
      assert.equal(list.statusCode, 200)
      assert.ok(list.json().data.snapshots.some((item) => item.id === snapshotId))

      const otherList = await otherApp.inject({
        method: 'GET',
        url: '/api/v1/governance/snapshots',
        headers: otherHeaders,
      })
      assert.equal(otherList.statusCode, 200)
      assert.ok(!otherList.json().data.snapshots.some((item) => item.id === snapshotId))

      const otherRead = await otherApp.inject({
        method: 'GET',
        url: `/api/v1/governance/snapshots/${snapshotId}`,
        headers: otherHeaders,
      })
      assert.equal(otherRead.statusCode, 404)
      const otherArchive = await otherApp.inject({
        method: 'POST',
        url: `/api/v1/governance/snapshots/${snapshotId}/archive`,
        headers: otherHeaders,
      })
      assert.equal(otherArchive.statusCode, 404)

      const archived = await app.inject({
        method: 'POST',
        url: `/api/v1/governance/snapshots/${snapshotId}/archive`,
        headers,
      })
      assert.equal(archived.statusCode, 200)
      assert.ok(archived.json().data.snapshot.archivedAt)
    } finally {
      await app.close()
      await otherApp.close()
    }

    const restartPool = new Pool({ connectionString: databaseUrl, max: 2 })
    const restartedApp = createApp({
      databasePool: restartPool,
      logger: false,
      env: { ARSY_OPERATOR_ID: ownerId, ARSY_OPERATOR_TOKEN: token },
    })
    try {
      const read = await restartedApp.inject({
        method: 'GET',
        url: `/api/v1/governance/snapshots/${snapshotId}`,
        headers,
      })
      assert.equal(read.statusCode, 200)
      const persisted = read.json().data.snapshot
      assert.deepEqual(persisted.graph, input.graph)
      assert.deepEqual(persisted.scenarioBaseline, input.scenarioBaseline)
      assert.deepEqual(persisted.scenario, input.scenario)
      assert.ok(persisted.archivedAt)
    } finally {
      await restartedApp.close()
      const cleanupPool = new Pool({ connectionString: databaseUrl, max: 1 })
      await cleanupPool.query(
        'DELETE FROM arsy_governance_snapshots WHERE owner_id = $1 OR owner_id = $2',
        [ownerId, otherOwnerId]
      )
      await cleanupPool.end()
    }
  }
)
