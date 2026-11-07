export const CORPUS_SPEC_VERSION="0.1" as const;
export type CorpusRecordKind="entity"|"resource"|"assertion"|"evidence"|"provenance"|"assessment";
export interface CorpusRelease {readonly releaseId:string;readonly specVersion:string;readonly datasetVersion:string;readonly contentHash:string;readonly publishedAt?:string}
export interface CanonicalRecordEnvelope<T=unknown>{readonly id:string;readonly recordType:CorpusRecordKind;readonly payload:T}
export type CorpusReadResult<T> =
 |{readonly status:"available";readonly record:CanonicalRecordEnvelope<T>;readonly rights?:Readonly<Record<string,unknown>>}
 |{readonly status:"restricted";readonly canonicalId:string;readonly rights?:Readonly<Record<string,unknown>>}
 |{readonly status:"unavailable";readonly canonicalId:string;readonly reason?:string}
 |{readonly status:"metadata-only";readonly canonicalId:string;readonly metadata:Readonly<Record<string,unknown>>;readonly rights?:Readonly<Record<string,unknown>>}
 |{readonly status:"not-found";readonly canonicalId:string};
export interface CorpusReader {getRelease():Promise<CorpusRelease>;readRecord<T=unknown>(kind:CorpusRecordKind,canonicalId:string):Promise<CorpusReadResult<T>>}
export interface CorpusAdapterOptions {readonly supportedSpecVersions?:readonly string[]}
export interface CorpusProjection<T=unknown>{
 readonly projectionKey:string;
 readonly source:{readonly repository:"moonwitness-corpus";readonly releaseId:string;readonly specVersion:string;readonly contentHash:string;readonly canonicalId:string;readonly recordType:CorpusRecordKind};
 readonly payload:T;readonly rights?:Readonly<Record<string,unknown>>;
}