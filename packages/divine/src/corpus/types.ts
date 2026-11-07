export const CORPUS_SPEC_VERSION = "0.1" as const;
export const CORPUS_CANONICAL_ID_MAX_LENGTH = 255;
export const CORPUS_CANONICAL_ID_PATTERN = /^mw:[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*:[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;

export type CorpusCanonicalId = \`mw:\${string}\`;
export type CorpusRecordKind = "entity" | "resource" | "assertion" | "evidence" | "provenance" | "assessment";

/** Structural envelope matching Corpus BaseRecord; domain-specific fields remain opaque. */
export interface CorpusCanonicalRecord { readonly id: CorpusCanonicalId; readonly record_type: CorpusRecordKind }
export interface CorpusRelease {
  readonly releaseId: string;
  readonly specVersion: string;
  readonly datasetVersion: string;
  readonly contentHash: string;
  readonly publishedAt?: string;
}
export type CorpusReadResult<T extends CorpusCanonicalRecord> =
  | { readonly status: "available"; readonly record: T; readonly rights?: Readonly<Record<string, unknown>> }
  | { readonly status: "restricted"; readonly canonicalId: CorpusCanonicalId; readonly rights?: Readonly<Record<string, unknown>> }
  | { readonly status: "unavailable"; readonly canonicalId: CorpusCanonicalId; readonly reason?: string }
  | { readonly status: "metadata-only"; readonly canonicalId: CorpusCanonicalId; readonly metadata: Readonly<Record<string, unknown>>; readonly rights?: Readonly<Record<string, unknown>> }
  | { readonly status: "not-found"; readonly canonicalId: CorpusCanonicalId };

export interface CorpusExternalIdentifier {
  readonly scheme: string;
  readonly value: string;
  readonly uri?: string;
}
export interface CorpusSourceLocalIdentifier {
  readonly source: CorpusCanonicalId;
  readonly value: string;
  readonly namespace?: string;
}
export interface CorpusIdentityAlias {
  readonly value: string;
  readonly language?: string;
  readonly kind?: string;
}
export interface CorpusIdentityRecord {
  readonly canonicalId: CorpusCanonicalId;
  readonly sourceLocalIdentifiers: readonly CorpusSourceLocalIdentifier[];
  readonly externalIdentifiers: readonly CorpusExternalIdentifier[];
  readonly aliases: readonly CorpusIdentityAlias[];
}
export type CorpusIdentityLookup =
  | { readonly type: "canonical"; readonly id: CorpusCanonicalId }
  | { readonly type: "source-local"; readonly identifier: CorpusSourceLocalIdentifier }
  | { readonly type: "external"; readonly identifier: CorpusExternalIdentifier }
  | { readonly type: "alias"; readonly value: string; readonly language?: string; readonly contextRef?: CorpusCanonicalId };
export type CorpusIdentityResolution =
  | { readonly status: "resolved"; readonly identity: CorpusIdentityRecord; readonly matchedBy: "canonical" | "source-local" | "external" | "alias" }
  | { readonly status: "ambiguous"; readonly candidates: readonly CorpusIdentityRecord[] }
  | { readonly status: "restricted"; readonly canonicalId?: CorpusCanonicalId; readonly reason?: string }
  | { readonly status: "not-found" };
export interface CorpusIdentityResolver {
  resolve(lookup: CorpusIdentityLookup): Promise<CorpusIdentityResolution>;
}

export interface CorpusProfileDescriptor {
  readonly id: string;
  readonly version: string;
  readonly specVersion: string;
  readonly recordTypes: readonly CorpusRecordKind[];
  readonly status: "draft" | "stable" | "deprecated";
}
export type CorpusProfileReadResult =
  | { readonly status: "available"; readonly profileId: string; readonly version: string; readonly canonicalId: CorpusCanonicalId; readonly payload: Readonly<Record<string, unknown>>; readonly rights?: Readonly<Record<string, unknown>> }
  | { readonly status: "restricted"; readonly profileId: string; readonly version: string; readonly canonicalId: CorpusCanonicalId; readonly rights?: Readonly<Record<string, unknown>> }
  | { readonly status: "unavailable"; readonly profileId: string; readonly version: string; readonly canonicalId: CorpusCanonicalId; readonly reason?: string }
  | { readonly status: "not-found"; readonly profileId: string; readonly version: string; readonly canonicalId: CorpusCanonicalId };
export interface CorpusProfileProvider {
  listProfiles(): Promise<readonly CorpusProfileDescriptor[]>;
  readProfile(profileId: string, version: string, canonicalId: CorpusCanonicalId): Promise<CorpusProfileReadResult>;
}
export interface CorpusReader {
  getRelease(): Promise<CorpusRelease>;
  readRecord<T extends CorpusCanonicalRecord = CorpusCanonicalRecord>(kind: CorpusRecordKind, canonicalId: CorpusCanonicalId): Promise<CorpusReadResult<T>>;
}
export interface CorpusAdapterOptions {
  readonly supportedSpecVersions?: readonly string[];
  readonly identityResolver?: CorpusIdentityResolver;
  readonly profileProvider?: CorpusProfileProvider;
}
export interface CorpusProjection<T extends CorpusCanonicalRecord = CorpusCanonicalRecord> {
  readonly projectionKey: string;
  readonly source: {
    readonly repository: "moonwitness-corpus";
    readonly releaseId: string;
    readonly specVersion: string;
    readonly datasetVersion: string;
    readonly contentHash: string;
    readonly canonicalId: CorpusCanonicalId;
    readonly recordType: CorpusRecordKind;
  };
  readonly record: T;
  readonly rights?: Readonly<Record<string, unknown>>;
}
