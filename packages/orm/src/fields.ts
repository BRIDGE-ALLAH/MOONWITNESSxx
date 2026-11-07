import type { FieldDefinition, FieldDefault, RelationDefinition, OnDelete } from "./index.js";

export interface CommonFieldOptions<TValue> {
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly readonly?: boolean;
  readonly index?: boolean;
  readonly unique?: boolean;
  readonly default?: FieldDefault<TValue>;
  readonly label?: string;
  readonly description?: string;
}

export type CharOptions = CommonFieldOptions<string | null> & Readonly<{ maxLength?: number; trim?: boolean }>;
export type DecimalOptions = CommonFieldOptions<string | null> & Readonly<{ precision: number; scale: number }>;
export type IntegerOptions = CommonFieldOptions<number | null> & Readonly<{ min?: number; max?: number }>;
export type FloatOptions = CommonFieldOptions<number | null> & Readonly<{ min?: number; max?: number }>;
export type SelectionOption<T extends string> = Readonly<{ value: T; label: string }>;
export type SelectionOptions<T extends string> = CommonFieldOptions<T | null> & Readonly<{ values: readonly SelectionOption<T>[] }>;

function descriptor<TValue>(
  kind: FieldDefinition<TValue>["kind"],
  options: CommonFieldOptions<TValue> & Readonly<Record<string, unknown>> = {},
): FieldDefinition<TValue> {
  return Object.freeze({
    kind,
    required: options.required ?? false,
    nullable: options.nullable ?? !options.required,
    readonly: options.readonly ?? false,
    index: options.index ?? options.unique ?? false,
    unique: options.unique ?? false,
    ...(options.default !== undefined ? { default: options.default } : {}),
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.description !== undefined ? { description: options.description } : {}),
    options: Object.freeze({ ...options }),
  });
}

function relation<TTarget extends string>(
  kind: RelationDefinition<TTarget>["kind"],
  target: TTarget,
  options: Readonly<{
    inverse?: string;
    onDelete?: OnDelete;
    relationTable?: string;
    required?: boolean;
    nullable?: boolean;
    readonly?: boolean;
    index?: boolean;
    label?: string;
  }> = {},
): RelationDefinition<TTarget> {
  if (!target.trim()) throw new TypeError("Relation target must be a non-empty model name.");
  return Object.freeze({
    kind,
    target,
    cardinality: kind,
    required: options.required ?? false,
    nullable: options.nullable ?? !options.required,
    readonly: options.readonly ?? false,
    index: options.index ?? (kind === "many-to-one"),
    ...(options.inverse ? { inverse: options.inverse } : {}),
    ...(options.onDelete ? { onDelete: options.onDelete } : {}),
    ...(options.relationTable ? { relationTable: options.relationTable } : {}),
    ...(options.label ? { label: options.label } : {}),
  });
}

export const fields = Object.freeze({
  Char: (options: CharOptions = {}) => descriptor<string | null>("char", options),
  Text: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("text", options),
  Boolean: (options: CommonFieldOptions<boolean | null> = {}) => descriptor<boolean | null>("boolean", options),
  Integer: (options: IntegerOptions = {}) => descriptor<number | null>("integer", options),
  Float: (options: FloatOptions = {}) => descriptor<number | null>("float", options),
  Decimal: (options: DecimalOptions) => {
    if (!Number.isInteger(options.precision) || options.precision < 1 || options.precision > 100) throw new RangeError("Decimal precision must be an integer from 1 to 100.");
    if (!Number.isInteger(options.scale) || options.scale < 0 || options.scale > options.precision) throw new RangeError("Decimal scale must be between zero and precision.");
    return descriptor<string | null>("decimal", options);
  },
  Date: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("date", options),
  DateTime: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("datetime", options),
  Time: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("time", options),
  UUID: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("uuid", options),
  JSON: <TValue = Readonly<Record<string, unknown>>>(options: CommonFieldOptions<TValue> = {}) => descriptor<TValue>("json", options),
  Selection: <T extends string>(options: SelectionOptions<T>) => {
    if (!options.values.length) throw new TypeError("Selection fields require at least one value.");
    const seen = new Set<string>();
    for (const item of options.values) {
      if (!item.value || seen.has(item.value)) throw new TypeError("Selection values must be non-empty and unique.");
      seen.add(item.value);
    }
    return descriptor<T | null>("selection", options);
  },
  Binary: (options: CommonFieldOptions<Uint8Array | null> = {}) => descriptor<Uint8Array | null>("binary", options),
  ManyToOne: <T extends string>(target: T, options: Parameters<typeof relation<T>>[2] = {}) => relation("many-to-one", target, options),
  OneToMany: <T extends string>(target: T, options: Parameters<typeof relation<T>>[2] = {}) => relation("one-to-many", target, options),
  ManyToMany: <T extends string>(target: T, options: Parameters<typeof relation<T>>[2] = {}) => relation("many-to-many", target, options),
  Computed: <TValue>(options: CommonFieldOptions<TValue> & Readonly<{ dependsOn: readonly string[]; stored?: boolean }>) =>
    descriptor<TValue>("computed", options),
  Related: <TValue>(options: CommonFieldOptions<TValue> & Readonly<{ path: string; stored?: boolean }>) =>
    descriptor<TValue>("related", options),
});

export type FieldFactory = typeof fields;
