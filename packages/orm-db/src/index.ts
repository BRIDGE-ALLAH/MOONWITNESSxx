/**
 * Orchestration contracts for persistence. This package owns policy and
 * transaction coordination; physical SQL and provider connections stay in
 * concrete adapter packages.
 */

import type { RegistrySnapshot } from "@riotworks/orm";
import type {
  DatabaseAdapter,
  DatabaseSnapshot,
  DatabaseTransaction,
  SchemaOperation,
} from "@riotworks/orm-db-adaptor";

export interface UnitOfWork {
  readonly transaction: DatabaseTransaction;
  readonly isActive: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface UnitOfWorkFactory {
  begin(options?: Readonly<{ isolationLevel?: string; readOnly?: boolean }>): Promise<UnitOfWork>;
}

export type ReconciliationRisk = "safe" | "review" | "destructive";

export interface SchemaPlanOperation extends SchemaOperation {
  readonly risk: ReconciliationRisk;
  readonly requiresApproval: boolean;
  readonly recoveryNotes: string;
}

export interface SchemaPlan {
  readonly id: string;
  readonly registryFingerprint: string;
  readonly provider: string;
  readonly generatedAt: string;
  readonly operations: readonly SchemaPlanOperation[];
  readonly requiresApproval: boolean;
}

export interface ReconciliationReceipt {
  readonly planId: string;
  readonly registryFingerprint: string;
  readonly provider: string;
  readonly appliedAt: string;
  readonly actorId: string;
  readonly results: readonly Readonly<{ operationId: string; applied: boolean; detail?: string }>[];
  readonly verified: boolean;
}

export interface ReconciliationPolicy {
  readonly mode: "off" | "plan" | "safe" | "strict";
  readonly allowDestructive: boolean;
  readonly requireApprovalForReview: boolean;
}

export interface ReconciliationStore {
  savePlan(plan: SchemaPlan): Promise<void>;
  saveReceipt(receipt: ReconciliationReceipt): Promise<void>;
  getLastReceipt(): Promise<ReconciliationReceipt | null>;
}

export interface SchemaPlanner {
  plan(registry: RegistrySnapshot, actual: DatabaseSnapshot): SchemaPlan;
}

export interface SchemaReconciler {
  reconcile(
    adapter: DatabaseAdapter,
    plan: SchemaPlan,
    policy: ReconciliationPolicy,
    actorId: string,
  ): Promise<ReconciliationReceipt>;
  verify(adapter: DatabaseAdapter, registry: RegistrySnapshot): Promise<boolean>;
}

export interface PersistenceRuntime {
  readonly adapter: DatabaseAdapter;
  readonly unitsOfWork: UnitOfWorkFactory;
  readonly planner: SchemaPlanner;
  readonly reconciler: SchemaReconciler;
  readonly store: ReconciliationStore;
}

export interface UpgradeHandlerContext {
  readonly transaction: DatabaseTransaction;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly registryFingerprint: string;
}

export interface UpgradeHandler {
  readonly id: string;
  readonly module: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  run(context: UpgradeHandlerContext): Promise<void>;
}
