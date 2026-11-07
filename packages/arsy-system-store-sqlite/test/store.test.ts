import assert from "node:assert/strict";
import test from "node:test";
import { createSqliteSystemAdapter } from "@riotworks/orm-db-adaptor-sqlite";
import { SqliteSystemStore } from "../src/index.ts";
import type { RegistrySnapshot } from "@riotworks/orm";
import type { ReconciliationReceipt, SchemaPlan } from "@riotworks/orm-db";

test("persists plans, receipts and atomically activates a verified registry under a fenced lease", async () => {
  const adapter = createSqliteSystemAdapter();
  await adapter.connect({ filename: ":memory:" });
  let now = 1_000;
  const store = new SqliteSystemStore({ adapter, clock: () => now });
  await store.initialize();

  const plan: SchemaPlan = {
    id: "plan-1", registryFingerprint: "registry-1", provider: "postgres:business",
    generatedAt: new Date(now).toISOString(), operations: [], requiresApproval: false,
  };
  const receipt: ReconciliationReceipt = {
    planId: "plan-1", registryFingerprint: "registry-1", provider: "postgres:business",
    appliedAt: new Date(now).toISOString(), actorId: "operator-1", results: [],
    verified: true, status: "verified",
  };
  const snapshot: RegistrySnapshot = {
    formatVersion: 1, fingerprint: "registry-1", createdAt: new Date(now).toISOString(),
    addonOrder: [], moduleOrder: [], models: {},
  };

  await store.savePlan(plan);
  await store.saveReceipt(receipt);
  assert.equal((await store.getLastReceipt())?.planId, "plan-1");

  const lease = await store.acquireLease("registry-activation", 5_000);
  assert.ok(lease);
  assert.equal(await store.acquireLease("registry-activation", 5_000), null);
  now += 1_000;
  const renewed = await store.renewLease(lease, 5_000);
  assert.ok(renewed.expiresAt > lease.expiresAt);

  const active = await store.activateRegistry(snapshot, receipt, renewed, "operator-1");
  assert.equal(active.generation, 1);
  assert.equal((await store.getActiveRegistry())?.snapshot.fingerprint, "registry-1");
  await adapter.query({
    text: "UPDATE mw_registry_snapshots SET payload_json = ? WHERE fingerprint = ?",
    parameters: [{ value: "{}" }, { value: "registry-1" }],
    operation: "write",
  });
  await assert.rejects(() => store.getActiveRegistry(), /integrity check failed/);

  await store.releaseLease(renewed);
  const nextLease = await store.acquireLease("registry-activation", 5_000);
  assert.ok(nextLease);
  assert.equal(nextLease.fencingGeneration, renewed.fencingGeneration + 1);
  await assert.rejects(
    () => store.activateRegistry(snapshot, receipt, renewed, "operator-1"),
    /lease is stale or fenced/,
  );
  await store.releaseLease(nextLease);
  await adapter.close();
  now += 1;
});
