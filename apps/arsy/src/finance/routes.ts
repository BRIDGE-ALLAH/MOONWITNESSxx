import { z } from 'zod'
import { httpEvidenceUrlSchema } from '../http-url.ts'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { FinancialRepository, type FinancialEventType } from './repository.ts'

const eventTypes = ['gross-receipt', 'platform-fee', 'refund', 'chargeback', 'variable-cost', 'production-cost', 'tax-reserve', 'fx-adjustment', 'payout', 'payout-reversal'] as const satisfies readonly FinancialEventType[]
const createSchema = z.object({
  productId: z.string().uuid().optional(),
  eventType: z.enum(eventTypes),
  amountMinor: z.string().regex(/^[1-9][0-9]{0,17}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.string().trim().min(2).max(200),
  providerReference: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
  metadata: z.record(z.unknown()).optional(),
})
const reconcileSchema = z.object({
  state: z.enum(['verified', 'disputed', 'reversed']),
  rationale: z.string().trim().min(10).max(2000),
  evidenceUrl: httpEvidenceUrlSchema,
})
const idSchema = z.string().uuid()
const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) })

export function registerFinancialRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new FinancialRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/financial-events', async (request, reply) => {
    const query = listSchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid financial event query.' } })
    return { data: await repository.list(ownerId, query.data.limit) }
  })

  app.post('/api/v1/financial-events', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Financial event input is invalid.', details: body.error.flatten() } })
    try {
      const result = await repository.create(ownerId, actorId, body.data)
      if (!result) return reply.code(404).send({ error: { code: 'PRODUCT_NOT_FOUND', message: 'The selected product does not exist for this operator.' } })
      return reply.code(result.replayed ? 200 : 201).send({ data: result.event, replayed: result.replayed })
    } catch (error) {
      if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_REUSED') {
        return reply.code(409).send({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for a different financial event.' } })
      }
      throw error
    }
  })

  app.patch('/api/v1/financial-events/:id/reconciliation', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = reconcileSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Reconciliation input is invalid.' } })
    const event = await repository.reconcile(ownerId, actorId, params.data.id, body.data.state, body.data.rationale, body.data.evidenceUrl)
    if (!event) return reply.code(409).send({ error: { code: 'RECONCILIATION_CONFLICT', message: 'Event was not found or is no longer pending reconciliation.' } })
    return { data: event }
  })

  app.get('/api/v1/financial-summary', async () => ({ data: await repository.summary(ownerId) }))
}
