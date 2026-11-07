import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
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

test("PostgreSQL adapter executes DDL, parameterized queries, rollback and catalog inspection", {
  skip: !process.env.TEST_POSTGRES_URL,
}, async () => {
  const adapter = new PostgresDatabaseAdapter();
  const table = "mw_adapter_" + randomUUID().replace(/-/g, "");
  await adapter.connect({
    connectionString: process.env.TEST_POSTGRES_URL,
    pool: { max: 2 },
    applicationName: "MOONWITNESS-ADAPTER-TEST",
  });
  try {
    await adapter.executeSchemaOperation({
      id: "create-live-table",
      kind: "create-table",
      table,
      description: "create adapter integration table",
      destructive: false,
      payload: {
        columns: [
          { name: "id", dataType: "TEXT", nullable: false },
          { name: "name", dataType: "VARCHAR(160)", nullable: false },
        ],
      },
    });
    await adapter.query({
      text: 'INSERT INTO "' + table + '" (id, name) VALUES ($1, $2)',
      parameters: [{ value: "row-1" }, { value: "First row" }],
      operation: "write",
    });
    const transaction = await adapter.beginTransaction();
    await transaction.query({
      text: 'INSERT INTO "' + table + '" (id, name) VALUES ($1, $2)',
      parameters: [{ value: "row-2" }, { value: "Rolled back row" }],
      operation: "write",
    });
    await transaction.rollback();

    const count = await adapter.query<{ count: string }>({
      text: 'SELECT COUNT(*)::text AS count FROM "' + table + '"',
      operation: "read",
    });
    assert.equal(count.rows[0]?.count, "1");

    await adapter.executeSchemaOperation({
      id: "create-live-index",
      kind: "create-index",
      table,
      description: "create adapter integration index",
      destructive: false,
      payload: { name: table + "_name_idx", columns: ["name"], unique: false },
    });
    const snapshot = await adapter.inspectSchema();
    const tableSnapshot = snapshot.tables.find((item) => item.name === table);
    assert.ok(tableSnapshot);
    assert.equal(tableSnapshot.columns.length, 2);
    assert.equal(tableSnapshot.indexes.some((item) => item.name === table + "_name_idx"), true);
  } finally {
    await adapter.query({ text: 'DROP TABLE IF EXISTS "' + table + '"', operation: "schema" });
    await adapter.close();
  }
});
