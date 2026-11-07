import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { ChannelRepository } from './repository.ts'

const createSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(2).max(160),
})
const reviewSchema = z.object({
  countryEligibility: z.array(z.object({
    country: z.string().trim().length(2).toUpperCase(),
    status: z.enum(['pass', 'blocked', 'unknown']),
    sourceUrl: z.string().url().optional(),
    checkedAt: z.string().datetime({ offset: true }).optional(),
  })).min(1).max(30),
  payoutRequirements: z.object({
    status: z.enum(['pass', 'blocked', 'unknown']),
    sourceUrl: z.string().url().optional(),
    checkedAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().trim().min(5).max(1000),
  }),
  policyUrl: z.string().url().optional(),
  policyCheckedAt: z.string().datetime({ offset: true }).optional(),
  manualFallback: z.string().trim().min(10).max(2000),
}).superRefine((input, context) => {
  for (const [index, item] of input.countryEligibility.entries()) {
    if (item.status !== 'unknown' && (!item.sourceUrl || !item.checkedAt)) {
      context.addIssue({ code: 'custom', path: ['countryEligibility', index], message: 'A non-unknown eligibility decision requires a source URL and review time.' })
    }
  }
  if (input.payoutRequirements.status !== 'unknown' && (!input.payoutRequirements.sourceUrl || !input.payoutRequirements.checkedAt)) {
    context.addIssue({ code: 'custom', path: ['payoutRequirements'], message: 'A non-unknown payout decision requires a source URL and review time.' })
  }
  if (Boolean(input.policyUrl) !== Boolean(input.policyCheckedAt)) {
    context.addIssue({ code: 'custom', path: ['policyUrl'], message: 'Policy URL and review time must be supplied together.' })
  }
})
const idSchema = z.string().uuid()

export function registerChannelRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new ChannelRepository(db)
  const reviewerId = env.ARSY_OPERATOR_ID?.trim() || 'primary-owner'

  app.get('/api/v1/channels', async () => ({ data: await repository.list() }))

  app.post('/api/v1/channels', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Channel registry input is invalid.', details: body.error.flatten() } })
    try {
      const channel = await repository.create(body.data.slug, body.data.displayName)
      return reply.code(201).send({ data: channel })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return reply.code(409).send({ error: { code: 'CHANNEL_SLUG_EXISTS', message: 'A channel with this slug already exists.' } })
      }
      throw error
    }
  })

  app.patch('/api/v1/channels/:id/review', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = reviewSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Channel review input is invalid.' } })
    const channel = await repository.review(params.data.id, reviewerId, body.data)
    if (!channel) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Channel was not found.' } })
    return { data: channel, capabilityDecision: channel.capability === 'C1' ? 'manual-package-enabled' : 'research-only' }
  })
}
