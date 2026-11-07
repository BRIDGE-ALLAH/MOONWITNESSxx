import { createHash } from "node:crypto";
import type {
  AddonManifest, FieldDescriptor, FieldMap, MixinDefinition, ModelConstructor,
  ModelExtension, ModelKind, ModuleManifest, RegistryBuildInput, RegistryComposer,
  RegistryModel, RegistrySnapshot,
} from "./index.ts";
import { assertValidDomain } from "./domain.ts";

const identifier = /^[a-z][a-z0-9_.-]*$/;
const fieldIdentifier = /^[a-z][a-zA-Z0-9_]*$/;

export interface RegistryIssue {
  readonly code: string;
  readonly message: string;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + stable(object[key])).join(",") + "}";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

function versionSatisfies(actual: string, requested: string): boolean {
  if (requested === "*" || requested === actual) return true;
  const range = requested.match(/^([~^])(\d+)\.(\d+)\.(\d+)$/);
  const version = actual.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!range || !version) return false;
  const [, operator, major, minor, patch] = range;
  const [a, b, c] = version.slice(1).map(Number);
  const [x, y, z] = [Number(major), Number(minor), Number(patch)];
  return operator === "^" ? a === x && (b > y || b === y && c >= z) : a === x && b === y && c >= z;
}

function sortDependencies<T extends { id: string }>(
  entries: readonly T[],
  getDependencies: (entry: T) => readonly { id: string; version?: string; optional?: boolean }[],
  label: string,
  versions: (entry: T) => string,
): T[] {
  const byId = new Map<string, T>(entries.map((entry): [string, T] => [entry.id, entry]));
  if (byId.size !== entries.length) throw new TypeError("Duplicate " + label + " identifier.");
  const marks = new Map<string, number>();
  const ordered: T[] = [];
  const visit = (entry: T, trail: readonly string[]) => {
    const mark = marks.get(entry.id) ?? 0;
    if (mark === 2) return;
    if (mark === 1) throw new TypeError(label + " dependency cycle: " + [...trail, entry.id].join(" -> "));
    marks.set(entry.id, 1);
    for (const dep of [...getDependencies(entry)].sort((a, b) => a.id.localeCompare(b.id))) {
      const target = byId.get(dep.id);
      if (!target) {
        if (!dep.optional) throw new TypeError("Missing " + label + " dependency " + dep.id + " required by " + entry.id + ".");
        continue;
      }
      if (dep.version && !versionSatisfies(versions(target), dep.version)) {
        throw new TypeError(label + " dependency version mismatch for " + entry.id + " -> " + dep.id + ".");
      }
      visit(target, [...trail, entry.id]);
    }
    marks.set(entry.id, 2);
    ordered.push(entry);
  };
  for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) visit(entry, []);
  return ordered;
}

function assertId(value: string, kind: string): void {
  if (!identifier.test(value)) throw new TypeError("Invalid " + kind + " identifier: " + value);
}

function validateFields(name: string, fields: FieldMap): void {
  for (const [fieldName, field] of Object.entries(fields)) {
    if (!fieldIdentifier.test(fieldName)) throw new TypeError("Invalid field name " + name + "." + fieldName + ".");
    if (!field || typeof field.kind !== "string") throw new TypeError("Invalid field descriptor " + name + "." + fieldName + ".");
    if (field.required && field.nullable) throw new TypeError("Required field cannot be nullable: " + name + "." + fieldName + ".");
    if (field.unique && !field.index) throw new TypeError("Unique field must be indexed: " + name + "." + fieldName + ".");
    if ((field.kind === "many-to-one" || field.kind === "one-to-many" || field.kind === "many-to-many") && !field.target) {
      throw new TypeError("Relation target is required: " + name + "." + fieldName + ".");
    }
    if (field.kind === "computed" && (!Array.isArray(field.options.dependsOn) || field.options.dependsOn.length === 0)) {
      throw new TypeError("Computed fields require dependencies: " + name + "." + fieldName + ".");
    }
    if (field.kind === "related" && typeof field.options.path !== "string") {
      throw new TypeError("Related fields require a path: " + name + "." + fieldName + ".");
    }
  }
}

export function modelTableName(modelName: string): string {
  assertId(modelName, "model");
  const result = modelName.replace(/[.-]/g, "_");
  if (!/^[a-z][a-z0-9_]*$/.test(result)) throw new TypeError("Model name cannot be mapped to a portable SQL identifier: " + modelName);
  return result;
}

export class DeterministicRegistryComposer implements RegistryComposer {
  compose(input: RegistryBuildInput): RegistrySnapshot {
    const addons = new Map<string, AddonManifest>();
    for (const addon of input.addons) {
      assertId(addon.id, "addon");
      if (addons.has(addon.id)) throw new TypeError("Duplicate addon " + addon.id + ".");
      if (!/^\d+\.\d+\.\d+/.test(addon.version) || !addon.publisher.trim()) throw new TypeError("Invalid addon manifest " + addon.id + ".");
      if (!addon.compatibility?.arsy || !addon.compatibility?.orm) throw new TypeError("Addon compatibility is required: " + addon.id + ".");
      addons.set(addon.id, addon);
    }
    for (const addon of input.addons) {
      for (const conflict of addon.conflicts ?? []) if (addons.has(conflict)) throw new TypeError("Addon conflict: " + addon.id + " <> " + conflict + ".");
      for (const dependency of addon.dependencies ?? []) {
        const target = addons.get(dependency.addon);
        if (!target && !dependency.optional) throw new TypeError("Missing addon dependency " + dependency.addon + ".");
        if (target && !versionSatisfies(target.version, dependency.version)) throw new TypeError("Incompatible addon dependency " + dependency.addon + ".");
      }
    }
    const addonOrder = sortDependencies(input.addons, (item) => (item.dependencies ?? []).map((dep) => ({ id: dep.addon, version: dep.version, optional: dep.optional })), "addon", (item) => item.version);

    const modules = new Map<string, ModuleManifest>();
    for (const module of input.modules) {
      assertId(module.id, "module");
      if (modules.has(module.id)) throw new TypeError("Duplicate module " + module.id + ".");
      const owner = addons.get(module.addon);
      if (!owner || !owner.modules.includes(module.id)) throw new TypeError("Module " + module.id + " is not declared by its addon.");
      modules.set(module.id, module);
    }
    for (const addon of input.addons) {
      for (const moduleId of addon.modules) if (!modules.has(moduleId)) throw new TypeError("Addon " + addon.id + " declares missing module " + moduleId + ".");
    }
    for (const module of input.modules) for (const conflict of module.conflicts ?? []) {
      if (modules.has(conflict)) throw new TypeError("Module conflict: " + module.id + " <> " + conflict + ".");
    }
    const moduleOrder = sortDependencies(input.modules, (item) => (item.dependencies ?? []).map((dep) => ({ id: dep.module, version: dep.version, optional: dep.optional })), "module", (item) => item.version);
    const modulePosition = new Map<string, number>(moduleOrder.map((item, index): [string, number] => [item.id, index]));

    const models = new Map<string, ModelConstructor>();
    for (const model of input.models) {
      assertId(model.modelName, "model");
      if (models.has(model.modelName)) throw new TypeError("Duplicate model " + model.modelName + ".");
      if (!modules.has(model.module)) throw new TypeError("Unknown module " + model.module + " for model " + model.modelName + ".");
      validateFields(model.modelName, model.fields);
      models.set(model.modelName, model);
    }

    const mixins = new Map<string, MixinDefinition>();
    for (const mixin of input.mixins ?? []) {
      assertId(mixin.id, "mixin");
      if (mixins.has(mixin.id)) throw new TypeError("Duplicate mixin " + mixin.id + ".");
      if (!modules.has(mixin.module)) throw new TypeError("Unknown mixin module " + mixin.module + ".");
      validateFields("mixin:" + mixin.id, mixin.fields);
      mixins.set(mixin.id, mixin);
    }
    const extensionIds = new Set<string>();
    const extensionsByModel = new Map<string, ModelExtension[]>();
    for (const extension of input.extensions ?? []) {
      assertId(extension.id, "extension");
      if (extensionIds.has(extension.id)) throw new TypeError("Duplicate extension " + extension.id + ".");
      extensionIds.add(extension.id);
      if (!models.has(extension.targetModel)) throw new TypeError("Unknown extension target " + extension.targetModel + ".");
      if (!modules.has(extension.module)) throw new TypeError("Unknown extension module " + extension.module + ".");
      if (extension.fields) validateFields("extension:" + extension.id, extension.fields);
      const list = extensionsByModel.get(extension.targetModel) ?? [];
      list.push(extension);
      extensionsByModel.set(extension.targetModel, list);
    }

    const resolved = new Map<string, { fields: Record<string, FieldDescriptor>; mixins: string[]; extensions: string[]; trail: string[] }>();
    const resolveModel = (name: string, trail: readonly string[] = []) => {
      const cached = resolved.get(name);
      if (cached) return cached;
      if (trail.includes(name)) throw new TypeError("Model inheritance cycle: " + [...trail, name].join(" -> "));
      const model = models.get(name);
      if (!model) throw new TypeError("Unknown inherited model " + name + ".");
      const result: { fields: Record<string, FieldDescriptor>; mixins: string[]; extensions: string[]; trail: string[] } = {
        fields: {}, mixins: [], extensions: [], trail: [],
      };
      const add = (source: string, contribution: FieldMap) => {
        for (const [fieldName, field] of Object.entries(contribution)) {
          const current = result.fields[fieldName];
          if (current) {
            if (!field.options.override || current.kind !== field.kind || current.target !== field.target) {
              throw new TypeError("Incompatible field collision on " + name + "." + fieldName + " from " + source + ".");
            }
          } else if (field.options.override) {
            throw new TypeError("Field override has no target on " + name + "." + fieldName + ".");
          }
          result.fields[fieldName] = deepFreeze({ ...field, options: { ...field.options } });
        }
      };
      for (const parentName of model.extends ?? []) {
        const parent = models.get(parentName);
        if (!parent || (parent.kind ?? "persistent") !== "abstract") {
          throw new TypeError("Only abstract models may be inherited: " + name + " -> " + parentName + ".");
        }
        const parentResolved = resolveModel(parentName, [...trail, name]);
        add("inherit:" + parentName, parentResolved.fields);
        result.mixins.push(...parentResolved.mixins);
        result.extensions.push(...parentResolved.extensions);
      }
      for (const mixinId of model.mixins ?? []) {
        const mixin = mixins.get(mixinId);
        if (!mixin) throw new TypeError("Unknown model mixin " + mixinId + " on " + name + ".");
        for (const conflict of mixin.conflicts ?? []) if ((model.mixins ?? []).includes(conflict)) {
          throw new TypeError("Mixin conflict on " + name + ": " + mixinId + " <> " + conflict + ".");
        }
        add("mixin:" + mixinId, mixin.fields);
        result.mixins.push(mixinId);
      }
      add("model:" + name, model.fields);
      const contributions = (extensionsByModel.get(name) ?? []).sort((a, b) =>
        (modulePosition.get(a.module) ?? 0) - (modulePosition.get(b.module) ?? 0)
        || (a.priority ?? 0) - (b.priority ?? 0)
        || a.id.localeCompare(b.id));
      for (const extension of contributions) {
        for (const mixinId of extension.mixins ?? []) {
          const mixin = mixins.get(mixinId);
          if (!mixin) throw new TypeError("Unknown extension mixin " + mixinId + ".");
          add("extension-mixin:" + extension.id + ":" + mixinId, mixin.fields);
          result.mixins.push(mixinId);
        }
        if (extension.fields) add("extension:" + extension.id, extension.fields);
        result.extensions.push(extension.id);
      }
      resolved.set(name, result);
      return result;
    };

    const registryModels: Record<string, RegistryModel> = {};
    const physicalTables = new Map<string, string>();
    for (const [name, model] of [...models.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const composed = resolveModel(name);
      for (const field of Object.values(composed.fields)) {
        if (field.target && !models.has(field.target)) throw new TypeError("Unknown relation target " + field.target + " on " + name + ".");
      }
      assertValidDomain(undefined, composed.fields);
      const tableName = modelTableName(name);
      const previous = physicalTables.get(tableName);
      if (previous && previous !== name) throw new TypeError("Physical table collision: " + previous + " and " + name + " map to " + tableName + ".");
      physicalTables.set(tableName, name);
      registryModels[name] = deepFreeze({
        name,
        module: model.module,
        addon: modules.get(model.module)!.addon,
        kind: (model.kind ?? "persistent") as ModelKind,
        fields: composed.fields,
        inherits: [...(model.extends ?? [])],
        mixins: [...new Set(composed.mixins)],
        extensions: [...new Set(composed.extensions)],
      });
    }

    const normalized = {
      formatVersion: 1,
      addonOrder: addonOrder.map((item) => item.id),
      moduleOrder: moduleOrder.map((item) => item.id),
      addonVersions: addonOrder.map((item) => ({ id: item.id, version: item.version, integrity: item.integrity ?? null })),
      models: registryModels,
    };
    const fingerprint = createHash("sha256").update(stable(normalized)).digest("hex");
    return deepFreeze({
      formatVersion: 1 as const,
      fingerprint,
      createdAt: new Date().toISOString(),
      addonOrder: normalized.addonOrder,
      moduleOrder: normalized.moduleOrder,
      models: registryModels,
    });
  }
}

export const composeRegistry = (input: RegistryBuildInput): RegistrySnapshot => new DeterministicRegistryComposer().compose(input);
