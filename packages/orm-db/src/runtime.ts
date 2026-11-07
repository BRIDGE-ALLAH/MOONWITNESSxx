import { randomUUID } from "node:crypto";
import type { DomainExpression, EnvironmentContext, FieldDescriptor, RegistryModel, RegistrySnapshot } from "@riotworks/orm";
import { assertValidDomain } from "@riotworks/orm";
import type { DatabaseAdapter, DatabaseRow, DatabaseSession, DbFilter, DbOrderBy, DbValue } from "@riotworks/orm-db-adaptor";

export type ModelAction = "read" | "create" | "write" | "delete";
export class OrmError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OrmError";
  }
}

export interface AccessControl {
  canModel(context: EnvironmentContext, model: RegistryModel, action: ModelAction): boolean | Promise<boolean>;
  canRecord(context: EnvironmentContext, model: RegistryModel, action: ModelAction, record: DatabaseRow): boolean | Promise<boolean>;
  canField(context: EnvironmentContext, model: RegistryModel, field: string, action: ModelAction): boolean | Promise<boolean>;
}

export interface AuditEvent {
  readonly id: string;
  readonly actorId: string;
  readonly model: string;
  readonly recordId: string;
  readonly action: "create" | "write" | "delete";
  readonly occurredAt: string;
  readonly changedFields: readonly string[];
}

export interface AuditWriter {
  record(session: DatabaseSession, event: AuditEvent): Promise<void>;
}

export class DatabaseAuditWriter implements AuditWriter {
  constructor(private readonly table = "base_audit_event") {}
  async record(session: DatabaseSession, event: AuditEvent): Promise<void> {
    await session.insert(this.table, {
      id: event.id,
      actorId: event.actorId,
      modelName: event.model,
      recordId: event.recordId,
      action: event.action,
      occurredAt: event.occurredAt,
      changedFields: JSON.stringify(event.changedFields),
    });
  }
}

export interface SearchOptions {
  readonly orderBy?: readonly DbOrderBy[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface Recordset<TRecord extends DatabaseRow = DatabaseRow> {
  readonly modelName: string;
  readonly ids: readonly string[];
  readonly length: number;
  toArray(): Promise<readonly TRecord[]>;
  first(): Promise<TRecord | null>;
  write(values: Readonly<Record<string, unknown>>): Promise<void>;
  delete(): Promise<void>;
}

export interface ModelCollection {
  get<TRecord extends DatabaseRow = DatabaseRow>(modelName: string, ids: readonly string[]): Recordset<TRecord>;
  search<TRecord extends DatabaseRow = DatabaseRow>(modelName: string, domain?: DomainExpression, options?: SearchOptions): Promise<Recordset<TRecord>>;
  create<TRecord extends DatabaseRow = DatabaseRow>(modelName: string, values: Readonly<Record<string, unknown>>): Promise<Recordset<TRecord>>;
}

export interface Environment {
  readonly context: EnvironmentContext;
  readonly registry: RegistrySnapshot;
  readonly models: ModelCollection;
  derive(changes: Readonly<{ companyId?: string; locale?: string; timeZone?: string }>): Environment;
}

export interface RuntimeOptions {
  readonly registry: RegistrySnapshot;
  readonly adapter: DatabaseAdapter;
  readonly context: EnvironmentContext;
  readonly access: AccessControl;
  readonly audit: AuditWriter;
}

export interface OrmRuntime {
  readonly env: Environment;
  readonly models: ModelCollection;
  close(): Promise<void>;
}

const protectedFields = new Set(["id", "createdAt", "createdById", "updatedAt", "updatedById", "tenantId", "workspaceId", "companyId"]);

function freezeContext(context: EnvironmentContext): EnvironmentContext {
  if (!context.principal?.id?.trim() || !context.principal.type.trim()) throw new OrmError("ORM_INVALID_CONTEXT", "A trusted principal is required.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.principal.id)) throw new OrmError("ORM_INVALID_CONTEXT", "Principal ID must be a UUID.");
  if (!Array.isArray(context.allowedCompanyIds) || context.allowedCompanyIds.some((id) => typeof id !== "string" || !id.trim())) throw new OrmError("ORM_INVALID_CONTEXT", "Allowed company IDs must be a list of non-empty IDs.");
  if (!context.locale.trim() || !context.timeZone.trim() || !context.traceId.trim()) throw new OrmError("ORM_INVALID_CONTEXT", "Locale, time zone and trace ID are required.");
  if (context.companyId && !context.allowedCompanyIds.includes(context.companyId)) throw new OrmError("ORM_INVALID_CONTEXT", "Company is outside the allowed-company scope.");
  if (context.workspaceId !== undefined && !context.workspaceId.trim()) throw new OrmError("ORM_INVALID_CONTEXT", "Workspace ID cannot be empty.");
  if (context.tenantId !== undefined && !context.tenantId.trim()) throw new OrmError("ORM_INVALID_CONTEXT", "Tenant ID cannot be empty.");
  return Object.freeze({
    ...context,
    principal: Object.freeze({ ...context.principal }),
    allowedCompanyIds: Object.freeze([...context.allowedCompanyIds]),
  });
}

function tableName(modelName: string): string {
  return modelName.replace(/[.-]/g, "_");
}

function and(...expressions: (DbFilter | undefined)[]): DbFilter | undefined {
  const items = expressions.filter((item): item is DbFilter => item !== undefined);
  if (items.length === 0) return undefined;
  if (items.length === 1) return items[0];
  return Object.freeze({ kind: "and", expressions: Object.freeze(items) });
}

function toDbFilter(node: DomainExpression | undefined): DbFilter | undefined {
  if (!node) return undefined;
  if (node.kind === "condition") return Object.freeze({
    kind: "condition",
    field: node.field,
    operator: node.operator,
    ...(node.value !== undefined ? { value: node.value as never } : {}),
  });
  if (node.kind === "not") return Object.freeze({ kind: "not", expression: toDbFilter(node.expression)! });
  return Object.freeze({ kind: node.kind, expressions: Object.freeze(node.expressions.map((item) => toDbFilter(item)!)) });
}

function scopeFilter(model: RegistryModel, context: EnvironmentContext): DbFilter | undefined {
  const terms: DbFilter[] = [];
  if (Object.hasOwn(model.fields, "tenantId")) {
    if (!context.tenantId) throw new OrmError("ORM_SCOPE_REQUIRED", "Tenant context is required for " + model.name + ".");
    terms.push({ kind: "condition", field: "tenantId", operator: "eq", value: context.tenantId });
  }
  if (Object.hasOwn(model.fields, "workspaceId")) {
    if (!context.workspaceId) throw new OrmError("ORM_SCOPE_REQUIRED", "Workspace context is required for " + model.name + ".");
    terms.push({ kind: "condition", field: "workspaceId", operator: "eq", value: context.workspaceId });
  }
  if (Object.hasOwn(model.fields, "companyId")) {
    if (!context.companyId) throw new OrmError("ORM_SCOPE_REQUIRED", "Company context is required for " + model.name + ".");
    terms.push({ kind: "condition", field: "companyId", operator: "eq", value: context.companyId });
  }
  return and(...terms);
}

function validateValue(name: string, field: FieldDescriptor, value: unknown): void {
  if (value === null) {
    if (!field.nullable) throw new OrmError("ORM_VALIDATION_FAILED", name + " cannot be null.");
    return;
  }
  if (value === undefined) {
    if (field.required && field.default === undefined) throw new OrmError("ORM_VALIDATION_FAILED", name + " is required.");
    return;
  }
  const invalid = (): never => { throw new OrmError("ORM_VALIDATION_FAILED", "Invalid value for " + name + " (" + field.kind + ")."); };
  switch (field.kind) {
    case "char":
    case "text":
    case "date":
    case "datetime":
    case "time":
    case "uuid":
    case "decimal":
    case "selection":
    case "many-to-one":
      if (typeof value !== "string") invalid();
      if (field.kind === "decimal" && !/^-?\d+(?:\.\d+)?$/.test(value)) invalid();
      if (field.kind === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid();
      if (field.kind === "char" && typeof field.options.maxLength === "number" && value.length > field.options.maxLength) invalid();
      if (field.kind === "selection" && Array.isArray(field.options.values) && !field.options.values.some((item: unknown) => (item as { value?: unknown }).value === value)) invalid();
      break;
    case "integer":
      if (!Number.isSafeInteger(value)) invalid();
      break;
    case "float":
      if (typeof value !== "number" || !Number.isFinite(value)) invalid();
      break;
    case "boolean":
      if (typeof value !== "boolean") invalid();
      break;
    case "json":
      if (typeof value !== "object") invalid();
      break;
    case "binary":
      if (!(value instanceof Uint8Array)) invalid();
      break;
    case "one-to-many":
    case "many-to-many":
      if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) invalid();
      break;
    case "computed":
    case "related":
      if (field.options.stored !== true) throw new OrmError("ORM_READ_ONLY_FIELD", name + " is not a stored field.");
      break;
  }
}

function normalizeInput(model: RegistryModel, input: Readonly<Record<string, unknown>>, context: EnvironmentContext, creating: boolean): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    const field = model.fields[key];
    if (!field) throw new OrmError("ORM_UNKNOWN_FIELD", "Unknown field " + model.name + "." + key + ".");
    if (protectedFields.has(key) || field.readonly || field.kind === "computed" || field.kind === "related") {
      throw new OrmError("ORM_READ_ONLY_FIELD", "Field " + model.name + "." + key + " is managed by the ORM.");
    }
    validateValue(key, field, input[key]);
    output[key] = input[key];
  }
  const now = new Date().toISOString();
  if (creating) {
    for (const [key, field] of Object.entries(model.fields)) {
      if (protectedFields.has(key)) continue;
      if (!Object.hasOwn(output, key) && field.default !== undefined) {
        output[key] = typeof field.default === "function" ? (field.default as () => unknown)() : field.default;
      }
      if (!Object.hasOwn(output, key) && field.required) throw new OrmError("ORM_VALIDATION_FAILED", "Missing required field " + model.name + "." + key + ".");
      if (output[key] !== undefined) validateValue(key, field, output[key]);
    }
    if (model.fields.id) output.id = randomUUID();
    if (model.fields.createdAt) output.createdAt = now;
    if (model.fields.createdById) output.createdById = context.principal.id;
    if (model.fields.updatedAt) output.updatedAt = now;
    if (model.fields.updatedById) output.updatedById = context.principal.id;
    if (model.fields.tenantId) {
      if (!context.tenantId) throw new OrmError("ORM_SCOPE_REQUIRED", "Tenant context is required to create " + model.name + ".");
      output.tenantId = context.tenantId;
    }
    if (model.fields.workspaceId) {
      if (!context.workspaceId) throw new OrmError("ORM_SCOPE_REQUIRED", "Workspace context is required to create " + model.name + ".");
      output.workspaceId = context.workspaceId;
    }
    if (model.fields.companyId) {
      if (!context.companyId) throw new OrmError("ORM_SCOPE_REQUIRED", "Company context is required to create " + model.name + ".");
      output.companyId = context.companyId;
    }
  } else {
    if (model.fields.updatedAt) output.updatedAt = now;
    if (model.fields.updatedById) output.updatedById = context.principal.id;
  }
  return output;
}

class RuntimeRecordset<TRecord extends DatabaseRow> implements Recordset<TRecord> {
  readonly modelName: string;
  readonly ids: readonly string[];
  readonly length: number;
  constructor(modelName: string, ids: readonly string[], private readonly load: (ids: readonly string[]) => Promise<readonly TRecord[]>, private readonly writeRecords: (ids: readonly string[], values: Readonly<Record<string, unknown>>) => Promise<void>, private readonly deleteRecords: (ids: readonly string[]) => Promise<void>) {
    this.modelName = modelName;
    this.ids = Object.freeze([...ids]);
    this.length = ids.length;
  }
  toArray(): Promise<readonly TRecord[]> { return this.load(this.ids); }
  async first(): Promise<TRecord | null> { return (await this.toArray())[0] ?? null; }
  write(values: Readonly<Record<string, unknown>>): Promise<void> { return this.writeRecords(this.ids, values); }
  delete(): Promise<void> { return this.deleteRecords(this.ids); }
}

export function createOrmRuntime(options: RuntimeOptions): OrmRuntime {
  if (!options.access || typeof options.access.canModel !== "function" || typeof options.access.canRecord !== "function" || typeof options.access.canField !== "function") {
    throw new OrmError("ORM_ACCESS_POLICY_REQUIRED", "Explicit model, record and field authorization policies are mandatory.");
  }
  if (!options.audit || typeof options.audit.record !== "function") throw new OrmError("ORM_AUDIT_REQUIRED", "A transactional audit writer is mandatory.");
  const initialContext = freezeContext(options.context);

  const canModel = async (context: EnvironmentContext, model: RegistryModel, action: ModelAction) => {
    if (!(await options.access.canModel(context, model, action))) throw new OrmError("ORM_ACCESS_DENIED", "Access denied to " + action + " " + model.name + ".");
  };
  const canRecord = async (context: EnvironmentContext, model: RegistryModel, action: ModelAction, record: DatabaseRow) => {
    if (!(await options.access.canRecord(context, model, action, record))) throw new OrmError("ORM_RECORD_NOT_FOUND", "Record not found.");
  };
  const canField = async (context: EnvironmentContext, model: RegistryModel, field: string, action: ModelAction) => {
    if (!(await options.access.canField(context, model, field, action))) throw new OrmError("ORM_FIELD_ACCESS_DENIED", "Access denied to field " + model.name + "." + field + ".");
  };
  const authorizeDomain = async (context: EnvironmentContext, model: RegistryModel, domain: DomainExpression | undefined) => {
    if (!domain) return;
    if (domain.kind === "condition") return canField(context, model, domain.field, "read");
    if (domain.kind === "not") return authorizeDomain(context, model, domain.expression);
    await Promise.all(domain.expressions.map((item) => authorizeDomain(context, model, item)));
  };
  const projectRecord = async (context: EnvironmentContext, model: RegistryModel, record: DatabaseRow): Promise<DatabaseRow> => {
    const projected: Record<string, unknown> = {};
    for (const key of Object.keys(model.fields)) {
      if (Object.hasOwn(record, key) && await options.access.canField(context, model, key, "read")) projected[key] = record[key];
    }
    return Object.freeze(projected);
  };

  const makeAudit = (context: EnvironmentContext, model: string, recordId: string, action: AuditEvent["action"], changedFields: readonly string[]): AuditEvent => Object.freeze({
    id: randomUUID(), actorId: context.principal.id, model, recordId, action,
    occurredAt: new Date().toISOString(), changedFields: Object.freeze([...changedFields].sort()),
  });

  const makeRecordset = <TRecord extends DatabaseRow>(model: RegistryModel, ids: readonly string[], context: EnvironmentContext): Recordset<TRecord> => {
    const load = async (requestedIds: readonly string[]): Promise<readonly TRecord[]> => {
      if (requestedIds.length === 0) return Object.freeze([]);
      if (model.kind !== "persistent") throw new OrmError("ORM_MODEL_NOT_PERSISTED", "Only persistent models have recordsets.");
      await canModel(context, model, "read");
      const where = and(scopeFilter(model, context), { kind: "condition", field: "id", operator: "in", value: requestedIds });
      const rows = await options.adapter.select({ table: tableName(model.name), where });
      const byId = new Map(rows.map((record) => [String(record.id), record]));
      const ordered: TRecord[] = [];
      for (const id of requestedIds) {
        const record = byId.get(id);
        if (!record) throw new OrmError("ORM_RECORD_NOT_FOUND", "Record not found.");
        await canRecord(context, model, "read", record);
        ordered.push(await projectRecord(context, model, record) as TRecord);
      }
      return Object.freeze(ordered);
    };
    const writeRecords = async (requestedIds: readonly string[], values: Readonly<Record<string, unknown>>) => {
      if (!requestedIds.length) return;
      if (model.kind !== "persistent") throw new OrmError("ORM_MODEL_NOT_PERSISTED", "Only persistent models can be updated.");
      await canModel(context, model, "write");
      for (const field of Object.keys(values)) await canField(context, model, field, "write");
      const payload = normalizeInput(model, values, context, false) as Record<string, DbValue>;
      const where = and(scopeFilter(model, context), { kind: "condition", field: "id", operator: "in", value: requestedIds });
      await options.adapter.transaction(async (tx) => {
        const before = await tx.select({ table: tableName(model.name), where });
        if (before.length !== requestedIds.length) throw new OrmError("ORM_RECORD_NOT_FOUND", "Record not found.");
        for (const record of before) await canRecord(context, model, "write", record);
        const updated = await tx.update(tableName(model.name), where!, payload);
        if (updated !== requestedIds.length) throw new OrmError("ORM_CONCURRENCY_CONFLICT", "Not all requested records were updated.");
        for (const record of before) await options.audit.record(tx, makeAudit(context, model.name, String(record.id), "write", Object.keys(values)));
      });
    };
    const deleteRecords = async (requestedIds: readonly string[]) => {
      if (!requestedIds.length) return;
      if (model.kind !== "persistent") throw new OrmError("ORM_MODEL_NOT_PERSISTED", "Only persistent models can be deleted.");
      await canModel(context, model, "delete");
      const where = and(scopeFilter(model, context), { kind: "condition", field: "id", operator: "in", value: requestedIds });
      await options.adapter.transaction(async (tx) => {
        const before = await tx.select({ table: tableName(model.name), where });
        if (before.length !== requestedIds.length) throw new OrmError("ORM_RECORD_NOT_FOUND", "Record not found.");
        for (const record of before) await canRecord(context, model, "delete", record);
        const deleted = await tx.delete(tableName(model.name), where!);
        if (deleted !== requestedIds.length) throw new OrmError("ORM_CONCURRENCY_CONFLICT", "Not all requested records were deleted.");
        for (const record of before) await options.audit.record(tx, makeAudit(context, model.name, String(record.id), "delete", Object.keys(record)));
      });
    };
    return new RuntimeRecordset<TRecord>(model.name, ids, load, writeRecords, deleteRecords);
  };

  const createEnvironment = (context: EnvironmentContext): Environment => {
    const models: ModelCollection = {
      get: <TRecord extends DatabaseRow = DatabaseRow>(modelName: string, ids: readonly string[]) => {
        const model = options.registry.models[modelName];
        if (!model) throw new OrmError("ORM_UNKNOWN_MODEL", "Unknown model " + modelName + ".");
        if (model.kind !== "persistent") throw new OrmError("ORM_MODEL_NOT_PERSISTED", "Only persistent models have recordsets.");
        if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
          throw new OrmError("ORM_INVALID_RECORDSET", "Recordset IDs must be non-empty and unique.");
        }
        return makeRecordset<TRecord>(model, ids, context);
      },
      search: async <TRecord extends DatabaseRow = DatabaseRow>(modelName: string, domain?: DomainExpression, searchOptions: SearchOptions = {}) => {
        const model = options.registry.models[modelName];
        if (!model) throw new OrmError("ORM_UNKNOWN_MODEL", "Unknown model " + modelName + ".");
        if (model.kind !== "persistent") throw new OrmError("ORM_MODEL_NOT_PERSISTED", "Only persistent models can be searched.");
        await canModel(context, model, "read");
        assertValidDomain(domain, model.fields);
        await authorizeDomain(context, model, domain);
        if (searchOptions.limit !== undefined && (!Number.isSafeInteger(searchOptions.limit) || searchOptions.limit < 0 || searchOptions.limit > 10000)) throw new OrmError("ORM_INVALID_QUERY", "Limit must be between 0 and 10000.");
        if (searchOptions.offset !== undefined && (!Number.isSafeInteger(searchOptions.offset) || searchOptions.offset < 0)) throw new OrmError("ORM_INVALID_QUERY", "Offset must be non-negative.");
        for (const item of searchOptions.orderBy ?? []) {
          if (!model.fields[item.field] || !["asc", "desc"].includes(item.direction)) throw new OrmError("ORM_INVALID_QUERY", "Invalid order-by field or direction.");
          await canField(context, model, item.field, "read");
        }
        const where = and(scopeFilter(model, context), toDbFilter(domain));
        const rows = await options.adapter.select({
          table: tableName(modelName),
          where,
          ...(searchOptions.orderBy ? { orderBy: searchOptions.orderBy } : {}),
          limit: 10000,
        });
        if (rows.length === 10000) throw new OrmError("ORM_QUERY_RESULT_LIMIT", "Search reached the 10000-record authorization scan limit; narrow the domain.");
        const visible: string[] = [];
        for (const record of rows) {
          try { await canRecord(context, model, "read", record); visible.push(String(record.id)); }
          catch { /* record policy filters the result without leaking the record */ }
        }
        const offset = searchOptions.offset ?? 0;
        const end = searchOptions.limit === undefined ? undefined : offset + searchOptions.limit;
        return makeRecordset<TRecord>(model, visible.slice(offset, end), context);
      },
      create: async <TRecord extends DatabaseRow = DatabaseRow>(modelName: string, values: Readonly<Record<string, unknown>>) => {
        const model = options.registry.models[modelName];
        if (!model) throw new OrmError("ORM_UNKNOWN_MODEL", "Unknown model " + modelName + ".");
        if (model.kind !== "persistent") throw new OrmError("ORM_MODEL_NOT_PERSISTED", "Only persistent models can be created.");
        await canModel(context, model, "create");
        for (const field of Object.keys(values)) await canField(context, model, field, "create");
        const payload = normalizeInput(model, values, context, true) as Record<string, DbValue>;
        for (const [key, field] of Object.entries(model.fields)) {
          if (field.required && payload[key] === undefined) throw new OrmError("ORM_VALIDATION_FAILED", "Missing required field " + modelName + "." + key + ".");
        }
        const row = await options.adapter.transaction(async (tx) => {
          const inserted = await tx.insert(tableName(modelName), payload);
          await options.audit.record(tx, makeAudit(context, modelName, String(inserted.id), "create", Object.keys(values)));
          return inserted;
        });
        return makeRecordset<TRecord>(model, [String(row.id)], context);
      },
    };

    return Object.freeze({
      context,
      registry: options.registry,
      models: Object.freeze(models),
      derive: (changes: Readonly<{ companyId?: string; locale?: string; timeZone?: string }>) => {
        if (changes.companyId !== undefined && !context.allowedCompanyIds.includes(changes.companyId)) throw new OrmError("ORM_SCOPE_ESCALATION", "Cannot derive outside allowed company scope.");
        return createEnvironment(freezeContext({ ...context, ...changes }));
      },
    });
  };

  const env = createEnvironment(initialContext);
  return Object.freeze({ env, models: env.models, close: () => options.adapter.close() });
}
