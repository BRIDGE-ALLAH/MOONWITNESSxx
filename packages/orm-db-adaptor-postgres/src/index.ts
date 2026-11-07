import { Pool, type PoolClient, type PoolConfig } from "pg";
import type {
  DatabaseAdapter, DatabaseCapability, DatabaseIdentity, DatabaseRow, DatabaseSession,
  DbFilter, DbValue, SchemaOperation, SelectQuery,
} from "@riotworks/orm-db-adaptor";

const identity: DatabaseIdentity = Object.freeze({ provider: "postgres", role: "business" });
const capabilities: ReadonlySet<DatabaseCapability> = new Set<DatabaseCapability>(["transactions", "returning", "foreign-keys", "json", "json-path", "partial-indexes", "row-locking", "advisory-locking", "schema-introspection", "transactional-ddl", "upsert"] as const);
const comparison: Record<string, string> = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "ILIKE" };

function quote(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new TypeError("Unsafe PostgreSQL identifier: " + value);
  return '"' + value + '"';
}

function compileFilter(filter: DbFilter | undefined, parameters: unknown[]): string {
  if (!filter) return "TRUE";
  if (filter.kind === "and" || filter.kind === "or") {
    if (filter.expressions.length === 0) throw new TypeError("Empty boolean filter is not permitted.");
    return "(" + filter.expressions.map((item) => compileFilter(item, parameters)).join(filter.kind === "and" ? " AND " : " OR ") + ")";
  }
  if (filter.kind === "not") return "(NOT " + compileFilter(filter.expression, parameters) + ")";
  const field = quote(filter.field);
  if (filter.operator === "is-null") return field + (filter.value === false ? " IS NOT NULL" : " IS NULL");
  if ((filter.operator === "eq" || filter.operator === "ne") && filter.value === null) return field + (filter.operator === "eq" ? " IS NULL" : " IS NOT NULL");
  if (filter.operator === "in" || filter.operator === "not-in") {
    if (!Array.isArray(filter.value) || filter.value.length === 0 || filter.value.length > 500) throw new TypeError("Invalid IN filter.");
    const slots = filter.value.map((value) => { parameters.push(value); return "$" + parameters.length; });
    return field + (filter.operator === "in" ? " IN (" : " NOT IN (") + slots.join(", ") + ")";
  }
  const operator = comparison[filter.operator];
  if (!operator) throw new TypeError("Unsupported PostgreSQL filter operator.");
  parameters.push(filter.value);
  return field + " " + operator + " $" + parameters.length;
}

function queryForSelect(query: SelectQuery): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const columns = query.columns?.length ? query.columns.map(quote).join(", ") : "*";
  let text = "SELECT " + columns + " FROM " + quote(query.table) + " WHERE " + compileFilter(query.where, values);
  for (const item of query.orderBy ?? []) text += " ORDER BY " + quote(item.field) + " " + (item.direction === "desc" ? "DESC" : "ASC");
  if (query.limit !== undefined) {
    if (!Number.isSafeInteger(query.limit) || query.limit < 0 || query.limit > 10000) throw new RangeError("Select limit must be between 0 and 10000.");
    values.push(query.limit); text += " LIMIT $" + values.length;
  }
  if (query.offset !== undefined) {
    if (!Number.isSafeInteger(query.offset) || query.offset < 0) throw new RangeError("Select offset must be non-negative.");
    values.push(query.offset); text += " OFFSET $" + values.length;
  }
  return { text, values };
}

function insertFor(table: string, values: Readonly<Record<string, DbValue>>): { text: string; parameters: unknown[] } {
  const keys = Object.keys(values).sort();
  if (!keys.length) throw new TypeError("Insert requires at least one value.");
  const parameters = keys.map((key) => values[key]);
  return {
    text: "INSERT INTO " + quote(table) + " (" + keys.map(quote).join(", ") + ") VALUES (" + keys.map((_, index) => "$" + (index + 1)).join(", ") + ") RETURNING *",
    parameters,
  };
}

function updateFor(table: string, where: DbFilter, values: Readonly<Record<string, DbValue>>): { text: string; parameters: unknown[] } {
  const keys = Object.keys(values).sort();
  if (!keys.length) return { text: "", parameters: [] };
  const parameters: unknown[] = keys.map((key) => values[key]);
  const setters = keys.map((key, index) => quote(key) + " = $" + (index + 1));
  const predicate = compileFilter(where, parameters);
  return { text: "UPDATE " + quote(table) + " SET " + setters.join(", ") + " WHERE " + predicate, parameters };
}

function deleteFor(table: string, where: DbFilter): { text: string; parameters: unknown[] } {
  const parameters: unknown[] = [];
  return { text: "DELETE FROM " + quote(table) + " WHERE " + compileFilter(where, parameters), parameters };
}

function row(row: unknown): DatabaseRow {
  return Object.freeze({ ...(row as Record<string, unknown>) });
}

function safeType(value: string): string {
  const normalized = value.toUpperCase().trim();
  if (!/^(TEXT|BOOLEAN|BIGINT|INTEGER|DOUBLE PRECISION|DATE|TIMESTAMPTZ|TIME|UUID|JSONB|BYTEA|VARCHAR\([1-9][0-9]*\)|NUMERIC\([1-9][0-9]*,[0-9]+\))$/.test(normalized)) {
    throw new TypeError("Unsupported PostgreSQL type: " + value);
  }
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
    const onDelete = column.references.onDelete ?? "restrict";
    const actions: Record<string, string> = { restrict: "RESTRICT", cascade: "CASCADE", "set-null": "SET NULL", "no-action": "NO ACTION" };
    if (!actions[onDelete]) throw new TypeError("Invalid foreign-key delete action.");
    sql += " REFERENCES " + quote(column.references.table) + " (" + quote(column.references.column) + ") ON DELETE " + actions[onDelete];
  }
  return sql;
}

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  readonly identity = identity;
  readonly capabilities = capabilities;
  #pool: Pool | null = null;
  constructor(private readonly connectionString: string, private readonly poolOptions: Omit<PoolConfig, "connectionString"> = {}) {
    if (!connectionString.trim()) throw new TypeError("PostgreSQL connection string is required.");
  }
  async connect(): Promise<void> {
    if (this.#pool) return;
    const pool = new Pool({ connectionString: this.connectionString, max: 20, idleTimeoutMillis: 30000, ...this.poolOptions });
    try { await pool.query("SELECT 1"); this.#pool = pool; } catch (error) { await pool.end(); throw error; }
  }
  async close(): Promise<void> { const pool = this.#pool; this.#pool = null; if (pool) await pool.end(); }
  async ping(): Promise<void> { await this.#requirePool().query("SELECT 1"); }
  async select(query: SelectQuery): Promise<readonly DatabaseRow[]> {
    const compiled = queryForSelect(query);
    const result = await this.#requirePool().query(compiled.text, compiled.values);
    return Object.freeze(result.rows.map(row));
  }
  async insert(table: string, values: Readonly<Record<string, DbValue>>): Promise<DatabaseRow> {
    const compiled = insertFor(table, values);
    const result = await this.#requirePool().query(compiled.text, compiled.parameters);
    if (!result.rows[0]) throw new Error("PostgreSQL insert returned no row.");
    return row(result.rows[0]);
  }
  async update(table: string, where: DbFilter, values: Readonly<Record<string, DbValue>>): Promise<number> {
    const compiled = updateFor(table, where, values);
    if (!compiled.text) return 0;
    const result = await this.#requirePool().query(compiled.text, compiled.parameters);
    return result.rowCount ?? 0;
  }
  async delete(table: string, where: DbFilter): Promise<number> {
    const compiled = deleteFor(table, where);
    const result = await this.#requirePool().query(compiled.text, compiled.parameters);
    return result.rowCount ?? 0;
  }
  async transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T> {
    const client = await this.#requirePool().connect();
    try {
      await client.query("BEGIN");
      const result = await operation(this.#session(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async withSchemaLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const client = await this.#requirePool().connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [key]);
      return await operation();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]).catch(() => undefined);
      client.release();
    }
  }
  async inspectSchema() {
    const pool = this.#requirePool();
    const [tablesResult, columnsResult, indexesResult] = await Promise.all([
      pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name"),
      pool.query("SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default, ordinal_position FROM information_schema.columns WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position"),
      pool.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() ORDER BY tablename, indexname"),
    ]);
    const tables = new Map<string, { name: string; columns: Array<{ name: string; dataType: string; nullable: boolean; defaultExpression?: string; primaryKey?: boolean }>; indexes: Array<{ name: string; columns: string[]; unique: boolean }> }>();
    for (const item of tablesResult.rows as Array<{ table_name: string }>) tables.set(item.table_name, { name: item.table_name, columns: [], indexes: [] });
    const primaryKeys = await pool.query("SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema=current_schema()");
    const primarySet = new Set((primaryKeys.rows as Array<{ table_name: string; column_name: string }>).map((item) => item.table_name + "." + item.column_name));
    for (const item of columnsResult.rows as Array<{ table_name: string; column_name: string; data_type: string; character_maximum_length: number | null; numeric_precision: number | null; numeric_scale: number | null; is_nullable: string; column_default: string | null }>) {
      const table = tables.get(item.table_name);
      if (!table) continue;
      let dataType = item.data_type.toUpperCase();
      if (item.data_type === "character varying") dataType = "VARCHAR(" + item.character_maximum_length + ")";
      if (item.data_type === "numeric") dataType = "NUMERIC(" + item.numeric_precision + "," + item.numeric_scale + ")";
      if (item.data_type === "timestamp with time zone") dataType = "TIMESTAMPTZ";
      table.columns.push({ name: item.column_name, dataType, nullable: item.is_nullable === "YES", ...(item.column_default !== null ? { defaultExpression: item.column_default } : {}), ...(primarySet.has(item.table_name + "." + item.column_name) ? { primaryKey: true } : {}) });
    }
    for (const item of indexesResult.rows as Array<{ tablename: string; indexname: string; indexdef: string }>) {
      const table = tables.get(item.tablename);
      if (!table) continue;
      const match = item.indexdef.match(/\(([^)]+)\)/);
      const cols = match ? match[1].split(",").map((value) => value.trim().replace(/^"|"$/g, "")) : [];
      table.indexes.push({ name: item.indexname, columns: cols, unique: /CREATE UNIQUE INDEX/i.test(item.indexdef) });
    }
    return Object.freeze({ identity, tables: Object.freeze([...tables.values()].map((item) => Object.freeze({ ...item, columns: Object.freeze(item.columns), indexes: Object.freeze(item.indexes) }))) });
  }
  async executeSchemaOperation(operation: SchemaOperation): Promise<void> {
    await this.transaction(async (tx) => {
      if (operation.kind === "create-table") {
        if (!operation.columns.length) throw new TypeError("A table requires columns.");
        const definitions = operation.columns.map(columnSql);
        if (operation.primaryKey?.length) definitions.push("PRIMARY KEY (" + operation.primaryKey.map(quote).join(", ") + ")");
        await this.#querySession(tx, "CREATE TABLE IF NOT EXISTS " + quote(operation.table) + " (" + definitions.join(", ") + ")");
      } else if (operation.kind === "add-column") {
        await this.#querySession(tx, "ALTER TABLE " + quote(operation.table) + " ADD COLUMN IF NOT EXISTS " + columnSql(operation.column));
      } else {
        await this.#querySession(tx, "CREATE " + (operation.unique ? "UNIQUE " : "") + "INDEX IF NOT EXISTS " + quote(operation.name) + " ON " + quote(operation.table) + " (" + operation.columns.map(quote).join(", ") + ")");
      }
    });
  }
  async #querySession(session: DatabaseSession, text: string): Promise<void> {
    const raw = session as DatabaseSession & { __raw?: (text: string) => Promise<void> };
    if (!raw.__raw) throw new Error("DDL requires a provider-owned transaction.");
    await raw.__raw(text);
  }
  #session(client: PoolClient): DatabaseSession {
    const query = async (text: string, values: unknown[] = []) => client.query(text, values);
    return {
      select: async (spec) => {
        const compiled = queryForSelect(spec);
        const result = await query(compiled.text, compiled.values);
        return Object.freeze(result.rows.map(row));
      },
      insert: async (table, values) => {
        const compiled = insertFor(table, values);
        const result = await query(compiled.text, compiled.parameters);
        if (!result.rows[0]) throw new Error("PostgreSQL insert returned no row.");
        return row(result.rows[0]);
      },
      update: async (table, where, values) => {
        const compiled = updateFor(table, where, values);
        if (!compiled.text) return 0;
        const result = await query(compiled.text, compiled.parameters);
        return result.rowCount ?? 0;
      },
      delete: async (table, where) => {
        const compiled = deleteFor(table, where);
        const result = await query(compiled.text, compiled.parameters);
        return result.rowCount ?? 0;
      },
      __raw: async (text: string) => { await query(text); },
    } as DatabaseSession;
  }
  #requirePool(): Pool {
    if (!this.#pool) throw new Error("PostgreSQL adapter is not connected.");
    return this.#pool;
  }
}

export function createPostgresAdapter(connectionString: string, poolOptions?: Omit<PoolConfig, "connectionString">): PostgresDatabaseAdapter {
  return new PostgresDatabaseAdapter(connectionString, poolOptions);
}
