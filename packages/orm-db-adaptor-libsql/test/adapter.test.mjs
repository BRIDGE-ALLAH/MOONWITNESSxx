import test from "node:test";
import assert from "node:assert/strict";
import { createLibsqlAdapter } from "../src/index.ts";

test("libSQL adapter persists, filters and rolls back transactions", async () => {
  const adapter = createLibsqlAdapter({ url: "file::memory:" });
  await adapter.connect();
  try {
    await adapter.executeSchemaOperation({
      id: "create-items", kind: "create-table", table: "items",
      columns: [
        { name: "id", type: "TEXT", nullable: false, primaryKey: true },
        { name: "name", type: "TEXT", nullable: false },
      ],
    });
    await adapter.insert("items", { id: "1", name: "one" });
    const rows = await adapter.select({ table: "items", where: { kind: "condition", field: "id", operator: "eq", value: "1" } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "one");
    await assert.rejects(adapter.transaction(async (tx) => {
      await tx.insert("items", { id: "2", name: "two" });
      throw new Error("rollback");
    }), /rollback/);
    assert.equal((await adapter.select({ table: "items" })).length, 1);
  } finally {
    await adapter.close();
  }
});
