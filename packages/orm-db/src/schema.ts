import { createHash } from "node:crypto";
import type { FieldDescriptor, RegistryModel, RegistrySnapshot } from "@riotworks/orm";
import { modelTableName } from "@riotworks/orm";
import type { DatabaseAdapter, DatabaseSnapshot, DbColumnDefinition, SchemaOperation } from "@riotworks/orm-db-adaptor";
import type { DatabaseSchemaLedger } from "./ledger.ts";

export type ReconciliationMode = "plan" | "safe" | "strict";
export interface SchemaApproval {
  readonly id: string;
  readonly planId: string;
  readonly actorId: string;
  readonly operationIds: readonly string[];
  readonly reason: string;
}
export interface PlannedOperation {
  readonly id: string;
  readonly operation: SchemaOperation;
  readonly risk: "safe" | "review";
  readonly reason: string;
}
export interface ReconciliationPlan {
  readonly id: string;
  readonly provider: string;
  readonly registryFingerprint: string;
  readonly generatedAt: string;
  readonly operations: readonly PlannedOperation[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}
export interface ReconciliationReceipt {
  readonly id: string;
  readonly planId: string;
  readonly registryFingerprint: string;
  readonly provider: string;
  readonly actorId: string;
  readonly appliedAt: string;
  readonly status: "planned" | "verified" | "partial" | "blocked";
  readonly results: readonly Readonly<{ operationId: string; applied: boolean; detail?: string }>[];
  readonly verified: boolean;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + stable(object[key])).join(",") + "}";
}
function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
function sqlType(field: FieldDescriptor, provider: "postgres" | "libsql"): string | null {
  if (field.kind === "one-to-many" || field.kind === "many-to-many") return null;
  if ((field.kind === "computed" || field.kind === "related") && field.options.stored !== true) return null;
  if (provider === "libsql") {
    switch (field.kind) {
      case "integer": case "boolean": return "INTEGER";
      case "float": return "REAL";
      case "decimal": return "NUMERIC";
      case "binary": return "BLOB";
      default: return "TEXT";
    }
  }
  switch (field.kind) {
    case "char": return "VARCHAR(" + Number(field.options.maxLength ?? 255) + ")";
    case "text": return "TEXT";
    case "boolean": return "BOOLEAN";
    case "integer": return "BIGINT";
    case "float": return "DOUBLE PRECISION";
    case "decimal": return "NUMERIC(" + Number(field.options.precision ?? 18) + "," + Number(field.options.scale ?? 2) + ")";
    case "date": return "DATE";
    case "datetime": return "TIMESTAMPTZ";
    case "time": return "TIME";
    case "uuid": case "many-to-one": return "UUID";
    case "json": return "JSONB";
    case "binary": return "BYTEA";
    case "selection": return "VARCHAR(80)";
    case "computed": case "related": return typeof field.options.databaseType === "string" ? field.options.databaseType : null;
    default: return null;
  }
}
function literalDefault(field: FieldDescriptor, provider: "postgres" | "libsql"): string | undefined {
  const value = field.default;
  if (value === undefined || typeof value === "function") return undefined;
  if (value === null) return "NULL";
  if (typeof value === "string") return "'" + value.replace(/'/g, "''") + "'";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return provider === "postgres" ? (value ? "TRUE" : "FALSE") : (value ? "1" : "0");
  return undefined;
}
function normalizeType(type: string): string {
  return type.toUpperCase().replace(/\s+/g, "").replace("CHARACTERVARYING", "VARCHAR");
}
function physicalColumns(model: RegistryModel, provider: "postgres" | "libsql"): DbColumnDefinition[] {
  const columns: DbColumnDefinition[] = [];
  for (const [name, field] of Object.entries(model.fields).sort(([a], [b]) => a.localeCompare(b))) {
    const type = sqlType(field, provider);
    if (!type) continue;
    const references = field.kind === "many-to-one" && field.target
      ? { table: modelTableName(field.target), column: "id", onDelete: field.onDelete ?? "restrict" as const }
      : undefined;
    const defaultValue = literalDefault(field, provider);
    columns.push({
      name,
      type,
      nullable: field.nullable,
      ...(defaultValue !== undefined ? { defaultExpression: defaultValue } : {}),
      ...(name === "id" ? { primaryKey: true } : {}),
      ...(references ? { references } : {}),
    });
  }
  if (!columns.some((item) => item.name === "id")) throw new TypeError("Persistent model " + model.name + " must declare the BaseEntity id field.");
  return columns;
}
function planned(operation: SchemaOperation, risk: "safe" | "review", reason: string): PlannedOperation {
  return Object.freeze({ id: operation.id, operation: Object.freeze(operation), risk, reason });
}
function operationId(payload: unknown): string {
  return digest(payload).slice(0, 24);
}
function orderedModels(models: readonly RegistryModel[], blockers: string[]): RegistryModel[] {
  const byName = new Map<string, RegistryModel>(models.map((model): [string, RegistryModel] => [model.name, model]));
  const marks = new Map<string, number>();
  const output: RegistryModel[] = [];
  const visit = (model: RegistryModel, chain: readonly string[]) => {
    const mark = marks.get(model.name) ?? 0;
    if (mark === 2) return;
    if (mark === 1) {
      blockers.push("Foreign-key dependency cycle: " + [...chain, model.name].join(" -> ") + ". Split the cycle using nullable references or an explicit data-upgrade plan.");
      return;
    }
    marks.set(model.name, 1);
    const targets = Object.values(model.fields)
      .filter((field) => field.kind === "many-to-one" && field.target)
      .map((field) => byName.get(field.target!))
      .filter((target): target is RegistryModel => Boolean(target))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const target of targets) visit(target, [...chain, model.name]);
    marks.set(model.name, 2);
    output.push(model);
  };
  for (const model of [...models].sort((a, b) => a.name.localeCompare(b.name))) visit(model, []);
  return [...new Map(output.map((model) => [model.name, model])).values()];
}
function indexName(table: string, field: string, unique: boolean): string {
  const prefix = unique ? "uq" : "ix";
  const suffix = digest({ table, field, unique }).slice(0, 8);
  return (prefix + "_" + table + "_" + field + "_" + suffix).slice(0, 63);
}

export function tableNameForModel(modelName: string): string {
  return modelTableName(modelName);
}

export function planSchema(registry: RegistrySnapshot, actual: DatabaseSnapshot): ReconciliationPlan {
  const provider = actual.identity.provider;
  const operations: PlannedOperation[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const actualTables = new Map(actual.tables.map((table) => [table.name, table]));
  const models = Object.values(registry.models).filter((model) => model.kind === "persistent");
  const ordered = orderedModels(models, blockers);

  // First create parent tables before tables that declare foreign keys.
  for (const model of ordered) {
    const table = modelTableName(model.name);
    const columns = physicalColumns(model, provider);
    const existing = actualTables.get(table);
    if (!existing) {
      const operation = { kind: "create-table" as const, table, columns, id: operationId({ kind: "create-table", table, columns }) };
      operations.push(planned(operation, "safe", "Creates a new table without changing existing data."));
      continue;
    }
    const existingColumns = new Map(existing.columns.map((column) => [column.name, column]));
    for (const column of columns) {
      const found = existingColumns.get(column.name);
      if (!found) {
        const risk = column.nullable || column.defaultExpression !== undefined ? "safe" : "review";
        const operation = { kind: "add-column" as const, table, column, id: operationId({ kind: "add-column", table, column }) };
        operations.push(planned(operation, risk, risk === "safe" ? "Adds a nullable/defaulted column." : "Requires a data backfill before enforcing NOT NULL."));
        if (risk === "review" && provider === "libsql") blockers.push("libSQL cannot safely add required column " + table + "." + column.name + " without a default; add a versioned data-upgrade handler.");
      } else if (normalizeType(found.dataType) !== normalizeType(column.type)) {
        blockers.push("Type drift detected for " + table + "." + column.name + ": " + found.dataType + " -> " + column.type + ". A reviewed semantic data upgrade is required.");
      } else if (column.nullable === false && found.nullable) {
        blockers.push("Nullability tightening for " + table + "." + column.name + " requires a data validation/backfill step.");
      }
    }
  }

  // Indexes run after all tables have been planned, including newly-created tables.
  for (const model of ordered) {
    const table = modelTableName(model.name);
    const existing = actualTables.get(table);
    const signatures = new Set((existing?.indexes ?? []).map((index) => index.columns.join(",") + ":" + index.unique));
    for (const [fieldName, field] of Object.entries(model.fields)) {
      if (fieldName === "id" || (!field.index && !field.unique)) continue;
      const signature = fieldName + ":" + Boolean(field.unique);
      if (signatures.has(signature)) continue;
      const name = indexName(table, fieldName, Boolean(field.unique));
      const operation = { kind: "create-index" as const, table, name, columns: [fieldName], unique: Boolean(field.unique), id: operationId({ kind: "create-index", table, name, columns: [fieldName], unique: Boolean(field.unique) }) };
      operations.push(planned(operation, field.unique ? "review" : "safe", field.unique ? "Existing data must be checked for duplicates before enforcing uniqueness." : "Adds a non-destructive lookup index."));
    }
  }

  // Many-to-many relation tables are built after both model tables.
  const relationTables = new Set<string>();
  for (const model of ordered) {
    const sourceTable = modelTableName(model.name);
    for (const field of Object.values(model.fields)) {
      if (field.kind !== "many-to-many" || !field.target) continue;
      const target = registry.models[field.target];
      if (!target || target.kind !== "persistent") {
        blockers.push("Many-to-many relation target must be a persistent model: " + model.name + " -> " + field.target + ".");
        continue;
      }
      const targetTable = modelTableName(target.name);
      const [leftTable, rightTable] = [sourceTable, targetTable].sort();
      const joinTable = "rel_" + leftTable + "_" + rightTable;
      if (relationTables.has(joinTable) || actualTables.has(joinTable)) continue;
      relationTables.add(joinTable);
      const leftColumn = sourceTable === targetTable ? "source_id" : leftTable + "_id";
      const rightColumn = sourceTable === targetTable ? "target_id" : rightTable + "_id";
      const columns: DbColumnDefinition[] = [
        { name: leftColumn, type: provider === "postgres" ? "UUID" : "TEXT", nullable: false, references: { table: leftTable, column: "id", onDelete: "cascade" } },
        { name: rightColumn, type: provider === "postgres" ? "UUID" : "TEXT", nullable: false, references: { table: rightTable, column: "id", onDelete: "cascade" } },
      ];
      const operation = {
        kind: "create-table" as const,
        table: joinTable,
        columns,
        primaryKey: [leftColumn, rightColumn],
        id: operationId({ kind: "create-table", table: joinTable, columns, primaryKey: [leftColumn, rightColumn] }),
      };
      operations.push(planned(operation, "safe", "Creates a new many-to-many relation table."));
    }
  }

  const normalized = { provider, registryFingerprint: registry.fingerprint, operations: operations.map((item) => ({ id: item.id, operation: item.operation, risk: item.risk })), blockers };
  return Object.freeze({
    id: digest(normalized),
    provider: provider + ":" + actual.identity.role,
    registryFingerprint: registry.fingerprint,
    generatedAt: new Date().toISOString(),
    operations: Object.freeze(operations),
    blockers: Object.freeze([...new Set(blockers)]),
    warnings: Object.freeze(warnings),
  });
}

export class SchemaReconciler {
  constructor(
    private readonly business: DatabaseAdapter,
    private readonly ledger: DatabaseSchemaLedger,
  ) {
    if (business.identity.role !== "business") throw new TypeError("Schema reconciliation requires a Business Database adapter.");
  }

  async plan(registry: RegistrySnapshot): Promise<ReconciliationPlan> {
    const actual = await this.business.inspectSchema();
    const plan = planSchema(registry, actual);
    await this.ledger.savePlan(plan);
    return plan;
  }

  async reconcile(
    registry: RegistrySnapshot,
    input: Readonly<{ actorId: string; mode?: ReconciliationMode; approval?: SchemaApproval }>,
  ): Promise<ReconciliationReceipt> {
    if (!input.actorId.trim()) throw new TypeError("A schema operator actor is required.");
    const mode = input.mode ?? "safe";
    if (mode === "plan") {
      const plan = await this.plan(registry);
      return this.#saveReceipt(plan, input.actorId, "planned", [], false);
    }

    return this.business.withSchemaLock("riotworks:orm:schema", async () => {
      // The plan is calculated only after acquiring the provider lock to avoid stale-plan application.
      const plan = await this.plan(registry);
      if (input.approval && (
        input.approval.planId !== plan.id
        || input.approval.actorId !== input.actorId
        || !input.approval.id.trim()
        || !input.approval.reason.trim()
      )) throw new Error("Schema approval is not bound to this exact plan and actor.");
      if (plan.blockers.length) return this.#saveReceipt(plan, input.actorId, "blocked", [], false);

      const results: Array<{ operationId: string; applied: boolean; detail?: string }> = [];
      let failed = false;
      for (const item of plan.operations) {
        const approved = item.risk === "safe" || Boolean(
          input.approval
          && input.approval.operationIds.includes(item.id)
        );
        if (!approved) {
          results.push({ operationId: item.id, applied: false, detail: "Explicit plan-bound operator approval is required." });
          if (mode === "strict") {
            failed = true;
            break;
          }
          continue;
        }
        try {
          await this.business.executeSchemaOperation(item.operation);
          results.push({ operationId: item.id, applied: true });
        } catch (error) {
          failed = true;
          results.push({ operationId: item.id, applied: false, detail: error instanceof Error ? error.message : "Unknown schema error." });
          break;
        }
      }
      const remaining = planSchema(registry, await this.business.inspectSchema());
      const verified = !failed && results.every((item) => item.applied) && remaining.operations.length === 0 && remaining.blockers.length === 0;
      const status = verified ? "verified" : results.some((item) => item.applied) ? "partial" : "blocked";
      return this.#saveReceipt(plan, input.actorId, status, results, verified);
    });
  }

  async #saveReceipt(plan: ReconciliationPlan, actorId: string, status: ReconciliationReceipt["status"], results: readonly { operationId: string; applied: boolean; detail?: string }[], verified: boolean): Promise<ReconciliationReceipt> {
    const receipt: ReconciliationReceipt = Object.freeze({
      id: digest({ planId: plan.id, actorId, status, results }),
      planId: plan.id,
      registryFingerprint: plan.registryFingerprint,
      provider: plan.provider,
      actorId,
      appliedAt: new Date().toISOString(),
      status,
      results: Object.freeze(results.map((item) => Object.freeze({ ...item }))),
      verified,
    });
    await this.ledger.saveReceipt(receipt);
    return receipt;
  }
}
