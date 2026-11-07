import { randomUUID } from "node:crypto";
import type { RegistryBuildInput, RegistryComposer, RegistrySnapshot } from "@riotworks/orm";
import type { DatabaseAdapter, DatabaseSnapshot } from "@riotworks/orm-db-adaptor";
import type { ReconciliationPolicy, ReconciliationReceipt, SchemaPlan, SchemaPlanner, SchemaReconciler } from "@riotworks/orm-db";

export const SYSTEM_MODE_STAGES = [
  "control-bootstrap", "recovery-check", "package-discovery", "trust-validation",
  "registry-composition", "persistence-preflight", "approval-gate", "reconciliation",
  "candidate-verification", "runtime-preparation", "atomic-activation", "runtime-handoff", "complete",
] as const;
export type SystemModeStage = typeof SYSTEM_MODE_STAGES[number];
export interface SystemModeLease { readonly name: string; readonly ownerToken: string; readonly fencingGeneration: number; readonly expiresAt: number }
export interface SystemModeRun {
  readonly runId: string; readonly actorId: string; readonly stage: SystemModeStage;
  readonly status: "running" | "failed" | "completed"; readonly registryFingerprint?: string;
  readonly planId?: string; readonly error?: string; readonly startedAt: string; readonly updatedAt: string;
}
export interface SystemModeStore {
  acquireLease(name: string, ttlMs: number): Promise<SystemModeLease | null>;
  renewLease(lease: SystemModeLease, ttlMs: number): Promise<SystemModeLease>;
  releaseLease(lease: SystemModeLease): Promise<void>;
  savePlan(plan: SchemaPlan): Promise<void>;
  saveReceipt(receipt: ReconciliationReceipt): Promise<void>;
  activateRegistry(snapshot: RegistrySnapshot, receipt: ReconciliationReceipt, lease: SystemModeLease, actorId: string): Promise<Readonly<{ generation: number; activatedAt: string }>>;
  appendAudit(eventType: string, actorId: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}
export interface SystemRunJournal {
  begin(runId: string, actorId: string, at: string): Promise<void>;
  transition(runId: string, expected: SystemModeStage, next: SystemModeStage, details?: Readonly<{ registryFingerprint?: string; planId?: string }>): Promise<void>;
  finish(runId: string, status: "failed" | "completed", error?: string): Promise<void>;
  incomplete(): Promise<readonly SystemModeRun[]>;
}
export interface SystemModePorts {
  readonly store: SystemModeStore;
  readonly journal: SystemRunJournal;
  readonly composer: RegistryComposer;
  readonly businessAdapter: DatabaseAdapter;
  readonly planner: SchemaPlanner;
  readonly reconciler: SchemaReconciler;
  readonly policy: ReconciliationPolicy;
  bootstrapControlPlane(): Promise<void>;
  readonly leaseName?: string;
  readonly leaseTtlMs?: number;
  readonly now?: () => Date;
  readonly createRunId?: () => string;
  discover(): Promise<RegistryBuildInput>;
  verifyTrust(input: RegistryBuildInput): Promise<RegistryBuildInput>;
  recover(incomplete: readonly SystemModeRun[]): Promise<void>;
  inspectBusiness(): Promise<DatabaseSnapshot>;
  approve(plan: SchemaPlan, actorId: string): Promise<ReconciliationPolicy>;
  prepareRuntime(snapshot: RegistrySnapshot): Promise<void>;
  handoff(snapshot: RegistrySnapshot): Promise<void>;
  setReadiness(ready: boolean, reason?: string): Promise<void>;
}
export interface SystemModeResult {
  readonly runId: string; readonly registry: RegistrySnapshot; readonly generation: number;
  readonly activatedAt: string; readonly receipt: ReconciliationReceipt;
}
export class SystemModeError extends Error {
  readonly stage: SystemModeStage;
  readonly runId: string;
  constructor(message: string, stage: SystemModeStage, runId: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SystemModeError"; this.stage = stage; this.runId = runId;
  }
}

/** Explicit deployment orchestration. Never invoke this from an HTTP request handler. */
export class SystemModeOrchestrator {
  readonly #ports: SystemModePorts;
  constructor(ports: SystemModePorts) { this.#ports = ports; }

  async run(actorId: string): Promise<SystemModeResult> {
    if (!actorId.trim()) throw new TypeError("System Mode requires an actor identity.");
    const now = this.#ports.now ?? (() => new Date());
    const runId = this.#ports.createRunId?.() ?? randomUUID();
    const leaseName = this.#ports.leaseName ?? "arsy-system-mode";
    const ttl = this.#ports.leaseTtlMs ?? 30_000;
    let lease: SystemModeLease | null = null;
    let stage: SystemModeStage = "control-bootstrap";
    let journalStarted = false;
    try {
      await this.#ports.bootstrapControlPlane();
      lease = await this.#ports.store.acquireLease(leaseName, ttl);
      if (!lease) throw new Error("Another System Mode process owns the deployment lease.");
      const incomplete = (await this.#ports.journal.incomplete()).filter((run) => run.runId !== runId);
      await this.#ports.journal.begin(runId, actorId, now().toISOString());
      journalStarted = true;
      await this.#ports.store.appendAudit("system-mode.started", actorId, { runId, fencingGeneration: lease.fencingGeneration });
      await this.#ports.setReadiness(false, "System Mode synchronization is in progress.");

      await this.#ports.journal.transition(runId, stage, "recovery-check"); stage = "recovery-check";
      await this.#ports.recover(incomplete);
      lease = await this.#ports.store.renewLease(lease, ttl);

      await this.#ports.journal.transition(runId, stage, "package-discovery"); stage = "package-discovery";
      const discovered = await this.#ports.discover();
      await this.#ports.journal.transition(runId, stage, "trust-validation"); stage = "trust-validation";
      const trusted = await this.#ports.verifyTrust(discovered);
      await this.#ports.journal.transition(runId, stage, "registry-composition"); stage = "registry-composition";
      const registry = this.#ports.composer.compose(trusted);

      await this.#ports.journal.transition(runId, stage, "persistence-preflight", { registryFingerprint: registry.fingerprint }); stage = "persistence-preflight";
      const plan = this.#ports.planner.plan(registry, await this.#ports.inspectBusiness());
      await this.#ports.store.savePlan(plan);
      await this.#ports.journal.transition(runId, stage, "approval-gate", { registryFingerprint: registry.fingerprint, planId: plan.id }); stage = "approval-gate";
      const approvedPolicy = await this.#ports.approve(plan, actorId);

      await this.#ports.journal.transition(runId, stage, "reconciliation"); stage = "reconciliation";
      lease = await this.#ports.store.renewLease(lease, ttl);
      const receipt = await this.#ports.reconciler.reconcile(this.#ports.businessAdapter, plan, approvedPolicy, actorId);
      await this.#ports.store.saveReceipt(receipt);
      if (receipt.status !== "verified" || !receipt.verified || receipt.registryFingerprint !== registry.fingerprint) {
        throw new Error("Reconciliation did not produce a verified receipt for this registry.");
      }

      await this.#ports.journal.transition(runId, stage, "candidate-verification"); stage = "candidate-verification";
      if (!await this.#ports.reconciler.verify(this.#ports.businessAdapter, registry)) {
        throw new Error("Business Database schema does not match the candidate registry.");
      }
      await this.#ports.journal.transition(runId, stage, "runtime-preparation"); stage = "runtime-preparation";
      await this.#ports.prepareRuntime(registry);
      await this.#ports.journal.transition(runId, stage, "atomic-activation"); stage = "atomic-activation";
      lease = await this.#ports.store.renewLease(lease, ttl);
      const activation = await this.#ports.store.activateRegistry(registry, receipt, lease, actorId);

      await this.#ports.journal.transition(runId, stage, "runtime-handoff", { registryFingerprint: registry.fingerprint, planId: plan.id }); stage = "runtime-handoff";
      await this.#ports.handoff(registry);
      await this.#ports.journal.transition(runId, stage, "complete");
      await this.#ports.journal.finish(runId, "completed");
      await this.#ports.store.appendAudit("system-mode.completed", actorId, { runId, fingerprint: registry.fingerprint, generation: activation.generation });
      await this.#ports.setReadiness(true);
      return Object.freeze({ runId, registry, generation: activation.generation, activatedAt: activation.activatedAt, receipt });
    } catch (cause) {
      await this.#ports.setReadiness(false, "System Mode failed; readiness remains disabled and the deployment journal requires recovery.").catch(() => undefined);
      if (journalStarted) {
        await this.#ports.journal.finish(runId, "failed", cause instanceof Error ? cause.message : String(cause)).catch(() => undefined);
        await this.#ports.store.appendAudit("system-mode.failed", actorId, {
          runId, stage, error: cause instanceof Error ? cause.message : String(cause),
        }).catch(() => undefined);
      }
      throw new SystemModeError(cause instanceof Error ? cause.message : String(cause), stage, runId, cause);
    } finally {
      if (lease) await this.#ports.store.releaseLease(lease).catch(() => undefined);
    }
  }
}


function journalParams(...values: unknown[]) { return values.map((value) => ({ value })); }
async function journalQuery<T>(adapter: DatabaseAdapter, text: string, values: unknown[] = [], operation: "read" | "write" | "schema" = "write") {
  return adapter.query<T>({ text, parameters: journalParams(...values), operation });
}

/** SQLite-backed deployment journal. It stores control metadata, never business data or secrets. */
export class SqliteSystemRunJournal implements SystemRunJournal {
  readonly #adapter: DatabaseAdapter;
  readonly #now: () => Date;
  #initialized = false;
  constructor(adapter: DatabaseAdapter, now: () => Date = () => new Date()) {
    if (adapter.identity.provider !== "sqlite" || adapter.identity.role !== "system") {
      throw new TypeError("System run journal requires the SQLite/System adapter.");
    }
    this.#adapter = adapter;
    this.#now = now;
  }
  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await journalQuery(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_system_runs (
      run_id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      registry_fingerprint TEXT,
      plan_id TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`, [], "schema");
    await journalQuery(this.#adapter, "CREATE INDEX IF NOT EXISTS idx_mw_system_runs_status ON mw_system_runs(status, updated_at)", [], "schema");
    this.#initialized = true;
  }
  async begin(runId: string, actorId: string, at: string): Promise<void> {
    this.#assertReady();
    if (!runId.trim() || !actorId.trim()) throw new TypeError("Run and actor identifiers are required.");
    await journalQuery(this.#adapter,
      "INSERT INTO mw_system_runs(run_id, actor_id, stage, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [runId, actorId, "control-bootstrap", "running", at, at]);
  }
  async transition(runId: string, expected: SystemModeStage, next: SystemModeStage, details: Readonly<{ registryFingerprint?: string; planId?: string }> = {}): Promise<void> {
    this.#assertReady();
    const result = await journalQuery(this.#adapter,
      "UPDATE mw_system_runs SET stage = ?, registry_fingerprint = COALESCE(?, registry_fingerprint), plan_id = COALESCE(?, plan_id), updated_at = ? WHERE run_id = ? AND status = 'running' AND stage = ?",
      [next, details.registryFingerprint ?? null, details.planId ?? null, this.#now().toISOString(), runId, expected]);
    if (result.rowCount !== 1) throw new Error("System run transition rejected: run is missing, inactive, or at a different stage.");
  }
  async finish(runId: string, status: "failed" | "completed", error?: string): Promise<void> {
    this.#assertReady();
    const result = await journalQuery(this.#adapter,
      "UPDATE mw_system_runs SET status = ?, stage = CASE WHEN ? = 'completed' THEN 'complete' ELSE stage END, error = ?, updated_at = ? WHERE run_id = ? AND status = 'running'",
      [status, status, error ?? null, this.#now().toISOString(), runId]);
    if (result.rowCount !== 1) throw new Error("System run finish rejected: run is missing or no longer active.");
  }
  async incomplete(): Promise<readonly SystemModeRun[]> {
    this.#assertReady();
    const result = await journalQuery<Record<string, unknown>>(this.#adapter,
      "SELECT run_id, actor_id, stage, status, registry_fingerprint, plan_id, error, started_at, updated_at FROM mw_system_runs WHERE status = 'running' ORDER BY started_at, run_id",
      [], "read");
    return Object.freeze(result.rows.map((row) => Object.freeze({
      runId: String(row.run_id),
      actorId: String(row.actor_id),
      stage: String(row.stage) as SystemModeStage,
      status: String(row.status) as SystemModeRun["status"],
      ...(typeof row.registry_fingerprint === "string" ? { registryFingerprint: row.registry_fingerprint } : {}),
      ...(typeof row.plan_id === "string" ? { planId: row.plan_id } : {}),
      ...(typeof row.error === "string" ? { error: row.error } : {}),
      startedAt: String(row.started_at),
      updatedAt: String(row.updated_at),
    })));
  }
  #assertReady(): void {
    if (!this.#initialized) throw new Error("SqliteSystemRunJournal.initialize() must be called before use.");
  }
}
