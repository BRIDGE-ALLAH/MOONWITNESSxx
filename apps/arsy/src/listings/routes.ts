import { z } from 'zod'
import { httpEvidenceUrlSchema } from '../http-url.ts'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { ListingRepository } from './repository.ts'

const createSchema = z.object({
  productVersionId: z.string().uuid(),
  channelId: z.string().uuid(),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(20).max(5000),
  tags: z.array(z.string().trim().min(1).max(60)).max(30),
  priceMinor: z.string().regex(/^[1-9][0-9]{0,17}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  disclosures: z.array(z.string().trim().min(3).max(500)).max(30),
  manualUploadInstructions: z.string().trim().min(20).max(3000),
})
const receiptSchema = z.object({
  providerReference: z.string().trim().min(2).max(300),
  evidenceUrl: httpEvidenceUrlSchema,
  publishedAt: z.string().datetime({ offset: true }),
})
const idSchema = z.string().uuid()

export function registerListingRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new ListingRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/listings', async () => ({ data: await repository.list(ownerId) }))

  app.post('/api/v1/listings', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Manual listing package input is invalid.', details: body.error.flatten() } })
    const listing = await repository.create(ownerId, actorId, body.data)
    if (!listing) return reply.code(409).send({ error: { code: 'LISTING_NOT_READY', message: 'Listing requires a READY product version and an enabled C1 manual channel. Check all inspections and channel evidence first.' } })
    return reply.code(201).send({ data: listing })
  })

  app.patch('/api/v1/listings/:id/publication-receipt', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const body = receiptSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Publication receipt input is invalid.' } })
    const listing = await repository.recordPublication(ownerId, actorId, params.data.id, body.data.providerReference, body.data.evidenceUrl, body.data.publishedAt)
    if (!listing) return reply.code(409).send({ error: { code: 'LISTING_STATE_CONFLICT', message: 'Listing was not found or is not ready/submitted for a publication receipt.' } })
    return { data: listing }
  })
}
