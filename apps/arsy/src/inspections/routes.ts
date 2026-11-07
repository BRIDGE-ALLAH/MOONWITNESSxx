import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { InspectionRepository } from './repository.ts'

const createSchema = z.object({
  productVersionId: z.string().uuid(),
  inspectionType: z.enum(['rights', 'policy', 'technical', 'creative']),
  status: z.enum(['pass', 'warning', 'blocked', 'needs-review']),
  findings: z.array(z.object({
    severity: z.enum(['info', 'warning', 'blocker']),
    description: z.string().trim().min(5).max(2000),
    evidenceUrl: z.string().url().optional(),
  })).min(1).max(100),
}).superRefine((input, context) => {
  if (input.status === 'pass' && input.findings.some((finding) => finding.severity === 'blocker')) {
    context.addIssue({
      code: 'custom',
      path: ['findings'],
      message: 'An inspection with blocker findings cannot be marked as passing.',
    })
  }
  if (input.status === 'pass' && ['rights', 'policy'].includes(input.inspectionType) &&
    !input.findings.some((finding) => finding.evidenceUrl)) {
    context.addIssue({ code: 'custom', path: ['findings'], message: 'Passing rights or policy inspection requires at least one evidence URL.' })
  }
})
const querySchema = z.object({ productVersionId: z.string().uuid().optional() })

export function registerInspectionRoutes(app: FastifyInstance, db: DatabasePool, env: NodeJS.ProcessEnv = process.env): void {
  const repository = new InspectionRepository(db)
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const actorId = ownerId

  app.get('/api/v1/inspections', async (request, reply) => {
    const query = querySchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: { code: 'INVALID_QUERY', message: 'Inspection query is invalid.' } })
    return { data: await repository.list(ownerId, query.data.productVersionId) }
  })

  app.post('/api/v1/inspections', async (request, reply) => {
    const body = createSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Inspection input is invalid.', details: body.error.flatten() } })
    const record = await repository.record(ownerId, actorId, body.data)
    if (!record) return reply.code(404).send({ error: { code: 'PRODUCT_VERSION_NOT_FOUND', message: 'Product version was not found for this operator.' } })
    return reply.code(201).send({ data: record })
  })
}
