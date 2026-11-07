/**
 * Database connector for ARSY application.
 *
 * Connects to PostgreSQL using the Docker service connection.
 * Uses the DATABASE_URL environment variable which should point
 * to the postgres Docker service (e.g., postgres://user:password@postgres:5432/db).
 *
 * This module is designed to work with Fastify and provides:
 * - Database connection pooling
 * - Health check endpoints
 * - Graceful connection management
 */

import { Pool } from 'pg'

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // maximum number of connections in the pool
  idleTimeoutMillis: 30000, // close connections after 30 seconds of idle
})

/**
 * Setup database connection for Fastify app.
 *
 * @param app - Fastify instance to attach database to
 */
export function setupDatabase(app: any): void {
  // Attach pool to fastify instance for use in routes
  app.decorate('db', pool)

  // Add health check route
  app.get('/health/db', async () => {
    try {
      await pool.query('SELECT 1')
      return { status: 'ok', message: 'Database connection healthy' }
    } catch (error) {
      console.error('Database health check failed:', error)
      throw error
    }
  })

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    await pool.end()
    console.log('Database pool closed')
  }

  // Handle process termination
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Export shutdown for use in other modules
  ;(app as any).shutdownDatabase = shutdown
}

export { pool }
