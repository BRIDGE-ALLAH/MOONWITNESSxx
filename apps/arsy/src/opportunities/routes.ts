import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { hasValidOperatorToken } from '../auth/operator-token.ts'
import { evaluateOpportunity, opportunityInputSchema } from './domain.ts'
import { OpportunityRepository } from './repository.ts'

const idSchema = z.string().uuid()
const decisionSchema = z.object({
  decision: z.enum(['blocked', 'research-more', 'prototype-candidate', 'park']),
  rationale: z.string().trim().min(10).max(2000),
})
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export function registerOpportunityRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new OpportunityRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId
  const token = env.ARSY_OPERATOR_TOKEN?.trim()

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/v1/')) return
    if (!ownerId || !token) {
      return reply.code(503).send({
        error: {
          code: 'OPERATOR_AUTH_NOT_CONFIGURED',
          message: 'A deliberate operator ID and server-side operator token are required.',
        },
      })
    }
    if (!hasValidOperatorToken(request, token)) {
      return reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid operator credentials are required.',
        },
      })
    }
  })

  app.get('/api/v1/opportunities', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid opportunity list query.' } })
    return { data: await repository.list(ownerId, parsed.data.limit) }
  })

  app.post('/api/v1/opportunities', async (request, reply) => {
    const parsed = opportunityInputSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Opportunity input is invalid.', details: parsed.error.flatten() },
    })
    const evaluation = evaluateOpportunity(parsed.data)
    const record = await repository.create(ownerId, actorId, parsed.data, evaluation)
    return reply.code(201).send({ data: record })
  })

  app.get('/api/v1/opportunities/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Opportunity ID must be a UUID.' } })
    const record = await repository.get(ownerId, params.data.id)
    if (!record) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Opportunity was not found.' } })
    return { data: record }
  })

  app.patch('/api/v1/opportunities/:id/decision', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = decisionSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Decision input is invalid.' } })
    const existing = await repository.get(ownerId, params.data.id)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Opportunity was not found.' } })
    const gateBlocked = existing.evaluation.blockedGates.length > 0
    const gateUnknown = existing.evaluation.unknownGates.length > 0 || existing.evaluation.missingScoreDimensions.length > 0
    if (body.data.decision === 'prototype-candidate' && (gateBlocked || gateUnknown || existing.evaluation.score === null || existing.evaluation.score < 80)) {
      return reply.code(409).send({ error: { code: 'PROMOTION_BLOCKED', message: 'Opportunity cannot be promoted while a hard gate is blocked/unknown or the evidence score is below 80.' } })
    }
    const record = await repository.decide(ownerId, actorId, params.data.id, body.data.decision, body.data.rationale)
    return { data: record }
  })

  app.delete('/api/v1/opportunities/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Opportunity ID must be a UUID.' } })
    const archived = await repository.archive(ownerId, actorId, params.data.id)
    if (!archived) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Opportunity was not found.' } })
    return reply.code(204).send()
  })
}
