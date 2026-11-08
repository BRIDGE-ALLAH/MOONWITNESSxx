import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { httpUrlSchema } from '../http-url.ts'
import { ListingRepository, type ReceiptInput } from './repository.ts'

const idSchema = z.string().uuid()
const packageSchema = z.object({
  productId: idSchema,
  productVersion: z.number().int().positive(),
  channelId: idSchema,
  disclosure: z.string().trim().min(10).max(2000),
})
const receiptSchema = z.object({
  receiptType: z.enum(['manual-submission', 'publication-confirmation', 'withdrawal-confirmation']),
  externalListingId: z.string().trim().min(1).max(300).optional(),
  publicUrl: httpUrlSchema.optional(),
  evidence: z.array(z.object({
    label: z.string().trim().min(2).max(200),
    url: httpUrlSchema.optional(),
    reference: z.string().trim().min(2).max(500).optional(),
  }).refine((item) => Boolean(item.url || item.reference), 'Evidence needs a URL or reference.')).min(1).max(50),
  operatorConfirmation: z.string().trim().min(20).max(2000),
}).superRefine((value, context) => {
  if (value.receiptType !== 'manual-submission' && !value.publicUrl && !value.externalListingId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['publicUrl'], message: 'Publication or withdrawal confirmation needs a public URL or external listing ID.' })
  }
})

export function registerListingRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new ListingRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/listings', async (request, reply) => {
    const parsed = z.object({ productId: idSchema.optional() }).safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid listing query.' } })
    return { data: await repository.list(ownerId, parsed.data.productId) }
  })

  app.post('/api/v1/listings/packages', async (request, reply) => {
    const parsed = packageSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Listing package input is invalid.', details: parsed.error.flatten() },
    })
    const idempotencyKey = request.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.length > 200) {
      return reply.code(400).send({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid Idempotency-Key header is required.' } })
    }
    try {
      const result = await repository.createPackage(
        ownerId, actorId, parsed.data.productId, parsed.data.productVersion,
        parsed.data.channelId, parsed.data.disclosure, idempotencyKey.trim(),
      )
      if (!result) return reply.code(404).send({ error: { code: 'PRODUCT_OR_CHANNEL_NOT_FOUND', message: 'The selected product version or channel was not found under this operator.' } })
      return reply.code(result.replayed ? 200 : 201).send({ data: result.listing, replayed: result.replayed })
    } catch (error) {
      if (error instanceof Error && error.message === 'LISTING_IDEMPOTENCY_KEY_REUSED') {
        return reply.code(409).send({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for a different listing package.' } })
      }
      throw error
    }
  })

  app.get('/api/v1/listings/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Listing ID must be a UUID.' } })
    const listing = await repository.get(ownerId, params.data.id)
    if (!listing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Listing was not found.' } })
    return { data: listing }
  })

  app.get('/api/v1/listings/:id/receipts', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Listing ID must be a UUID.' } })
    const receipts = await repository.receipts(ownerId, params.data.id)
    if (!receipts) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Listing was not found.' } })
    return { data: receipts }
  })

  app.post('/api/v1/listings/:id/receipts', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const parsed = receiptSchema.safeParse(request.body)
    if (!params.success || !parsed.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Publication receipt input is invalid.', details: parsed.success ? undefined : parsed.error.flatten() },
    })
    const result = await repository.recordReceipt(ownerId, actorId, params.data.id, parsed.data as ReceiptInput)
    if (!result.listing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Listing was not found.' } })
    if (result.conflict || !result.receipt) return reply.code(409).send({
      error: { code: 'LISTING_STATE_CONFLICT', message: 'Receipt type does not match the current listing state. Refresh and verify the actual channel action.' },
      data: result.listing,
    })
    return reply.code(201).send({ data: { listing: result.listing, receipt: result.receipt } })
  })
}
