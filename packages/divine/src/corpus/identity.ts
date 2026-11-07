import { DivineError } from "../errors.ts";
import { CORPUS_CANONICAL_ID_MAX_LENGTH, CORPUS_CANONICAL_ID_PATTERN } from "./types.ts";
import type { CorpusCanonicalId, CorpusIdentityRecord, CorpusExternalIdentifier, CorpusSourceLocalIdentifier } from "./types.ts";

export function isCorpusCanonicalId(value: unknown): value is CorpusCanonicalId {
  return typeof value === "string" && value.length <= CORPUS_CANONICAL_ID_MAX_LENGTH && CORPUS_CANONICAL_ID_PATTERN.test(value);
}
export function assertCorpusCanonicalId(value: unknown): asserts value is CorpusCanonicalId {
  if (!isCorpusCanonicalId(value)) {
    throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "Expected a canonical Corpus ID; Divine never mints or normalizes canonical identities.", {
      value: typeof value === "string" ? value : typeof value,
    });
  }
}
export function validateCorpusIdentityRecord(identity: CorpusIdentityRecord): void {
  if (!Array.isArray(identity.sourceLocalIdentifiers) || !Array.isArray(identity.externalIdentifiers) || !Array.isArray(identity.aliases)) {
    throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "Corpus identity must preserve source-local identifiers, external identifiers and aliases as separate arrays.");
  }
  assertCorpusCanonicalId(identity.canonicalId);
  for (const item of identity.sourceLocalIdentifiers) {
    assertCorpusCanonicalId(item.source);
    if (!item.value || /[\u0000-\u001f\u007f]/.test(item.value)) {
      throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "Source-local identifiers must be preserved as non-empty source-owned values.");
    }
  }
  for (const item of identity.externalIdentifiers) {
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(item.scheme) || !item.value || /[\u0000-\u001f\u007f]/.test(item.value)) {
      throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "External identifiers must retain their source scheme and exact non-empty value.");
    }
    if (item.uri && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(item.uri)) {
      throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "External identifier URI must be absolute.");
    }
  }
  for (const alias of identity.aliases) {
    if (!alias.value || /[\u0000-\u001f\u007f]/.test(alias.value)) {
      throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "Aliases must be non-empty source-owned labels; Divine does not normalize them into identity.");
    }
  }
}
export function validateSourceLocalIdentifier(value: CorpusSourceLocalIdentifier): void {
  assertCorpusCanonicalId(value.source);
  if (!value.value || /[\u0000-\u001f\u007f]/.test(value.value)) {
    throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "Invalid source-local identifier.");
  }
}
export function validateExternalIdentifier(value: CorpusExternalIdentifier): void {
  validateCorpusIdentityRecord({ canonicalId: "mw:resource:identity-validation", sourceLocalIdentifiers: [], externalIdentifiers: [value], aliases: [] });
}
