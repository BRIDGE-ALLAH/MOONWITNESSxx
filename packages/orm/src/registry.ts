import { createHash } from "node:crypto";
import { OrmError } from "./index.js";
import type {
  AddonManifest, FieldDefinition, ModelConstructor, ModelExtensionDefinition,
  ModuleManifest, RegistryBuildInput, RegistryComposer, RegistryModelEntry, RegistrySnapshot,
} from "./index.js";

const identifier = /^[a-z][a-z0-9_.-]*$/;
const fieldIdentifier = /^[a-z][a-zA-Z0-9_]*$/;

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + stable(object[key])).join(",") + "}";
}

function hash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function assertIdentifier(value: string, kind: string): void {
  if (!identifier.test(value)) throw new OrmError("ORM_INVALID_MODEL", `Invalid ${kind} identifier "${value}".`, { value, kind });
}

function topological<T extends { id: string }>(
  entries: readonly T[],
  dependencies: (entry: T) => readonly { id: string; optional?: boolean }[],
  kind: string,
): T[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  if (byId.size !== entries.length) throw new OrmError("ORM_REGISTRY_CONFLICT", `Duplicate ${kind} identifier.`);
  const marks = new Map<string, number>();
  const ordered: T[] = [];
  const visit = (entry: T, trail: readonly string[]) => {
    const mark = marks.get(entry.id) ?? 0;
    if (mark === 2) return;
    if (mark === 1) throw new OrmError("ORM_DEPENDENCY_CYCLE", `${kind} dependency cycle: ${[...trail, entry.id].join(" -> ")}`);
    marks.set(entry.id, 1);
    for (const dependency of [...dependencies(entry)].sort((a, b) => a.id.localeCompare(b.id))) {
      const target = byId.get(dependency.id);
      if (!target) {
        if (!dependency.optional) throw new OrmError("ORM_REGISTRY_CONFLICT", `Missing ${kind} dependency "${dependency.id}" required by "${entry.id}".`);
      } else visit(target, [...trail, entry.id]);
    }
    marks.set(entry.id, 2);
    ordered.push(entry);
  };
  for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) visit(entry, []);
  return ordered;
}

function satisfies(actual: string, requested: string): boolean {
  if (requested === "*" || requested === actual) return true;
  const range = requested.match(/^([~^])(\d+)\.(\d+)\.(\d+)$/);
  const version = actual.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!range || !version) return false;
  const [, operator, major, minor, patch] = range;
  const [a, b, c] = version.slice(1).map(Number);
  const [x, y, z] = [Number(major), Number(minor), Number(patch)];
  return operator === "^" ? a === x && (b > y || (b === y && c >= z))
    : a === x && b === y && c >= z;
}

export class DeterministicRegistryComposer implements RegistryComposer {
  compose(input: RegistryBuildInput): RegistrySnapshot {
    const addons = new Map<string, AddonManifest>();
    for (const addon of input.addons) {
      assertIdentifier(addon.id, "addon");
      if (addons.has(addon.id)) throw new OrmError("ORM_REGISTRY_CONFLICT", `Duplicate addon "${addon.id}".`);
      if (!addon.version || !addon.publisher || !addon.entrypoint || !addon.compatibility?.arsy || !addon.compatibility?.orm) {
        throw new OrmError("ORM_INVALID_MODEL", `Addon "${addon.id}" has an incomplete manifest.`);
      }
      addons.set(addon.id, addon);
    }
    for (const addon of input.addons) {
      for (const conflict of addon.conflicts ?? []) if (addons.has(conflict)) {
        throw new OrmError("ORM_REGISTRY_CONFLICT", `Addon "${addon.id}" conflicts with "${conflict}".`);
      }
      for (const dependency of addon.dependencies ?? []) {
        const target = addons.get(dependency.addon);
        if (!target && !dependency.optional) throw new OrmError("ORM_REGISTRY_CONFLICT", `Missing addon dependency "${dependency.addon}".`);
        if (target && !satisfies(target.version, dependency.version)) throw new OrmError("ORM_ADDON_INCOMPATIBLE", `Addon "${addon.id}" requires ${dependency.addon}@${dependency.version}; found ${target.version}.`);
      }
    }
    const addonOrder = topological(input.addons, (addon) => (addon.dependencies ?? []).map((item) => ({ id: item.addon, optional: item.optional })), "addon");

    const modules = new Map<string, ModuleManifest>();
    for (const module of input.modules) {
      assertIdentifier(module.id, "module");
      if (modules.has(module.id)) throw new OrmError("ORM_REGISTRY_CONFLICT", `Duplicate module "${module.id}".`);
      const owner = addons.get(module.addon);
      if (!owner || !owner.modules.includes(module.id)) throw new OrmError("ORM_REGISTRY_CONFLICT", `Module "${module.id}" is not declared by addon "${module.addon}".`);
      modules.set(module.id, module);
    }
    for (const addon of input.addons) {
      for (const moduleId of addon.modules) if (!modules.has(moduleId)) throw new OrmError("ORM_REGISTRY_CONFLICT", `Addon "${addon.id}" declares missing module "${moduleId}".`);
    }
    for (const module of input.modules) {
      for (const conflict of module.conflicts ?? []) if (modules.has(conflict)) throw new OrmError("ORM_REGISTRY_CONFLICT", `Module "${module.id}" conflicts with "${conflict}".`);
    }
    const moduleOrder = topological(input.modules, (module) => (module.depends ?? []).map((item) => ({ id: item.module, optional: item.optional })), "module");
    const modulePosition = new Map(moduleOrder.map((module, index) => [module.id, index]));

    const modelsByName = new Map<string, ModelConstructor>();
    for (const model of input.models) {
      assertIdentifier(model.modelName, "model");
      if (modelsByName.has(model.modelName)) throw new OrmError("ORM_DUPLICATE_MODEL", `Duplicate model "${model.modelName}".`);
      if (!modules.has(model.module)) throw new OrmError("ORM_INVALID_MODEL", `Model "${model.modelName}" references unknown module "${model.module}".`);
      modelsByName.set(model.modelName, model);
    }

    const mixins = new Map((input.mixins ?? []).map((mixin) => [mixin.id, mixin]));
    if (mixins.size !== (input.mixins ?? []).length) throw new OrmError("ORM_REGISTRY_CONFLICT", "Duplicate mixin identifier.");
    const extensions = new Map<string, ModelExtensionDefinition[]>();
    const extensionIds = new Set<string>();
    for (const extension of input.extensions ?? []) {
      assertIdentifier(extension.id, "extension");
      if (extensionIds.has(extension.id)) throw new OrmError("ORM_REGISTRY_CONFLICT", `Duplicate extension "${extension.id}".`);
      extensionIds.add(extension.id);
      if (!modelsByName.has(extension.targetModel)) throw new OrmError("ORM_INVALID_MODEL", `Extension "${extension.id}" targets unknown model "${extension.targetModel}".`);
      if (!modules.has(extension.module)) throw new OrmError("ORM_INVALID_MODEL", `Extension "${extension.id}" references unknown module "${extension.module}".`);
      const list = extensions.get(extension.targetModel) ?? [];
      list.push(extension);
      extensions.set(extension.targetModel, list);
    }

    const registryModels: Record<string, RegistryModelEntry> = {};
    for (const [name, model] of [...modelsByName.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const fields: Record<string, FieldDefinition> = {};
      const origins = new Map<string, string>();
      const addFields = (source: string, contribution: Readonly<Record<string, FieldDefinition>>) => {
        for (const [fieldName, field] of Object.entries(contribution)) {
          if (!fieldIdentifier.test(fieldName) || !field || typeof field.kind !== "string") {
            throw new OrmError("ORM_INVALID_FIELD", `Invalid field descriptor "${name}.${fieldName}".`);
          }
          if (Object.hasOwn(fields, fieldName)) throw new OrmError("ORM_DUPLICATE_FIELD", `Field "${name}.${fieldName}" is contributed by "${origins.get(fieldName)}" and "${source}".`);
          fields[fieldName] = Object.freeze({ ...field, ...(field.options ? { options: Object.freeze({ ...field.options }) } : {}) });
          origins.set(fieldName, source);
        }
      };
      addFields(`model:${name}`, model.fields);
      const contributions = (extensions.get(name) ?? []).sort((a, b) =>
        (modulePosition.get(a.module) ?? Number.MAX_SAFE_INTEGER) - (modulePosition.get(b.module) ?? Number.MAX_SAFE_INTEGER)
        || (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id));
      for (const extension of contributions) {
        for (const mixinId of extension.mixins ?? []) {
          const mixin = mixins.get(mixinId);
          if (!mixin) throw new OrmError("ORM_INVALID_MODEL", `Extension "${extension.id}" references unknown mixin "${mixinId}".`);
          addFields(`mixin:${mixinId}`, mixin.fields);
        }
        if (extension.fields) addFields(`extension:${extension.id}`, extension.fields);
      }
      for (const [fieldName, field] of Object.entries(fields)) {
        if ("target" in field && typeof field.target === "string" && !modelsByName.has(field.target)) {
          throw new OrmError("ORM_UNKNOWN_RELATION_TARGET", `Relation "${name}.${fieldName}" targets unknown model "${field.target}".`);
        }
      }
      const module = modules.get(model.module)!;
      registryModels[name] = Object.freeze({
        name, module: model.module, kind: model.kind ?? "persistent",
        fields: Object.freeze(fields), sourceAddon: module.addon,
        extensions: Object.freeze(contributions.map((item) => item.id)),
      });
    }

    const normalized = {
      formatVersion: 1,
      addonOrder: addonOrder.map((item) => item.id),
      moduleOrder: moduleOrder.map((item) => item.id),
      models: registryModels,
      addonVersions: addonOrder.map((item) => ({ id: item.id, version: item.version, integrity: item.integrity ?? null })),
    };
    return Object.freeze({
      formatVersion: 1,
      fingerprint: hash(normalized),
      createdAt: new Date().toISOString(),
      addonOrder: Object.freeze(normalized.addonOrder),
      moduleOrder: Object.freeze(normalized.moduleOrder),
      models: Object.freeze(registryModels),
    });
  }
}

export const registryComposer: RegistryComposer = new DeterministicRegistryComposer();
