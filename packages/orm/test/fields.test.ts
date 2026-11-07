import assert from "node:assert/strict";
import test from "node:test";
import { fields } from "../src/fields.ts";
import { validateModelDeclaration } from "../src/declaration.ts";

test("field factories freeze metadata and apply safe defaults", () => {
  const name = fields.Char({ required: true, maxLength: 160 });
  assert.equal(name.kind, "char");
  assert.equal(name.required, true);
  assert.equal(name.nullable, false);
  assert.equal(Object.isFrozen(name), true);
  assert.equal(Object.isFrozen(name.options), true);
});

test("unique fields are indexed by default", () => {
  const email = fields.Char({ unique: true });
  assert.equal(email.unique, true);
  assert.equal(email.index, true);
});

test("decimal precision and scale are validated", () => {
  assert.throws(() => fields.Decimal({ precision: 4, scale: 5 }), RangeError);
  assert.equal(fields.Decimal({ precision: 18, scale: 2 }).kind, "decimal");
});

test("selection values must be unique", () => {
  assert.throws(() => fields.Selection({
    values: [{ value: "draft", label: "Draft" }, { value: "draft", label: "Again" }],
  }), TypeError);
});

test("relation declarations require a target", () => {
  assert.throws(() => fields.ManyToOne(""), TypeError);
  assert.equal(fields.ManyToOne("res.company").target, "res.company");
});

test("declaration validation rejects invalid required/nullability combinations", () => {
  const issues = validateModelDeclaration({
    modelName: "crm.customer",
    module: "crm",
    fields: { name: { kind: "char", required: true, nullable: true } },
  });
  assert.equal(issues.some((issue) => issue.code === "INVALID_FIELD_OPTIONS"), true);
});
