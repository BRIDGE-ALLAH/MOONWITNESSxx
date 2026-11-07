import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { setupDatabase, type DatabasePool } from './db.ts'

export interface CreateAppOptions {
  databasePool: DatabasePool
  logger?: boolean
}

export function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: options.logger ?? true })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const typedApp = app.withTypeProvider<ZodTypeProvider>()
  const { databasePool } = options
  let databaseReady = false
  let readinessTimer: ReturnType<typeof setInterval> | undefined

  const refreshDatabaseReadiness = async () => {
    try {
      await databasePool.query('SELECT 1')
      databaseReady = true
    } catch {
      databaseReady = false
    }
  }

  app.addHook(
    'onReady',
    async () => {
      await refreshDatabaseReadiness()
      readinessTimer = setInterval(() => {
        void refreshDatabaseReadiness()
      }, 5_000)
      readinessTimer.unref()
    },
  )

  app.addHook(
    'onClose',
    async () => {
      if (readinessTimer) clearInterval(readinessTimer)
    },
  )

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
    async (_request, reply) => {
      if (!databaseReady) {
        return reply.code(503).send({ status: 'not-ready' })
      }
      return { status: 'ready' }
    },
  )

  setupDatabase(app, databasePool, () => databaseReady)
  return app
}
