export { CorpusAdapter, isCorpusProjectionFresh, assertCorpusProjectionFresh } from "./adapter.ts";
export { isCorpusCanonicalId, assertCorpusCanonicalId, validateCorpusIdentityRecord } from "./identity.ts";
export {
  CORPUS_SPEC_VERSION, CORPUS_CANONICAL_ID_MAX_LENGTH, CORPUS_CANONICAL_ID_PATTERN,
} from "./types.ts";
export type {
  CorpusAdapterOptions, CorpusCanonicalId, CorpusCanonicalRecord, CorpusExternalIdentifier,
  CorpusIdentityAlias, CorpusIdentityLookup, CorpusIdentityRecord, CorpusIdentityResolution,
  CorpusIdentityResolver, CorpusProfileDescriptor, CorpusProfileProvider, CorpusProfileReadResult,
  CorpusProjection, CorpusReadResult, CorpusReader, CorpusRecordKind, CorpusRelease,
  CorpusSourceLocalIdentifier,
} from "./types.ts";
