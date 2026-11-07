import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { AssetRepository, type AssetInput, type InspectionInput } from './repository.ts'
import { createAssetStorage, type AssetStorage } from './storage.ts'

const MAX_ASSET_BYTES = 10 * 1024 * 1024
const allowedMediaTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/zip'] as const
const provenanceSchema = z.object({
  sourceAssetId: z.string().uuid().optional(),
  sourceReference: z.string().trim().max(2048).optional(),
  creator: z.string().trim().min(2).max(200),
  license: z.string().trim().min(2).max(500),
  permissionBasis: z.string().trim().min(10).max(1000),
  toolModel: z.string().trim().max(300).optional(),
  editHistory: z.array(z.object({
    action: z.string().trim().min(2).max(300),
    actor: z.string().trim().min(2).max(200),
    occurredAt: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(1000).optional(),
  })).max(100),
  disclosure: z.string().trim().min(3).max(1000),
})
const uploadSchema = z.object({
  productId: z.string().uuid(),
  productVersion: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(180).regex(/^[^/\\\\\\u0000-\\u001f]+$/),
  mediaType: z.enum(allowedMediaTypes),
  contentBase64: z.string().min(4).max(14 * 1024 * 1024),
  provenance: provenanceSchema,
})
const inspectionSchema = z.object({
  inspectionType: z.enum(['rights', 'policy', 'technical-qa', 'creative-qa']),
  status: z.enum(['pass', 'blocked', 'unknown']),
  inspectionSource: z.enum(['operator-attestation', 'automated-check', 'independent-review']),
  rationale: z.string().trim().min(10).max(2000),
  findings: z.array(z.object({
    code: z.string().trim().min(1).max(100),
    severity: z.enum(['info', 'warning', 'blocking']),
    message: z.string().trim().min(1).max(1000),
  })).max(100),
  evidence: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    url: z.string().url().max(2048).optional(),
    reference: z.string().trim().max(500).optional(),
  })).max(100),
})
const idSchema = z.string().uuid()
const listSchema = z.object({ productId: idSchema.optional() })

function decodeBase64(value: string): Buffer | null {
  const normalized = value.replace(/\\s/g, '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) return null
  const bytes = Buffer.from(normalized, 'base64')
  return bytes.toString('base64') === normalized ? bytes : null
}
function safeAsset(asset: Awaited<ReturnType<AssetRepository['get']>>) {
  if (!asset) return null
  const { storageKey: _storageKey, ...publicAsset } = asset
  return publicAsset
}
function safeDownloadName(fileName: string): string {
  return fileName.replace(/[\\r\\n"\\\\]/g, '_')
}

export function registerAssetRoutes(
  app: FastifyInstance,
  db: DatabasePool,
  env: NodeJS.ProcessEnv = process.env,
  suppliedStorage?: AssetStorage,
): void {
  const repository = new AssetRepository(db)
  const storage = suppliedStorage ?? createAssetStorage(env)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/assets', async (request, reply) => {
    const parsed = listSchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Invalid asset list query.' } })
    const assets = await repository.list(ownerId, parsed.data.productId)
    return { data: assets.map((asset) => safeAsset(asset)) }
  })

  app.post('/api/v1/assets', { bodyLimit: 15 * 1024 * 1024 }, async (request, reply) => {
    const parsed = uploadSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Asset upload metadata is invalid.', details: parsed.error.flatten() },
    })
    const bytes = decodeBase64(parsed.data.contentBase64)
    if (!bytes || bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
      return reply.code(400).send({ error: { code: 'INVALID_ASSET_BYTES', message: 'Asset bytes must be valid base64 and no larger than 10 MiB.' } })
    }
    const storageKey = randomUUID()
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const input: AssetInput = {
      productId: parsed.data.productId,
      productVersion: parsed.data.productVersion,
      fileName: parsed.data.fileName,
      mediaType: parsed.data.mediaType,
      byteSize: bytes.length,
      storageKey,
      sha256,
      provenance: parsed.data.provenance,
    }
    await storage.put(storageKey, bytes)
    try {
      const asset = await repository.create(ownerId, actorId, input)
      if (!asset) {
        await storage.delete(storageKey)
        return reply.code(409).send({ error: { code: 'PRODUCT_VERSION_NOT_FOUND', message: 'The product version does not exist under this operator.' } })
      }
      return reply.code(201).send({ data: safeAsset(asset) })
    } catch (error) {
      await storage.delete(storageKey).catch(() => undefined)
      throw error
    }
  })

  app.get('/api/v1/assets/:id', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } })
    const asset = await repository.get(ownerId, params.data.id)
    if (!asset) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    return { data: safeAsset(asset) }
  })

  app.get('/api/v1/assets/:id/download', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } })
    const asset = await repository.get(ownerId, params.data.id)
    if (!asset) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    try {
      const bytes = await storage.get(asset.storageKey)
      return reply
        .type(asset.mediaType)
        .header('Content-Length', String(bytes.length))
        .header('Content-Disposition', `attachment; filename="${safeDownloadName(asset.fileName)}"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`)
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .send(bytes)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.code(410).send({ error: { code: 'ASSET_BYTES_MISSING', message: 'Asset metadata exists but the stored bytes are unavailable. Restore the asset volume from backup.' } })
      }
      throw error
    }
  })

  app.get('/api/v1/assets/:id/inspections', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } })
    const history = await repository.inspections(ownerId, params.data.id)
    if (!history) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    return { data: history }
  })

  app.get('/api/v1/assets/:id/readiness', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: { code: 'INVALID_ID', message: 'Asset ID must be a UUID.' } })
    const readiness = await repository.readiness(ownerId, params.data.id)
    if (!readiness) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    return { data: readiness }
  })

  app.post('/api/v1/assets/:id/inspections', async (request, reply) => {
    const params = z.object({ id: idSchema }).safeParse(request.params)
    const parsed = inspectionSchema.safeParse(request.body)
    if (!params.success || !parsed.success) return reply.code(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Inspection input is invalid.', details: parsed.success ? undefined : parsed.error.flatten() },
    })
    const inspection = await repository.appendInspection(ownerId, actorId, params.data.id, parsed.data as InspectionInput)
    if (!inspection) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    return reply.code(201).send({ data: inspection })
  })
}
