import test from "node:test";
import assert from "node:assert/strict";
import { fields, assertValidDomain } from "../src/index.ts";

test("domain rejects unknown and non-searchable fields", () => {
  const modelFields = { name: fields.Char(), blob: fields.Binary() };
  assert.throws(() => assertValidDomain({ kind: "condition", field: "missing", operator: "eq", value: "x" }, modelFields), /Unknown field/);
  assert.throws(() => assertValidDomain({ kind: "condition", field: "blob", operator: "eq", value: "x" }, modelFields), /portable query API/);
});

test("domain accepts exact decimal comparison and bounded IN lists", () => {
  const modelFields = { amount: fields.Decimal({ precision: 18, scale: 2 }) };
  assert.doesNotThrow(() => assertValidDomain({ kind: "condition", field: "amount", operator: "eq", value: "12.30" }, modelFields));
  assert.doesNotThrow(() => assertValidDomain({ kind: "condition", field: "amount", operator: "in", value: ["1.00", "2.00"] }, modelFields));
});
