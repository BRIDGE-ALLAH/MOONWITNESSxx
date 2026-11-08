import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { DatabasePool } from '../db.ts'
import { PortfolioMetricsRepository } from './portfolio-metrics.ts'

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
}).refine((query) => new Date(query.from).getTime() < new Date(query.to).getTime(), {
  path: ['to'],
  message: 'The end of the metrics window must be after its start.',
})

export function registerPortfolioMetricsRoutes(
  app: FastifyInstance,
  db: DatabasePool,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const ownerId = env.ARSY_OPERATOR_ID?.trim() ?? ''
  const repository = new PortfolioMetricsRepository(db)

  app.get('/api/v1/portfolio-metrics', async (request, reply) => {
    if (!ownerId) return reply.code(503).send({ error: { code: 'OPERATOR_AUTH_NOT_CONFIGURED' } })
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_METRICS_WINDOW', message: 'Provide an offset-aware from/to window where from is before to.' } })
    return { data: await repository.get(ownerId, parsed.data.from, parsed.data.to) }
  })
}
