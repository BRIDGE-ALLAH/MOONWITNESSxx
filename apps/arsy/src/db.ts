import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { createPostgresAdapter } from "@riotworks/orm-db-adaptor-postgres";
import { createSqliteSystemAdapter } from "@riotworks/orm-db-adaptor-sqlite";

/** Initialize the System Database first, then the Business Database. */
export async function setupDatabase(app: FastifyInstance): Promise<void> {
  const systemPath = resolve(process.env.SYSTEM_DATABASE_PATH ?? ".data/system.sqlite");
  await mkdir(dirname(systemPath), { recursive: true });

  const systemDb = createSqliteSystemAdapter();
  await systemDb.connect({ filename: systemPath });

  const businessDb = createPostgresAdapter();
  try {
    if (!process.env.DATABASE_URL) throw new TypeError("DATABASE_URL is required for the Business Database.");
    await businessDb.connect({
      connectionString: process.env.DATABASE_URL,
      pool: { min: 0, max: 20, idleTimeoutMs: 30_000 },
      applicationName: "MOONWITNESS-ARSY",
    });
  } catch (error) {
    await systemDb.close();
    throw error;
  }

  app.decorate("systemDb", systemDb);
  app.decorate("businessDb", businessDb);

  app.get("/health/system-db", async (_request, reply) => {
    try {
      await systemDb.ping();
      return { status: "ok", provider: "sqlite", role: "system" };
    } catch {
      return reply.code(503).send({ status: "error", provider: "sqlite", role: "system" });
    }
  });

  app.get("/health/business-db", async (_request, reply) => {
    try {
      await businessDb.ping();
      return { status: "ok", provider: "postgres", role: "business" };
    } catch {
      return reply.code(503).send({ status: "error", provider: "postgres", role: "business" });
    }
  });

  app.addHook("onClose", async () => {
    try {
      await businessDb.close();
    } finally {
      await systemDb.close();
    }
  });
}
