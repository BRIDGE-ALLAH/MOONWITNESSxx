import type { DatabaseAdapter } from "@riotworks/orm-db-adaptor";
import type { ReconciliationPlan, ReconciliationReceipt } from "./schema.ts";

const planTable = "_orm_schema_plan";
const receiptTable = "_orm_schema_receipt";

export class DatabaseSchemaLedger {
  constructor(private readonly system: DatabaseAdapter) {
    if (system.identity.role !== "system") throw new TypeError("Schema ledger must use the separate System Database.");
  }

  async initialize(): Promise<void> {
    await this.system.executeSchemaOperation({
      id: "init-schema-plan-ledger",
      kind: "create-table",
      table: planTable,
      columns: [
        { name: "id", type: "TEXT", nullable: false, primaryKey: true },
        { name: "registryFingerprint", type: "TEXT", nullable: false },
        { name: "provider", type: "TEXT", nullable: false },
        { name: "payload", type: "TEXT", nullable: false },
        { name: "createdAt", type: "TEXT", nullable: false },
      ],
    });
    await this.system.executeSchemaOperation({
      id: "init-schema-receipt-ledger",
      kind: "create-table",
      table: receiptTable,
      columns: [
        { name: "id", type: "TEXT", nullable: false, primaryKey: true },
        { name: "planId", type: "TEXT", nullable: false },
        { name: "provider", type: "TEXT", nullable: false },
        { name: "status", type: "TEXT", nullable: false },
        { name: "payload", type: "TEXT", nullable: false },
        { name: "createdAt", type: "TEXT", nullable: false },
      ],
    });
    await this.system.executeSchemaOperation({
      id: "init-schema-receipt-plan-index",
      kind: "create-index",
      table: receiptTable,
      name: "_orm_schema_receipt_plan_idx",
      columns: ["planId"],
      unique: false,
    });
  }

  async savePlan(plan: ReconciliationPlan): Promise<void> {
    const values = {
      id: plan.id,
      registryFingerprint: plan.registryFingerprint,
      provider: plan.provider,
      payload: JSON.stringify(plan),
      createdAt: plan.generatedAt,
    };
    await this.system.transaction(async (tx) => {
      const existing = await tx.select({ table: planTable, where: { kind: "condition", field: "id", operator: "eq", value: plan.id }, limit: 1 });
      if (existing.length) await tx.update(planTable, { kind: "condition", field: "id", operator: "eq", value: plan.id }, { payload: values.payload });
      else await tx.insert(planTable, values);
    });
  }

  async saveReceipt(receipt: ReconciliationReceipt): Promise<void> {
    const values = {
      id: receipt.id,
      planId: receipt.planId,
      provider: receipt.provider,
      status: receipt.status,
      payload: JSON.stringify(receipt),
      createdAt: receipt.appliedAt,
    };
    await this.system.transaction(async (tx) => {
      const existing = await tx.select({ table: receiptTable, where: { kind: "condition", field: "id", operator: "eq", value: receipt.id }, limit: 1 });
      if (existing.length) await tx.update(receiptTable, { kind: "condition", field: "id", operator: "eq", value: receipt.id }, { payload: values.payload });
      else await tx.insert(receiptTable, values);
    });
  }
}
