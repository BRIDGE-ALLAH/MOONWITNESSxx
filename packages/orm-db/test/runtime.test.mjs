import test from "node:test";
import assert from "node:assert/strict";
import { baseAddon } from "../../orm-addon-base/src/index.ts";
import { composeRegistry, fields, Model } from "../../orm/src/index.ts";
import { createOrmRuntime, DatabaseAuditWriter } from "../src/index.ts";

class Task extends Model {
  static modelName = "task.item";
  static module = "base.core";
  static mixins = ["base.entity"];
  static fields = {
    title: fields.Char({ required: true }),
    workspaceId: fields.Char({ required: true, index: true }),
  };
}

class MemoryAdapter {
  identity = { provider: "postgres", role: "business" };
  capabilities = new Set(["transactions"]);
  tables = new Map();
  async connect() {}
  async close() {}
  async ping() {}
  async withSchemaLock(_key, fn) { return fn(); }
  async inspectSchema() { return { identity: this.identity, tables: [] }; }
  async executeSchemaOperation() {}
  matches(row, filter) {
    if (!filter) return true;
    if (filter.kind === "and") return filter.expressions.every((item) => this.matches(row, item));
    if (filter.kind === "or") return filter.expressions.some((item) => this.matches(row, item));
    if (filter.kind === "not") return !this.matches(row, filter.expression);
    const actual = row[filter.field];
    const value = filter.value;
    switch (filter.operator) {
      case "eq": return actual === value;
      case "ne": return actual !== value;
      case "in": return Array.isArray(value) && value.includes(actual);
      case "not-in": return Array.isArray(value) && !value.includes(actual);
      case "gt": return actual > value;
      case "gte": return actual >= value;
      case "lt": return actual < value;
      case "lte": return actual <= value;
      case "like": case "ilike": return String(actual).includes(String(value).replaceAll("%", ""));
      case "is-null": return filter.value === false ? actual !== null : actual === null;
    }
  }
  async select(query) {
    const rows = [...(this.tables.get(query.table)?.values() ?? [])].filter((row) => this.matches(row, query.where));
    if (query.orderBy?.length) rows.sort((a, b) => {
      const item = query.orderBy[0];
      const result = String(a[item.field]).localeCompare(String(b[item.field]));
      return item.direction === "desc" ? -result : result;
    });
    return rows.slice(query.offset ?? 0, query.limit === undefined ? undefined : (query.offset ?? 0) + query.limit);
  }
  async insert(table, values) {
    const map = this.tables.get(table) ?? new Map();
    if (map.has(values.id)) throw new Error("duplicate key");
    const row = { ...values };
    map.set(values.id, row);
    this.tables.set(table, map);
    return row;
  }
  async update(table, where, values) {
    const rows = await this.select({ table, where });
    for (const row of rows) this.tables.get(table).set(row.id, { ...row, ...values });
    return rows.length;
  }
  async delete(table, where) {
    const rows = await this.select({ table, where });
    for (const row of rows) this.tables.get(table).delete(row.id);
    return rows.length;
  }
  async transaction(fn) {
    const backup = new Map([...this.tables].map(([name, rows]) => [name, new Map([...rows].map(([id, row]) => [id, { ...row }]))]));
    const tx = {
      select: (query) => this.select(query),
      insert: (table, values) => this.insert(table, values),
      update: (table, where, values) => this.update(table, where, values),
      delete: (table, where) => this.delete(table, where),
    };
    try { return await fn(tx); } catch (error) { this.tables = backup; throw error; }
  }
}

function setup() {
  const registry = composeRegistry({
    addons: [baseAddon.manifest],
    modules: [baseAddon.module],
    models: [...baseAddon.models, Task],
    mixins: [...baseAddon.mixins],
  });
  const adapter = new MemoryAdapter();
  const context = {
    principal: { id: "00000000-0000-4000-8000-000000000001", type: "user" },
    workspaceId: "workspace-a",
    allowedCompanyIds: [],
    locale: "id-ID",
    timeZone: "Asia/Jakarta",
    traceId: "trace-test",
  };
  const access = { canModel: () => true, canRecord: () => true, canField: () => true };
  const orm = createOrmRuntime({ registry, adapter, context, access, audit: new DatabaseAuditWriter() });
  return { orm, adapter };
}

test("CRUD is transactionally audited and workspace-scoped by trusted context", async () => {
  const { orm, adapter } = setup();
  const created = await orm.models.create("task.item", { title: "First task" });
  const record = await created.first();
  assert.equal(record.title, "First task");
  assert.equal(record.workspaceId, "workspace-a");
  assert.equal(record.createdById, "00000000-0000-4000-8000-000000000001");
  assert.equal((await orm.models.search("task.item")).length, 1);
  await created.write({ title: "Updated task" });
  assert.equal((await created.first()).title, "Updated task");
  await created.delete();
  assert.equal((await orm.models.search("task.item")).length, 0);
  assert.equal(adapter.tables.get("base_audit_event").size, 3);
});

test("audit failure rolls back the business mutation", async () => {
  const { orm, adapter } = setup();
  const runtime = createOrmRuntime({
    registry: orm.env.registry,
    adapter,
    context: orm.env.context,
    access: { canModel: () => true, canRecord: () => true, canField: () => true },
    audit: { record: async () => { throw new Error("audit unavailable"); } },
  });
  await assert.rejects(runtime.models.create("task.item", { title: "must rollback" }), /audit unavailable/);
  assert.equal(adapter.tables.get("task_item")?.size ?? 0, 0);
});

test("recordset returns rows in requested identity order and rejects workspace spoofing", async () => {
  const { orm } = setup();
  const first = await orm.models.create("task.item", { title: "A" });
  const second = await orm.models.create("task.item", { title: "B" });
  const records = await orm.models.get("task.item", [second.ids[0], first.ids[0]]).toArray();
  assert.deepEqual(records.map((item) => item.title), ["B", "A"]);
  await assert.rejects(orm.models.create("task.item", { title: "Wrong workspace", workspaceId: "workspace-b" }), /managed by the ORM/);
});

test("field policies are enforced for search and reads", async () => {
  const registry = ormRegistry();
  const adapter = new MemoryAdapter();
  const orm = createOrmRuntime({
    registry,
    adapter,
    context: {
      principal: { id: "00000000-0000-4000-8000-000000000001", type: "user" },
      workspaceId: "workspace-a", allowedCompanyIds: [], locale: "id-ID", timeZone: "Asia/Jakarta", traceId: "field-policy",
    },
    access: {
      canModel: () => true,
      canRecord: () => true,
      canField: (_context, _model, field, action) => !(field === "secret" && action === "read"),
    },
    audit: new DatabaseAuditWriter(),
  });
  const created = await orm.models.create("task.item", { title: "Secured" });
  const record = await created.first();
  assert.equal(record.title, "Secured");
  assert.equal(Object.hasOwn(record, "secret"), false);
  await assert.rejects(
    orm.models.search("task.item", { kind: "condition", field: "secret", operator: "eq", value: "hidden" }),
    /Access denied to field/,
  );
});

function ormRegistry() {
  class SecureTask extends Model {
    static modelName = "task.item";
    static module = "base.core";
    static mixins = ["base.entity"];
    static fields = {
      title: fields.Char({ required: true }),
      workspaceId: fields.Char({ required: true }),
      secret: fields.Char(),
    };
  }
  return composeRegistry({
    addons: [baseAddon.manifest],
    modules: [baseAddon.module],
    models: [...baseAddon.models, SecureTask],
    mixins: [...baseAddon.mixins],
  });
}
