import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironment } from "../src/runtime.ts";

const registry = {
  formatVersion: 1,
  fingerprint: "registry-test",
  createdAt: "2026-01-01T00:00:00.000Z",
  addonOrder: [],
  moduleOrder: ["crm"],
  models: {
    "crm.customer": {
      name: "crm.customer",
      module: "crm",
      kind: "persistent",
      fields: {},
      sourceAddon: "crm",
      extensions: [],
    },
  },
};

function environment(overrides = {}) {
  return createEnvironment({
    registry,
    principal: { id: "user-1", type: "user" },
    tenantId: "workspace-1",
    companyId: "company-1",
    allowedCompanyIds: ["company-1", "company-2"],
    locale: "id-ID",
    timeZone: "Asia/Jakarta",
    traceId: "trace-1",
    loadRecords: async ({ ids }) => ids.map((id) => ({ id })),
    ...overrides,
  });
}

test("environment context and principal are immutable snapshots", () => {
  const env = environment();
  assert.equal(Object.isFrozen(env), true);
  assert.equal(Object.isFrozen(env.context), true);
  assert.equal(Object.isFrozen(env.context.principal), true);
  assert.equal(env.context.tenantId, "workspace-1");
});

test("derive can change presentation context but not identity or tenant", () => {
  const env = environment();
  const derived = env.derive({ locale: "en-US", timeZone: "UTC" });
  assert.equal(derived.context.locale, "en-US");
  assert.equal(derived.context.timeZone, "UTC");
  assert.equal(derived.context.tenantId, "workspace-1");
  assert.throws(() => env.derive({ tenantId: "other-workspace" }), /cannot be escalated/);
  assert.throws(() => env.derive({ principal: null }), /cannot be escalated/);
});

test("derive enforces allowed-company scope", () => {
  const env = environment();
  assert.equal(env.derive({ companyId: "company-2" }).context.companyId, "company-2");
  assert.throws(() => env.derive({ companyId: "company-3" }), /outside the allowed-company scope/);
});

test("recordsets have stable empty and populated behavior", async () => {
  const env = environment();
  const empty = env.models.get("crm.customer");
  assert.equal(empty.length, 0);
  assert.equal(await empty.first(), null);
  assert.deepEqual(await empty.toArray(), []);
  const records = env.models.get("crm.customer", ["c1", "c2"]);
  assert.equal(records.length, 2);
  assert.deepEqual(await records.toArray(), [{ id: "c1" }, { id: "c2" }]);
  assert.deepEqual(await records.first(), { id: "c1" });
});

test("recordsets reject invalid identities and unknown models", () => {
  const env = environment();
  assert.throws(() => env.models.get("crm.missing"), /Unknown model/);
  assert.throws(() => env.models.get("crm.customer", ["", "c1"]), /non-empty strings/);
  assert.throws(() => env.models.get("crm.customer", ["c1", "c1"]), /unique/);
});

test("recordsets cannot be used after their transaction closes", async () => {
  let active = true;
  const env = environment({ transaction: { id: "tx-1", get isActive() { return active; } } });
  const records = env.models.get("crm.customer", ["c1"]);
  active = false;
  await assert.rejects(() => records.toArray(), /no longer active/);
});
