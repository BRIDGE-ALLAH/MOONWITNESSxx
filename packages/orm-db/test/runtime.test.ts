import assert from "node:assert/strict";
import test from "node:test";
import { createUnitOfWorkFactory, withUnitOfWork } from "../src/runtime.ts";

function adapter() {
  const calls: string[] = [];
  let active = true;
  return {
    calls,
    get active() { return active; },
    async beginTransaction() {
      return {
        id: "tx-1",
        get isActive() { return active; },
        async query() { return { rows: [], rowCount: 0 }; },
        async commit() { calls.push("commit"); active = false; },
        async rollback() { calls.push("rollback"); active = false; },
      };
    },
  };
}

test("withUnitOfWork commits after a successful operation", async () => {
  const fake = adapter();
  const factory = createUnitOfWorkFactory(fake as never);
  const result = await withUnitOfWork(factory, async (uow) => {
    assert.equal(uow.isActive, true);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.deepEqual(fake.calls, ["commit"]);
  assert.equal(fake.active, false);
});

test("withUnitOfWork rolls back when the operation fails", async () => {
  const fake = adapter();
  const factory = createUnitOfWorkFactory(fake as never);
  await assert.rejects(
    () => withUnitOfWork(factory, async () => { throw new Error("operation failed"); }),
    /operation failed/,
  );
  assert.deepEqual(fake.calls, ["rollback"]);
});

test("commit failures are surfaced and do not pretend the unit is active", async () => {
  const fake = adapter();
  const broken = {
    ...fake,
    async beginTransaction() {
      return {
        id: "tx-broken",
        isActive: true,
        async query() { return { rows: [], rowCount: 0 }; },
        async commit() { throw new Error("commit failed"); },
        async rollback() { fake.calls.push("rollback"); },
      };
    },
  };
  const factory = createUnitOfWorkFactory(broken as never);
  await assert.rejects(() => withUnitOfWork(factory, async () => "done"), /commit failed/);
});
