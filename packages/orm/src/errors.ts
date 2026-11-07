import type { OrmErrorCode } from "./index.js";

export class OrmError extends Error {
  readonly code: OrmErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: OrmErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = "OrmError";
    this.code = code;
    this.details = details;
  }
}
