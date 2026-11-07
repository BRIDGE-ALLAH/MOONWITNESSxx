import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { AssetRepository, type AssetInput, type InspectionInput } from './repository.ts'
import { createAssetStorage, type AssetStorage } from './storage.ts'
import { getInspectionPrincipalId } from '../auth/operator-token.ts'

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
}).superRefine((value, context) => {
  if (value.status !== 'unknown' && value.evidence.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['evidence'],
      message: 'A pass or blocked inspection must include supporting evidence.',
    })
  }
})
const idSchema = z.string().uuid()
const listSchema = z.object({ productId: idSchema.optional() })

function decodeBase64(value: string): Buffer | null {
  const normalized = value.replace(/\\s/g, '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) return null
  const bytes = Buffer.from(normalized, 'base64')
  return bytes.toString('base64') === normalized ? bytes : null
}
function matchesMediaType(mediaType: string, bytes: Buffer): boolean {
  if (mediaType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mediaType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mediaType === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (mediaType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-'
  if (mediaType === 'application/zip') return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3])
  if (mediaType === 'text/plain') {
    if (bytes.includes(0)) return false
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true } catch { return false }
  }
  return false
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
    const idempotencyKey = request.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.length > 200) {
      return reply.code(400).send({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid Idempotency-Key header is required.' } })
    }
    if (parsed.data.provenance.sourceAssetId) {
      const sourceAsset = await repository.get(ownerId, parsed.data.provenance.sourceAssetId)
      if (!sourceAsset) return reply.code(409).send({
        error: { code: 'SOURCE_ASSET_NOT_FOUND', message: 'The source asset does not exist under this operator.' },
      })
    }
    const bytes = decodeBase64(parsed.data.contentBase64)
    if (!bytes || bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
      return reply.code(400).send({ error: { code: 'INVALID_ASSET_BYTES', message: 'Asset bytes must be valid base64 and no larger than 10 MiB.' } })
    }
    if (!matchesMediaType(parsed.data.mediaType, bytes)) {
      return reply.code(400).send({ error: { code: 'ASSET_CONTENT_TYPE_MISMATCH', message: 'The uploaded bytes do not match the declared safe media type.' } })
    }
    const storageKey = randomUUID()
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const requestHash = createHash('sha256').update(JSON.stringify({
      productId: parsed.data.productId, productVersion: parsed.data.productVersion,
      fileName: parsed.data.fileName, mediaType: parsed.data.mediaType, byteSize: bytes.length,
      sha256, provenance: parsed.data.provenance,
    })).digest('hex')
    const input: AssetInput = {
      productId: parsed.data.productId,
      productVersion: parsed.data.productVersion,
      fileName: parsed.data.fileName,
      mediaType: parsed.data.mediaType,
      byteSize: bytes.length,
      storageKey,
      sha256,
      idempotencyKey: idempotencyKey.trim(),
      requestHash,
      provenance: parsed.data.provenance,
    }
    try {
      await storage.put(storageKey, bytes)
      const storedBytes = await storage.get(storageKey)
      const storedHash = createHash('sha256').update(storedBytes).digest('hex')
      if (storedHash !== sha256 || storedBytes.length !== bytes.length) {
        await storage.delete(storageKey).catch(() => undefined)
        return reply.code(503).send({ error: { code: 'ASSET_STORAGE_CHECKSUM_MISMATCH', message: 'Stored asset bytes failed checksum verification; no asset record was created.' } })
      }
    } catch {
      await storage.delete(storageKey).catch(() => undefined)
      return reply.code(503).send({ error: { code: 'ASSET_STORAGE_UNAVAILABLE', message: 'Asset storage could not safely persist and verify the uploaded bytes.' } })
    }
    try {
      const result = await repository.create(ownerId, actorId, input)
      if (!result) {
        await storage.delete(storageKey)
        return reply.code(409).send({ error: { code: 'PRODUCT_VERSION_NOT_FOUND', message: 'The product version does not exist under this operator.' } })
      }
      if (result.replayed) await storage.delete(storageKey)
      return reply.code(result.replayed ? 200 : 201).send({ data: safeAsset(result.asset), replayed: result.replayed })
    } catch (error) {
      await storage.delete(storageKey).catch(() => undefined)
      if (error instanceof Error && error.message === 'ASSET_IDEMPOTENCY_KEY_REUSED') {
        return reply.code(409).send({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for different asset bytes or provenance.' } })
      }
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
    const inspectionPrincipalId = getInspectionPrincipalId(request)
    if (inspectionPrincipalId && parsed.data.inspectionSource === 'operator-attestation') {
      return reply.code(403).send({ error: { code: 'INSPECTION_SOURCE_MISMATCH', message: 'Trusted inspection principals must record automated-check or independent-review source types.' } })
    }
    if (!inspectionPrincipalId && parsed.data.inspectionSource !== 'operator-attestation') {
      return reply.code(403).send({ error: { code: 'TRUSTED_INSPECTOR_REQUIRED', message: 'Automated checks and independent reviews require a separately configured inspection principal.' } })
    }
    const inspection = await repository.appendInspection(ownerId, inspectionPrincipalId ?? actorId, params.data.id, parsed.data as InspectionInput)
    if (!inspection) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Asset was not found.' } })
    return reply.code(201).send({ data: inspection })
  })
}
