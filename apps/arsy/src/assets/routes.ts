import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { AssetRepository } from './repository.ts'
import { LocalAssetStorage } from './storage.ts'

const allowedMediaTypes = new Set([
  'application/pdf', 'application/zip', 'application/json', 'text/plain',
  'image/png', 'image/jpeg', 'image/webp',
])
const provenanceSchema = z.object({
  creator: z.string().trim().min(2).max(200),
  license: z.string().trim().min(2).max(300),
  sourceUrl: z.string().url().optional(),
  originalDeclaration: z.string().trim().min(10).max(1000).optional(),
  toolModel: z.string().trim().max(300).optional(),
  editHistory: z.array(z.string().trim().min(3).max(500)).max(50),
  disclosure: z.string().trim().min(3).max(1000),
  derivativeOf: z.string().trim().max(300).optional(),
})
const uploadSchema = z.object({
  productVersionId: z.string().uuid(),
  filename: z.string().trim().min(1).max(180).refine((value) => !/[\\/\u0000-\u001f]/.test(value), 'Filename must not contain path separators or control characters.'),
  mediaType: z.string().min(1).max(120),
  contentBase64: z.string().min(4).max(7 * 1024 * 1024).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  provenance: provenanceSchema,
  rightsState: z.enum(['pass', 'blocked', 'unknown']),
}).superRefine((input, context) => {
  if (!allowedMediaTypes.has(input.mediaType)) {
    context.addIssue({ code: 'custom', path: ['mediaType'], message: 'This file type is not allowed.' })
  }
  if (input.rightsState === 'pass' && !input.provenance.sourceUrl && !input.provenance.originalDeclaration) {
    context.addIssue({ code: 'custom', path: ['provenance'], message: 'Passing rights requires a source URL or original-work declaration.' })
  }
})
const querySchema = z.object({ productVersionId: z.string().uuid().optional() })
const idSchema = z.string().uuid()
const MAX_BYTES = 5 * 1024 * 1024

export function registerAssetRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new AssetRepository(db)
  const storage = new LocalAssetStorage(env.ARSY_ASSET_STORAGE_DIR)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/assets', async (request, reply) => {
    const query = querySchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Asset query is invalid.' } })
    return { data: await repository.list(ownerId, query.data.productVersionId) }
  })

  app.post('/api/v1/assets', { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const body = uploadSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Asset upload input is invalid.', details: body.error.flatten() } })
    const content = Buffer.from(body.data.contentBase64, 'base64')
    if (content.length === 0 || content.length > MAX_BYTES || content.toString('base64') !== body.data.contentBase64) {
      return reply.code(400).send({ error: { code: 'INVALID_ASSET_CONTENT', message: 'Asset content must be canonical base64 and no larger than 5 MiB.' } })
    }

    const assetId = randomUUID()
    let stored: { storageKey: string; checksumSha256: string }
    try {
      stored = await storage.write(ownerId, assetId, content)
    } catch (error) {
      if (error instanceof Error && error.message === 'ARSY_ASSET_STORAGE_DIR_NOT_CONFIGURED') {
        return reply.code(503).send({ error: { code: 'ASSET_STORAGE_NOT_CONFIGURED', message: 'Persistent asset storage is not configured.' } })
      }
      throw error
    }

    let asset: Awaited<ReturnType<AssetRepository['create']>>
    try {
      asset = await repository.create(ownerId, actorId, {
        id: assetId,
        productVersionId: body.data.productVersionId,
        filename: body.data.filename,
        mediaType: body.data.mediaType,
        storageKey: stored.storageKey,
        checksumSha256: stored.checksumSha256,
        provenance: body.data.provenance,
        rightsState: body.data.rightsState,
      })
    } catch (error) {
      await storage.delete(stored.storageKey)
      throw error
    }
    if (!asset) {
      await storage.delete(stored.storageKey)
      return reply.code(404).send({ error: { code: 'PRODUCT_VERSION_NOT_FOUND', message: 'Product version was not found for this operator.' } })
    }
    return reply.code(201).send({ data: asset })
  })

  app.get('/api/v1/assets/:id/content', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } })
    const asset = await repository.get(ownerId, params.data.id)
    if (!asset) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    try {
      const content = await storage.read(asset.storageKey)
      return reply.type(asset.mediaType)
        .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(asset.filename)}`)
        .header('x-content-sha256', asset.checksumSha256 ?? '')
        .send(content)
    } catch {
      return reply.code(503).send({ error: { code: 'ASSET_CONTENT_UNAVAILABLE', message: 'Asset metadata exists but its stored binary could not be read.' } })
    }
  })

  app.delete('/api/v1/assets/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } })
    const archived = await repository.archive(ownerId, actorId, params.data.id)
    if (!archived) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    return reply.code(204).send()
  })
}
