import type { DomainExpression, DomainOperator, FieldDescriptor, FieldMap } from "./index.ts";

export interface DomainIssue {
  readonly path: string;
  readonly code: "UNKNOWN_FIELD" | "UNSEARCHABLE_FIELD" | "INVALID_OPERATOR" | "INVALID_VALUE" | "EMPTY_BOOLEAN_GROUP";
  readonly message: string;
}

const operators = new Set<DomainOperator>(["eq", "ne", "gt", "gte", "lt", "lte", "in", "not-in", "like", "ilike", "is-null"]);
const orderedKinds = new Set(["integer", "float", "decimal", "date", "datetime", "time"]);
const scalarKinds = new Set(["char", "text", "boolean", "integer", "float", "decimal", "date", "datetime", "time", "uuid", "selection"]);

function validateCondition(fieldName: string, operator: DomainOperator, value: unknown, field: FieldDescriptor): string | null {
  if (!operators.has(operator)) return "Operator is not supported.";
  if (field.kind === "one-to-many" || field.kind === "many-to-many" || field.kind === "binary" || field.kind === "json" || field.kind === "computed" && field.options.stored !== true || field.kind === "related" && field.options.stored !== true) {
    return "Field is not directly searchable in the portable query API.";
  }
  if (operator === "is-null") return value === undefined || typeof value === "boolean" ? null : "is-null accepts an optional boolean.";
  if (operator === "in" || operator === "not-in") {
    return Array.isArray(value) && value.length > 0 && value.length <= 500 ? null : "in/not-in requires a non-empty array with at most 500 values.";
  }
  if (operator === "like" || operator === "ilike") {
    return typeof value === "string" && scalarKinds.has(field.kind) && ["char", "text", "selection"].includes(field.kind) ? null : "like/ilike require a string field and string value.";
  }
  if (value === undefined || value === null && operator !== "eq" && operator !== "ne") return "Comparison requires a defined value.";
  if (["gt", "gte", "lt", "lte"].includes(operator) && !orderedKinds.has(field.kind)) return "Ordered comparison is not supported for this field type.";
  if (operator === "eq" || operator === "ne") return null;
  if (field.kind === "boolean") return typeof value === "boolean" ? null : "Boolean field requires a boolean value.";
  if (field.kind === "integer") return Number.isSafeInteger(value) ? null : "Integer field requires a safe integer.";
  if (field.kind === "float") return typeof value === "number" && Number.isFinite(value) ? null : "Float field requires a finite number.";
  if (field.kind === "decimal") return typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value) ? null : "Decimal values must be exact decimal strings.";
  if (field.kind === "uuid" || field.kind === "many-to-one") return typeof value === "string" && value.length > 0 ? null : "UUID/relation field requires a non-empty string.";
  if (scalarKinds.has(field.kind)) return typeof value === "string" || typeof value === "number" ? null : "Invalid scalar value.";
  return null;
}

export function validateDomain(domain: DomainExpression | undefined, fields: FieldMap): readonly DomainIssue[] {
  if (!domain) return Object.freeze([]);
  const issues: DomainIssue[] = [];
  const visit = (node: DomainExpression, path: string): void => {
    if (!node || typeof node !== "object") {
      issues.push({ path, code: "INVALID_VALUE", message: "Domain node must be an object." });
      return;
    }
    if (node.kind === "condition") {
      const field = fields[node.field];
      if (!field) {
        issues.push({ path, code: "UNKNOWN_FIELD", message: "Unknown field " + node.field + "." });
        return;
      }
      const problem = validateCondition(node.field, node.operator, node.value, field);
      if (problem) issues.push({ path, code: problem.includes("searchable") ? "UNSEARCHABLE_FIELD" : "INVALID_OPERATOR", message: problem });
      return;
    }
    if (node.kind === "not") {
      visit(node.expression, path + ".expression");
      return;
    }
    if (node.kind === "and" || node.kind === "or") {
      if (!Array.isArray(node.expressions) || node.expressions.length === 0) {
        issues.push({ path, code: "EMPTY_BOOLEAN_GROUP", message: "Boolean groups must contain at least one expression." });
        return;
      }
      node.expressions.forEach((item, index) => visit(item, path + ".expressions[" + index + "]"));
      return;
    }
    issues.push({ path, code: "INVALID_VALUE", message: "Unknown domain expression kind." });
  };
  visit(domain, "domain");
  return Object.freeze(issues.map((item) => Object.freeze(item)));
}

export function assertValidDomain(domain: DomainExpression | undefined, fields: FieldMap): void {
  const issues = validateDomain(domain, fields);
  if (issues.length) throw new TypeError("Invalid domain: " + issues.map((item) => item.path + ": " + item.message).join("; "));
}
