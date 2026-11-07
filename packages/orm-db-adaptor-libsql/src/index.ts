import { createClient } from "@libsql/client";
import type { DatabaseAdapter, DatabaseCapability, DatabaseIdentity, DatabaseRow, DatabaseSession, DbFilter, DbValue, SchemaOperation, SelectQuery } from "@riotworks/orm-db-adaptor";

type LibsqlClient = ReturnType<typeof createClient>;
type LibsqlTransaction = Awaited<ReturnType<LibsqlClient["transaction"]>>;

const identity: DatabaseIdentity = Object.freeze({ provider: "libsql", role: "system" });
const capabilities: ReadonlySet<DatabaseCapability> = new Set<DatabaseCapability>(["transactions", "foreign-keys", "json", "schema-introspection", "transactional-ddl", "upsert"] as const);
const comparison: Record<string, string> = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE" };
const locks = new Map<string, Promise<void>>();

function quote(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new TypeError("Unsafe libSQL identifier: " + value);
  return '"' + value + '"';
}

function compileFilter(filter: DbFilter | undefined, parameters: unknown[]): string {
  if (!filter) return "1=1";
  if (filter.kind === "and" || filter.kind === "or") {
    if (!filter.expressions.length) throw new TypeError("Empty boolean filter is not permitted.");
    return "(" + filter.expressions.map((item) => compileFilter(item, parameters)).join(filter.kind === "and" ? " AND " : " OR ") + ")";
  }
  if (filter.kind === "not") return "(NOT " + compileFilter(filter.expression, parameters) + ")";
  const field = quote(filter.field);
  if (filter.operator === "is-null") return field + (filter.value === false ? " IS NOT NULL" : " IS NULL");
  if ((filter.operator === "eq" || filter.operator === "ne") && filter.value === null) return field + (filter.operator === "eq" ? " IS NULL" : " IS NOT NULL");
  if (filter.operator === "in" || filter.operator === "not-in") {
    if (!Array.isArray(filter.value) || filter.value.length === 0 || filter.value.length > 500) throw new TypeError("Invalid IN filter.");
    parameters.push(...filter.value);
    return field + (filter.operator === "in" ? " IN (" : " NOT IN (") + filter.value.map(() => "?").join(", ") + ")";
  }
  if (filter.operator === "ilike") {
    parameters.push(filter.value);
    return "LOWER(" + field + ") LIKE LOWER(?)";
  }
  const operator = comparison[filter.operator];
  if (!operator) throw new TypeError("Unsupported libSQL filter operator.");
  parameters.push(filter.value);
  return field + " " + operator + " ?";
}

function selectSql(query: SelectQuery): { sql: string; args: unknown[] } {
  const args: unknown[] = [];
  const columns = query.columns?.length ? query.columns.map(quote).join(", ") : "*";
  let sql = "SELECT " + columns + " FROM " + quote(query.table) + " WHERE " + compileFilter(query.where, args);
  for (const item of query.orderBy ?? []) sql += " ORDER BY " + quote(item.field) + " " + (item.direction === "desc" ? "DESC" : "ASC");
  if (query.limit !== undefined) {
    if (!Number.isSafeInteger(query.limit) || query.limit < 0 || query.limit > 10000) throw new RangeError("Select limit must be between 0 and 10000.");
    args.push(query.limit); sql += " LIMIT ?";
  }
  if (query.offset !== undefined) {
    if (!Number.isSafeInteger(query.offset) || query.offset < 0) throw new RangeError("Select offset must be non-negative.");
    if (query.limit === undefined) sql += " LIMIT -1";
    args.push(query.offset); sql += " OFFSET ?";
  }
  return { sql, args };
}

function normalizeRow(value: unknown): DatabaseRow {
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(source)) result[key] = item instanceof Uint8Array ? new Uint8Array(item) : item;
  return Object.freeze(result);
}

function safeType(value: string): string {
  const normalized = value.toUpperCase().trim();
  if (!["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB"].includes(normalized)) throw new TypeError("Unsupported libSQL type: " + value);
  return normalized;
}

function defaultExpression(value: string | undefined): string {
  if (value === undefined) return "";
  if (!/^(NULL|TRUE|FALSE|-?[0-9]+(?:\.[0-9]+)?|'(?:[^']|'')*')$/i.test(value)) throw new TypeError("Unsafe SQL default expression.");
  return " DEFAULT " + value;
}

function columnSql(column: { name: string; type: string; nullable?: boolean; defaultExpression?: string; primaryKey?: boolean; references?: { table: string; column: string; onDelete?: string } }): string {
  let sql = quote(column.name) + " " + safeType(column.type) + defaultExpression(column.defaultExpression);
  if (column.nullable === false) sql += " NOT NULL";
  if (column.primaryKey) sql += " PRIMARY KEY";
  if (column.references) {
    const actions: Record<string, string> = { restrict: "RESTRICT", cascade: "CASCADE", "set-null": "SET NULL", "no-action": "NO ACTION" };
    const action = actions[column.references.onDelete ?? "restrict"];
    if (!action) throw new TypeError("Invalid foreign-key delete action.");
    sql += " REFERENCES " + quote(column.references.table) + " (" + quote(column.references.column) + ") ON DELETE " + action;
  }
  return sql;
}

export interface LibsqlAdapterOptions {
  readonly url: string;
  readonly authToken?: string;
  readonly syncUrl?: string;
  readonly syncInterval?: number;
}

export class LibsqlDatabaseAdapter implements DatabaseAdapter {
  readonly identity = identity;
  readonly capabilities = capabilities;
  #client: LibsqlClient | null = null;
  constructor(private readonly options: LibsqlAdapterOptions) {
    if (!options.url.trim()) throw new TypeError("libSQL URL is required.");
  }
  async connect(): Promise<void> {
    if (this.#client) return;
    this.#client = createClient({
      url: this.options.url,
      ...(this.options.authToken ? { authToken: this.options.authToken } : {}),
      ...(this.options.syncUrl ? { syncUrl: this.options.syncUrl } : {}),
      ...(this.options.syncInterval ? { syncInterval: this.options.syncInterval } : {}),
    });
    try { await this.ping(); } catch (error) { await this.close(); throw error; }
  }
  async close(): Promise<void> { const client = this.#client; this.#client = null; if (client) await client.close(); }
  async ping(): Promise<void> { await this.#requireClient().execute("SELECT 1"); }
  async select(query: SelectQuery): Promise<readonly DatabaseRow[]> {
    const compiled = selectSql(query);
    const result = await this.#requireClient().execute({ sql: compiled.sql, args: compiled.args as never[] });
    return Object.freeze(result.rows.map(normalizeRow));
  }
  async insert(table: string, values: Readonly<Record<string, DbValue>>): Promise<DatabaseRow> {
    const keys = Object.keys(values).sort();
    if (!keys.length) throw new TypeError("Insert requires at least one value.");
    const args = keys.map((key) => values[key]);
    const result = await this.#requireClient().execute({
      sql: "INSERT INTO " + quote(table) + " (" + keys.map(quote).join(", ") + ") VALUES (" + keys.map(() => "?").join(", ") + ")",
      args: args as never[],
    });
    if (values.id !== undefined) {
      const rows = await this.select({ table, where: { kind: "condition", field: "id", operator: "eq", value: values.id } });
      if (rows[0]) return rows[0];
    }
    return Object.freeze({ ...values, ...(result.lastInsertRowid !== undefined ? { rowid: String(result.lastInsertRowid) } : {}) });
  }
  async update(table: string, where: DbFilter, values: Readonly<Record<string, DbValue>>): Promise<number> {
    const keys = Object.keys(values).sort();
    if (!keys.length) return 0;
    const args: unknown[] = keys.map((key) => values[key]);
    const predicate = compileFilter(where, args);
    const result = await this.#requireClient().execute({ sql: "UPDATE " + quote(table) + " SET " + keys.map((key) => quote(key) + " = ?").join(", ") + " WHERE " + predicate, args: args as never[] });
    return Number(result.rowsAffected);
  }
  async delete(table: string, where: DbFilter): Promise<number> {
    const args: unknown[] = [];
    const result = await this.#requireClient().execute({ sql: "DELETE FROM " + quote(table) + " WHERE " + compileFilter(where, args), args: args as never[] });
    return Number(result.rowsAffected);
  }
  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    const transaction = await this.#requireClient().transaction("write");
    try {
      const result = await operation(this.#session(transaction));
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }
  async withSchemaLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    locks.set(key, queued);
    await previous;
    try { return await operation(); }
    finally {
      release();
      if (locks.get(key) === queued) locks.delete(key);
    }
  }
  async inspectSchema() {
    const client = this.#requireClient();
    const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = [];
    for (const item of tablesResult.rows as unknown as Array<{ name: string }>) {
      const name = item.name;
      const columnsResult = await client.execute("PRAGMA table_info(" + quote(name) + ")");
      const indexesResult = await client.execute("PRAGMA index_list(" + quote(name) + ")");
      const columns = (columnsResult.rows as unknown as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>).map((column) => ({
        name: column.name,
        dataType: column.type.toUpperCase() || "TEXT",
        nullable: column.notnull !== 1,
        ...(column.dflt_value !== null ? { defaultExpression: column.dflt_value } : {}),
        ...(column.pk === 1 ? { primaryKey: true } : {}),
      }));
      const indexes = [];
      for (const index of indexesResult.rows as unknown as Array<{ name: string; unique: number }>) {
        const info = await client.execute("PRAGMA index_info(" + quote(index.name) + ")");
        indexes.push({ name: index.name, columns: (info.rows as unknown as Array<{ name: string | null; seqno: number }>).sort((a, b) => a.seqno - b.seqno).map((col) => col.name).filter((col): col is string => Boolean(col)), unique: index.unique === 1 });
      }
      tables.push({ name, columns, indexes });
    }
    return Object.freeze({ identity, tables: Object.freeze(tables.map((item) => Object.freeze({ ...item, columns: Object.freeze(item.columns), indexes: Object.freeze(item.indexes) }))) });
  }
  async executeSchemaOperation(operation: SchemaOperation): Promise<void> {
    await this.transaction(async (session) => {
      const tx = session as DatabaseSession & { __raw?: (sql: string, args?: unknown[]) => Promise<void> };
      if (!tx.__raw) throw new Error("Schema operations require a libSQL transaction.");
      if (operation.kind === "create-table") {
        if (!operation.columns.length) throw new TypeError("A table requires columns.");
        const columns = operation.columns.map(columnSql);
        if (operation.primaryKey?.length) columns.push("PRIMARY KEY (" + operation.primaryKey.map(quote).join(", ") + ")");
        await tx.__raw("CREATE TABLE IF NOT EXISTS " + quote(operation.table) + " (" + columns.join(", ") + ")");
      } else if (operation.kind === "add-column") {
        if (operation.column.nullable === false && operation.column.defaultExpression === undefined) throw new Error("libSQL cannot safely add a NOT NULL column without a default.");
        await tx.__raw("ALTER TABLE " + quote(operation.table) + " ADD COLUMN " + columnSql(operation.column));
      } else {
        await tx.__raw("CREATE " + (operation.unique ? "UNIQUE " : "") + "INDEX IF NOT EXISTS " + quote(operation.name) + " ON " + quote(operation.table) + " (" + operation.columns.map(quote).join(", ") + ")");
      }
    });
  }
  #session(transaction: LibsqlTransaction): DatabaseSession {
    return {
      select: async (query) => {
        const compiled = selectSql(query);
        const result = await transaction.execute({ sql: compiled.sql, args: compiled.args as never[] });
        return Object.freeze(result.rows.map(normalizeRow));
      },
      insert: async (table, values) => {
        const keys = Object.keys(values).sort();
        const args = keys.map((key) => values[key]);
        await transaction.execute({ sql: "INSERT INTO " + quote(table) + " (" + keys.map(quote).join(", ") + ") VALUES (" + keys.map(() => "?").join(", ") + ")", args: args as never[] });
        if (values.id !== undefined) {
          const rows = await transaction.execute({ sql: "SELECT * FROM " + quote(table) + " WHERE " + quote("id") + " = ?", args: [values.id] as never[] });
          if (rows.rows[0]) return normalizeRow(rows.rows[0]);
        }
        return Object.freeze({ ...values });
      },
      update: async (table, where, values) => {
        const keys = Object.keys(values).sort();
        if (!keys.length) return 0;
        const args: unknown[] = keys.map((key) => values[key]);
        const predicate = compileFilter(where, args);
        const result = await transaction.execute({ sql: "UPDATE " + quote(table) + " SET " + keys.map((key) => quote(key) + " = ?").join(", ") + " WHERE " + predicate, args: args as never[] });
        return Number(result.rowsAffected);
      },
      delete: async (table, where) => {
        const args: unknown[] = [];
        const result = await transaction.execute({ sql: "DELETE FROM " + quote(table) + " WHERE " + compileFilter(where, args), args: args as never[] });
        return Number(result.rowsAffected);
      },
      __raw: async (sql: string, args: unknown[] = []) => { await transaction.execute({ sql, args: args as never[] }); },
    } as DatabaseSession;
  }
  #requireClient(): LibsqlClient {
    if (!this.#client) throw new Error("libSQL adapter is not connected.");
    return this.#client;
  }
}

export function createLibsqlAdapter(options: LibsqlAdapterOptions): LibsqlDatabaseAdapter {
  return new LibsqlDatabaseAdapter(options);
}
