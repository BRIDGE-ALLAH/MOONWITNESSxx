import assert from "node:assert/strict";
import test from "node:test";
import { createSqliteSystemAdapter } from "@riotworks/orm-db-adaptor-sqlite";
import { SqliteSystemRunJournal } from "../src/index.ts";

test("persists run stages and returns interrupted deployments for recovery", async () => {
  const adapter = createSqliteSystemAdapter();
  await adapter.connect({ filename: ":memory:" });
  let tick = 0;
  const journal = new SqliteSystemRunJournal(adapter, () => new Date(1_700_000_000_000 + tick++));
  await journal.initialize();
  await journal.begin("run-1", "operator", "2026-01-01T00:00:00.000Z");
  await journal.transition("run-1", "control-bootstrap", "recovery-check");
  await journal.transition("run-1", "recovery-check", "package-discovery", { registryFingerprint: "fp" });
  const incomplete = await journal.incomplete();
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0]?.stage, "package-discovery");
  assert.equal(incomplete[0]?.registryFingerprint, "fp");
  await assert.rejects(() => journal.transition("run-1", "control-bootstrap", "trust-validation"), /different stage/);
  await journal.finish("run-1", "failed", "simulated crash");
  assert.equal((await journal.incomplete()).length, 0);
  await journal.begin("run-2", "operator", "2026-01-01T00:00:00.000Z");
  await journal.finish("run-2", "completed");
  assert.equal((await journal.incomplete()).length, 0);
  await adapter.close();
});
