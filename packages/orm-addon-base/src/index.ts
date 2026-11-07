import { fields, Model } from "@riotworks/orm";
import type { AddonManifest, FieldMap, MixinDefinition, ModelConstructor, ModuleManifest } from "@riotworks/orm";

export const baseCoreAddon: AddonManifest = Object.freeze({
  id: "base",
  version: "1.0.0",
  publisher: "RIOTWORKS",
  compatibility: Object.freeze({ arsy: "*", orm: "^0.1.0" }),
  modules: Object.freeze(["base.core"]),
  capabilities: Object.freeze(["models.register"]),
});

export const baseCoreModule: ModuleManifest = Object.freeze({
  id: "base.core",
  addon: "base",
  version: "1.0.0",
});

export const baseEntityMixin: MixinDefinition = Object.freeze({
  id: "base.entity",
  module: "base.core",
  fields: Object.freeze({
    id: fields.UUID({ required: true, unique: true, readonly: true }),
    createdAt: fields.DateTime({ required: true, readonly: true }),
    createdById: fields.UUID({ nullable: true, readonly: true }),
    updatedAt: fields.DateTime({ required: true, readonly: true }),
    updatedById: fields.UUID({ nullable: true, readonly: true }),
  } satisfies FieldMap),
});

class AuditEvent extends Model {
  static modelName = "base.audit.event";
  static module = "base.core";
  static fields = {
    id: fields.UUID({ required: true, unique: true, readonly: true }),
    actorId: fields.UUID({ required: true, readonly: true }),
    modelName: fields.Char({ required: true, readonly: true, maxLength: 160 }),
    recordId: fields.UUID({ required: true, readonly: true }),
    action: fields.Selection({ required: true, readonly: true, values: [
      { value: "create", label: "Create" },
      { value: "write", label: "Write" },
      { value: "delete", label: "Delete" },
    ] as const }),
    occurredAt: fields.DateTime({ required: true, readonly: true }),
    changedFields: fields.JSON<readonly string[]>({ required: true, readonly: true }),
  };
}

export const baseCoreModels: readonly ModelConstructor[] = Object.freeze([AuditEvent]);
export const baseCoreMixins: readonly MixinDefinition[] = Object.freeze([baseEntityMixin]);

export const baseAddon = Object.freeze({
  manifest: baseCoreAddon,
  module: baseCoreModule,
  models: baseCoreModels,
  mixins: baseCoreMixins,
});

export type BaseEntityFields = Readonly<{
  id: string;
  createdAt: string;
  createdById: string | null;
  updatedAt: string;
  updatedById: string | null;
}>;
