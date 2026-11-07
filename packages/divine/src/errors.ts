export type DivineErrorCode = "DIVINE_DUPLICATE_ADDON"|"DIVINE_MISSING_DEPENDENCY"|"DIVINE_DEPENDENCY_CYCLE"|"DIVINE_INCOMPATIBLE_VERSION"|"DIVINE_DUPLICATE_SERVICE"|"DIVINE_INITIALIZATION_FAILED"|"DIVINE_CORPUS_UNAVAILABLE"|"DIVINE_CORPUS_INCOMPATIBLE"|"DIVINE_CORPUS_RELEASE_INVALID";
export class DivineError extends Error {
  readonly code: DivineErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(code: DivineErrorCode,message: string,details: Record<string,unknown>={}) {
    super(message); this.name="DivineError"; this.code=code; this.details=Object.freeze({...details});
  }
}