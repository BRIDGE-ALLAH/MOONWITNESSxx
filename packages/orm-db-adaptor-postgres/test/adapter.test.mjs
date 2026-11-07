import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAdapter } from "../src/index.ts";

test("PostgreSQL adapter requires a connection string and reports its provider identity", async () => {
  assert.throws(() => createPostgresAdapter(""), /connection string/);
  const adapter = createPostgresAdapter("postgres://invalid:invalid@127.0.0.1:1/invalid");
  assert.equal(adapter.identity.provider, "postgres");
  assert.equal(adapter.identity.role, "business");
  await assert.rejects(adapter.ping(), /not connected/);
});

test("PostgreSQL adapter performs real CRUD, transactions, and introspection when TEST_DATABASE_URL is supplied", async (context) => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    context.skip("TEST_DATABASE_URL is not configured; live PostgreSQL verification is unavailable.");
    return;
  }
  const adapter = createPostgresAdapter(connectionString);
  const table = "orm_ci_" + Date.now();
  await adapter.connect();
  try {
    await adapter.executeSchemaOperation({
      id: "create-ci-table",
      kind: "create-table",
      table,
      columns: [
        { name: "id", type: "UUID", nullable: false, primaryKey: true },
        { name: "value", type: "TEXT", nullable: false },
      ],
    });
    await adapter.executeSchemaOperation({
      id: "create-ci-index",
      kind: "create-index",
      table,
      name: table + "_value_idx",
      columns: ["value"],
      unique: false,
    });

    const id = "00000000-0000-4000-8000-000000000001";
    const created = await adapter.insert(table, { id, value: "before" });
    assert.equal(created.value, "before");
    assert.equal((await adapter.select({ table, where: { kind: "condition", field: "id", operator: "eq", value: id } })).length, 1);
    assert.equal(await adapter.update(table, { kind: "condition", field: "id", operator: "eq", value: id }, { value: "after" }), 1);
    assert.equal((await adapter.select({ table, where: { kind: "condition", field: "value", operator: "eq", value: "after" } }))[0].id, id);

    await assert.rejects(adapter.transaction(async (tx) => {
      await tx.insert(table, { id: "00000000-0000-4000-8000-000000000002", value: "rollback" });
      throw new Error("expected rollback");
    }), /expected rollback/);
    assert.equal((await adapter.select({ table })).length, 1);

    const schema = await adapter.inspectSchema();
    const found = schema.tables.find((item) => item.name === table);
    assert.ok(found?.columns.some((column) => column.name === "value"));
    assert.ok(found?.indexes.some((index) => index.name === table + "_value_idx"));
    assert.equal(await adapter.delete(table, { kind: "condition", field: "id", operator: "eq", value: id }), 1);
  } finally {
    await adapter.close();
  }
});
