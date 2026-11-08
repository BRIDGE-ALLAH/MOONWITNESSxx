import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { httpUrlSchema } from '../http-url.ts'
import {
  calculateConvertedMinor,
  FxConversionRepository,
  PayoutRepository,
  type FxConversionInput,
  type PayoutInput,
} from './payouts.ts'

const amountSchema = z.string().regex(/^[1-9][0-9]{0,17}$/)
const currencySchema = z.string().regex(/^[A-Z]{3}$/)
const idSchema = z.string().uuid()
const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) })

const payoutInputSchema = z.object({
  channelId: idSchema,
  amountMinor: amountSchema,
  currency: currencySchema,
  expectedAt: z.string().datetime({ offset: true }).optional(),
  providerReference: z.string().trim().max(300).optional(),
  source: z.string().trim().min(2).max(200),
  idempotencyKey: z.string().trim().min(8).max(200),
  evidenceUrl: httpUrlSchema,
  evidenceCapturedAt: z.string().datetime({ offset: true }),
  evidenceSummary: z.string().trim().min(10).max(2000),
})

const payoutTransitionSchema = z.object({
  status: z.enum(['paid', 'failed', 'reversed', 'disputed']),
  rationale: z.string().trim().min(10).max(2000),
  evidenceUrl: httpUrlSchema,
  evidenceCapturedAt: z.string().datetime({ offset: true }),
})

const fxInputSchema = z.object({
  sourceEventId: idSchema,
  fromAmountMinor: amountSchema,
  fromCurrency: currencySchema,
  toAmountMinor: amountSchema,
  toCurrency: currencySchema,
  rateNumerator: z.string().regex(/^[1-9][0-9]{0,37}$/),
  rateDenominator: z.string().regex(/^[1-9][0-9]{0,37}$/),
  rateSource: z.string().trim().min(2).max(200),
  sourceUrl: httpUrlSchema,
  observedAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().trim().min(8).max(200),
}).refine((input) => input.fromCurrency !== input.toCurrency, {
  path: ['toCurrency'],
  message: 'FX conversion currencies must be different.',
})

export function registerPayoutAndFxRoutes(
  app: FastifyInstance,
  db: DatabasePool,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId
  const payouts = new PayoutRepository(db)
  const fxConversions = new FxConversionRepository(db)

  app.get('/api/v1/payouts', async (request, reply) => {
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })
    const query = listSchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid payout query.' } })
    return { data: await payouts.list(ownerId, query.data.limit) }
  })

  app.post('/api/v1/payouts', async (request, reply) => {
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })
    const parsed = payoutInputSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Payout input is invalid.', details: parsed.error.flatten() } })
    try {
      const result = await payouts.create(ownerId, actorId, parsed.data as PayoutInput)
      if (!result) return reply.code(409).send({ error: { code: 'CHANNEL_NOT_ELIGIBLE', message: 'The selected channel is not enabled at a reviewed C1-or-higher capability.' } })
      return reply.code(result.replayed ? 200 : 201).send({ data: result.payout, replayed: result.replayed })
    } catch (error) {
      if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_REUSED') {
        return reply.code(409).send({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for a different payout.' } })
      }
      throw error
    }
  })

  app.patch('/api/v1/payouts/:id/status', async (request, reply) => {
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const parsed = payoutTransitionSchema.safeParse(request.body)
    if (!params.success || !parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Payout transition input is invalid.' } })
    const payout = await payouts.transition(
      ownerId, actorId, params.data.id, parsed.data.status,
      parsed.data.rationale, parsed.data.evidenceUrl, parsed.data.evidenceCapturedAt,
    )
    if (!payout) return reply.code(409).send({ error: { code: 'PAYOUT_TRANSITION_CONFLICT', message: 'Payout was not found or the requested status transition is not allowed.' } })
    return { data: payout }
  })

  app.get('/api/v1/fx-conversions', async (request, reply) => {
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })
    const query = listSchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid FX conversion query.' } })
    return { data: await fxConversions.list(ownerId, query.data.limit) }
  })

  app.post('/api/v1/fx-conversions', async (request, reply) => {
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })
    const parsed = fxInputSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'FX conversion input is invalid.', details: parsed.error.flatten() } })
    let expectedAmount: string
    try {
      expectedAmount = calculateConvertedMinor(
        parsed.data.fromAmountMinor,
        parsed.data.rateNumerator,
        parsed.data.rateDenominator,
      )
    } catch {
      return reply.code(400).send({ error: { code: 'INVALID_FX_RATE', message: 'FX amount and rational rate must be positive integers.' } })
    }
    if (expectedAmount !== parsed.data.toAmountMinor) {
      return reply.code(400).send({ error: { code: 'FX_AMOUNT_MISMATCH', message: 'Converted minor-unit amount does not match the supplied exact rational rate and half-up rounding rule.', expectedAmountMinor: expectedAmount } })
    }
    try {
      const result = await fxConversions.create(ownerId, actorId, parsed.data as FxConversionInput)
      if (!result) return reply.code(409).send({ error: { code: 'SOURCE_EVENT_NOT_VERIFIED', message: 'FX conversion requires a matching verified source financial event owned by this operator.' } })
      return reply.code(result.replayed ? 200 : 201).send({ data: result.conversion, replayed: result.replayed })
    } catch (error) {
      if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_REUSED') {
        return reply.code(409).send({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for a different FX conversion.' } })
      }
      throw error
    }
  })
}
