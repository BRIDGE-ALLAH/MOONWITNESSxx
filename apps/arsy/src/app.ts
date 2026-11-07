import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { createDatabasePool, setupDatabase, type DatabasePool } from './db.ts'
import { registerOpportunityRoutes } from './opportunities/routes.ts'
import { registerProductRoutes } from './products/routes.ts'

export interface CreateAppOptions {
  databasePool?: DatabasePool
  logger?: boolean
  env?: NodeJS.ProcessEnv
}

export function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true })
  const databasePool = options.databasePool ?? createDatabasePool(options.env)

  app.register(async (instance) => {
    // Register the onRoute hook before declaring routes in this encapsulated scope.
    await instance.register(rateLimit, { global: false })
    instance.setValidatorCompiler(validatorCompiler)
    instance.setSerializerCompiler(serializerCompiler)

    const typedApp = instance.withTypeProvider<ZodTypeProvider>()

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

    setupDatabase(instance, databasePool)
    registerOpportunityRoutes(instance, databasePool, options.env)
    registerProductRoutes(instance, databasePool, options.env)
  })

  return app
}
