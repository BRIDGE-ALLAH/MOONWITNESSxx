import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { setupDatabase } from './db'

// ARSY app routes (prototype/local). Core modules live in @riotworks/arsy-core.
const app = Fastify({ logger: true })

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

const typedApp = app.withTypeProvider<ZodTypeProvider>()

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
  })
)

app.get('/health/live', async () => ({ status: 'ok' }))

setupDatabase(app)

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'Graceful shutdown started')
  try {
    await app.close()
    app.log.info({ signal }, 'Graceful shutdown completed')
  } catch (error) {
    app.log.error({ err: error, signal }, 'Graceful shutdown failed')
    process.exitCode = 1
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

app
  .listen({ port, host })
  .then(() => {
    app.log.info({ host, port }, 'ARSY Command Center is running')
  })
  .catch((error) => {
    app.log.error(error)
    process.exitCode = 1
  })

export { app }
