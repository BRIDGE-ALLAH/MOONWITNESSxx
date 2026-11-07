/**
 * Public, provider-neutral contracts for the ARSY declaration ORM.
 *
 * This package describes models and runtime metadata. It deliberately does not
 * open database connections, compile SQL, execute DDL, or import provider code.
 */

export type ModelKind = "persistent" | "abstract" | "transient";

export type FieldKind =
  | "char"
  | "text"
  | "boolean"
  | "integer"
  | "float"
  | "decimal"
  | "date"
  | "datetime"
  | "time"
  | "uuid"
  | "json"
  | "selection"
  | "binary"
  | "many-to-one"
  | "one-to-many"
  | "many-to-many"
  | "computed"
  | "related"
  | "reference";

export type FieldScalar = string | number | boolean | null;
export type FieldDefault<T = unknown> = T | (() => T);

export interface FieldDefinition<TValue = unknown> {
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly readonly?: boolean;
  readonly index?: boolean;
  readonly unique?: boolean;
  readonly default?: FieldDefault<TValue>;
  readonly label?: string;
  readonly description?: string;
  readonly options?: Readonly<Record<string, unknown>>;
  readonly __valueType?: TValue;
}

export type RelationCardinality = "one-to-one" | "many-to-one" | "one-to-many" | "many-to-many";
export type OnDelete = "restrict" | "cascade" | "set-null" | "no-action";

export interface RelationDefinition<TTarget extends string = string>
  extends FieldDefinition<string | readonly string[] | null> {
  readonly kind: "many-to-one" | "one-to-many" | "many-to-many";
  readonly target: TTarget;
  readonly inverse?: string;
  readonly cardinality: RelationCardinality;
  readonly onDelete?: OnDelete;
  readonly relationTable?: string;
}

export type FieldMap = Readonly<Record<string, FieldDefinition>>;

export interface ModelDefinition<TFields extends FieldMap = FieldMap> {
  readonly name: string;
  readonly module: string;
  readonly kind: ModelKind;
  readonly fields: TFields;
  readonly description?: string;
  readonly extends?: readonly string[];
  readonly mixins?: readonly string[];
  readonly abstract?: boolean;
}

export interface ModelConstructor<TDefinition extends ModelDefinition = ModelDefinition> {
  new (...args: never[]): unknown;
  readonly modelName: TDefinition["name"];
  readonly module: TDefinition["module"];
  readonly kind?: TDefinition["kind"];
  readonly fields: TDefinition["fields"];
  readonly description?: TDefinition["description"];
  readonly extends?: TDefinition["extends"];
  readonly mixins?: TDefinition["mixins"];
}

export interface AddonDependency {
  readonly addon: string;
  readonly version: string;
  readonly optional?: boolean;
}

export interface ModuleDependency {
  readonly module: string;
  readonly version: string;
  readonly optional?: boolean;
}

export interface AddonManifest {
  readonly id: string;
  readonly version: string;
  readonly publisher: string;
  readonly description?: string;
  readonly arsy: string;
  readonly modules: readonly string[];
  readonly dependencies?: readonly AddonDependency[];
  readonly conflicts?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly permissions?: readonly string[];
  readonly entrypoint: string;
  readonly integrity?: string;
  readonly signature?: string;
}

export interface ModuleManifest {
  readonly id: string;
  readonly addon: string;
  readonly version: string;
  readonly description?: string;
  readonly depends?: readonly ModuleDependency[];
  readonly conflicts?: readonly string[];
  readonly models?: readonly string[];
}

export interface RegistryModelEntry {
  readonly name: string;
  readonly module: string;
  readonly kind: ModelKind;
  readonly fields: Readonly<Record<string, FieldDefinition>>;
  readonly sourceAddon: string;
  readonly extensions: readonly string[];
}

export interface RegistrySnapshot {
  readonly formatVersion: 1;
  readonly fingerprint: string;
  readonly createdAt: string;
  readonly addonOrder: readonly string[];
  readonly moduleOrder: readonly string[];
  readonly models: Readonly<Record<string, RegistryModelEntry>>;
}

export type OrmErrorCode =
  | "ORM_INVALID_MODEL"
  | "ORM_INVALID_FIELD"
  | "ORM_DUPLICATE_MODEL"
  | "ORM_DUPLICATE_FIELD"
  | "ORM_UNKNOWN_RELATION_TARGET"
  | "ORM_INVALID_OVERRIDE"
  | "ORM_DEPENDENCY_CYCLE"
  | "ORM_ADDON_INCOMPATIBLE"
  | "ORM_REGISTRY_CONFLICT"
  | "ORM_ACCESS_DENIED"
  | "ORM_VALIDATION_FAILED"
  | "ORM_INVALID_ENVIRONMENT"
  | "ORM_PROVIDER_CAPABILITY_MISSING";

export class OrmError extends Error {
  readonly code: OrmErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: OrmErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "OrmError";
    this.code = code;
    this.details = details;
  }
}

export interface RegistryBuildInput {
  readonly addons: readonly AddonManifest[];
  readonly modules: readonly ModuleManifest[];
  readonly models: readonly ModelConstructor[];
}

export interface RegistryComposer {
  compose(input: RegistryBuildInput): RegistrySnapshot;
}

export interface PrincipalReference {
  readonly id: string;
  readonly type: string;
}

export interface EnvironmentContext {
  readonly principal: PrincipalReference | null;
  readonly tenantId?: string;
  readonly companyId?: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly traceId: string;
}

export interface Environment {
  readonly context: EnvironmentContext;
  readonly registry: RegistrySnapshot;
  readonly models: ModelCollection;
}

export interface ModelCollection {
  get<TRecord = unknown>(modelName: string): Recordset<TRecord>;
}

export interface Recordset<TRecord = unknown> extends AsyncIterable<TRecord> {
  readonly modelName: string;
  readonly length: number;
  readonly ids: readonly string[];
  readonly env: Environment;
  first(): Promise<TRecord | null>;
  toArray(): Promise<readonly TRecord[]>;
}
