export type DatabaseIdentity =
  | Readonly<{ provider: "postgres"; role: "business" }>
  | Readonly<{ provider: "libsql"; role: "system" }>;

export type DatabaseCapability =
  | "transactions" | "returning" | "foreign-keys" | "json" | "json-path"
  | "partial-indexes" | "row-locking" | "advisory-locking"
  | "schema-introspection" | "transactional-ddl" | "upsert";

export type DbValue = string | number | boolean | null | Uint8Array | readonly unknown[] | Readonly<Record<string, unknown>>;

export type DbFilter =
  | Readonly<{ kind: "condition"; field: string; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "not-in" | "like" | "ilike" | "is-null"; value?: DbValue }>
  | Readonly<{ kind: "and" | "or"; expressions: readonly DbFilter[] }>
  | Readonly<{ kind: "not"; expression: DbFilter }>;

export interface DbOrderBy {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

export interface SelectQuery {
  readonly table: string;
  readonly columns?: readonly string[];
  readonly where?: DbFilter;
  readonly orderBy?: readonly DbOrderBy[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface DatabaseRow {
  readonly [key: string]: unknown;
}

export interface DbColumnSnapshot {
  readonly name: string;
  readonly dataType: string;
  readonly nullable: boolean;
  readonly defaultExpression?: string;
  readonly primaryKey?: boolean;
}

export interface DbIndexSnapshot {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
}

export interface DbTableSnapshot {
  readonly name: string;
  readonly columns: readonly DbColumnSnapshot[];
  readonly indexes: readonly DbIndexSnapshot[];
}

export interface DatabaseSnapshot {
  readonly identity: DatabaseIdentity;
  readonly tables: readonly DbTableSnapshot[];
}

export interface DbColumnDefinition {
  readonly name: string;
  readonly type: string;
  readonly nullable?: boolean;
  readonly defaultExpression?: string;
  readonly primaryKey?: boolean;
  readonly references?: Readonly<{ table: string; column: string; onDelete?: "restrict" | "cascade" | "set-null" | "no-action" }>;
}

export type SchemaOperation =
  | Readonly<{ id: string; kind: "create-table"; table: string; columns: readonly DbColumnDefinition[]; primaryKey?: readonly string[] }>
  | Readonly<{ id: string; kind: "add-column"; table: string; column: DbColumnDefinition }>
  | Readonly<{ id: string; kind: "create-index"; table: string; name: string; columns: readonly string[]; unique: boolean }>;

export interface DatabaseSession {
  select(query: SelectQuery): Promise<readonly DatabaseRow[]>;
  insert(table: string, values: Readonly<Record<string, DbValue>>): Promise<DatabaseRow>;
  update(table: string, where: DbFilter, values: Readonly<Record<string, DbValue>>): Promise<number>;
  delete(table: string, where: DbFilter): Promise<number>;
}

export interface DatabaseAdapter extends DatabaseSession {
  readonly identity: DatabaseIdentity;
  readonly capabilities: ReadonlySet<DatabaseCapability>;
  connect(): Promise<void>;
  close(): Promise<void>;
  ping(): Promise<void>;
  transaction<T>(operation: (session: DatabaseSession) => Promise<T>): Promise<T>;
  inspectSchema(): Promise<DatabaseSnapshot>;
  executeSchemaOperation(operation: SchemaOperation): Promise<void>;
  withSchemaLock<T>(key: string, operation: () => Promise<T>): Promise<T>;
}

export class DatabaseCapabilityError extends Error {
  readonly code = "DATABASE_CAPABILITY_UNSUPPORTED";
  constructor(readonly capability: DatabaseCapability, readonly identity: DatabaseIdentity) {
    super("Database " + identity.provider + "/" + identity.role + " does not support " + capability + ".");
    this.name = "DatabaseCapabilityError";
  }
}

export function requireCapabilities(
  available: ReadonlySet<DatabaseCapability>,
  identity: DatabaseIdentity,
  required: readonly DatabaseCapability[],
): void {
  for (const capability of required) if (!available.has(capability)) throw new DatabaseCapabilityError(capability, identity);
}
