import { createHash } from "node:crypto";
import type { FieldDefinition, FieldMap, RegistrySnapshot } from "@riotworks/orm";
import type {
  DatabaseSnapshot,
  SchemaOperation,
} from "@riotworks/orm-db-adaptor";
import type {
  ReconciliationRisk,
  SchemaPlan,
  SchemaPlanOperation,
  SchemaPlanner,
} from "./index.js";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + stable(object[key])).join(",") + "}";
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function safeIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new TypeError("Unsafe database identifier: " + value);
  }
  return value;
}

function tableName(modelName: string): string {
  return safeIdentifier(modelName.replace(/\./g, "_"));
}

function optionNumber(field: FieldDefinition, key: string): number | undefined {
  const value = field.options?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sqlType(field: FieldDefinition, provider: "postgres" | "sqlite"): string | null {
  const options = field.options ?? {};
  if (field.kind === "one-to-many" || field.kind === "many-to-many") return null;
  if (field.kind === "computed" || field.kind === "related") {
    if (options.stored !== true) return null;
    return typeof options.databaseType === "string" ? options.databaseType : null;
  }
  if (provider === "sqlite") {
    switch (field.kind) {
      case "boolean":
      case "integer": return "INTEGER";
      case "float": return "REAL";
      case "decimal": return "NUMERIC";
      case "binary": return "BLOB";
      default: return "TEXT";
    }
  }
  switch (field.kind) {
    case "char": {
      const length = optionNumber(field, "maxLength") ?? 255;
      if (!Number.isInteger(length) || length < 1 || length > 10_485_760) throw new RangeError("Invalid Char maxLength.");
      return "VARCHAR(" + length + ")";
    }
    case "text": return "TEXT";
    case "boolean": return "BOOLEAN";
    case "integer": return "BIGINT";
    case "float": return "DOUBLE PRECISION";
    case "decimal": {
      const precision = optionNumber(field, "precision") ?? 18;
      const scale = optionNumber(field, "scale") ?? 2;
      if (!Number.isInteger(precision) || !Number.isInteger(scale) || precision < 1 || scale < 0 || scale > precision) {
        throw new RangeError("Invalid Decimal precision/scale.");
      }
      return "NUMERIC(" + precision + "," + scale + ")";
    }
    case "date": return "DATE";
    case "datetime": return "TIMESTAMPTZ";
    case "time": return "TIME";
    case "uuid":
    case "many-to-one": return "UUID";
    case "json": return "JSONB";
    case "binary": return "BYTEA";
    case "selection": return "VARCHAR(80)";
    case "reference": return "TEXT";
    default: return null;
  }
}

function literalDefault(field: FieldDefinition, provider: "postgres" | "sqlite"): string | undefined {
  const value = field.default;
  if (value === undefined || typeof value === "function") return undefined;
  if (value === null) return "NULL";
  if (typeof value === "string") return "'" + value.replace(/'/g, "''") + "'";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return provider === "postgres" ? (value ? "TRUE" : "FALSE") : (value ? "1" : "0");
  return undefined;
}

function normalizeType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").replace("charactervarying", "varchar");
}

function operation(
  kind: SchemaOperation["kind"],
  table: string,
  description: string,
  destructive: boolean,
  payload: Readonly<Record<string, unknown>>,
  risk: ReconciliationRisk,
  recoveryNotes: string,
): SchemaPlanOperation {
  const id = digest({ kind, table, payload }).slice(0, 24);
  return Object.freeze({
    id,
    kind,
    table,
    description,
    destructive,
    payload: Object.freeze({ ...payload }),
    risk,
    requiresApproval: risk !== "safe",
    recoveryNotes,
  });
}

export class DeterministicSchemaPlanner implements SchemaPlanner {
  plan(registry: RegistrySnapshot, actual: DatabaseSnapshot): SchemaPlan {
    const provider = actual.identity.provider;
    const actualTables = new Map(actual.tables.map((table) => [table.name, table]));
    const operations: SchemaPlanOperation[] = [];

    for (const [modelName, model] of Object.entries(registry.models).sort(([a], [b]) => a.localeCompare(b))) {
      if (model.kind !== "persistent") continue;
      const table = tableName(modelName);
      const existing = actualTables.get(table);
      const desiredColumns: Array<{
        name: string;
        dataType: string;
        nullable: boolean;
        defaultExpression?: string;
      }> = [];

      for (const [fieldName, field] of Object.entries(model.fields as FieldMap).sort(([a], [b]) => a.localeCompare(b))) {
        safeIdentifier(fieldName);
        const dataType = sqlType(field, provider);
        if (!dataType) continue;
        desiredColumns.push({
          name: fieldName,
          dataType,
          nullable: field.nullable ?? !field.required,
          ...(literalDefault(field, provider) !== undefined
            ? { defaultExpression: literalDefault(field, provider) }
            : {}),
        });
      }

      if (!existing) {
        operations.push(operation(
          "create-table",
          table,
          "Create table for model " + modelName,
          false,
          { modelName, columns: desiredColumns },
          "safe",
          "A newly created empty table can be removed before application data is written.",
        ));
        for (const [fieldName, field] of Object.entries(model.fields as FieldMap).sort(([a], [b]) => a.localeCompare(b))) {
          if (!field.index && !field.unique) continue;
          if (!sqlType(field, provider)) continue;
          const indexName = table + "_" + fieldName + (field.unique ? "_uniq" : "_idx");
          operations.push(operation(
            "create-index",
            table,
            "Create " + (field.unique ? "unique " : "") + "index for " + modelName + "." + fieldName,
            false,
            { name: indexName, columns: [fieldName], unique: Boolean(field.unique) },
            field.unique ? "review" : "safe",
            field.unique ? "Verify there are no duplicate values before creating the unique index." : "Drop the index if query plans regress.",
          ));
        }
        continue;
      }

      const existingColumns = new Map(existing.columns.map((column) => [column.name, column]));
      const existingIndexes = new Set(existing.indexes.map((index) => index.columns.join(",") + ":" + index.unique));
      for (const column of desiredColumns) {
        const found = existingColumns.get(column.name);
        if (!found) {
          const field = model.fields[column.name];
          const hasDefault = column.defaultExpression !== undefined;
          const risk: ReconciliationRisk = !column.nullable && !hasDefault ? "review" : "safe";
          operations.push(operation(
            "add-column",
            table,
            "Add column " + table + "." + column.name,
            false,
            { column },
            risk,
            risk === "review"
              ? "Backfill existing rows and validate non-null values before applying a NOT NULL constraint."
              : "The column is additive; verify application defaults before rollout.",
          ));
        } else if (normalizeType(found.dataType) !== normalizeType(column.dataType)) {
          operations.push(operation(
            "alter-column",
            table,
            "Change type of " + table + "." + column.name,
            true,
            { column, previousType: found.dataType },
            "destructive",
            "Take a recoverable backup, test a data conversion, and approve a versioned semantic migration before changing stored values.",
          ));
        }
      }

      for (const [fieldName, field] of Object.entries(model.fields as FieldMap).sort(([a], [b]) => a.localeCompare(b))) {
        if (!field.index && !field.unique) continue;
        if (!sqlType(field, provider)) continue;
        const signature = fieldName + ":" + Boolean(field.unique);
        if (existingIndexes.has(signature)) continue;
        const indexName = table + "_" + fieldName + (field.unique ? "_uniq" : "_idx");
        operations.push(operation(
          "create-index",
          table,
          "Create " + (field.unique ? "unique " : "") + "index for " + modelName + "." + fieldName,
          false,
          { name: indexName, columns: [fieldName], unique: Boolean(field.unique) },
          field.unique ? "review" : "safe",
          field.unique ? "Verify existing values are unique before creating the index." : "Drop the index if query plans regress.",
        ));
      }
    }

    const normalized = {
      registryFingerprint: registry.fingerprint,
      provider,
      operations: operations.map((item) => ({
        id: item.id,
        kind: item.kind,
        table: item.table,
        payload: item.payload,
        risk: item.risk,
      })),
    };
    const planId = digest(normalized);
    return Object.freeze({
      id: planId,
      registryFingerprint: registry.fingerprint,
      provider: provider + ":" + actual.identity.role,
      generatedAt: new Date().toISOString(),
      operations: Object.freeze(operations),
      requiresApproval: operations.some((item) => item.requiresApproval),
    });
  }
}

export const schemaPlanner: SchemaPlanner = new DeterministicSchemaPlanner();
