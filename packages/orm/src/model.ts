import type { FieldMap, ModelKind } from "./index.js";

export interface ModelDeclaration {
  readonly modelName: string;
  readonly module: string;
  readonly kind?: ModelKind;
  readonly fields: FieldMap;
  readonly description?: string;
  readonly extends?: readonly string[];
  readonly mixins?: readonly string[];
}

export interface ModelConstructor<T extends ModelDeclaration = ModelDeclaration> {
  new (...args: never[]): Model;
  readonly modelName: T["modelName"];
  readonly module: T["module"];
  readonly kind?: T["kind"];
  readonly fields: T["fields"];
  readonly description?: T["description"];
  readonly extends?: T["extends"];
  readonly mixins?: T["mixins"];
}

/** Base class for programmatic, static model declarations. Never instantiate it to discover metadata. */
export abstract class Model {}

export function readModelDeclaration(model: ModelConstructor): ModelDeclaration {
  const declaration = model as unknown as ModelDeclaration;
  if (!declaration.modelName || !declaration.module || !declaration.fields) {
    throw new TypeError("Model declaration requires static modelName, module, and fields.");
  }
  return Object.freeze({
    modelName: declaration.modelName,
    module: declaration.module,
    kind: declaration.kind ?? "persistent",
    fields: Object.freeze({ ...declaration.fields }),
    ...(declaration.description ? { description: declaration.description } : {}),
    ...(declaration.extends ? { extends: Object.freeze([...declaration.extends]) } : {}),
    ...(declaration.mixins ? { mixins: Object.freeze([...declaration.mixins]) } : {}),
  });
}
