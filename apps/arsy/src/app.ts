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

  // Register the rate-limit hook before declaring these routes. Fastify runs
  // onRoute hooks at route-registration time, so registering the plugin and
  // declaring routes back-to-back in the root scope can leave existing routes
  // outside the limiter. The nested plugin waits for rate-limit registration
  // before adding the database health endpoints.
  app.register(async (healthRoutes) => {
    await healthRoutes.register(rateLimit, { global: false })

    healthRoutes.get(
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

    setupDatabase(healthRoutes, databasePool)
  })

  return app
}
