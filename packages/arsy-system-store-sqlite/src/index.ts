import { createHash, randomUUID } from "node:crypto";
import type { RegistrySnapshot } from "@riotworks/orm";
import type { DatabaseAdapter, DatabaseTransaction } from "@riotworks/orm-db-adaptor";
import type {
  ReconciliationReceipt,
  ReconciliationStore,
  SchemaPlan,
} from "@riotworks/orm-db";

export interface SystemLease {
  readonly name: string;
  readonly ownerToken: string;
  readonly fencingGeneration: number;
  readonly expiresAt: number;
}

export interface ActiveRegistry {
  readonly snapshot: RegistrySnapshot;
  readonly generation: number;
  readonly activatedAt: string;
  readonly receiptPlanId: string;
}

export interface SqliteSystemStoreOptions {
  readonly adapter: DatabaseAdapter;
  readonly clock?: () => number;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
}

function digest(snapshot: RegistrySnapshot): string {
  const { createdAt: _createdAt, ...stableSnapshot } = snapshot;
  return createHash("sha256").update(canonical(stableSnapshot)).digest("hex");
}

function parseJson<T>(value: unknown, label: string): T {
  if (typeof value !== "string") throw new TypeError("Stored " + label + " payload is not text.");
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new TypeError("Stored " + label + " payload is invalid JSON.");
  }
}

function params(...values: unknown[]) {
  return values.map((value) => ({ value }));
}

async function query<T>(
  target: DatabaseAdapter | DatabaseTransaction,
  text: string,
  values: unknown[] = [],
  operation: "read" | "write" | "schema" = "write",
) {
  return target.query<T>({ text, parameters: params(...values), operation });
}

/**
 * Durable SQLite control-plane store. It deliberately accepts only the
 * SQLite/System adapter identity and never stores business records or secrets.
 */
export class SqliteSystemStore implements ReconciliationStore {
  readonly #adapter: DatabaseAdapter;
  readonly #clock: () => number;
  #initialized = false;
  #transactionTail: Promise<void> = Promise.resolve();

  constructor(options: SqliteSystemStoreOptions) {
    if (options.adapter.identity.provider !== "sqlite" || options.adapter.identity.role !== "system") {
      throw new TypeError("SqliteSystemStore requires the SQLite/System Database adapter.");
    }
    this.#adapter = options.adapter;
    this.#clock = options.clock ?? Date.now;
  }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await query(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_system_plans (
      plan_id TEXT PRIMARY KEY,
      registry_fingerprint TEXT NOT NULL,
      provider TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )`, [], "schema");
    await query(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_system_receipts (
      plan_id TEXT PRIMARY KEY,
      registry_fingerprint TEXT NOT NULL,
      provider TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      approval_id TEXT,
      results_json TEXT NOT NULL,
      verified INTEGER NOT NULL,
      status TEXT NOT NULL
    )`, [], "schema");
    await query(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_registry_snapshots (
      fingerprint TEXT PRIMARY KEY,
      snapshot_digest TEXT NOT NULL,
      generation INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`, [], "schema");
    await query(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_system_state (
      singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
      active_fingerprint TEXT,
      generation INTEGER NOT NULL DEFAULT 0,
      activated_at TEXT,
      receipt_plan_id TEXT
    )`, [], "schema");
    await query(this.#adapter, `INSERT OR IGNORE INTO mw_system_state(singleton_id, generation) VALUES (1, 0)`);
    await query(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_system_leases (
      lease_name TEXT PRIMARY KEY,
      owner_token TEXT NOT NULL,
      fencing_generation INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`, [], "schema");
    await query(this.#adapter, `CREATE TABLE IF NOT EXISTS mw_system_audit (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`, [], "schema");
    await query(this.#adapter, "CREATE INDEX IF NOT EXISTS idx_mw_system_audit_created ON mw_system_audit(created_at)", [], "schema");
    this.#initialized = true;
  }

  async savePlan(plan: SchemaPlan): Promise<void> {
    this.#assertInitialized();
    await query(this.#adapter,
      `INSERT INTO mw_system_plans(plan_id, registry_fingerprint, provider, generated_at, payload_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(plan_id) DO UPDATE SET registry_fingerprint=excluded.registry_fingerprint,
       provider=excluded.provider, generated_at=excluded.generated_at, payload_json=excluded.payload_json`,
      [plan.id, plan.registryFingerprint, plan.provider, plan.generatedAt, JSON.stringify(plan)]);
  }

  async saveReceipt(receipt: ReconciliationReceipt): Promise<void> {
    this.#assertInitialized();
    await query(this.#adapter,
      `INSERT INTO mw_system_receipts(plan_id, registry_fingerprint, provider, applied_at, actor_id, approval_id, results_json, verified, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(plan_id) DO UPDATE SET registry_fingerprint=excluded.registry_fingerprint,
       provider=excluded.provider, applied_at=excluded.applied_at, actor_id=excluded.actor_id,
       approval_id=excluded.approval_id, results_json=excluded.results_json,
       verified=excluded.verified, status=excluded.status`,
      [receipt.planId, receipt.registryFingerprint, receipt.provider, receipt.appliedAt,
        receipt.actorId, receipt.approvalId ?? null, JSON.stringify(receipt.results),
        receipt.verified ? 1 : 0, receipt.status]);
  }

  async getLastReceipt(): Promise<ReconciliationReceipt | null> {
    this.#assertInitialized();
    const result = await query<Record<string, unknown>>(this.#adapter,
      "SELECT plan_id, registry_fingerprint, provider, applied_at, actor_id, approval_id, results_json, verified, status FROM mw_system_receipts ORDER BY applied_at DESC, plan_id DESC LIMIT 1",
      [], "read");
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({
      planId: String(row.plan_id),
      registryFingerprint: String(row.registry_fingerprint),
      provider: String(row.provider),
      appliedAt: String(row.applied_at),
      actorId: String(row.actor_id),
      ...(typeof row.approval_id === "string" ? { approvalId: row.approval_id } : {}),
      results: Object.freeze(parseJson<ReconciliationReceipt["results"]>(row.results_json, "receipt results")),
      verified: Number(row.verified) === 1,
      status: String(row.status) as ReconciliationReceipt["status"],
    });
  }

  async acquireLease(name: string, ttlMs: number): Promise<SystemLease | null> {
    this.#assertInitialized();
    if (!name.trim() || !Number.isSafeInteger(ttlMs) || ttlMs < 1_000) {
      throw new TypeError("Lease name and a TTL of at least 1000ms are required.");
    }
    return this.#withTransactionLock(async () => {
      const now = this.#clock();
      const ownerToken = randomUUID();
        const transaction = await this.#adapter.beginTransaction();
        try {
          const existing = await query<Record<string, unknown>>(transaction,
            "SELECT fencing_generation, expires_at FROM mw_system_leases WHERE lease_name = ?",
            [name], "read");
          const row = existing.rows[0];
          if (row && Number(row.expires_at) > now) {
            await transaction.rollback();
            return null;
          }
          const generation = row ? Number(row.fencing_generation) + 1 : 1;
          const expiresAt = now + ttlMs;
          const result = await query(transaction,
            `INSERT INTO mw_system_leases(lease_name, owner_token, fencing_generation, expires_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(lease_name) DO UPDATE SET owner_token=excluded.owner_token,
             fencing_generation=excluded.fencing_generation, expires_at=excluded.expires_at
             WHERE mw_system_leases.expires_at <= ?`,
            [name, ownerToken, generation, expiresAt, now]);
          if (result.rowCount !== 1) {
            await transaction.rollback();
            return null;
          }
          await transaction.commit();
          return Object.freeze({ name, ownerToken, fencingGeneration: generation, expiresAt });
        } catch (error) {
          if (transaction.isActive) await transaction.rollback();
          throw error;
        }
        });
    }
  
    async renewLease(lease: SystemLease, ttlMs: number): Promise<SystemLease> {
      this.#assertInitialized();
      if (!Number.isSafeInteger(ttlMs) || ttlMs < 1_000) throw new TypeError("Lease TTL must be at least 1000ms.");
      const now = this.#clock();
      const expiresAt = now + ttlMs;
      const result = await query(this.#adapter,
        "UPDATE mw_system_leases SET expires_at = ? WHERE lease_name = ? AND owner_token = ? AND fencing_generation = ? AND expires_at > ?",
        [expiresAt, lease.name, lease.ownerToken, lease.fencingGeneration, now]);
      if (result.rowCount !== 1) throw new Error("System Mode lease is expired or fenced by a newer owner.");
      return Object.freeze({ ...lease, expiresAt });
    }
  
    async releaseLease(lease: SystemLease): Promise<void> {
      this.#assertInitialized();
      await query(this.#adapter,
        "UPDATE mw_system_leases SET owner_token = '', expires_at = 0 WHERE lease_name = ? AND owner_token = ? AND fencing_generation = ?",
        [lease.name, lease.ownerToken, lease.fencingGeneration]);
    }
  
    async activateRegistry(
      snapshot: RegistrySnapshot,
      receipt: ReconciliationReceipt,
      lease: SystemLease,
      actorId: string,
    ): Promise<ActiveRegistry> {
      this.#assertInitialized();
      if (receipt.status !== "verified" || !receipt.verified || receipt.registryFingerprint !== snapshot.fingerprint) {
        throw new TypeError("Only a verified receipt for the exact candidate registry can be activated.");
      }
      if (!actorId.trim()) throw new TypeError("Activation actorId is required.");
      if (receipt.provider !== "postgres:business" || receipt.actorId !== actorId) {
        throw new TypeError("Activation requires a Business Database receipt bound to the activating actor.");
      }
      const actualDigest = digest(snapshot);
      return this.#withTransactionLock(async () => {
      const transaction = await this.#adapter.beginTransaction();
      try {
        const lock = await query<Record<string, unknown>>(transaction,
          "SELECT owner_token, fencing_generation, expires_at FROM mw_system_leases WHERE lease_name = ?",
          [lease.name], "read");
        const owner = lock.rows[0];
        if (!owner || owner.owner_token !== lease.ownerToken
          || Number(owner.fencing_generation) !== lease.fencingGeneration
          || Number(owner.expires_at) <= this.#clock()) {
          throw new Error("System Mode activation rejected: lease is stale or fenced.");
        }
        const storedPlan = await query<Record<string, unknown>>(transaction,
          "SELECT registry_fingerprint, provider FROM mw_system_plans WHERE plan_id = ?", [receipt.planId], "read");
        const storedReceipt = await query<Record<string, unknown>>(transaction,
          "SELECT registry_fingerprint, provider, actor_id, verified, status FROM mw_system_receipts WHERE plan_id = ?", [receipt.planId], "read");
        const planRow = storedPlan.rows[0];
        const receiptRow = storedReceipt.rows[0];
        if (!planRow || planRow.registry_fingerprint !== snapshot.fingerprint || planRow.provider !== "postgres:business"
          || !receiptRow || receiptRow.registry_fingerprint !== snapshot.fingerprint || receiptRow.provider !== "postgres:business"
          || receiptRow.actor_id !== actorId || Number(receiptRow.verified) !== 1 || receiptRow.status !== "verified") {
          throw new Error("System Mode activation rejected: matching persisted plan and verified receipt are required.");
        }
        const state = await query<Record<string, unknown>>(transaction,
          "SELECT generation FROM mw_system_state WHERE singleton_id = 1", [], "read");
        const generation = Number(state.rows[0]?.generation ?? 0) + 1;
        const activatedAt = new Date(this.#clock()).toISOString();
        await query(transaction,
          `INSERT INTO mw_registry_snapshots(fingerprint, snapshot_digest, generation, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(fingerprint) DO UPDATE SET snapshot_digest=excluded.snapshot_digest,
           generation=excluded.generation, payload_json=excluded.payload_json, created_at=excluded.created_at`,
          [snapshot.fingerprint, actualDigest, generation, JSON.stringify(snapshot), activatedAt]);
        await query(transaction,
          "UPDATE mw_system_state SET active_fingerprint = ?, generation = ?, activated_at = ?, receipt_plan_id = ? WHERE singleton_id = 1",
          [snapshot.fingerprint, generation, activatedAt, receipt.planId]);
        await query(transaction,
          "INSERT INTO mw_system_audit(event_id, event_type, actor_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
          [randomUUID(), "registry.activated", actorId,
            JSON.stringify({ fingerprint: snapshot.fingerprint, generation, planId: receipt.planId, fencingGeneration: lease.fencingGeneration }),
            activatedAt]);
        await transaction.commit();
        return Object.freeze({ snapshot, generation, activatedAt, receiptPlanId: receipt.planId });
      } catch (error) {
        if (transaction.isActive) await transaction.rollback();
        throw error;
      }
      });
  }

  async getActiveRegistry(): Promise<ActiveRegistry | null> {
    this.#assertInitialized();
    const state = await query<Record<string, unknown>>(this.#adapter,
      "SELECT active_fingerprint, generation, activated_at, receipt_plan_id FROM mw_system_state WHERE singleton_id = 1",
      [], "read");
    const row = state.rows[0];
    if (!row || typeof row.active_fingerprint !== "string") return null;
    const stored = await query<Record<string, unknown>>(this.#adapter,
      "SELECT snapshot_digest, payload_json FROM mw_registry_snapshots WHERE fingerprint = ?",
      [row.active_fingerprint], "read");
    const snapshotRow = stored.rows[0];
    if (!snapshotRow) throw new Error("Active registry pointer references a missing snapshot.");
    const snapshot = parseJson<RegistrySnapshot>(snapshotRow.payload_json, "registry snapshot");
    if (snapshot.fingerprint !== row.active_fingerprint || digest(snapshot) !== snapshotRow.snapshot_digest) {
      throw new Error("Active registry snapshot integrity check failed.");
    }
    const receipt = await query<Record<string, unknown>>(this.#adapter,
      "SELECT verified, status, registry_fingerprint FROM mw_system_receipts WHERE plan_id = ?",
      [row.receipt_plan_id], "read");
    const receiptRow = receipt.rows[0];
    if (!receiptRow || Number(receiptRow.verified) !== 1 || receiptRow.status !== "verified"
      || receiptRow.registry_fingerprint !== row.active_fingerprint) {
      throw new Error("Active registry has no matching verified reconciliation receipt.");
    }
    return Object.freeze({
      snapshot,
      generation: Number(row.generation),
      activatedAt: String(row.activated_at),
      receiptPlanId: String(row.receipt_plan_id),
    });
  }

  async appendAudit(eventType: string, actorId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
    this.#assertInitialized();
    if (!eventType.trim() || !actorId.trim()) throw new TypeError("Audit event type and actor are required.");
    await query(this.#adapter,
      "INSERT INTO mw_system_audit(event_id, event_type, actor_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), eventType, actorId, JSON.stringify(payload), new Date(this.#clock()).toISOString()]);
  }

  async #withTransactionLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#transactionTail;
    let release!: () => void;
    this.#transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  #assertInitialized(): void {
    if (!this.#initialized) throw new Error("SqliteSystemStore.initialize() must be called before use.");
  }
}
