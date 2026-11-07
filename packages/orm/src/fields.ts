import type { FieldDefault, FieldDescriptor, FieldKind } from "./index.ts";

export interface CommonFieldOptions<TValue = unknown> {
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly readonly?: boolean;
  readonly index?: boolean;
  readonly unique?: boolean;
  readonly default?: FieldDefault<TValue>;
  readonly label?: string;
  readonly description?: string;
  readonly [option: string]: unknown;
}

export type CharOptions = CommonFieldOptions<string | null> & Readonly<{ maxLength?: number; trim?: boolean }>;
export type DecimalOptions = CommonFieldOptions<string | null> & Readonly<{ precision: number; scale: number }>;
export type SelectionOptions<T extends string> = CommonFieldOptions<T | null> & Readonly<{ values: readonly Readonly<{ value: T; label: string }>[] }>;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

function descriptor<TValue>(
  kind: FieldKind,
  options: CommonFieldOptions<TValue> = {},
  relation?: Readonly<{ target: string; inverse?: string; onDelete?: FieldDescriptor["onDelete"] }>,
): FieldDescriptor<TValue> {
  const required = options.required ?? false;
  const nullable = options.nullable ?? !required;
  if (required && nullable) throw new TypeError("A required field cannot be nullable.");
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!["required", "nullable", "readonly", "index", "unique", "default", "label", "description"].includes(key)) {
      extra[key] = value;
    }
  }
  return freeze({
    kind,
    required,
    nullable,
    readonly: options.readonly ?? false,
    index: options.index ?? options.unique ?? false,
    unique: options.unique ?? false,
    ...(options.default !== undefined ? { default: options.default } : {}),
    ...(options.label !== undefined ? { label: options.label } : {}),
    ...(options.description !== undefined ? { description: options.description } : {}),
    options: extra,
    ...(relation ?? {}),
  }) as FieldDescriptor<TValue>;
}

export const fields = Object.freeze({
  Char: (options: CharOptions = {}) => {
    const maxLength = options.maxLength ?? 255;
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 1_000_000) {
      throw new RangeError("Char maxLength must be an integer from 1 to 1000000.");
    }
    return descriptor<string | null>("char", options);
  },
  Text: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("text", options),
  Boolean: (options: CommonFieldOptions<boolean | null> = {}) => descriptor<boolean | null>("boolean", options),
  Integer: (options: CommonFieldOptions<number | null> = {}) => descriptor<number | null>("integer", options),
  Float: (options: CommonFieldOptions<number | null> = {}) => descriptor<number | null>("float", options),
  Decimal: (options: DecimalOptions) => {
    if (!Number.isInteger(options.precision) || options.precision < 1 || options.precision > 100) {
      throw new RangeError("Decimal precision must be an integer from 1 to 100.");
    }
    if (!Number.isInteger(options.scale) || options.scale < 0 || options.scale > options.precision) {
      throw new RangeError("Decimal scale must be between zero and precision.");
    }
    return descriptor<string | null>("decimal", options);
  },
  Date: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("date", options),
  DateTime: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("datetime", options),
  Time: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("time", options),
  UUID: (options: CommonFieldOptions<string | null> = {}) => descriptor<string | null>("uuid", options),
  JSON: <TValue = Readonly<Record<string, unknown>>>(options: CommonFieldOptions<TValue> = {}) => descriptor<TValue>("json", options),
  Selection: <T extends string>(options: SelectionOptions<T>) => {
    if (!Array.isArray(options.values) || options.values.length === 0) throw new TypeError("Selection requires at least one value.");
    const values = new Set(options.values.map((item) => item.value));
    if (values.size !== options.values.length || options.values.some((item) => !item.value)) {
      throw new TypeError("Selection values must be non-empty and unique.");
    }
    return descriptor<T | null>("selection", options);
  },
  Binary: (options: CommonFieldOptions<Uint8Array | null> = {}) => descriptor<Uint8Array | null>("binary", options),
  ManyToOne: (target: string, options: CommonFieldOptions<string | null> & Readonly<{ inverse?: string; onDelete?: FieldDescriptor["onDelete"] }> = {}) => {
    if (!target.trim()) throw new TypeError("Relation target must not be empty.");
    return descriptor<string | null>("many-to-one", options, { target, ...(options.inverse ? { inverse: options.inverse } : {}), ...(options.onDelete ? { onDelete: options.onDelete } : {}) });
  },
  OneToMany: (target: string, options: CommonFieldOptions<readonly string[] | null> & Readonly<{ inverse?: string }> = {}) => {
    if (!target.trim() || !options.inverse) throw new TypeError("OneToMany requires a target and inverse field.");
    return descriptor<readonly string[] | null>("one-to-many", options, { target, inverse: options.inverse });
  },
  ManyToMany: (target: string, options: CommonFieldOptions<readonly string[] | null> & Readonly<{ inverse?: string }> = {}) => {
    if (!target.trim()) throw new TypeError("Relation target must not be empty.");
    return descriptor<readonly string[] | null>("many-to-many", options, { target, ...(options.inverse ? { inverse: options.inverse } : {}) });
  },
  Computed: <TValue>(options: CommonFieldOptions<TValue> & Readonly<{ dependsOn: readonly string[]; stored?: boolean; databaseType?: string }>) => {
    if (!Array.isArray(options.dependsOn) || options.dependsOn.length === 0) throw new TypeError("Computed fields require dependencies.");
    return descriptor<TValue>("computed", options);
  },
  Related: <TValue>(options: CommonFieldOptions<TValue> & Readonly<{ path: string; stored?: boolean; databaseType?: string }>) => {
    if (!options.path.trim()) throw new TypeError("Related fields require a path.");
    return descriptor<TValue>("related", options);
  },
});

export type FieldFactory = typeof fields;
