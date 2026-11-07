import { Pool } from "pg";
import type { FastifyInstance } from "fastify";

/** Attach one PostgreSQL pool to the API lifecycle. */
export function setupDatabase(app: FastifyInstance): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
  });

  app.decorate("db", pool);
  app.get("/health/db", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", message: "Database connection healthy" };
    } catch {
      return reply.code(503).send({ status: "error", message: "Database unavailable" });
    }
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return pool;
}
