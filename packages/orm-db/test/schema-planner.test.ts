import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicSchemaPlanner } from "../src/schema-planner.ts";

const registry = {
  formatVersion: 1,
  fingerprint: "registry-fingerprint-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  addonOrder: ["crm"],
  moduleOrder: ["crm"],
  models: {
    "crm.customer": {
      name: "crm.customer",
      module: "crm",
      kind: "persistent",
      sourceAddon: "crm",
      extensions: [],
      fields: {
        name: { kind: "char", required: true, nullable: false, options: { maxLength: 160 } },
        email: { kind: "char", nullable: true, index: true },
        active: { kind: "boolean", nullable: false, default: true },
      },
    },
  },
};

function actual(tables = []) {
  return {
    identity: { provider: "postgres", role: "business" },
    tables,
  };
}

test("planner creates missing persistent tables with deterministic column metadata", () => {
  const plan = new DeterministicSchemaPlanner().plan(registry, actual());
  const create = plan.operations.find((item) => item.kind === "create-table");
  assert.ok(create);
  assert.equal(create.table, "crm_customer");
  const columns = create.payload.columns;
  assert.equal(Array.isArray(columns), true);
  assert.equal(plan.provider, "postgres:business");
  assert.equal(plan.requiresApproval, false);
});

test("planner adds missing nullable columns as safe additive changes", () => {
  const snapshot = actual([{
    name: "crm_customer",
    columns: [{ name: "name", dataType: "VARCHAR(160)", nullable: false, ordinal: 1 }],
    indexes: [],
    foreignKeys: [],
  }]);
  const plan = new DeterministicSchemaPlanner().plan(registry, snapshot);
  const add = plan.operations.find((item) => item.kind === "add-column" && item.table === "crm_customer");
  assert.ok(add);
  assert.equal(add.risk, "safe");
  assert.equal(add.requiresApproval, false);
});

test("planner marks required additions without defaults for review", () => {
  const snapshot = actual([{
    name: "crm_customer",
    columns: [],
    indexes: [],
    foreignKeys: [],
  }]);
  const plan = new DeterministicSchemaPlanner().plan(registry, snapshot);
  const addName = plan.operations.find((item) => item.kind === "add-column" && item.payload.column?.name === "name");
  assert.equal(addName?.risk, "review");
  assert.equal(addName?.requiresApproval, true);
});

test("planner classifies type changes as destructive and never proposes drops", () => {
  const snapshot = actual([{
    name: "crm_customer",
    columns: [
      { name: "name", dataType: "TEXT", nullable: false, ordinal: 1 },
      { name: "legacy_note", dataType: "TEXT", nullable: true, ordinal: 2 },
      { name: "active", dataType: "BOOLEAN", nullable: false, ordinal: 3 },
    ],
    indexes: [],
    foreignKeys: [],
  }]);
  const plan = new DeterministicSchemaPlanner().plan(registry, snapshot);
  assert.equal(plan.operations.some((item) => item.kind === "alter-column" && item.risk === "destructive"), true);
  assert.equal(plan.operations.some((item) => item.kind === "drop-column" || item.kind === "drop-table"), false);
});

test("plan identity is deterministic and excludes generated timestamp", () => {
  const planner = new DeterministicSchemaPlanner();
  const first = planner.plan(registry, actual());
  const second = planner.plan(registry, actual());
  assert.equal(first.id, second.id);
  assert.notEqual(first.generatedAt, undefined);
});
