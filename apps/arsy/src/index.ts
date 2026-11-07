import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
// ARSY application composition root. Core governance primitives live in @riotworks/arsy-core.

const app = Fastify({
  logger: true,
})

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

const typedApp = app.withTypeProvider<ZodTypeProvider>()

// Example route
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
  async () => {
    return {
      status: 'ok',
      message: 'ARSY Command Center is running',
    }
  }
)

// Database connector setup
import { pool, setupDatabase } from './db.ts'
import { resolveServerConfig } from './config.ts'
setupDatabase(app)

typedApp.get('/health/live', async () => ({ status: 'alive' }))
typedApp.get('/health/ready', async () => {
  await pool.query('SELECT 1')
  return { status: 'ready' }
})

const { host, port } = resolveServerConfig()
app.listen({ host, port })
  .then(() => app.log.info({ host, port }, 'ARSY Command Center is listening'))
  .catch((error) => {
    app.log.error({ err: error }, 'ARSY failed to start')
    process.exit(1)
  })

export { app }
