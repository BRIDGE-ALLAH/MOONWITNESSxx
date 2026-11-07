import assert from "node:assert/strict";
import test from "node:test";
import { fields } from "../src/fields.ts";
import { DeterministicRegistryComposer } from "../src/registry.ts";
import type { ModelConstructor } from "../src/index.ts";

function model(
  modelName: string,
  module: string,
  kind: "persistent" | "abstract" | "transient",
  declaredFields: Record<string, ReturnType<typeof fields.Char> | ReturnType<typeof fields.ManyToOne>>,
  inherits: readonly string[] = [],
): ModelConstructor {
  return Object.assign(class {}, {
    modelName,
    module,
    kind,
    fields: declaredFields,
    extends: inherits,
  }) as unknown as ModelConstructor;
}

function input(models: readonly ModelConstructor[]) {
  return {
    addons: [{
      id: "core",
      version: "1.0.0",
      publisher: "MOONWITNESS",
      compatibility: { arsy: "^1.0.0", orm: "^1.0.0" },
      modules: ["base", "crm"],
      entrypoint: "index.js",
    }],
    modules: [
      { id: "base", addon: "core", version: "1.0.0" },
      { id: "crm", addon: "core", version: "1.0.0", depends: [{ module: "base", version: "1.0.0" }] },
    ],
    models,
  };
}

test("registry composes abstract inheritance and explicit compatible field overrides", () => {
  const base = model("base.mixin", "base", "abstract", {
    name: fields.Char({ required: true, maxLength: 80 }),
  });
  const customer = model("crm.customer", "crm", "persistent", {
    name: fields.Char({ override: true, required: true, maxLength: 160 }),
    email: fields.Char({ unique: true }),
  }, ["base.mixin"]);
  const snapshot = new DeterministicRegistryComposer().compose(input([base, customer]));
  assert.deepEqual(snapshot.models["crm.customer"].inherits, ["base.mixin"]);
  assert.equal(snapshot.models["crm.customer"].fields.name.options?.maxLength, 160);
  assert.equal(snapshot.models["crm.customer"].fields.email.kind, "char");
});

test("registry rejects field replacement without an explicit override marker", () => {
  const base = model("base.mixin", "base", "abstract", { name: fields.Char() });
  const customer = model("crm.customer", "crm", "persistent", { name: fields.Char() }, ["base.mixin"]);
  assert.throws(
    () => new DeterministicRegistryComposer().compose(input([base, customer])),
    (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ORM_DUPLICATE_FIELD",
  );
});

test("registry rejects inheritance cycles and persistent-model inheritance", () => {
  const first = model("base.first", "base", "abstract", {}, ["base.second"]);
  const second = model("base.second", "base", "abstract", {}, ["base.first"]);
  assert.throws(() => new DeterministicRegistryComposer().compose(input([first, second])), /inheritance cycle/);

  const persistent = model("base.company", "base", "persistent", {});
  const child = model("crm.customer", "crm", "persistent", {}, ["base.company"]);
  assert.throws(() => new DeterministicRegistryComposer().compose(input([persistent, child])), /only abstract models/);
});

test("registry fingerprint is independent of input declaration order", () => {
  const base = model("base.mixin", "base", "abstract", { name: fields.Char() });
  const customer = model("crm.customer", "crm", "persistent", { email: fields.Char() }, ["base.mixin"]);
  const composer = new DeterministicRegistryComposer();
  const first = composer.compose(input([base, customer]));
  const second = composer.compose(input([customer, base]));
  assert.equal(first.fingerprint, second.fingerprint);
});
