import test from "node:test";
import assert from "node:assert/strict";
import { fields, composeRegistry, Model } from "../src/index.ts";

const addon = { id: "base", version: "1.0.0", publisher: "riotworks", compatibility: { arsy: "*", orm: "*" }, modules: ["base.core"] };
const module = { id: "base.core", addon: "base", version: "1.0.0" };

class AbstractNamed extends Model {
  static modelName = "base.named";
  static module = "base.core";
  static kind = "abstract";
  static fields = { name: fields.Char({ required: true }) };
}
class Partner extends Model {
  static modelName = "res.partner";
  static module = "base.core";
  static extends = ["base.named"];
  static fields = { email: fields.Char({ index: true }) };
}

test("registry composition is deterministic and applies abstract inheritance", () => {
  const build = () => composeRegistry({ addons: [addon], modules: [module], models: [Partner, AbstractNamed] });
  const first = build();
  const second = build();
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(Object.keys(first.models["res.partner"].fields).sort(), ["email", "name"]);
  assert.equal(first.models["res.partner"].inherits[0], "base.named");
});

test("model-declared mixins are composed and conflicts fail closed", () => {
  const mixin = { id: "base.entity", module: "base.core", fields: { id: fields.UUID({ required: true, unique: true }) } };
  class Document extends Model {
    static modelName = "base.document";
    static module = "base.core";
    static mixins = ["base.entity"];
    static fields = { title: fields.Char({ required: true }) };
  }
  const snapshot = composeRegistry({ addons: [addon], modules: [module], models: [Document], mixins: [mixin] });
  assert.ok(snapshot.models["base.document"].fields.id);
  assert.deepEqual(snapshot.models["base.document"].mixins, ["base.entity"]);
});

test("unknown relation targets and physical table collisions are rejected", () => {
  class BadRelation extends Model {
    static modelName = "bad.relation";
    static module = "base.core";
    static fields = { parent: fields.ManyToOne("missing.model") };
  }
  assert.throws(() => composeRegistry({ addons: [addon], modules: [module], models: [BadRelation] }), /Unknown relation target/);
});
