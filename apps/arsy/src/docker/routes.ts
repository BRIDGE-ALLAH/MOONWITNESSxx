import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { decryptDockerCredentials, encryptDockerCredentials, resolveRemoteDockerEndpoint, validateTlsCredentials } from './security.ts'
import { getDockerInfo, getDockerContainerLogs, listDockerContainers, type DockerConnection } from './engine.ts'

type QueryResult<T> = { rows: T[] }
type ServerRow = {
  id: string
  name: string
  kind: 'local' | 'remote'
  endpoint_url: string | null
  encrypted_credentials: string | null
  created_at: string
}

const LOCAL_SOCKET = '/var/run/docker.sock'
const SERVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function localConnection(env: NodeJS.ProcessEnv): DockerConnection {
  const socketPath = env.DOCKER_LOCAL_SOCKET_PATH?.trim() || LOCAL_SOCKET
  if (socketPath !== LOCAL_SOCKET && socketPath !== '/run/docker.sock') {
    throw new Error('DOCKER_LOCAL_SOCKET_PATH must be /var/run/docker.sock or /run/docker.sock')
  }
  return { kind: 'local', socketPath }
}

async function connectionFor(row: ServerRow, env: NodeJS.ProcessEnv): Promise<DockerConnection> {
  if (row.kind === 'local') return localConnection(env)
  if (!row.endpoint_url || !row.encrypted_credentials) throw new Error('Remote Docker TLS configuration is incomplete')
  const resolved = await resolveRemoteDockerEndpoint(row.endpoint_url, env)
  return {
    kind: 'remote',
    endpointUrl: resolved.url.origin,
    addresses: resolved.addresses,
    tls: decryptDockerCredentials(row.encrypted_credentials, env),
  }
}

function safeServer(row: ServerRow) {
  return { id: row.id, name: row.name, kind: row.kind, endpointUrl: row.endpoint_url, createdAt: row.created_at }
}

export function registerDockerRoutes(app: FastifyInstance, pool: DatabasePool, env: NodeJS.ProcessEnv = process.env) {
  app.get('/api/v1/infrastructure/docker/servers', async (_request, reply) => {
    const ownerId = env.ARSY_OPERATOR_ID?.trim()
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_NOT_CONFIGURED' } })
    const result = await pool.query(
      'SELECT id, name, kind, endpoint_url, encrypted_credentials, created_at FROM docker_connector_servers WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId],
    ) as QueryResult<ServerRow>
    return { data: result.rows.map(safeServer) }
  })

  app.post('/api/v1/infrastructure/docker/servers', async (request, reply) => {
    const ownerId = env.ARSY_OPERATOR_ID?.trim()
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_NOT_CONFIGURED' } })
    const body = request.body as Record<string, unknown> | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const kind = body?.kind
    if (!name || name.length > 80 || !['local', 'remote'].includes(String(kind))) {
      return reply.code(400).send({ error: { code: 'INVALID_DOCKER_SERVER', message: 'Name and a supported connection kind are required.' } })
    }

    let connection: DockerConnection
    let endpointUrl: string | null = null
    let encryptedCredentials: string | null = null
    try {
      if (kind === 'local') {
        connection = localConnection(env)
      } else {
        const resolved = await resolveRemoteDockerEndpoint(String(body?.endpointUrl ?? ''), env)
        endpointUrl = resolved.url.origin
        const tls = validateTlsCredentials(body?.tls)
        encryptedCredentials = encryptDockerCredentials(tls, env)
        connection = { kind: 'remote', endpointUrl, addresses: resolved.addresses, tls }
      }
      const info = await getDockerInfo(connection)
      if (!info.ServerVersion) throw new Error('Docker Engine did not return a server version')
    } catch (error) {
      return reply.code(400).send({ error: { code: 'DOCKER_CONNECTION_FAILED', message: error instanceof Error ? error.message : 'Docker connection failed.' } })
    }

    const id = randomUUID()
    const result = await pool.query(
      `WITH inserted AS (
        INSERT INTO docker_connector_servers (id, owner_id, name, kind, endpoint_url, encrypted_credentials)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, kind, endpoint_url, encrypted_credentials, created_at
      ), audit AS (
        INSERT INTO docker_connector_audit_events (owner_id, server_id, action, actor_id)
        SELECT $2, id, 'server.connected', $2 FROM inserted
        RETURNING id
      )
      SELECT id, name, kind, endpoint_url, encrypted_credentials, created_at FROM inserted`,
      [id, ownerId, name, kind, endpointUrl, encryptedCredentials],
    ) as QueryResult<ServerRow>
    return reply.code(201).send({ data: safeServer(result.rows[0]) })
  })

  app.get('/api/v1/infrastructure/docker/servers/:id/info', async (request, reply) => {
    const ownerId = env.ARSY_OPERATOR_ID?.trim()
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_NOT_CONFIGURED' } })
    const { id } = request.params as { id: string }
    if (!SERVER_ID.test(id)) return reply.code(400).send({ error: { code: 'INVALID_SERVER_ID' } })
    const result = await pool.query(
      'SELECT id, name, kind, endpoint_url, encrypted_credentials, created_at FROM docker_connector_servers WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    ) as QueryResult<ServerRow>
    const row = result.rows[0]
    if (!row) return reply.code(404).send({ error: { code: 'DOCKER_SERVER_NOT_FOUND' } })
    try {
      const info = await getDockerInfo(await connectionFor(row, env))
      return { data: { server: safeServer(row), engine: {
        name: info.Name ?? null, serverVersion: info.ServerVersion ?? null,
        operatingSystem: info.OperatingSystem ?? null, architecture: info.Architecture ?? null,
        cpuCount: info.NCPU ?? null, memoryBytes: info.MemTotal ?? null,
      } } }
    } catch {
      return reply.code(502).send({ error: { code: 'DOCKER_ENGINE_UNAVAILABLE', message: 'Docker Engine is unavailable or rejected the connection.' } })
    }
  })

  app.get('/api/v1/infrastructure/docker/servers/:id/containers', async (request, reply) => {
    const ownerId = env.ARSY_OPERATOR_ID?.trim()
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_NOT_CONFIGURED' } })
    const { id } = request.params as { id: string }
    if (!SERVER_ID.test(id)) return reply.code(400).send({ error: { code: 'INVALID_SERVER_ID' } })
    const result = await pool.query(
      'SELECT id, name, kind, endpoint_url, encrypted_credentials, created_at FROM docker_connector_servers WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    ) as QueryResult<ServerRow>
    const row = result.rows[0]
    if (!row) return reply.code(404).send({ error: { code: 'DOCKER_SERVER_NOT_FOUND' } })
    try {
      const containers = await listDockerContainers(await connectionFor(row, env))
      return { data: { containers, truncated: containers.length === 100 } }
    } catch {
      return reply.code(502).send({ error: { code: 'DOCKER_ENGINE_UNAVAILABLE', message: 'Docker container inventory is unavailable.' } })
    }
  })

  app.get('/api/v1/infrastructure/docker/servers/:id/containers/:containerId/logs', async (request, reply) => {
    const ownerId = env.ARSY_OPERATOR_ID?.trim()
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_NOT_CONFIGURED' } })
    const { id, containerId } = request.params as { id: string; containerId: string }
    if (!SERVER_ID.test(id)) return reply.code(400).send({ error: { code: 'INVALID_SERVER_ID' } })
    if (!/^[a-f0-9]{12,64}$/i.test(containerId)) {
      return reply.code(400).send({ error: { code: 'INVALID_CONTAINER_ID' } })
    }
    const result = await pool.query(
      'SELECT id, name, kind, endpoint_url, encrypted_credentials, created_at FROM docker_connector_servers WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    ) as QueryResult<ServerRow>
    const row = result.rows[0]
    if (!row) return reply.code(404).send({ error: { code: 'DOCKER_SERVER_NOT_FOUND' } })
    try {
      const logs = await getDockerContainerLogs(await connectionFor(row, env), containerId)
      return { data: { containerId, logs, tail: 200 } }
    } catch {
      return reply.code(502).send({ error: { code: 'DOCKER_LOGS_UNAVAILABLE', message: 'Container logs are unavailable.' } })
    }
  })
}
