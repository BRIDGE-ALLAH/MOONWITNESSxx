import assert from "node:assert/strict";
import test from "node:test";
import { PostgresDatabaseAdapter } from "../src/index.ts";

test("PostgreSQL adapter enforces explicit connection configuration", async () => {
  const adapter = new PostgresDatabaseAdapter();
  await assert.rejects(() => adapter.connect({}), /connectionString is required/);
  await assert.rejects(() => adapter.ping(), /not connected/);
  await assert.rejects(() => adapter.beginTransaction(), /not connected/);
});

test("PostgreSQL adapter exposes the Business Database identity", () => {
  const adapter = new PostgresDatabaseAdapter();
  assert.deepEqual(adapter.identity, { provider: "postgres", role: "business" });
  assert.equal(adapter.capabilities.supported.has("transactional-ddl"), true);
});
