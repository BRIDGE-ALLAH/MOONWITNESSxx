import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
  type FastifyServerOptions,
} from "fastify";
import { z } from "zod";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

const healthCheckSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  version: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  path: z.string().optional(),
});

/** Reusable ARSY HTTP platform plugin. Business routes belong to app modules. */
export const arsyCorePlugin: FastifyPluginAsync = async (app) => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get("/", {
    schema: {
      response: {
        200: healthCheckSchema,
      },
    },
  }, async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");
    const errorValue = error instanceof Error ? error : new Error("Unknown request error");
    const statusValue = (error as { statusCode?: unknown }).statusCode;
    const statusCode = typeof statusValue === "number" && statusValue >= 400 && statusValue < 500
      ? statusValue
      : 500;
    reply.code(statusCode).send({
      error: errorValue.name || "Internal Server Error",
      message: statusCode < 500 ? errorValue.message : "Internal Server Error",
      path: request.url,
    });
  });
};

export function createApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, ...options });
  app.register(arsyCorePlugin);
  return app;
}

export async function startServer(
  port = 3000,
  host = "0.0.0.0",
): Promise<void> {
  const app = createApp();
  try {
    await app.listen({ port, host });
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

export { healthCheckSchema, errorResponseSchema };
