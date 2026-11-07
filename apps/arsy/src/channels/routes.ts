import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { ChannelRepository, type ChannelInput } from './repository.ts'

const evidenceSchema = z.object({
  evidenceType: z.enum(['official-policy', 'account-eligibility', 'payout-requirements', 'api-capability', 'other']),
  sourceName: z.string().trim().min(2).max(160),
  sourceUrl: z.string().url().max(2048),
  capturedAt: z.string().datetime({ offset: true }),
  reviewedAt: z.string().datetime({ offset: true }).nullable().optional(),
  evidenceClass: z.enum(['observed-fact', 'operator-attestation', 'inference', 'unknown']),
  summary: z.string().trim().min(5).max(2000),
  limitations: z.string().trim().min(5).max(1000),
})
const channelObjectSchema = z.object({
  channelKey: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(2).max(160),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/),
  accountEligibility: z.enum(['eligible', 'ineligible', 'unknown']),
  officialPolicyUrl: z.string().url().max(2048).nullable().optional(),
  policyReviewedAt: z.string().datetime({ offset: true }).nullable().optional(),
  policyRecheckAt: z.string().datetime({ offset: true }).nullable().optional(),
  payoutRequirements: z.record(z.string(), z.unknown()),
  payoutSetupStatus: z.enum(['configured', 'not-configured', 'unavailable', 'unknown']),
  capability: z.enum(['C0', 'C1']),
  grantedScopes: z.array(z.string().trim().min(1).max(200)).max(50),
  quotaNotes: z.record(z.string(), z.unknown()),
  channelStatus: z.enum(['active', 'paused']),
  evidence: z.array(evidenceSchema).max(100),
})
const validateChannel = (value: z.infer<typeof channelObjectSchema>, context: z.RefinementCtx) => {
  const types = new Set(value.evidence.map((item) => item.evidenceType))
  if (value.accountEligibility === 'eligible' && !types.has('account-eligibility')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'Eligible account status requires dated account-eligibility evidence.' })
  }
  if (value.payoutSetupStatus === 'configured' && !types.has('payout-requirements')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['evidence'], message: 'Configured payout status requires dated payout evidence.' })
  }
  if (value.capability === 'C1') {
    if (!value.officialPolicyUrl || !value.policyReviewedAt || !value.policyRecheckAt || !types.has('official-policy')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['capability'], message: 'C1 manual-package capability requires an official policy URL, review/recheck dates and policy evidence.' })
    }
    if (value.accountEligibility !== 'eligible' || value.payoutSetupStatus !== 'configured' || !types.has('account-eligibility') || !types.has('payout-requirements')) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['capability'], message: 'C1 requires current account eligibility and payout setup evidence.' })
    }
  }
}
const channelBaseSchema = channelObjectSchema.superRefine(validateChannel)
const updateSchema = channelObjectSchema.extend({ expectedRevision: z.number().int().positive() })
const idSchema = z.string().uuid()

export function registerChannelRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new ChannelRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/channels', async () => ({ data: await repository.list(ownerId) }))

  app.post('/api/v1/channels', async (request, reply) => {
    const parsed = channelBaseSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Channel registry input is invalid.', details: parsed.error.flatten() },
    })
    try {
      const channel = await repository.create(ownerId, actorId, parsed.data as ChannelInput)
      return reply.code(201).send({ data: channel })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: { code: 'CHANNEL_ALREADY_EXISTS', message: 'A channel with this key already exists for this operator.' } })
      throw error
    }
  })

  app.get('/api/v1/channels/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Channel ID must be a UUID.' } })
    const channel = await repository.get(ownerId, params.data.id)
    if (!channel) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Channel was not found.' } })
    return { data: channel }
  })

  app.patch('/api/v1/channels/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = updateSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Channel update input is invalid.', details: body.success ? undefined : body.error.flatten() },
    })
    const { expectedRevision, ...input } = body.data
    const existingEvidence = await repository.evidence(ownerId, params.data.id)
    if (!existingEvidence) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Channel was not found.' } })
    const validated = channelBaseSchema.safeParse({
      ...input,
      evidence: [
        ...existingEvidence.map((item) => ({
          evidenceType: item.evidenceType, sourceName: item.sourceName, sourceUrl: item.sourceUrl,
          capturedAt: item.capturedAt, reviewedAt: item.reviewedAt, evidenceClass: item.evidenceClass,
          summary: item.summary, limitations: item.limitations,
        })),
        ...input.evidence,
      ],
    })
    if (!validated.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Channel update does not satisfy its evidence gates.', details: validated.error.flatten() },
    })
    try {
      const result = await repository.update(ownerId, actorId, params.data.id, expectedRevision, input as ChannelInput)
      if (!result.channel) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Channel was not found.' } })
      if (result.conflict) return reply.code(409).send({ error: { code: 'REVISION_CONFLICT', message: 'Channel changed since it was loaded. Refresh before retrying.' }, data: result.channel })
      return { data: result.channel }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: { code: 'CHANNEL_ALREADY_EXISTS', message: 'A channel with this key already exists for this operator.' } })
      throw error
    }
  })

  app.get('/api/v1/channels/:id/evidence', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Channel ID must be a UUID.' } })
    const evidence = await repository.evidence(ownerId, params.data.id)
    if (!evidence) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Channel was not found.' } })
    return { data: evidence }
  })

  app.post('/api/v1/channels/:id/evidence', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = evidenceSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Channel evidence input is invalid.', details: body.success ? undefined : body.error.flatten() },
    })
    const evidence = await repository.appendEvidence(ownerId, actorId, params.data.id, body.data)
    if (!evidence) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Channel was not found.' } })
    return reply.code(201).send({ data: evidence })
  })
}
