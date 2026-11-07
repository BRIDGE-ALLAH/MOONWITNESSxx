import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type {
  DatabaseAdapter,
  DatabaseCapabilities,
  DatabaseConnectionOptions,
  DatabaseSnapshot,
  DatabaseTransaction,
  QueryRequest,
  QueryResult,
  SchemaExecutionResult,
  SchemaOperation,
  TableSnapshot,
} from "@riotworks/orm-db-adaptor";

const identity = Object.freeze({ provider: "postgres", role: "business" } as const);
const supported = new Set([
  "transactions", "savepoints", "returning", "json", "json-path", "foreign-keys",
  "check-constraints", "partial-indexes", "expression-indexes", "row-locking",
  "advisory-locking", "schema-introspection", "transactional-ddl", "upsert",
] as const);

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new TypeError("Unsafe SQL identifier: " + value);
  return '"' + value.replace(/"/g, '""') + '"';
}

function validateType(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("SQL data type must be a string.");
  const normalized = value.toUpperCase().replace(/\s+/g, " ").trim();
  if (!/^(TEXT|BOOLEAN|BIGINT|DOUBLE PRECISION|DATE|TIMESTAMPTZ|TIME|UUID|JSONB|BYTEA|VARCHAR\([1-9][0-9]*\)|NUMERIC\([1-9][0-9]*,[0-9]+\))$/.test(normalized)) {
    throw new TypeError("Unsupported PostgreSQL column type: " + value);
  }
  return normalized;
}

function validateDefault(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^(NULL|TRUE|FALSE|-?[0-9]+(?:\.[0-9]+)?|'(?:[^']|'')*')$/i.test(value)) {
    throw new TypeError("Unsafe SQL default expression.");
  }
  return value;
}

function columnDefinition(value: unknown): string {
  if (!value || typeof value !== "object") throw new TypeError("Invalid schema column payload.");
  const column = value as Record<string, unknown>;
  const name = quoteIdentifier(String(column.name ?? ""));
  const type = validateType(column.dataType);
  const nullable = column.nullable !== false;
  const defaultValue = validateDefault(column.defaultExpression);
  return name + " " + type + (defaultValue !== undefined ? " DEFAULT " + defaultValue : "") + (nullable ? "" : " NOT NULL");
}

class PostgresTransaction implements DatabaseTransaction {
  readonly id = randomUUID();
  #active = true;
  readonly #client: PoolClient;

  constructor(client: PoolClient) {
    this.#client = client;
  }

  get isActive(): boolean {
    return this.#active;
  }

  async query<TRow = Readonly<Record<string, unknown>>>(request: QueryRequest): Promise<QueryResult<TRow>> {
    this.#assertActive();
    const result = await this.#client.query(request.text, (request.parameters ?? []).map((item) => item.value) as never[]);
    return {
      rows: result.rows as TRow[],
      rowCount: result.rowCount ?? result.rows.length,
      command: result.command,
    };
  }

  async commit(): Promise<void> {
    this.#assertActive();
    try {
      await this.#client.query("COMMIT");
    } catch (error) {
      await this.#client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      this.#active = false;
      this.#client.release();
    }
  }

  async rollback(): Promise<void> {
    if (!this.#active) return;
    try {
      await this.#client.query("ROLLBACK");
    } finally {
      this.#active = false;
      this.#client.release();
    }
  }

  #assertActive(): void {
    if (!this.#active) throw new Error("PostgreSQL transaction is no longer active.");
  }
}

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  readonly id = "postgres-business";
  readonly identity = identity;
  #pool: Pool | null = null;
  #version = "unknown";

  get capabilities(): DatabaseCapabilities {
    return Object.freeze({
      identity,
      version: this.#version,
      supported,
      limits: Object.freeze({ maxIdentifierLength: 63, maxParameters: 65_535, maxConnections: 500 }),
    });
  }

  async connect(options: DatabaseConnectionOptions): Promise<void> {
    if (this.#pool) throw new Error("PostgreSQL adapter is already connected.");
    if (!options.connectionString) throw new TypeError("PostgreSQL connectionString is required.");
    const config = {
      connectionString: options.connectionString,
      min: options.pool?.min ?? 0,
      max: options.pool?.max ?? 20,
      idleTimeoutMillis: options.pool?.idleTimeoutMs ?? 30_000,
      ...(options.applicationName ? { application_name: options.applicationName } : {}),
    };
    const pool = new Pool(config);
    try {
      const result = await pool.query("SHOW server_version");
      this.#version = (result.rows[0] as { server_version?: string } | undefined)?.server_version ?? "unknown";
      this.#pool = pool;
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  async close(): Promise<void> {
    const pool = this.#pool;
    this.#pool = null;
    if (pool) await pool.end();
  }

  async ping(): Promise<void> {
    await this.query({ text: "SELECT 1", operation: "read" });
  }

  async beginTransaction(options: Readonly<{ isolationLevel?: string; readOnly?: boolean }> = {}): Promise<DatabaseTransaction> {
    const pool = this.#requirePool();
    const client = await pool.connect();
    const isolation = (options.isolationLevel ?? "READ COMMITTED").toUpperCase();
    if (!["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"].includes(isolation)) {
      client.release();
      throw new TypeError("Unsupported PostgreSQL transaction isolation level.");
    }
    try {
      await client.query("BEGIN ISOLATION LEVEL " + isolation + (options.readOnly ? " READ ONLY" : ""));
      return new PostgresTransaction(client);
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async query<TRow = Readonly<Record<string, unknown>>>(request: QueryRequest): Promise<QueryResult<TRow>> {
    const result = await this.#requirePool().query(request.text, (request.parameters ?? []).map((item) => item.value) as never[]);
    return {
      rows: result.rows as TRow[],
      rowCount: result.rowCount ?? result.rows.length,
      command: result.command,
    };
  }

  async inspectSchema(): Promise<DatabaseSnapshot> {
    const pool = this.#requirePool();
    const [tablesResult, columnsResult, indexesResult, foreignKeysResult] = await Promise.all([
      pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name",
      ),
      pool.query(
        "SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default, ordinal_position FROM information_schema.columns WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position",
      ),
      pool.query(
        "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema() ORDER BY tablename, indexname",
      ),
      pool.query(
        "SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = current_schema() ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position",
      ),
    ]);

    const tableRows = tablesResult.rows as Array<{ table_name: string }>;
    const columnRows = columnsResult.rows as Array<{
      table_name: string; column_name: string; data_type: string; character_maximum_length: number | null;
      numeric_precision: number | null; numeric_scale: number | null; is_nullable: string;
      column_default: string | null; ordinal_position: number;
    }>;
    const indexRows = indexesResult.rows as Array<{ tablename: string; indexname: string; indexdef: string }>;
    const foreignKeyRows = foreignKeysResult.rows as Array<{
      table_name: string; constraint_name: string; column_name: string; foreign_table_name: string;
      foreign_column_name: string; delete_rule: string;
    }>;
    const tables = new Map<string, {
      name: string;
      columns: Array<{ name: string; dataType: string; nullable: boolean; defaultExpression?: string; ordinal: number }>;
      indexes: Array<{ name: string; columns: string[]; unique: boolean; predicate?: string }>;
      foreignKeys: Array<{ name: string; columns: string[]; targetTable: string; targetColumns: string[]; onDelete: string }>;
    }>();
    for (const row of tableRows) {
      tables.set(row.table_name, { name: row.table_name, columns: [], indexes: [], foreignKeys: [] });
    }
    for (const row of columnRows) {
      const table = tables.get(row.table_name);
      if (!table) continue;
      let dataType = row.data_type.toUpperCase();
      if (row.data_type === "character varying") dataType = "VARCHAR(" + row.character_maximum_length + ")";
      else if (row.data_type === "numeric") dataType = "NUMERIC(" + row.numeric_precision + "," + row.numeric_scale + ")";
      else if (row.data_type === "timestamp with time zone") dataType = "TIMESTAMPTZ";
      table.columns.push({
        name: row.column_name,
        dataType,
        nullable: row.is_nullable === "YES",
        ...(row.column_default !== null ? { defaultExpression: row.column_default } : {}),
        ordinal: row.ordinal_position,
      });
    }
    for (const row of indexRows) {
      const table = tables.get(row.tablename);
      if (!table) continue;
      const match = row.indexdef.match(/\(([^)]+)\)(?:\s+WHERE\s+(.+))?$/i);
      const columns = match
        ? match[1].split(",").map((value) => value.trim().replace(/^"|"$/g, "")).filter((value) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value))
        : [];
      table.indexes.push({
        name: row.indexname,
        columns,
        unique: /CREATE UNIQUE INDEX/i.test(row.indexdef),
        ...(match?.[2] ? { predicate: match[2] } : {}),
      });
    }
    for (const row of foreignKeyRows) {
      const table = tables.get(row.table_name);
      if (!table) continue;
      let key = table.foreignKeys.find((item) => item.name === row.constraint_name);
      if (!key) {
        key = {
          name: row.constraint_name,
          columns: [],
          targetTable: row.foreign_table_name,
          targetColumns: [],
          onDelete: row.delete_rule,
        };
        table.foreignKeys.push(key);
      }
      key.columns.push(row.column_name);
      key.targetColumns.push(row.foreign_column_name);
    }
    return {
      identity,
      tables: [...tables.values()].map((table) => Object.freeze({
        ...table,
        columns: Object.freeze(table.columns),
        indexes: Object.freeze(table.indexes),
        foreignKeys: Object.freeze(table.foreignKeys),
      })) as readonly TableSnapshot[],
    };
  }

  async executeSchemaOperation(operation: SchemaOperation): Promise<SchemaExecutionResult> {
    const client = await this.#requirePool().connect();
    try {
      await client.query("BEGIN");
      const table = quoteIdentifier(operation.table);
      if (operation.kind === "create-table") {
        const columns = Array.isArray(operation.payload.columns) ? operation.payload.columns : [];
        if (columns.length === 0) throw new TypeError("create-table requires at least one column.");
        const definitions = columns.map(columnDefinition);
        await client.query("CREATE TABLE IF NOT EXISTS " + table + " (" + definitions.join(", ") + ")");
      } else if (operation.kind === "add-column") {
        await client.query("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS " + columnDefinition(operation.payload.column));
      } else if (operation.kind === "create-index") {
        const name = quoteIdentifier(String(operation.payload.name ?? ""));
        const columns = Array.isArray(operation.payload.columns) ? operation.payload.columns : [];
        if (columns.length === 0) throw new TypeError("create-index requires at least one column.");
        const unique = operation.payload.unique === true ? "UNIQUE " : "";
        await client.query("CREATE " + unique + "INDEX IF NOT EXISTS " + name + " ON " + table + " (" + columns.map((value) => quoteIdentifier(String(value))).join(", ") + ")");
      } else {
        throw new Error("Operation " + operation.kind + " requires a versioned semantic UpgradeHandler or explicit adapter extension.");
      }
      await client.query("COMMIT");
      return { operationId: operation.id, applied: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  #requirePool(): Pool {
    if (!this.#pool) throw new Error("PostgreSQL adapter is not connected.");
    return this.#pool;
  }
}

export function createPostgresAdapter(): PostgresDatabaseAdapter {
  return new PostgresDatabaseAdapter();
}
