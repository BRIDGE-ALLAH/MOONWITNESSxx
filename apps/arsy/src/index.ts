import Fastify from 'fastify'
import Zod from 'zod'
import fastifyTypeProviderZod from 'fastify-type-provider-zod'
// ARSY app routes (prototype/local). Core modules live in @riotworks/arsy-core.

const app = Fastify({
  logger: true,
})

app.register(fastifyTypeProviderZod)

// Example route
app.get(
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
  async (request, reply) => {
    return {
      status: 'ok',
      message: 'ARSY Command Center is running',
    }
  }
)

// Database connector setup
import { setupDatabase } from './db'
setupDatabase(app)

app
  .listen({ port: 3000 })
  .then(() => {
    console.log('🚀 ARSY Command Center running on http://localhost:3000')
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

export { app }
