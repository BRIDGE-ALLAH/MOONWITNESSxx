import { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'

export interface DatabasePool {
  query: (statement: string, values?: unknown[]) => Promise<unknown>
  connect?: () => Promise<{
    query: (statement: string, values?: unknown[]) => Promise<unknown>
    release: () => void
  }>
  end: () => Promise<void>
}

declare module 'fastify' {
  interface FastifyInstance {
    db: DatabasePool
  }
}

export function createDatabasePool(env: NodeJS.ProcessEnv = process.env): Pool {
  const connectionString = env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to start the ARSY application')
  }

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
  })
}

export function setupDatabase(app: FastifyInstance, pool: DatabasePool): void {
  app.decorate('db', pool)

  app.get(
    '/health/db',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      try {
        await pool.query('SELECT 1')
        return { status: 'ok', message: 'Database connection healthy' }
      } catch (error) {
        app.log.error({ err: error }, 'Database health check failed')
        return reply.code(503).send({
          status: 'unavailable',
          message: 'Database connection unavailable',
        })
      }
    },
  )

  app.addHook('onClose', async () => {
    await pool.end()
  })
}
