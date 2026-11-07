import assert from "node:assert/strict";
import test from "node:test";
import { createSchemaReconciler } from "../src/reconciler.ts";

function store() {
  const plans = [];
  const receipts = [];
  return {
    plans,
    receipts,
    async savePlan(plan) { plans.push(plan); },
    async saveReceipt(receipt) { receipts.push(receipt); },
    async getLastReceipt() { return receipts.at(-1) ?? null; },
  };
}

function adapter(initialTables = []) {
  const tables = structuredClone(initialTables);
  const calls = [];
  return {
    identity: { provider: "postgres", role: "business" },
    capabilities: { identity: { provider: "postgres", role: "business" }, version: "16", supported: new Set(["schema-introspection"]), limits: { maxIdentifierLength: 63 } },
    tables,
    calls,
    async connect() {},
    async close() {},
    async ping() {},
    async beginTransaction() { throw new Error("not used in schema test"); },
    async query() { return { rows: [], rowCount: 0 }; },
    async inspectSchema() { return { identity: this.identity, tables: this.tables }; },
    async executeSchemaOperation(operation) {
      this.calls.push(operation.id);
      const table = this.tables.find((item) => item.name === operation.table);
      if (operation.kind === "create-table") {
        const columns = operation.payload.columns.map((item) => ({
          name: item.name,
          dataType: item.dataType,
          nullable: item.nullable,
          ordinal: this.tables.length + 1,
        }));
        this.tables.push({ name: operation.table, columns, indexes: [], foreignKeys: [] });
      } else if (operation.kind === "add-column" || operation.kind === "alter-column") {
        const column = operation.payload.column;
        const existing = table.columns.find((item) => item.name === column.name);
        if (existing) Object.assign(existing, column);
        else table.columns.push({ ...column, ordinal: table.columns.length + 1 });
      } else if (operation.kind === "create-index") {
        table.indexes.push({
          name: operation.payload.name,
          columns: operation.payload.columns,
          unique: operation.payload.unique,
        });
      }
      return { operationId: operation.id, applied: true };
    },
  };
}

function op(id, kind, risk, table = "crm_customer", payload = {}) {
  return {
    id,
    kind,
    table,
    description: id,
    destructive: risk === "destructive",
    payload,
    risk,
    requiresApproval: risk !== "safe",
    recoveryNotes: "test",
  };
}

function plan(operations, provider = "postgres:business") {
  return {
    id: "plan-1",
    registryFingerprint: "registry-1",
    provider,
    generatedAt: "2026-01-01T00:00:00.000Z",
    operations,
    requiresApproval: operations.some((item) => item.requiresApproval),
  };
}

const safeCreate = op("create", "create-table", "safe", "crm_customer", {
  columns: [{ name: "name", dataType: "VARCHAR(160)", nullable: false }],
});
const reviewAdd = op("add", "add-column", "review", "crm_customer", {
  column: { name: "legacy_ref", dataType: "TEXT", nullable: false },
});
const destructiveAlter = op("alter", "alter-column", "destructive", "crm_customer", {
  column: { name: "amount", dataType: "NUMERIC(18,2)", nullable: false },
});

test("safe mode applies safe operations and records unapproved review operations", async () => {
  const db = adapter();
  const persistence = store();
  const reconciler = createSchemaReconciler({ store: persistence });
  const receipt = await reconciler.reconcile(db, plan([safeCreate, reviewAdd]), {
    mode: "safe",
    allowDestructive: false,
    requireApprovalForReview: true,
  }, "operator-1");
  assert.deepEqual(db.calls, ["create"]);
  assert.equal(receipt.results[0].applied, true);
  assert.equal(receipt.results[1].applied, false);
  assert.equal(receipt.verified, false);
  assert.equal(receipt.status, "partial");
  assert.equal(persistence.plans.length, 1);
  assert.equal(persistence.receipts.length, 1);
});

test("plan mode persists a plan without executing DDL", async () => {
  const db = adapter();
  const persistence = store();
  const reconciler = createSchemaReconciler({ store: persistence });
  const receipt = await reconciler.reconcile(db, plan([safeCreate]), {
    mode: "plan",
    allowDestructive: false,
    requireApprovalForReview: true,
  }, "operator-1");
  assert.deepEqual(db.calls, []);
  assert.equal(receipt.results[0].applied, false);
  assert.equal(receipt.status, "planned");
});

test("destructive changes require per-operation approval, actor binding and allowDestructive", async () => {
  const db = adapter([{
    name: "crm_customer",
    columns: [{ name: "amount", dataType: "TEXT", nullable: false, ordinal: 1 }],
    indexes: [],
    foreignKeys: [],
  }]);
  const persistence = store();
  const reconciler = createSchemaReconciler({ store: persistence });
  const receipt = await reconciler.reconcile(db, plan([destructiveAlter]), {
    mode: "safe",
    allowDestructive: true,
    requireApprovalForReview: true,
    approvalId: "approval-7",
    approvedBy: "operator-1",
    approvedOperationIds: ["alter"],
  }, "operator-1");
  assert.deepEqual(db.calls, ["alter"]);
  assert.equal(receipt.verified, true);
  assert.equal(receipt.status, "verified");
  assert.equal(receipt.approvalId, "approval-7");
});

test("strict mode blocks before any DDL if an operation lacks approval", async () => {
  const db = adapter();
  const reconciler = createSchemaReconciler({ store: store() });
  await assert.rejects(
    () => reconciler.reconcile(db, plan([safeCreate, reviewAdd]), {
      mode: "strict",
      allowDestructive: false,
      requireApprovalForReview: true,
    }, "operator-1"),
    /Strict reconciliation blocked/,
  );
  assert.deepEqual(db.calls, []);
});

test("reconciler rejects provider-role mismatches", async () => {
  const db = adapter();
  db.identity = { provider: "sqlite", role: "system" };
  const reconciler = createSchemaReconciler({ store: store() });
  await assert.rejects(
    () => reconciler.reconcile(db, plan([safeCreate]), {
      mode: "safe",
      allowDestructive: false,
      requireApprovalForReview: true,
    }, "operator-1"),
    /does not match/,
  );
});
