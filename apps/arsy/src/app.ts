import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { createDatabasePool, setupDatabase, type DatabasePool } from './db.ts'

export interface CreateAppOptions {
  databasePool?: DatabasePool
  logger?: boolean
}

export function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true })
  app.register(rateLimit, { global: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const typedApp = app.withTypeProvider<ZodTypeProvider>()
  const databasePool = options.databasePool ?? createDatabasePool()

  typedApp.get(
    '/',
    {
      schema: {
        response: {
          200: Zod.object({
            status: Zod.string(),
            message: Zod.string(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok',
      message: 'ARSY Command Center is running',
    }),
  )

  typedApp.get('/health/live', async () => ({ status: 'alive' }))

  typedApp.get(
    '/health/ready',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      try {
        await databasePool.query('SELECT 1')
        return { status: 'ready' }
      } catch {
        return reply.code(503).send({ status: 'not-ready' })
      }
    },
  )

  setupDatabase(app, databasePool)
  return app
}
