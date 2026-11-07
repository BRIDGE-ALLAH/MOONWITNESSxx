import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { ProductRepository } from './repository.ts'
import { canTransitionProductLifecycle, productLifecycleStates, type ProductLifecycleState } from './lifecycle.ts'

const createSchema = z.object({
  opportunityId: z.string().uuid(),
  acceptanceCriteria: z.array(z.string().trim().min(3).max(500)).min(1).max(30),
})
const versionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  brief: z.record(z.unknown()),
  acceptanceCriteria: z.array(z.string().trim().min(3).max(500)).min(1).max(30),
})
const idSchema = z.string().uuid()
const lifecycleSchema = z.object({ lifecycleState: z.enum(productLifecycleStates) })
const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) })

export function registerProductRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new ProductRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId
  app.get('/api/v1/products', async (request, reply) => {
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid product list query.' } })
    return { data: await repository.list(ownerId, parsed.data.limit) }
  })

  app.post('/api/v1/products/from-opportunity', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Product brief input is invalid.', details: parsed.error.flatten() } })
    const existing = await repository.findByOpportunity(ownerId, parsed.data.opportunityId)
    if (existing) return reply.code(409).send({ error: { code: 'PRODUCT_ALREADY_EXISTS', message: 'This opportunity already has a product.' }, data: existing })
    const product = await repository.createFromOpportunity(ownerId, actorId, parsed.data.opportunityId, parsed.data.acceptanceCriteria)
    if (!product) return reply.code(409).send({ error: { code: 'OPPORTUNITY_NOT_READY', message: 'Only an opportunity with a complete score of at least 80 and all hard gates passed can become a product brief.' } })
    return reply.code(201).send({ data: product })
  })

  app.get('/api/v1/products/:id/versions', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Product ID must be a UUID.' } })
    const product = await repository.get(ownerId, params.data.id)
    if (!product) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Product was not found.' } })
    return { data: await repository.listVersions(ownerId, params.data.id) }
  })

  app.post('/api/v1/products/:id/versions', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = versionSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Product version input is invalid.' } })
    const existing = await repository.get(ownerId, params.data.id)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Product was not found.' } })
    if (existing.version !== body.data.expectedVersion) {
      return reply.code(409).send({ error: { code: 'VERSION_CONFLICT', message: 'Product changed since this version was loaded. Refresh before saving.' }, data: existing })
    }
    const product = await repository.createVersion(
      ownerId, actorId, params.data.id, body.data.expectedVersion,
      body.data.brief, body.data.acceptanceCriteria,
    )
    if (!product) return reply.code(409).send({ error: { code: 'VERSION_CONFLICT', message: 'Product changed concurrently. Refresh before saving.' } })
    return reply.code(201).send({ data: product })
  })

  app.patch('/api/v1/products/:id/lifecycle', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = lifecycleSchema.safeParse(request.body)
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Product lifecycle input is invalid.' } })
    }

    const existing = await repository.get(ownerId, params.data.id)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Product was not found.' } })
    if (existing.lifecycleState === body.data.lifecycleState) return { data: existing }
    if (!canTransitionProductLifecycle(existing.lifecycleState, body.data.lifecycleState)) {
      return reply.code(409).send({
        error: {
          code: 'INVALID_LIFECYCLE_TRANSITION',
          message: `Product cannot move from ${existing.lifecycleState} to ${body.data.lifecycleState}.`,
        },
      })
    }

    const updated = await repository.transitionLifecycle(
      ownerId,
      actorId,
      params.data.id,
      existing.lifecycleState as ProductLifecycleState,
      body.data.lifecycleState,
    )
    if (!updated) {
      return reply.code(409).send({ error: { code: 'LIFECYCLE_CONFLICT', message: 'Product lifecycle changed concurrently. Refresh and try again.' } })
    }
    return { data: updated }
  })

  app.get('/api/v1/products/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Product ID must be a UUID.' } })
    const product = await repository.get(ownerId, params.data.id)
    if (!product) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Product was not found.' } })
    return { data: product }
  })
}
