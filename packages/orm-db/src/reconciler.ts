import type { DatabaseAdapter, DatabaseSnapshot, SchemaOperation } from "@riotworks/orm-db-adaptor";
import type {
  ReconciliationPolicy,
  ReconciliationReceipt,
  ReconciliationStore,
  SchemaPlan,
  SchemaPlanOperation,
  SchemaReconciler,
} from "./index.js";

export interface SchemaReconcilerOptions {
  readonly store: ReconciliationStore;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function sameType(left: unknown, right: unknown): boolean {
  return typeof left === "string" && typeof right === "string"
    && left.toLowerCase().replace(/\s+/g, "") === right.toLowerCase().replace(/\s+/g, "");
}

function operationVerified(snapshot: DatabaseSnapshot, operation: SchemaPlanOperation): boolean {
  const table = snapshot.tables.find((item) => item.name === operation.table);
  if (operation.kind === "create-table") {
    if (!table) return false;
    const columns = Array.isArray(operation.payload.columns) ? operation.payload.columns : [];
    return columns.every((item) => {
      const desired = asRecord(item);
      if (!desired || typeof desired.name !== "string") return false;
      const actual = table.columns.find((column) => column.name === desired.name);
      return Boolean(actual && sameType(actual.dataType, desired.dataType));
    });
  }
  if (!table) return false;
  if (operation.kind === "add-column" || operation.kind === "alter-column") {
    const column = asRecord(operation.payload.column);
    if (!column || typeof column.name !== "string") return false;
    const actual = table.columns.find((item) => item.name === column.name);
    return Boolean(actual && sameType(actual.dataType, column.dataType));
  }
  if (operation.kind === "create-index") {
    const columns = Array.isArray(operation.payload.columns)
      ? operation.payload.columns.filter((value): value is string => typeof value === "string")
      : [];
    const unique = operation.payload.unique === true;
    const name = typeof operation.payload.name === "string" ? operation.payload.name : undefined;
    return table.indexes.some((index) =>
      (name ? index.name === name : index.columns.join(",") === columns.join(","))
      && index.unique === unique
      && index.columns.join(",") === columns.join(","),
    );
  }
  return false;
}

function operationApproved(
  operation: SchemaPlanOperation,
  policy: ReconciliationPolicy,
  actorId: string,
): boolean {
  const hasApprovalContext = Boolean(policy.approvalId && policy.approvedBy === actorId);
  const explicitlyApproved = hasApprovalContext && (policy.approvedOperationIds ?? []).includes(operation.id);
  if (operation.risk === "safe") return true;
  if (operation.risk === "review") return !policy.requireApprovalForReview || explicitlyApproved;
  return policy.allowDestructive && explicitlyApproved;
}

function receiptStatus(receipt: Pick<ReconciliationReceipt, "results" | "verified">): ReconciliationReceipt["status"] {
  if (receipt.verified) return "verified";
  if (receipt.results.length > 0 && receipt.results.some((result) => result.applied)) return "partial";
  return "planned";
}

export class ApprovalBoundSchemaReconciler implements SchemaReconciler {
  readonly #store: ReconciliationStore;

  constructor(options: SchemaReconcilerOptions) {
    this.#store = options.store;
  }

  async reconcile(
    adapter: DatabaseAdapter,
    plan: SchemaPlan,
    policy: ReconciliationPolicy,
    actorId: string,
  ): Promise<ReconciliationReceipt> {
    const provider = adapter.identity.provider + ":" + adapter.identity.role;
    if (plan.provider !== provider) {
      throw new TypeError("Schema plan provider identity does not match the selected adapter.");
    }
    if (!actorId.trim()) throw new TypeError("Reconciliation actorId is required.");
    await this.#store.savePlan(plan);

    const shouldExecute = policy.mode !== "off" && policy.mode !== "plan";
    const eligibility = plan.operations.map((item) => operationApproved(item, policy, actorId));
    if (policy.mode === "strict" && eligibility.some((allowed) => !allowed)) {
      throw new Error("Strict reconciliation blocked: every review/destructive operation requires explicit approval.");
    }

    const results: Array<{ operationId: string; applied: boolean; detail?: string }> = [];
    let executionFailed = false;
    for (let index = 0; index < plan.operations.length; index += 1) {
      const operation = plan.operations[index];
      if (!shouldExecute) {
        results.push({ operationId: operation.id, applied: false, detail: "Execution disabled by reconciliation mode." });
        continue;
      }
      if (!eligibility[index]) {
        results.push({ operationId: operation.id, applied: false, detail: "Operation is not approved by the active reconciliation policy." });
        continue;
      }
      if (executionFailed) {
        results.push({ operationId: operation.id, applied: false, detail: "Skipped after an earlier schema operation failed." });
        continue;
      }
      try {
        const result = await adapter.executeSchemaOperation(operation as SchemaOperation);
        results.push({
          operationId: operation.id,
          applied: result.applied,
          ...(result.detail ? { detail: result.detail } : {}),
        });
        if (!result.applied) executionFailed = true;
      } catch (error) {
        executionFailed = true;
        results.push({
          operationId: operation.id,
          applied: false,
          detail: error instanceof Error ? error.message : "Unknown schema execution error.",
        });
      }
    }

    let verified = false;
    if (shouldExecute && !executionFailed && results.every((item) => item.applied)) {
      try {
        const snapshot = await adapter.inspectSchema();
        verified = plan.operations.every((item) => operationVerified(snapshot, item));
      } catch {
        verified = false;
      }
    }

    const receipt: ReconciliationReceipt = Object.freeze({
      planId: plan.id,
      registryFingerprint: plan.registryFingerprint,
      provider: plan.provider,
      appliedAt: new Date().toISOString(),
      actorId,
      ...(policy.approvalId ? { approvalId: policy.approvalId } : {}),
      results: Object.freeze(results.map((item) => Object.freeze(item))),
      verified,
      status: receiptStatus({ results, verified }),
    });
    await this.#store.saveReceipt(receipt);
    return receipt;
  }

  async verify(adapter: DatabaseAdapter, registry: Parameters<SchemaReconciler["verify"]>[1]): Promise<boolean> {
    const snapshot = await adapter.inspectSchema();
    const pending = await import("./schema-planner.js").then(({ schemaPlanner }) => schemaPlanner.plan(registry, snapshot));
    return pending.operations.length === 0;
  }
}

export function createSchemaReconciler(options: SchemaReconcilerOptions): SchemaReconciler {
  return new ApprovalBoundSchemaReconciler(options);
}
