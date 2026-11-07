import Database from "better-sqlite3";
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

type SqliteDatabase = InstanceType<typeof Database>;
const identity = Object.freeze({ provider: "sqlite", role: "system" } as const);
const supported = new Set([
  "transactions", "savepoints", "foreign-keys", "schema-introspection",
  "transactional-ddl", "upsert",
] as const);

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new TypeError("Unsafe SQLite identifier: " + value);
  return '"' + value.replace(/"/g, '""') + '"';
}

function quoteExistingIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

function validateType(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("SQLite data type must be a string.");
  const normalized = value.toUpperCase().trim();
  if (!["TEXT", "INTEGER", "REAL", "NUMERIC", "BLOB"].includes(normalized)) {
    throw new TypeError("Unsupported SQLite column type: " + value);
  }
  return normalized;
}

function validateDefault(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^(NULL|TRUE|FALSE|-?[0-9]+(?:\.[0-9]+)?|'(?:[^']|'')*')$/i.test(value)) {
    throw new TypeError("Unsafe SQLite default expression.");
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

function executeQuery<TRow>(db: SqliteDatabase, request: QueryRequest): QueryResult<TRow> {
  const parameters = (request.parameters ?? []).map((item) => item.value) as never[];
  const mode = request.operation ?? (/^(SELECT|PRAGMA|EXPLAIN)\b/i.test(request.text.trim()) ? "read" : "write");
  const statement = db.prepare(request.text);
  if (mode === "read") {
    const rows = statement.all(...parameters) as TRow[];
    return { rows, rowCount: rows.length, command: "SELECT" };
  }
  const result = statement.run(...parameters);
  return { rows: [], rowCount: Number(result.changes), command: mode === "schema" ? "DDL" : "WRITE" };
}

class SqliteTransaction implements DatabaseTransaction {
  readonly id = "sqlite-tx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  #active = true;

  constructor(
    private readonly db: SqliteDatabase,
    private readonly onClose: () => void,
  ) {}

  get isActive(): boolean {
    return this.#active && this.db.inTransaction;
  }

  async query<TRow = Readonly<Record<string, unknown>>>(request: QueryRequest): Promise<QueryResult<TRow>> {
    this.#assertActive();
    return executeQuery<TRow>(this.db, request);
  }

  async commit(): Promise<void> {
    this.#assertActive();
    try {
      this.db.exec("COMMIT");
    } catch (error) {
      if (this.db.inTransaction) this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.#active = false;
      this.onClose();
    }
  }

  async rollback(): Promise<void> {
    if (!this.#active) return;
    try {
      if (this.db.inTransaction) this.db.exec("ROLLBACK");
    } finally {
      this.#active = false;
      this.onClose();
    }
  }

  #assertActive(): void {
    if (!this.isActive) throw new Error("SQLite transaction is no longer active.");
  }
}

export class SqliteSystemDatabaseAdapter implements DatabaseAdapter {
  readonly id = "sqlite-system";
  readonly identity = identity;
  #db: SqliteDatabase | null = null;
  #version = "unknown";
  #transactionActive = false;

  get capabilities(): DatabaseCapabilities {
    return Object.freeze({
      identity,
      version: this.#version,
      supported,
      limits: Object.freeze({ maxIdentifierLength: 255, maxParameters: 32_766, maxConnections: 1 }),
    });
  }

  async connect(options: DatabaseConnectionOptions): Promise<void> {
    if (this.#db) throw new Error("SQLite System Database adapter is already connected.");
    if (!options.filename) throw new TypeError("SQLite filename is required.");
    const db = new Database(options.filename);
    try {
      db.pragma("foreign_keys = ON");
      db.pragma("busy_timeout = 5000");
      db.pragma("synchronous = NORMAL");
      if (options.filename !== ":memory:") db.pragma("journal_mode = WAL");
      const version = db.prepare("SELECT sqlite_version() AS version").get() as { version?: string } | undefined;
      this.#version = version?.version ?? "unknown";
      this.#db = db;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  async close(): Promise<void> {
    const db = this.#db;
    this.#db = null;
    if (db) db.close();
  }

  async ping(): Promise<void> {
    await this.query({ text: "SELECT 1", operation: "read" });
  }

  async beginTransaction(options: Readonly<{ isolationLevel?: string; readOnly?: boolean }> = {}): Promise<DatabaseTransaction> {
    const db = this.#requireDatabase();
    if (this.#transactionActive || db.inTransaction) throw new Error("SQLite System Database permits one active transaction per connection.");
    if (options.readOnly) throw new TypeError("SQLite read-only transactions are not exposed by this adapter.");
    if (options.isolationLevel && options.isolationLevel.toUpperCase() !== "SERIALIZABLE") {
      throw new TypeError("SQLite supports SERIALIZABLE transaction isolation only.");
    }
    db.exec("BEGIN IMMEDIATE");
    this.#transactionActive = true;
    return new SqliteTransaction(db, () => { this.#transactionActive = false; });
  }

  async query<TRow = Readonly<Record<string, unknown>>>(request: QueryRequest): Promise<QueryResult<TRow>> {
    if (this.#transactionActive) throw new Error("Use the active DatabaseTransaction for queries while a transaction is open.");
    return executeQuery<TRow>(this.#requireDatabase(), request);
  }

  async inspectSchema(): Promise<DatabaseSnapshot> {
    const db = this.#requireDatabase();
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>;
    const tables: TableSnapshot[] = [];
    for (const item of names) {
      const table = quoteExistingIdentifier(item.name);
      const rawColumns = db.prepare("PRAGMA table_info(" + table + ")").all() as Array<{
        name: string; type: string; notnull: number; dflt_value: string | null; cid: number;
      }>;
      const rawIndexes = db.prepare("PRAGMA index_list(" + table + ")").all() as Array<{
        name: string; unique: number;
      }>;
      const indexes = rawIndexes.map((index) => {
        const raw = db.prepare("PRAGMA index_info(" + quoteExistingIdentifier(index.name) + ")").all() as Array<{ name: string | null; seqno: number }>;
        return {
          name: index.name,
          columns: raw.sort((a, b) => a.seqno - b.seqno).map((column) => column.name).filter((name): name is string => Boolean(name)),
          unique: index.unique === 1,
        };
      });
      const rawForeignKeys = db.prepare("PRAGMA foreign_key_list(" + table + ")").all() as Array<{
        id: number; seq: number; table: string; from: string; to: string; on_delete: string;
      }>;
      const foreignKeys = new Map<number, {
        name: string; columns: string[]; targetTable: string; targetColumns: string[]; onDelete: string;
      }>();
      for (const key of rawForeignKeys) {
        let existing = foreignKeys.get(key.id);
        if (!existing) {
          existing = {
            name: "fk_" + item.name + "_" + key.id,
            columns: [],
            targetTable: key.table,
            targetColumns: [],
            onDelete: key.on_delete,
          };
          foreignKeys.set(key.id, existing);
        }
        existing.columns[key.seq] = key.from;
        existing.targetColumns[key.seq] = key.to;
      }
      tables.push({
        name: item.name,
        columns: rawColumns.sort((a, b) => a.cid - b.cid).map((column) => ({
          name: column.name,
          dataType: validateType(column.type || "TEXT"),
          nullable: column.notnull !== 1,
          ...(column.dflt_value !== null ? { defaultExpression: column.dflt_value } : {}),
          ordinal: column.cid + 1,
        })),
        indexes,
        foreignKeys: [...foreignKeys.values()],
      });
    }
    return { identity, tables };
  }

  async executeSchemaOperation(operation: SchemaOperation): Promise<SchemaExecutionResult> {
    const db = this.#requireDatabase();
    if (this.#transactionActive || db.inTransaction) throw new Error("Schema operations cannot run inside an unrelated SQLite transaction.");
    const table = quoteIdentifier(operation.table);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (operation.kind === "create-table") {
        const columns = Array.isArray(operation.payload.columns) ? operation.payload.columns : [];
        if (columns.length === 0) throw new TypeError("create-table requires at least one column.");
        db.exec("CREATE TABLE IF NOT EXISTS " + table + " (" + columns.map(columnDefinition).join(", ") + ")");
      } else if (operation.kind === "add-column") {
        const column = operation.payload.column as Record<string, unknown>;
        const columnName = String(column?.name ?? "");
        const existing = db.prepare("PRAGMA table_info(" + table + ")").all() as Array<{ name: string }>;
        if (!existing.some((item) => item.name === columnName)) {
          db.exec("ALTER TABLE " + table + " ADD COLUMN " + columnDefinition(column));
        }
      } else if (operation.kind === "create-index") {
        const name = quoteIdentifier(String(operation.payload.name ?? ""));
        const columns = Array.isArray(operation.payload.columns) ? operation.payload.columns : [];
        if (columns.length === 0) throw new TypeError("create-index requires at least one column.");
        const unique = operation.payload.unique === true ? "UNIQUE " : "";
        db.exec("CREATE " + unique + "INDEX IF NOT EXISTS " + name + " ON " + table + " (" + columns.map((value) => quoteIdentifier(String(value))).join(", ") + ")");
      } else {
        throw new Error("Operation " + operation.kind + " requires a versioned semantic UpgradeHandler or explicit adapter extension.");
      }
      db.exec("COMMIT");
      return { operationId: operation.id, applied: true };
    } catch (error) {
      if (db.inTransaction) db.exec("ROLLBACK");
      throw error;
    }
  }

  #requireDatabase(): SqliteDatabase {
    if (!this.#db) throw new Error("SQLite System Database adapter is not connected.");
    return this.#db;
  }
}

export function createSqliteSystemAdapter(): SqliteSystemDatabaseAdapter {
  return new SqliteSystemDatabaseAdapter();
}
