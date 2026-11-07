import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { createDatabasePool, setupDatabase, type DatabasePool } from './db.ts'
import { registerOpportunityRoutes } from './opportunities/routes.ts'

export interface CreateAppOptions {
  databasePool?: DatabasePool
  logger?: boolean
  env?: NodeJS.ProcessEnv
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const typedApp = app.withTypeProvider<ZodTypeProvider>()
  const databasePool = options.databasePool ?? createDatabasePool(options.env)

  // The rate-limit plugin is wrapped with fastify-plugin. Register it at the
  // application root before declaring routes so its onRoute hook can see the
  // route-level config on both database health endpoints. Keep global limiting
  // disabled: only routes with an explicit config.rateLimit are throttled.
  await app.register(rateLimit, { global: false })

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
