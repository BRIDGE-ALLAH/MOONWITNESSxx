import Fastify from 'fastify'
import Zod from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { resolveArsyRuntimeConfig } from './config/runtime'
import { setupDatabase } from './db'

// ARSY owns HTTP lifecycle; @riotworks/arsy-core remains framework-neutral.
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
  }),
)

setupDatabase(app)

const { host, port } = resolveArsyRuntimeConfig(process.env)

app.listen({ host, port }).catch((error) => {
  app.log.error(error, 'ARSY failed to start')
  process.exitCode = 1
})

export { app }
