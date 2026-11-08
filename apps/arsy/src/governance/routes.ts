import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { governanceSnapshotInputSchema } from '@riotworks/contract'
import { getArsyOperatorPrincipal } from '../auth/operator-token.ts'
import { PostgresGovernanceStore } from './store.ts'

const snapshotParams = z.object({ id: z.uuid() })

function operatorScope(request: Parameters<typeof getArsyOperatorPrincipal>[0]): string | null {
  const principal = getArsyOperatorPrincipal(request)
  const operatorId = principal?.operatorId.trim()
  return operatorId && operatorId.length <= 128 ? operatorId : null
}

function parseSnapshotId(params: unknown): string | null {
  const parsed = snapshotParams.safeParse(params)
  return parsed.success ? parsed.data.id : null
}

export function registerGovernanceRoutes(app: FastifyInstance, pool: Pool): void {
  app.post('/api/v1/governance/snapshots', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    const parsed = governanceSnapshotInputSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Governance snapshot input is invalid.',
          issues: parsed.error.issues.map((issue) => issue.message),
        },
      })
    }

    try {
      const snapshot = await new PostgresGovernanceStore(pool, ownerId).create(parsed.data)
      return reply.code(201).send({ data: { snapshot } })
    } catch (error) {
      app.log.error({ err: error }, 'Governance snapshot create failed')
      return reply.code(503).send({ error: { code: 'GOVERNANCE_STORE_UNAVAILABLE' } })
    }
  })

  app.get('/api/v1/governance/snapshots', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    try {
      const snapshots = await new PostgresGovernanceStore(pool, ownerId).list()
      return { data: { snapshots } }
    } catch (error) {
      app.log.error({ err: error }, 'Governance snapshot list failed')
      return reply.code(503).send({ error: { code: 'GOVERNANCE_STORE_UNAVAILABLE' } })
    }
  })

  app.get('/api/v1/governance/snapshots/:id', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    const id = parseSnapshotId(request.params)
    if (!id)
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: 'Snapshot id is invalid.' } })

    try {
      const snapshot = await new PostgresGovernanceStore(pool, ownerId).get(id)
      if (!snapshot) return reply.code(404).send({ error: { code: 'SNAPSHOT_NOT_FOUND' } })
      return { data: { snapshot } }
    } catch (error) {
      app.log.error({ err: error }, 'Governance snapshot read failed')
      return reply.code(503).send({ error: { code: 'GOVERNANCE_STORE_UNAVAILABLE' } })
    }
  })

  app.post('/api/v1/governance/snapshots/:id/archive', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    const id = parseSnapshotId(request.params)
    if (!id)
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: 'Snapshot id is invalid.' } })

    try {
      const snapshot = await new PostgresGovernanceStore(pool, ownerId).archive(id)
      if (!snapshot) return reply.code(404).send({ error: { code: 'SNAPSHOT_NOT_FOUND' } })
      return { data: { snapshot } }
    } catch (error) {
      app.log.error({ err: error }, 'Governance snapshot archive failed')
      return reply.code(503).send({ error: { code: 'GOVERNANCE_STORE_UNAVAILABLE' } })
    }
  })
}
