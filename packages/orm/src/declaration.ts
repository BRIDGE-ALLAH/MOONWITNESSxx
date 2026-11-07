import type { FieldDefinition, FieldMap, ModelDeclaration } from "./index.js";

const identifier = /^[a-z][a-z0-9_.-]*$/;
const fieldIdentifier = /^[a-z][a-zA-Z0-9_]*$/;

export interface DeclarationIssue {
  readonly code: "INVALID_MODEL_ID" | "INVALID_MODULE_ID" | "INVALID_FIELD_NAME" | "INVALID_DESCRIPTOR" | "INVALID_FIELD_OPTIONS" | "INVALID_RELATION";
  readonly path: string;
  readonly message: string;
}

export function validateModelDeclaration(model: ModelDeclaration): readonly DeclarationIssue[] {
  const issues: DeclarationIssue[] = [];
  if (!identifier.test(model.modelName)) issues.push({ code: "INVALID_MODEL_ID", path: "modelName", message: "Model name must be a stable technical identifier." });
  if (!identifier.test(model.module)) issues.push({ code: "INVALID_MODULE_ID", path: "module", message: "Module name must be a stable technical identifier." });
  for (const [name, field] of Object.entries(model.fields as FieldMap)) {
    const path = `fields.${name}`;
    if (!fieldIdentifier.test(name)) issues.push({ code: "INVALID_FIELD_NAME", path, message: "Field name is invalid." });
    if (!field || typeof field.kind !== "string") {
      issues.push({ code: "INVALID_DESCRIPTOR", path, message: "Field descriptor is missing a valid kind." });
      continue;
    }
    if (field.required && field.nullable) issues.push({ code: "INVALID_FIELD_OPTIONS", path, message: "A required field cannot be nullable." });
    if (field.unique && field.index === false) issues.push({ code: "INVALID_FIELD_OPTIONS", path, message: "Unique fields must be indexed by the registry." });
    if (field.kind === "many-to-one" || field.kind === "one-to-many" || field.kind === "many-to-many") {
      if (!("target" in field) || typeof field.target !== "string" || !identifier.test(field.target)) {
        issues.push({ code: "INVALID_RELATION", path, message: "Relation target must be a valid model identifier." });
      }
    }
    if (field.kind === "computed" && !Array.isArray(field.options?.dependsOn)) {
      issues.push({ code: "INVALID_FIELD_OPTIONS", path, message: "Computed fields require a dependsOn list." });
    }
    if (field.kind === "related" && typeof field.options?.path !== "string") {
      issues.push({ code: "INVALID_FIELD_OPTIONS", path, message: "Related fields require a relation path." });
    }
  }
  return Object.freeze(issues);
}

export function assertValidModelDeclaration(model: ModelDeclaration): void {
  const issues = validateModelDeclaration(model);
  if (issues.length) {
    const error = new TypeError(`Invalid model declaration "${model.modelName}": ${issues.map((item) => item.message).join(" ")}`);
    Object.assign(error, { issues });
    throw error;
  }
}

export type { FieldDefinition };
