import test from "node:test";
import assert from "node:assert/strict";
import { baseAddon } from "../src/index.ts";
import { composeRegistry, fields, Model } from "@riotworks/orm";

class Project extends Model {
  static modelName = "project.project";
  static module = "base.core";
  static mixins = ["base.entity"];
  static fields = { name: fields.Char({ required: true }) };
}

test("BaseEntity contributes exactly the five canonical fields", () => {
  const registry = composeRegistry({
    addons: [baseAddon.manifest],
    modules: [baseAddon.module],
    models: [...baseAddon.models, Project],
    mixins: [...baseAddon.mixins],
  });
  assert.deepEqual(Object.keys(registry.models["project.project"].fields).sort(), [
    "createdAt", "createdById", "id", "name", "updatedAt", "updatedById",
  ]);
  assert.deepEqual(registry.models["project.project"].mixins, ["base.entity"]);
});
