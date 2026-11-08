import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { createApp } from '../src/app.ts'
import { randomUUID } from 'node:crypto'
import { applyTestMigrations } from './helpers/apply-migrations.mjs'

const databaseUrl = process.env.TEST_DATABASE_URL

test(
  'Docker connector migration is repeatable and persists owner-scoped metadata and audit events',
  {
    skip:
      !databaseUrl &&
      'TEST_DATABASE_URL is not configured; run in the Docker connector PostgreSQL CI job',
  },
  async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 2 })
    const id = randomUUID()
    const ownerId = `docker-ci-${id}`
    try {
      const migration = await readFile(
        new URL('../migrations/002_docker_connector.sql', import.meta.url),
        'utf8'
      )
      await applyTestMigrations(pool, [migration, migration])
      await pool.query(
        'INSERT INTO docker_connector_servers (id, owner_id, name, kind, endpoint_url, encrypted_credentials) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, ownerId, 'CI remote', 'remote', 'https://docker.example.com:2376', 'iv.tag.ciphertext']
      )
      await pool.query(
        'INSERT INTO docker_connector_audit_events (owner_id, server_id, action, actor_id) VALUES ($1,$2,$3,$4)',
        [ownerId, id, 'server.connected', ownerId]
      )
      const ownerRows = await pool.query(
        'SELECT id, encrypted_credentials FROM docker_connector_servers WHERE id = $1 AND owner_id = $2',
        [id, ownerId]
      )
      const otherOwnerRows = await pool.query(
        'SELECT id FROM docker_connector_servers WHERE id = $1 AND owner_id = $2',
        [id, 'different-owner']
      )
      const audit = await pool.query(
        'SELECT action FROM docker_connector_audit_events WHERE server_id = $1 AND owner_id = $2',
        [id, ownerId]
      )
      assert.equal(ownerRows.rowCount, 1)
      assert.equal(ownerRows.rows[0].encrypted_credentials, 'iv.tag.ciphertext')
      assert.equal(otherOwnerRows.rowCount, 0)
      assert.equal(audit.rows[0].action, 'server.connected')
      await assert.rejects(
        pool.query('UPDATE docker_connector_audit_events SET action = $1 WHERE server_id = $2', [
          'tampered',
          id,
        ]),
        /append-only/
      )
      await assert.rejects(
        pool.query('DELETE FROM docker_connector_audit_events WHERE server_id = $1', [id]),
        /append-only/
      )
    } finally {
      await pool.end()
    }
  }
)

test(
  'real ARSY Docker API persists an Engine connection and immutable audit event in PostgreSQL',
  {
    skip:
      (!databaseUrl || process.env.DOCKER_SMOKE_SOCKET !== '1') &&
      'Requires disposable PostgreSQL and a real Docker Engine in CI',
  },
  async () => {
    const ownerId = `docker-e2e-${randomUUID()}`
    const operatorToken = `test-${randomUUID()}-${randomUUID()}`
    const pool = new Pool({ connectionString: databaseUrl, max: 2 })
    const app = createApp({
      databasePool: pool,
      logger: false,
      env: {
        ARSY_OPERATOR_ID: ownerId,
        ARSY_OPERATOR_TOKEN: operatorToken,
        DOCKER_LOCAL_SOCKET_PATH: process.env.DOCKER_LOCAL_SOCKET_PATH || '/var/run/docker.sock',
      },
    })
    const headers = { 'x-arsy-operator-token': operatorToken }
    let serverId
    try {
      const registered = await app.inject({
        method: 'POST',
        url: '/api/v1/infrastructure/docker/servers',
        headers,
        payload: { name: 'PostgreSQL Docker E2E', kind: 'local' },
      })
      assert.equal(registered.statusCode, 201, registered.body)
      serverId = registered.json().data.id
      const persisted = await pool.query(
        'SELECT id, owner_id, kind, encrypted_credentials FROM docker_connector_servers WHERE id = $1 AND owner_id = $2',
        [serverId, ownerId]
      )
      assert.equal(persisted.rowCount, 1)
      assert.equal(persisted.rows[0].kind, 'local')
      assert.equal(persisted.rows[0].encrypted_credentials, null)
      const audit = await pool.query(
        'SELECT action, actor_id FROM docker_connector_audit_events WHERE server_id = $1 AND owner_id = $2',
        [serverId, ownerId]
      )
      assert.equal(audit.rowCount, 1)
      assert.equal(audit.rows[0].action, 'server.connected')
      assert.equal(audit.rows[0].actor_id, ownerId)
      const serverList = await app.inject({
        method: 'GET',
        url: '/api/v1/infrastructure/docker/servers',
        headers,
      })
      assert.equal(serverList.statusCode, 200, serverList.body)
      assert.ok(Array.isArray(serverList.json().data))
      assert.equal(
        serverList.json().data.some((server) => server.id === serverId),
        true
      )
      const info = await app.inject({
        method: 'GET',
        url: `/api/v1/infrastructure/docker/servers/${serverId}/info`,
        headers,
      })
      assert.equal(info.statusCode, 200, info.body)
      assert.ok(info.json().data.engine.serverVersion)
      const inventory = await app.inject({
        method: 'GET',
        url: `/api/v1/infrastructure/docker/servers/${serverId}/containers`,
        headers,
      })
      assert.equal(inventory.statusCode, 200, inventory.body)
      assert.ok(Array.isArray(inventory.json().data.containers))
      assert.ok(inventory.json().data.containers.length <= 100)
    } finally {
      await app.close()
    }
  }
)
