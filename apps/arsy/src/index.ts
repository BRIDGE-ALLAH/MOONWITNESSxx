import type { FastifyPluginAsync } from "fastify";
import { arsyCorePlugin } from "@riotworks/arsy-core";
import { setupDatabase } from "./db.js";

/** Fastify CLI entrypoint. The core plugin owns shared HTTP behavior. */
const app: FastifyPluginAsync = async (fastify) => {
  await fastify.register(arsyCorePlugin);
  setupDatabase(fastify);
};

export default app;
