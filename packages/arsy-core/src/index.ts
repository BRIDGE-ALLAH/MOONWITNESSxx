/**
 * ARSY Core — Fastify server with ZOD validation.
 * 
 * Provides the Fastify lifecycle, plugins, runtime context,
 * logging, errors, and health checks for the ARSY application.
 * 
 * Business models and SQL dependencies belong in separate packages,
 * not in this core infrastructure layer.
 */

import Fastify from 'fastify'
import Zod from 'zod'
import fastifyTypeProviderZod from 'fastify-type-provider-zod'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// Initialize AJV with format detection
const ajv = new Ajv({ strict: false })
addFormats(ajv, ['date', 'date-time', 'url', 'email', 'ipv4', 'ipv6'])

// Health check schema
const healthCheckSchema = Zod.object({
  status: Zod.string(),
  timestamp: Zod.string().optional(),
  version: Zod.string().optional()
})

// Base error response
const errorResponseSchema = Zod.object({
  error: Zod.string(),
  message: Zod.string(),
  path: Zod.string().optional()
})

/**
 * Fastify app factory with standard configuration.
 * 
 * @param options - Optional configuration overrides
 * @returns Configured Fastify instance
 */
export function createApp(options: { port?: number } = {}): Fastify.Instance {
  const app = Fastify({
    logger: true,
    ...options
  })

  app.register(fastifyTypeProviderZod)

  // Health check route
  app.get(
    '/',
    {
      schema: {
        response: {
          200: healthCheckSchema
        }
      }
    },
    async (request, reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '0.0.1'
      }
    }
  )

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    reply.code(500).send({
      error: error.message || 'Internal Server Error',
      message: error.message,
      path: request.url
    })
  })

  return app
}

/**
 * Start the Fastify server.
 * 
 * @param port - Port to listen on (default: 3000)
 * @param host - Host to bind to (default: 0.0.0.0)
 */
export async function startServer(port: number = 3000, host: string = '0.0.0.0'): Promise<void> {
  const app = createApp({ port, host })
  
  try {
    await app.listen({ port, host })
    console.log(`🚀 ARSY Core running on http://${host}:${port}`)
  } catch (err) {
    console.error('Failed to start ARSY Core server:', err)
    process.exit(1)
  }
}

// Export types for external use
export type { healthCheckSchema, errorResponseSchema }