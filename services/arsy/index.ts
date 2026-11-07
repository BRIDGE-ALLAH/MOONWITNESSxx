import Fastify from 'fastify'
import Zod from 'zod'
import { $Ref } from 'zod'
import { enqueueProductUpload, enqueueAnalysisJob, scheduleDailyProductReview } from './queue'

// ARSY Service — Fastify wrapper untuk command center
// Letakkan di: services/arsy/

const app = Fastify({ logger: true })

app.register(async (instance, opts) => {
  // Health check route
  app.get('/', async () => ({
    status: 'ok',
    service: 'ARSY',
    version: '0.0.0'
  }))

  // Product upload endpoint
  app.post('/products/upload', {
    schema: {
      body: Zod.object({
        productId: Zod.string(),
        filePath: Zod.string().url(),
        userId: Zod.string(),
        priority: Zod.enum(['high', 'normal', 'low']).optional()
      })
    }
  }, async (request, reply) => {
    const result = await enqueueProductUpload(request.body)
    return reply.code(202).send({
      status: 'accepted',
      data: result
    })
  })

  // Signal analysis endpoint
  app.post('/signals/analyze', {
    schema: {
      body: Zod.object({
        signalId: Zod.string(),
        analysisType: Zod.enum(['market', 'competitor', 'trend']),
        parameters: Zod.record(Zod.any()).optional()
      })
    }
  }, async (request, reply) => {
    const result = await enqueueAnalysisJob(request.body)
    return reply.code(202).send({
      status: 'accepted',
      data: result
    })
  })

  // Schedule daily review
  app.post('/products/:productId/review/schedule', {
    schema: {
      params: Zod.object({
        productId: Zod.string()
      })
    }
  }, async (request, reply) => {
    const result = await scheduleDailyProductReview(request.params.productId)
    return reply.code(202).send({
      status: 'accepted',
      data: result
    })
  })
})

export { app }