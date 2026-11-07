import test from "node:test";
import assert from "node:assert/strict";
import { baseAddon } from "../../orm-addon-base/src/index.ts";
import { composeRegistry, fields, Model } from "../../orm/src/index.ts";
import { planSchema } from "../src/schema.ts";

class Tag extends Model {
  static modelName = "res.tag";
  static module = "base.core";
  static mixins = ["base.entity"];
  static fields = { name: fields.Char({ required: true, index: true }) };
}
class User extends Model {
  static modelName = "res.user";
  static module = "base.core";
  static mixins = ["base.entity"];
  static fields = { email: fields.Char({ required: true, unique: true }) };
}
class Task extends Model {
  static modelName = "task.item";
  static module = "base.core";
  static mixins = ["base.entity"];
  static fields = {
    title: fields.Char({ required: true }),
    ownerId: fields.ManyToOne("res.user"),
    tags: fields.ManyToMany("res.tag"),
  };
}
function registry(models = [Tag, User, Task]) {
  return composeRegistry({
    addons: [baseAddon.manifest],
    modules: [baseAddon.module],
    models: [...baseAddon.models, ...models],
    mixins: [...baseAddon.mixins],
  });
}
const emptyPostgres = { identity: { provider: "postgres", role: "business" }, tables: [] };

test("schema plan creates model tables before dependent foreign keys and relation tables", () => {
  const plan = planSchema(registry(), emptyPostgres);
  const creates = plan.operations.filter((item) => item.operation.kind === "create-table");
  const index = (table) => creates.findIndex((item) => item.operation.table === table);
  assert.ok(index("res_user") < index("task_item"));
  assert.ok(index("res_tag") < index("rel_res_tag_task_item"));
  assert.ok(index("task_item") < index("rel_res_tag_task_item"));
  assert.equal(plan.blockers.length, 0);
  assert.ok(plan.operations.some((item) => item.operation.kind === "create-index" && item.operation.table === "res_tag"));
});

test("unique indexes require operator review and no primary-key duplicate index is generated", () => {
  const plan = planSchema(registry(), emptyPostgres);
  assert.ok(plan.operations.some((item) => item.operation.kind === "create-index" && item.operation.table === "res_user" && item.risk === "review"));
  assert.equal(plan.operations.some((item) => item.operation.kind === "create-index" && item.operation.columns.includes("id")), false);
});

test("foreign-key cycles block rather than generate an unsafe schema sequence", () => {
  class Left extends Model {
    static modelName = "cycle.left";
    static module = "base.core";
    static mixins = ["base.entity"];
    static fields = { rightId: fields.ManyToOne("cycle.right") };
  }
  class Right extends Model {
    static modelName = "cycle.right";
    static module = "base.core";
    static mixins = ["base.entity"];
    static fields = { leftId: fields.ManyToOne("cycle.left") };
  }
  const plan = planSchema(registry([Left, Right]), emptyPostgres);
  assert.ok(plan.blockers.some((item) => item.includes("Foreign-key dependency cycle")));
});
