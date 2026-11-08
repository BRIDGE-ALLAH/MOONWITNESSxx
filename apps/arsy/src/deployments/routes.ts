import { z } from 'zod'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getArsyOperatorPrincipal } from '../auth/operator-token.ts'
import type { DatabasePool } from '../db.ts'
import {
  authorizeDeploymentOperation,
  createEd25519CapabilityVerifier,
  createTrustedPublicKeyring,
  PostgresDeploymentAuthorizationStore,
  type AuthorizeDeploymentDependencies,
} from './authorization.ts'
import {
  createDeployment,
  createDeploymentOperation,
  enqueueDeploymentOperation,
  IdempotencyConflictError,
  OperationStateConflictError,
  transitionDeploymentOperation,
} from './operation-store.ts'
import type { JsonObject, DeploymentOperationKind, DeploymentOperationStatus } from './contracts.ts'

type QueryResult<T> = { rows: T[] }

interface DeploymentRouteOptions {
  authorization?: Omit<AuthorizeDeploymentDependencies, 'store'>
  env?: NodeJS.ProcessEnv
}

interface DeploymentRow {
  id: string
  owner_id: string
  docker_server_id: string
  name: string
  desired_image_digest: string | null
  desired_config: JsonObject
  status: string
  created_by: string
  created_at: Date | string
  updated_at: Date | string
}

interface OperationRow {
  id: string
  deployment_id: string
  owner_id: string
  actor_id: string
  kind: DeploymentOperationKind
  status: DeploymentOperationStatus
  idempotency_key: string
  request_hash: string
  request_payload: JsonObject
  attempt_count: number
  error_code: string | null
  result: JsonObject | null
  created_at: Date | string
  updated_at: Date | string
  started_at: Date | string | null
  completed_at: Date | string | null
}

interface EventRow {
  operation_id: string
  sequence: string | number
  event_type: string
  from_status: string | null
  to_status: string
  actor_id: string
  details: JsonObject
  occurred_at: Date | string
}

interface AuthorizationRow {
  allowed: boolean
  reason_codes: string[] | string
  policy_version: string | null
  recorded_at: Date | string
}

const UUID = z.string().uuid()
const sourceSchema = z
  .object({
    repository: z.string().min(1).max(300),
    commit: z.string().regex(/^[a-fA-F0-9]{40,64}$/),
    dockerfile: z.string().min(1).max(240),
  })
  .strict()
  .superRefine((source, context) => {
    let repository: URL
    try {
      repository = new URL(source.repository)
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['repository'],
        message: 'Repository must be a canonical HTTPS GitHub URL',
      })
      return
    }
    if (
      repository.protocol !== 'https:' ||
      repository.hostname !== 'github.com' ||
      repository.username ||
      repository.password ||
      repository.search ||
      repository.hash ||
      !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(repository.pathname)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['repository'],
        message: 'Only canonical HTTPS GitHub owner/repository URLs are supported',
      })
    }
    const path = source.dockerfile
    if (
      path.startsWith('/') ||
      path.includes('\\') ||
      path.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
      path.split('/').some((segment) => !/^[A-Za-z0-9_.-]+$/.test(segment))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dockerfile'],
        message: 'Dockerfile path must be a normalized repository-relative path',
      })
    }
  })

const createDeploymentSchema = z
  .object({
    dockerServerId: UUID,
    name: z.string().trim().min(1).max(80),
    desiredConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const createOperationSchema = z
  .object({
    kind: z.enum(['deploy', 'stop', 'restart', 'rollback']),
    source: sourceSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === 'deploy' && !value.source) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message: 'A deploy operation requires an immutable Git commit and Dockerfile path',
      })
    }
    if (value.kind !== 'deploy' && value.source) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message: 'Source builds are only valid for deploy operations',
      })
    }
  })

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    before: z.string().datetime().optional(),
  })
  .strict()

const eventQuerySchema = z
  .object({
    after: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

function queryRows<T>(value: unknown): T[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as QueryResult<T>).rows)) {
    throw new Error('Deployment API database query returned an invalid result')
  }
  return (value as QueryResult<T>).rows
}

function principalScope(request: FastifyRequest) {
  return getArsyOperatorPrincipal(request)
}

function serializeAuthorization(row: AuthorizationRow | undefined) {
  if (!row) return null
  let reasons = row.reason_codes
  if (typeof reasons === 'string') {
    try {
      reasons = JSON.parse(reasons) as string[]
    } catch {
      reasons = []
    }
  }
  return {
    allowed: row.allowed === true,
    reasonCodes: Array.isArray(reasons)
      ? reasons.filter((value): value is string => typeof value === 'string')
      : [],
    policyVersion: row.policy_version,
    recordedAt: row.recorded_at,
  }
}

function statusCodeForError(error: unknown): number {
  if (error instanceof IdempotencyConflictError || error instanceof OperationStateConflictError)
    return 409
  if (error instanceof TypeError || error instanceof z.ZodError) return 400
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null
  if (code === '23503' || code === 'P0002') return 404
  if (code === '23505') return 409
  return 503
}

function safeErrorCode(error: unknown): string {
  if (error instanceof IdempotencyConflictError) return 'IDEMPOTENCY_CONFLICT'
  if (error instanceof OperationStateConflictError) return 'OPERATION_STATE_CONFLICT'
  if (error instanceof TypeError || error instanceof z.ZodError) return 'VALIDATION_ERROR'
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null
  if (code === '23503' || code === 'P0002') return 'DEPLOYMENT_NOT_FOUND'
  if (code === '23505') return 'DEPLOYMENT_CONFLICT'
  return 'DEPLOYMENT_STORE_UNAVAILABLE'
}

export function registerDeploymentRoutes(
  app: FastifyInstance,
  pool: DatabasePool,
  options: DeploymentRouteOptions = {}
): void {
  const authorizationDependencies = options.authorization ?? {}
  const publicKeys = createTrustedPublicKeyring(
    (options.env ?? process.env).ARSY_DEPLOYMENT_TRUSTED_PUBLIC_KEYS
  )
  const capabilityVerifier =
    authorizationDependencies.capabilityVerifier ?? createEd25519CapabilityVerifier(publicKeys)
  const approvalKeyring = authorizationDependencies.approvalKeyring ?? publicKeys

  app.get('/api/v1/deployments', async (request, reply) => {
    const principal = principalScope(request)
    if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    const parsed = listQuerySchema.safeParse(request.query ?? {})
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
    try {
      const rows = queryRows<DeploymentRow>(
        await pool.query(
          'SELECT id, owner_id, docker_server_id, name, desired_image_digest, desired_config, status, created_by, created_at, updated_at FROM arsy_deployments WHERE owner_id = $1 AND ($2::timestamptz IS NULL OR created_at < $2) ORDER BY created_at DESC, id DESC LIMIT $3',
          [principal.operatorId, parsed.data.before ?? null, parsed.data.limit + 1]
        )
      )
      const hasMore = rows.length > parsed.data.limit
      const page = hasMore ? rows.slice(0, parsed.data.limit) : rows
      return {
        data: page,
        page: {
          limit: parsed.data.limit,
          hasMore,
          nextBefore: hasMore ? (page[page.length - 1]?.created_at ?? null) : null,
        },
      }
    } catch {
      return reply.code(503).send({ error: { code: 'DEPLOYMENT_STORE_UNAVAILABLE' } })
    }
  })

  app.post('/api/v1/deployments', async (request, reply) => {
    const principal = principalScope(request)
    if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    const parsed = createDeploymentSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
    try {
      const deployment = await createDeployment(pool, {
        ownerId: principal.operatorId,
        actorId: principal.operatorId,
        dockerServerId: parsed.data.dockerServerId,
        name: parsed.data.name,
        desiredConfig: (parsed.data.desiredConfig ?? {}) as JsonObject,
      })
      return reply.code(201).send({ data: deployment })
    } catch (error) {
      return reply.code(statusCodeForError(error)).send({ error: { code: safeErrorCode(error) } })
    }
  })

  app.get('/api/v1/deployments/:deploymentId', async (request, reply) => {
    const principal = principalScope(request)
    if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    const params = z.object({ deploymentId: UUID }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
    try {
      const rows = queryRows<DeploymentRow>(
        await pool.query(
          'SELECT id, owner_id, docker_server_id, name, desired_image_digest, desired_config, status, created_by, created_at, updated_at FROM arsy_deployments WHERE id = $1 AND owner_id = $2',
          [params.data.deploymentId, principal.operatorId]
        )
      )
      if (!rows[0]) return reply.code(404).send({ error: { code: 'DEPLOYMENT_NOT_FOUND' } })
      return { data: rows[0] }
    } catch {
      return reply.code(503).send({ error: { code: 'DEPLOYMENT_STORE_UNAVAILABLE' } })
    }
  })

  app.get('/api/v1/deployments/:deploymentId/operations', async (request, reply) => {
    const principal = principalScope(request)
    if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    const params = z.object({ deploymentId: UUID }).safeParse(request.params)
    const query = listQuerySchema.safeParse(request.query ?? {})
    if (!params.success || !query.success)
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
    try {
      const rows = queryRows<OperationRow>(
        await pool.query(
          'SELECT id, deployment_id, owner_id, actor_id, kind, status, idempotency_key, request_hash, request_payload, attempt_count, error_code, result, created_at, updated_at, started_at, completed_at FROM arsy_deployment_operations WHERE owner_id = $1 AND deployment_id = $2 AND ($3::timestamptz IS NULL OR created_at < $3) ORDER BY created_at DESC, id DESC LIMIT $4',
          [
            principal.operatorId,
            params.data.deploymentId,
            query.data.before ?? null,
            query.data.limit + 1,
          ]
        )
      )
      const hasMore = rows.length > query.data.limit
      const page = hasMore ? rows.slice(0, query.data.limit) : rows
      return {
        data: page,
        page: {
          limit: query.data.limit,
          hasMore,
          nextBefore: hasMore ? (page[page.length - 1]?.created_at ?? null) : null,
        },
      }
    } catch {
      return reply.code(503).send({ error: { code: 'DEPLOYMENT_STORE_UNAVAILABLE' } })
    }
  })

  app.get('/api/v1/deployments/:deploymentId/operations/:operationId', async (request, reply) => {
    const principal = principalScope(request)
    if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    const params = z.object({ deploymentId: UUID, operationId: UUID }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
    try {
      const rows = queryRows<OperationRow>(
        await pool.query(
          'SELECT id, deployment_id, owner_id, actor_id, kind, status, idempotency_key, request_hash, request_payload, attempt_count, error_code, result, created_at, updated_at, started_at, completed_at FROM arsy_deployment_operations WHERE id = $1 AND deployment_id = $2 AND owner_id = $3',
          [params.data.operationId, params.data.deploymentId, principal.operatorId]
        )
      )
      if (!rows[0]) return reply.code(404).send({ error: { code: 'OPERATION_NOT_FOUND' } })
      const decision = queryRows<AuthorizationRow>(
        await pool.query(
          'SELECT allowed, reason_codes, policy_version, recorded_at FROM arsy_deployment_authorization_decisions WHERE owner_id = $1 AND operation_id = $2 ORDER BY recorded_at DESC, id DESC LIMIT 1',
          [principal.operatorId, params.data.operationId]
        )
      )[0]
      return { data: rows[0], authorization: serializeAuthorization(decision) }
    } catch {
      return reply.code(503).send({ error: { code: 'DEPLOYMENT_STORE_UNAVAILABLE' } })
    }
  })

  app.get(
    '/api/v1/deployments/:deploymentId/operations/:operationId/events',
    async (request, reply) => {
      const principal = principalScope(request)
      if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
      const params = z.object({ deploymentId: UUID, operationId: UUID }).safeParse(request.params)
      const query = eventQuerySchema.safeParse(request.query ?? {})
      if (!params.success || !query.success)
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
      try {
        const operation = queryRows<{ id: string }>(
          await pool.query(
            'SELECT id FROM arsy_deployment_operations WHERE id = $1 AND deployment_id = $2 AND owner_id = $3',
            [params.data.operationId, params.data.deploymentId, principal.operatorId]
          )
        )[0]
        if (!operation) return reply.code(404).send({ error: { code: 'OPERATION_NOT_FOUND' } })
        const rows = queryRows<EventRow>(
          await pool.query(
            'SELECT operation_id, sequence, event_type, from_status, to_status, actor_id, details, occurred_at FROM arsy_deployment_operation_events WHERE operation_id = $1 AND owner_id = $2 AND sequence > $3 ORDER BY sequence ASC LIMIT $4',
            [params.data.operationId, principal.operatorId, query.data.after, query.data.limit + 1]
          )
        )
        const hasMore = rows.length > query.data.limit
        const page = hasMore ? rows.slice(0, query.data.limit) : rows
        return {
          data: page,
          page: {
            limit: query.data.limit,
            hasMore,
            nextAfter: hasMore ? Number(page[page.length - 1]?.sequence ?? query.data.after) : null,
          },
        }
      } catch {
        return reply.code(503).send({ error: { code: 'DEPLOYMENT_STORE_UNAVAILABLE' } })
      }
    }
  )

  app.post('/api/v1/deployments/:deploymentId/operations', async (request, reply) => {
    const principal = principalScope(request)
    if (!principal) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    const params = z.object({ deploymentId: UUID }).safeParse(request.params)
    const parsed = createOperationSchema.safeParse(request.body)
    const header = request.headers['idempotency-key']
    if (
      !params.success ||
      !parsed.success ||
      typeof header !== 'string' ||
      header.trim().length < 8 ||
      header.length > 200
    ) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR' } })
    }
    if (typeof pool.connect !== 'function') {
      return reply.code(503).send({ error: { code: 'DEPLOYMENT_TRANSACTION_UNAVAILABLE' } })
    }

    const requestPayload: JsonObject = parsed.data.source
      ? {
          source: {
            repository: parsed.data.source.repository,
            commit: parsed.data.source.commit.toLowerCase(),
            dockerfile: parsed.data.source.dockerfile,
          },
        }
      : {}
    let client: Awaited<ReturnType<NonNullable<DatabasePool['connect']>>> | null = null
    let transactionOpen = false
    try {
      client = await pool.connect()
      const txPool: DatabasePool = {
        query: (statement, values) => client!.query(statement, values),
        end: async () => {},
      }
      await client.query('BEGIN')
      transactionOpen = true

      const created = await createDeploymentOperation(
        txPool,
        {
          ownerId: principal.operatorId,
          actorId: principal.operatorId,
          deploymentId: params.data.deploymentId,
          kind: parsed.data.kind,
          idempotencyKey: header.trim(),
          requestPayload,
        },
        { enqueueOutbox: false }
      )

      let decision: ReturnType<typeof serializeAuthorization> = null
      let operationStatus = created.operation.status
      let outboxQueued = false
      if (created.disposition === 'created') {
        const authorization = await authorizeDeploymentOperation(
          {
            operationId: created.operation.id,
            ownerId: principal.operatorId,
            authenticatedActorId: principal.operatorId,
          },
          {
            ...authorizationDependencies,
            store: new PostgresDeploymentAuthorizationStore(txPool),
            capabilityVerifier,
            approvalKeyring,
          }
        )
        const decisionRows = queryRows<AuthorizationRow>(
          await txPool.query(
            'SELECT allowed, reason_codes, policy_version, recorded_at FROM arsy_deployment_authorization_decisions WHERE owner_id = $1 AND operation_id = $2 ORDER BY recorded_at DESC, id DESC LIMIT 1',
            [principal.operatorId, created.operation.id]
          )
        )
        decision = serializeAuthorization(decisionRows[0])
        if (!decision) throw new Error('authorization_audit_missing')

        if (!authorization.allowed) {
          const blocked = await transitionDeploymentOperation(txPool, {
            operationId: created.operation.id,
            ownerId: principal.operatorId,
            actorId: principal.operatorId,
            expectedStatus: 'queued',
            nextStatus: 'blocked',
            eventType: 'operation.authorization_denied',
            details: {
              reasonCodes: authorization.reasonCodes,
              policyVersion: authorization.policyVersion,
            },
            errorCode: authorization.reasonCodes[0] ?? 'authorization_denied',
          })
          operationStatus = blocked.status
        } else {
          await enqueueDeploymentOperation(txPool, {
            operationId: created.operation.id,
            ownerId: principal.operatorId,
          })
          outboxQueued = true
        }
      } else {
        const rows = queryRows<AuthorizationRow>(
          await txPool.query(
            'SELECT allowed, reason_codes, policy_version, recorded_at FROM arsy_deployment_authorization_decisions WHERE owner_id = $1 AND operation_id = $2 ORDER BY recorded_at DESC, id DESC LIMIT 1',
            [principal.operatorId, created.operation.id]
          )
        )
        decision = serializeAuthorization(rows[0])
        if (!decision) throw new Error('authorization_audit_missing')
        outboxQueued = decision.allowed && created.operation.status === 'queued'
      }

      await client.query('COMMIT')
      transactionOpen = false
      return reply.code(created.disposition === 'created' ? 202 : 200).send({
        data: { ...created.operation, status: operationStatus },
        disposition: created.disposition,
        authorization: decision,
        dispatch: {
          outbox: outboxQueued ? 'queued' : 'not_enqueued',
          worker: 'disabled',
          providerSideEffects: 'not_started',
        },
      })
    } catch (error) {
      if (transactionOpen && client) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* original error remains authoritative */
        }
      }
      return reply.code(statusCodeForError(error)).send({ error: { code: safeErrorCode(error) } })
    } finally {
      client?.release()
    }
  })
}
