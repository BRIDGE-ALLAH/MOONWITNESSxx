import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { httpUrlSchema } from '../http-url.ts'
import {
  canTransitionPayout,
  FxConversionRepository,
  PayoutRepository,
  type PayoutStatus,
} from './payouts.ts'

const idSchema = z.string().uuid()
const amountSchema = z.string().regex(/^[1-9][0-9]{0,17}$/)
const currencySchema = z.string().regex(/^[A-Z]{3}$/)
const idempotencySchema = z.string().trim().min(8).max(200)
const payoutStatuses = ['pending', 'paid', 'failed', 'reversed', 'disputed'] as const

const createPayoutSchema = z.object({
  channelId: idSchema,
  listingId: idSchema.optional(),
  amountMinor: amountSchema,
  currency: currencySchema,
  providerReference: z.string().trim().max(300).optional(),
  expectedAt: z.string().datetime({ offset: true }),
  source: z.string().trim().min(2).max(200),
  evidenceUrl: httpUrlSchema,
  idempotencyKey: idempotencySchema,
})

const transitionSchema = z.object({
  expectedStatus: z.enum(payoutStatuses),
  status: z.enum(payoutStatuses),
  rationale: z.string().trim().min(10).max(2000),
  evidenceUrl: httpUrlSchema.nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.string().trim().min(2).max(200),
})

const statementRowSchema = z.object({
  channelId: idSchema,
  listingId: idSchema.optional(),
  amountMinor: amountSchema,
  currency: currencySchema,
  providerReference: z.string().trim().min(1).max(300),
  paidAt: z.string().datetime({ offset: true }),
  evidenceUrl: httpUrlSchema,
  idempotencyKey: idempotencySchema,
})
const statementImportSchema = z.object({
  statementSource: z.string().trim().min(2).max(200),
  rows: z.array(statementRowSchema).min(1).max(100),
})

const fxSchema = z.object({
  sourceEventId: idSchema,
  toCurrency: currencySchema,
  rateNumerator: z.string().regex(/^[1-9][0-9]{0,37}$/),
  rateDenominator: z.string().regex(/^[1-9][0-9]{0,37}$/),
  rateSource: z.string().trim().min(2).max(200),
  rateObservedAt: z.string().datetime({ offset: true }),
  evidenceUrl: httpUrlSchema,
  roundingMode: z.enum(['half-up', 'half-even']),
  idempotencyKey: idempotencySchema,
})

export function registerPayoutRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const payouts = new PayoutRepository(db)
  const fx = new FxConversionRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/payouts', async (request, reply) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) }).safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY' } })
    return { data: await payouts.list(ownerId, query.data.limit) }
  })

  app.post('/api/v1/payouts', async (request, reply) => {
    const body = createPayoutSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Expected payout input is invalid.', details: body.error.flatten() } })
    try {
      const result = await payouts.create(ownerId, actorId, body.data)
      if (!result) return reply.code(409).send({ error: { code: 'CHANNEL_NOT_ELIGIBLE', message: 'A payout requires an enabled C1 channel and, when supplied, an owner-scoped listing on that channel.' } })
      return reply.code(result.replayed ? 200 : 201).send({ data: result.payout, replayed: result.replayed })
    } catch (error) {
      if (error instanceof Error && error.message === 'PAYOUT_IDEMPOTENCY_CONFLICT') {
        return reply.code(409).send({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key belongs to a different payout.' } })
      }
      throw error
    }
  })

  app.patch('/api/v1/payouts/:id/status', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = transitionSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Payout transition input is invalid.' } })
    if (!canTransitionPayout(body.data.expectedStatus as PayoutStatus, body.data.status as PayoutStatus)) {
      return reply.code(409).send({ error: { code: 'INVALID_PAYOUT_TRANSITION', message: 'The requested payout state transition is not allowed.' } })
    }
    if (['paid', 'reversed'].includes(body.data.status) && !body.data.evidenceUrl) {
      return reply.code(400).send({ error: { code: 'PAYOUT_EVIDENCE_REQUIRED', message: 'Paid and reversed payout states require statement or provider evidence.' } })
    }
    try {
      const payout = await payouts.transition(
        ownerId, actorId, params.data.id, body.data.expectedStatus as PayoutStatus,
        body.data.status as PayoutStatus, body.data.rationale, body.data.evidenceUrl ?? null,
        body.data.occurredAt, body.data.source,
      )
      if (!payout) return reply.code(409).send({ error: { code: 'PAYOUT_CONFLICT', message: 'Payout was not found or its state changed. Refresh before retrying.' } })
      return { data: payout }
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PAYOUT_TRANSITION') {
        return reply.code(409).send({ error: { code: 'INVALID_PAYOUT_TRANSITION' } })
      }
      if (error instanceof Error && error.message === 'PAYOUT_EVIDENCE_REQUIRED') {
        return reply.code(400).send({ error: { code: 'PAYOUT_EVIDENCE_REQUIRED' } })
      }
      throw error
    }
  })

  app.get('/api/v1/payouts/:id/events', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID' } })
    const payout = (await payouts.list(ownerId, 200)).find((item) => item.id === params.data.id)
    if (!payout) return reply.code(404).send({ error: { code: 'NOT_FOUND' } })
    return { data: await payouts.events(ownerId, params.data.id) }
  })

  app.post('/api/v1/payouts/statement-import', async (request, reply) => {
    const body = statementImportSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Statement import input is invalid.', details: body.error.flatten() } })
    const results: Array<{ row: number; status: string; payoutId?: string; error?: string; replayed?: boolean }> = []
    for (const [index, row] of body.data.rows.entries()) {
      try {
        const created = await payouts.create(ownerId, actorId, {
          channelId: row.channelId,
          listingId: row.listingId,
          amountMinor: row.amountMinor,
          currency: row.currency,
          providerReference: row.providerReference,
          expectedAt: row.paidAt,
          source: body.data.statementSource,
          evidenceUrl: row.evidenceUrl,
          idempotencyKey: row.idempotencyKey,
        })
        if (!created) {
          results.push({ row: index + 1, status: 'rejected', error: 'CHANNEL_NOT_ELIGIBLE' })
          continue
        }
        if (created.payout.status === 'paid') {
          results.push({ row: index + 1, status: 'paid', payoutId: created.payout.id, replayed: true })
          continue
        }
        const paid = await payouts.transition(
          ownerId, actorId, created.payout.id, 'pending', 'paid',
          'Reconciled from a manually imported provider statement.',
          row.evidenceUrl, row.paidAt, body.data.statementSource,
        )
        results.push(paid
          ? { row: index + 1, status: 'paid', payoutId: paid.id, replayed: created.replayed }
          : { row: index + 1, status: 'conflict', payoutId: created.payout.id, error: 'PAYOUT_CONFLICT' })
      } catch (error) {
        results.push({ row: index + 1, status: 'rejected', error: error instanceof Error ? error.message : 'IMPORT_FAILED' })
      }
    }
    const accepted = results.filter((item) => item.status === 'paid').length
    return reply.code(results.every((item) => item.status === 'paid') ? 200 : 207)
      .send({ data: { accepted, rejected: results.length - accepted, results } })
  })

  app.get('/api/v1/fx-conversions', async (request, reply) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) }).safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY' } })
    return { data: await fx.list(ownerId, query.data.limit) }
  })

  app.post('/api/v1/fx-conversions', async (request, reply) => {
    const body = fxSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'FX conversion input is invalid.', details: body.error.flatten() } })
    try {
      const result = await fx.create(ownerId, actorId, body.data)
      if (!result) return reply.code(409).send({ error: { code: 'SOURCE_EVENT_NOT_VERIFIED', message: 'Only an owner-scoped verified financial event can be converted.' } })
      return reply.code(result.replayed ? 200 : 201).send({ data: result.conversion, replayed: result.replayed })
    } catch (error) {
      if (error instanceof Error && error.message === 'FX_CURRENCY_MUST_DIFFER') return reply.code(400).send({ error: { code: 'FX_CURRENCY_MUST_DIFFER' } })
      if (error instanceof Error && error.message === 'FX_IDEMPOTENCY_CONFLICT') return reply.code(409).send({ error: { code: 'FX_IDEMPOTENCY_CONFLICT' } })
      if (error instanceof Error && error.message === 'INVALID_FX_INTEGER') return reply.code(400).send({ error: { code: 'INVALID_FX_INTEGER' } })
      if (error instanceof Error && error.message === 'FX_RESULT_OUT_OF_RANGE') return reply.code(400).send({ error: { code: 'FX_RESULT_OUT_OF_RANGE' } })
      throw error
    }
  })
}
