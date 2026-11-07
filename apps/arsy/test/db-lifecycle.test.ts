import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupDatabase } from "../src/db.ts";

test("ARSY bootstraps System before Business DB and closes both providers with Fastify", {
  skip: !process.env.TEST_POSTGRES_URL,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "moonwitness-arsy-db-"));
  const previousSystemPath = process.env.SYSTEM_DATABASE_PATH;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.SYSTEM_DATABASE_PATH = join(directory, "system.sqlite");
  process.env.DATABASE_URL = process.env.TEST_POSTGRES_URL;
  const app = Fastify();
  let initialized = false;
  try {
    await setupDatabase(app);
    initialized = true;
    const systemHealth = await app.inject({ method: "GET", url: "/health/system-db" });
    const businessHealth = await app.inject({ method: "GET", url: "/health/business-db" });
    assert.equal(systemHealth.statusCode, 200);
    assert.equal(businessHealth.statusCode, 200);
    await app.close();
    initialized = false;
  } finally {
    if (initialized) await app.close();
    if (previousSystemPath === undefined) delete process.env.SYSTEM_DATABASE_PATH;
    else process.env.SYSTEM_DATABASE_PATH = previousSystemPath;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(directory, { recursive: true, force: true });
  }
});
