export type ModelKind = "persistent" | "abstract" | "transient";

export type FieldKind =
  | "char" | "text" | "boolean" | "integer" | "float" | "decimal"
  | "date" | "datetime" | "time" | "uuid" | "json" | "selection" | "binary"
  | "many-to-one" | "one-to-many" | "many-to-many" | "computed" | "related";

export type FieldDefault<T = unknown> = T | (() => T);

export interface FieldDescriptor<TValue = unknown> {
  readonly kind: FieldKind;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly readonly: boolean;
  readonly index: boolean;
  readonly unique: boolean;
  readonly default?: FieldDefault<TValue>;
  readonly label?: string;
  readonly description?: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly target?: string;
  readonly inverse?: string;
  readonly onDelete?: "restrict" | "cascade" | "set-null" | "no-action";
  readonly __valueType?: TValue;
}

export type FieldMap = Readonly<Record<string, FieldDescriptor>>;
export type InferFieldValue<T> = T extends FieldDescriptor<infer TValue> ? TValue : never;
export type InferModelValues<TFields extends FieldMap> = { readonly [K in keyof TFields]: InferFieldValue<TFields[K]> };

export interface ModelDefinition<TFields extends FieldMap = FieldMap> {
  readonly modelName: string;
  readonly module: string;
  readonly kind?: ModelKind;
  readonly fields: TFields;
  readonly extends?: readonly string[];
  readonly mixins?: readonly string[];
  readonly description?: string;
}

export interface ModelConstructor<TFields extends FieldMap = FieldMap> {
  readonly modelName: string;
  readonly module: string;
  readonly kind?: ModelKind;
  readonly fields: TFields;
  readonly extends?: readonly string[];
  readonly mixins?: readonly string[];
  readonly description?: string;
  new (...args: never[]): unknown;
}

export abstract class Model {}

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
  readonly compatibility: Readonly<{ arsy: string; orm: string }>;
  readonly modules: readonly string[];
  readonly dependencies?: readonly AddonDependency[];
  readonly conflicts?: readonly string[];
  readonly capabilities?: readonly string[];
  readonly entrypoint?: string;
  readonly integrity?: string;
}

export interface ModuleManifest {
  readonly id: string;
  readonly addon: string;
  readonly version: string;
  readonly dependencies?: readonly ModuleDependency[];
  readonly conflicts?: readonly string[];
}

export interface MixinDefinition {
  readonly id: string;
  readonly module: string;
  readonly fields: FieldMap;
  readonly conflicts?: readonly string[];
}

export interface ModelExtension {
  readonly id: string;
  readonly module: string;
  readonly targetModel: string;
  readonly fields?: FieldMap;
  readonly mixins?: readonly string[];
  readonly priority?: number;
}

export interface RegistryModel {
  readonly name: string;
  readonly module: string;
  readonly addon: string;
  readonly kind: ModelKind;
  readonly fields: FieldMap;
  readonly inherits: readonly string[];
  readonly mixins: readonly string[];
  readonly extensions: readonly string[];
}

export interface RegistrySnapshot {
  readonly formatVersion: 1;
  readonly fingerprint: string;
  readonly createdAt: string;
  readonly addonOrder: readonly string[];
  readonly moduleOrder: readonly string[];
  readonly models: Readonly<Record<string, RegistryModel>>;
}

export interface RegistryBuildInput {
  readonly addons: readonly AddonManifest[];
  readonly modules: readonly ModuleManifest[];
  readonly models: readonly ModelConstructor[];
  readonly mixins?: readonly MixinDefinition[];
  readonly extensions?: readonly ModelExtension[];
}

export interface RegistryComposer {
  compose(input: RegistryBuildInput): RegistrySnapshot;
}

export type DomainOperator =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
  | "in" | "not-in" | "like" | "ilike" | "is-null";

export type DomainExpression =
  | Readonly<{ kind: "condition"; field: string; operator: DomainOperator; value?: unknown }>
  | Readonly<{ kind: "and" | "or"; expressions: readonly DomainExpression[] }>
  | Readonly<{ kind: "not"; expression: DomainExpression }>;

export interface PrincipalReference {
  readonly id: string;
  readonly type: string;
}

export interface EnvironmentContext {
  readonly principal: PrincipalReference;
  readonly tenantId?: string;
  readonly workspaceId?: string;
  readonly companyId?: string;
  readonly allowedCompanyIds: readonly string[];
  readonly locale: string;
  readonly timeZone: string;
  readonly traceId: string;
}

export { fields } from "./fields.ts";
export type { CommonFieldOptions, CharOptions, DecimalOptions, SelectionOptions } from "./fields.ts";
export { DeterministicRegistryComposer, composeRegistry, modelTableName } from "./registry.ts";
export type { RegistryIssue } from "./registry.ts";
export { validateDomain, assertValidDomain } from "./domain.ts";
export type { DomainIssue } from "./domain.ts";
