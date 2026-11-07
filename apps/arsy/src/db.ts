/**
 * Database connector for ARSY.
 *
 * The pool is owned by Fastify's lifecycle. Readiness probes verify the
 * database connection; liveness probes intentionally do not depend on it.
 */
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
})

export function setupDatabase(app: any): void {
  app.decorate('db', pool)

  app.get('/health/ready', async (_request: unknown, reply: any) => {
    try {
      await pool.query('SELECT 1')
      return { status: 'ok', dependencies: { database: 'ready' } }
    } catch (error) {
      app.log.error({ err: error }, 'Database readiness check failed')
      return reply.code(503).send({
        status: 'error',
        dependencies: { database: 'unavailable' },
      })
    }
  })

  app.addHook('onClose', async () => {
    await pool.end()
    app.log.info('Database pool closed')
  })
}

export { pool }
