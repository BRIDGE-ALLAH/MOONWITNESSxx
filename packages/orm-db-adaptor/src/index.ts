/**
 * Database adapter SPI. Concrete drivers implement this contract; they are not
 * imported by ORM declarations or by addon packages.
 */

export type DatabaseProviderKind = "postgres" | "sqlite";

export type DatabaseIdentity =
  | Readonly<{ provider: "sqlite"; role: "system" }>
  | Readonly<{ provider: "postgres"; role: "business" }>;

export type DatabaseCapability =
  | "transactions"
  | "savepoints"
  | "returning"
  | "json"
  | "json-path"
  | "foreign-keys"
  | "check-constraints"
  | "partial-indexes"
  | "expression-indexes"
  | "row-locking"
  | "advisory-locking"
  | "schema-introspection"
  | "transactional-ddl"
  | "upsert";

export interface DatabaseCapabilities {
  readonly identity: DatabaseIdentity;
  readonly version: string;
  readonly supported: ReadonlySet<DatabaseCapability>;
  readonly limits: Readonly<{
    maxIdentifierLength: number;
    maxParameters?: number;
    maxConnections?: number;
  }>;
}

export interface DatabaseConnectionOptions {
  readonly connectionString?: string;
  readonly filename?: string;
  readonly pool?: Readonly<{ min?: number; max?: number; idleTimeoutMs?: number }>;
  readonly applicationName?: string;
}

export interface QueryParameter {
  readonly value: unknown;
  readonly type?: string;
}

export interface QueryRequest {
  readonly text: string;
  readonly parameters?: readonly QueryParameter[];
  readonly operation?: "read" | "write" | "schema";
}

export interface QueryResult<TRow = Readonly<Record<string, unknown>>> {
  readonly rows: readonly TRow[];
  readonly rowCount: number;
  readonly command?: string;
}

export interface ColumnSnapshot {
  readonly name: string;
  readonly dataType: string;
  readonly nullable: boolean;
  readonly defaultExpression?: string;
  readonly ordinal: number;
}

export interface IndexSnapshot {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly predicate?: string;
}

export interface ForeignKeySnapshot {
  readonly name: string;
  readonly columns: readonly string[];
  readonly targetTable: string;
  readonly targetColumns: readonly string[];
  readonly onDelete: string;
}

export interface TableSnapshot {
  readonly name: string;
  readonly columns: readonly ColumnSnapshot[];
  readonly indexes: readonly IndexSnapshot[];
  readonly foreignKeys: readonly ForeignKeySnapshot[];
}

export interface DatabaseSnapshot {
  readonly identity: DatabaseIdentity;
  readonly tables: readonly TableSnapshot[];
}

export interface SchemaOperation {
  readonly id: string;
  readonly kind: "create-table" | "add-column" | "alter-column" | "create-index" | "add-constraint" | "drop-column" | "drop-table" | "custom";
  readonly table: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface SchemaExecutionResult {
  readonly operationId: string;
  readonly applied: boolean;
  readonly detail?: string;
}

export interface DatabaseTransaction {
  readonly id: string;
  readonly isActive: boolean;
  query<TRow = Readonly<Record<string, unknown>>>(request: QueryRequest): Promise<QueryResult<TRow>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseAdapter {
  readonly id: string;
  readonly identity: DatabaseIdentity;
  readonly capabilities: DatabaseCapabilities;
  connect(options: DatabaseConnectionOptions): Promise<void>;
  close(): Promise<void>;
  ping(): Promise<void>;
  beginTransaction(options?: Readonly<{ isolationLevel?: string; readOnly?: boolean }>): Promise<DatabaseTransaction>;
  query<TRow = Readonly<Record<string, unknown>>>(request: QueryRequest): Promise<QueryResult<TRow>>;
  inspectSchema(): Promise<DatabaseSnapshot>;
  executeSchemaOperation(operation: SchemaOperation): Promise<SchemaExecutionResult>;
}

export class DatabaseCapabilityError extends Error {
  readonly code = "DATABASE_CAPABILITY_UNSUPPORTED";

  constructor(
    readonly capability: DatabaseCapability,
    readonly identity: DatabaseIdentity,
  ) {
    super(`Database provider "${identity.provider}" with role "${identity.role}" does not support required capability "${capability}".`);
    this.name = "DatabaseCapabilityError";
  }
}

export function requireCapabilities(
  capabilities: DatabaseCapabilities,
  required: readonly DatabaseCapability[],
): void {
  for (const capability of required) {
    if (!capabilities.supported.has(capability)) {
      throw new DatabaseCapabilityError(capability, capabilities.identity);
    }
  }
}
