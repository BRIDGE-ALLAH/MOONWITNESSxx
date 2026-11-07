import assert from "node:assert/strict";
import test from "node:test";
import { SqliteSystemDatabaseAdapter } from "../src/index.ts";

test("SQLite adapter connects, executes parameterized queries and introspects schema", async () => {
  const adapter = new SqliteSystemDatabaseAdapter();
  await adapter.connect({ filename: ":memory:" });
  assert.equal(adapter.identity.provider, "sqlite");
  assert.equal(adapter.identity.role, "system");
  assert.equal(adapter.capabilities.supported.has("transactional-ddl"), true);

  await adapter.executeSchemaOperation({
    id: "create-customer",
    kind: "create-table",
    table: "crm_customer",
    description: "create test table",
    destructive: false,
    payload: {
      columns: [
        { name: "id", dataType: "TEXT", nullable: false },
        { name: "name", dataType: "TEXT", nullable: false },
      ],
    },
  });
  await adapter.query({
    text: "INSERT INTO crm_customer (id, name) VALUES (?, ?)",
    parameters: [{ value: "c1" }, { value: "Customer One" }],
    operation: "write",
  });
  await adapter.executeSchemaOperation({
    id: "create-name-index",
    kind: "create-index",
    table: "crm_customer",
    description: "index name",
    destructive: false,
    payload: { name: "crm_customer_name_idx", columns: ["name"], unique: false },
  });

  const snapshot = await adapter.inspectSchema();
  const table = snapshot.tables.find((item) => item.name === "crm_customer");
  assert.ok(table);
  assert.equal(table.columns.length, 2);
  assert.equal(table.indexes.some((item) => item.name === "crm_customer_name_idx"), true);
  const rows = await adapter.query<{ id: string; name: string }>({
    text: "SELECT id, name FROM crm_customer WHERE id = ?",
    parameters: [{ value: "c1" }],
    operation: "read",
  });
  assert.deepEqual(rows.rows, [{ id: "c1", name: "Customer One" }]);
  await adapter.close();
});

test("SQLite transactions commit and rollback within one connection", async () => {
  const adapter = new SqliteSystemDatabaseAdapter();
  await adapter.connect({ filename: ":memory:" });
  await adapter.executeSchemaOperation({
    id: "create-counter",
    kind: "create-table",
    table: "counter",
    description: "create counter",
    destructive: false,
    payload: { columns: [{ name: "value", dataType: "INTEGER", nullable: false }] },
  });
  const transaction = await adapter.beginTransaction();
  await transaction.query({ text: "INSERT INTO counter (value) VALUES (?)", parameters: [{ value: 1 }], operation: "write" });
  await transaction.rollback();
  assert.equal(transaction.isActive, false);
  const result = await adapter.query({ text: "SELECT COUNT(*) AS count FROM counter", operation: "read" });
  assert.equal(Number(result.rows[0].count), 0);
  await adapter.close();
});

test("SQLite adapter rejects unsafe identifiers, unsupported types and concurrent transactions", async () => {
  const adapter = new SqliteSystemDatabaseAdapter();
  await adapter.connect({ filename: ":memory:" });
  await assert.rejects(() => adapter.executeSchemaOperation({
    id: "unsafe",
    kind: "create-table",
    table: "crm_customer; DROP TABLE users",
    description: "unsafe",
    destructive: false,
    payload: { columns: [{ name: "id", dataType: "TEXT", nullable: false }] },
  }), /Unsafe SQLite identifier/);
  await assert.rejects(() => adapter.executeSchemaOperation({
    id: "unsupported-type",
    kind: "create-table",
    table: "bad_table",
    description: "bad type",
    destructive: false,
    payload: { columns: [{ name: "value", dataType: "MAGIC", nullable: true }] },
  }), /Unsupported SQLite column type/);
  const transaction = await adapter.beginTransaction();
  await assert.rejects(() => adapter.beginTransaction(), /one active transaction/);
  await transaction.rollback();
  await adapter.close();
});
