import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import { EvidenceLedger } from '@riotworks/arsy-core/evidence'
import { getArsyOperatorPrincipal } from '../auth/operator-token.ts'
import { PostgresEvidenceStore } from './postgres-store.ts'

const aggregateParams = z.object({
  aggregateId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
})

const appendBody = z.object({
  id: z.string().trim().min(1).max(128),
  kind: z.enum([
    'observation.recorded',
    'claim.proposed',
    'claim.supported',
    'claim.contested',
    'claim.superseded',
    'decision.recorded',
    'action.recorded',
    'outcome.recorded',
  ]),
  occurredAt: z.string().datetime({ offset: true }),
  payload: z.record(z.unknown()),
  evidenceIds: z.array(z.string().trim().min(1).max(512)).max(100).optional(),
}).strict()

function operatorScope(request: Parameters<typeof getArsyOperatorPrincipal>[0]): string | null {
  const principal = getArsyOperatorPrincipal(request)
  const operatorId = principal?.operatorId.trim()
  return operatorId && operatorId.length <= 128 ? operatorId : null
}

function parseAggregateId(params: unknown): string | null {
  const parsed = aggregateParams.safeParse(params)
  return parsed.success ? parsed.data.aggregateId : null
}

export function registerEvidenceRoutes(app: FastifyInstance, pool: Pool): void {
  app.post('/api/v1/evidence/streams/:aggregateId/events', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    const aggregateId = parseAggregateId(request.params)
    const parsed = appendBody.safeParse(request.body)
    if (!aggregateId || !parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Evidence event input is invalid.' } })
    }

    const store = new PostgresEvidenceStore(pool, ownerId)
    const ledger = new EvidenceLedger(store)
    try {
      const appended = await ledger.appendWithDisposition({
        ...parsed.data,
        aggregateId,
        actorId: ownerId,
      })
      const event = (await store.list(aggregateId)).find((item) => item.id === appended.event.id)
      if (!event) throw new Error('Persisted evidence event could not be reloaded')
      return reply.code(appended.disposition === 'replayed' ? 200 : 201).send({
        data: { event, disposition: appended.disposition },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'Event id collision') {
        return reply.code(409).send({ error: { code: 'EVIDENCE_EVENT_ID_CONFLICT' } })
      }
      if (message.includes('stream head changed')) {
        return reply.code(409).send({ error: { code: 'EVIDENCE_STREAM_CONFLICT', retryable: true } })
      }
      app.log.error({ err: error }, 'Evidence event append failed')
      return reply.code(503).send({ error: { code: 'EVIDENCE_STORE_UNAVAILABLE' } })
    }
  })

  app.get('/api/v1/evidence/streams/:aggregateId/events', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    const aggregateId = parseAggregateId(request.params)
    if (!aggregateId) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Aggregate ID is invalid.' } })
    }

    try {
      const events = await new PostgresEvidenceStore(pool, ownerId).list(aggregateId)
      return { data: { aggregateId, events } }
    } catch (error) {
      app.log.error({ err: error }, 'Evidence event read failed')
      return reply.code(503).send({ error: { code: 'EVIDENCE_STORE_UNAVAILABLE' } })
    }
  })

  app.get('/api/v1/evidence/streams/:aggregateId/verify', async (request, reply) => {
    const ownerId = operatorScope(request)
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_ID_INVALID' } })

    const aggregateId = parseAggregateId(request.params)
    if (!aggregateId) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Aggregate ID is invalid.' } })
    }

    try {
      const ledger = new EvidenceLedger(new PostgresEvidenceStore(pool, ownerId))
      return { data: { aggregateId, ...(await ledger.verify(aggregateId)) } }
    } catch (error) {
      app.log.error({ err: error }, 'Evidence stream verification failed')
      return reply.code(503).send({ error: { code: 'EVIDENCE_STORE_UNAVAILABLE' } })
    }
  })
}
