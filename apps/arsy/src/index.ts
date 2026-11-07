import Fastify from 'fastify'
import Zod from 'zod'
import fastifyTypeProviderZod from 'fastify-type-provider-zod'

// ARSY's HTTP application is the canonical backend entrypoint.
// Reusable lifecycle/configuration modules will be extracted when implemented and tested.

const app = Fastify({
  logger: true,
})

app.register(fastifyTypeProviderZod)

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
  async () => {
    return {
      status: 'ok',
      message: 'ARSY Command Center is running',
    }
  }
)

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
