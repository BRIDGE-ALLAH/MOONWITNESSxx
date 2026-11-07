import { DivineError } from "../errors.ts";
import { assertCorpusCanonicalId, validateCorpusIdentityRecord, validateExternalIdentifier, validateSourceLocalIdentifier } from "./identity.ts";
import { CORPUS_SPEC_VERSION } from "./types.ts";
import type {
  CorpusAdapterOptions, CorpusCanonicalId, CorpusCanonicalRecord, CorpusIdentityLookup, CorpusIdentityResolution,
  CorpusProfileDescriptor, CorpusProfileReadResult, CorpusProjection, CorpusReadResult, CorpusReader,
  CorpusRecordKind, CorpusRelease,
} from "./types.ts";

function stableKey(input: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
function assertConnected(release?: CorpusRelease): asserts release is CorpusRelease {
  if (!release) throw new DivineError("DIVINE_CORPUS_UNAVAILABLE", "Call connect() before reading Corpus.");
}
function assertProfileDescriptor(profile: CorpusProfileDescriptor): void {
  if (!/^[a-z][a-z0-9.-]*$/.test(profile.id) || !/^\d+\.\d+\.\d+$/.test(profile.version) ||
      !profile.specVersion || profile.recordTypes.length === 0 || !["draft", "stable", "deprecated"].includes(profile.status)) {
    throw new DivineError("DIVINE_CORPUS_RELEASE_INVALID", "Corpus returned an invalid profile descriptor.", { profile });
  }
}

export class CorpusAdapter {
  readonly supportedSpecVersions: readonly string[];
  private readonly reader: CorpusReader;
  private readonly identityResolver?: CorpusAdapterOptions["identityResolver"];
  private readonly profileProvider?: CorpusAdapterOptions["profileProvider"];
  private release?: CorpusRelease;

  constructor(reader: CorpusReader, options: CorpusAdapterOptions = {}) {
    this.reader = reader;
    this.identityResolver = options.identityResolver;
    this.profileProvider = options.profileProvider;
    this.supportedSpecVersions = Object.freeze([...(options.supportedSpecVersions ?? [CORPUS_SPEC_VERSION])]);
  }

  async connect(): Promise<CorpusRelease> {
    let release: CorpusRelease;
    try {
      release = await this.reader.getRelease();
    } catch (cause) {
      throw new DivineError("DIVINE_CORPUS_UNAVAILABLE", "Corpus release metadata could not be read.", {
        cause: cause instanceof Error ? cause.message : String(cause),
      });
    }
    if (!release.releaseId || !release.specVersion || !release.datasetVersion || !release.contentHash) {
      throw new DivineError("DIVINE_CORPUS_RELEASE_INVALID", "Corpus release metadata is incomplete.", { release });
    }
    if (!this.supportedSpecVersions.includes(release.specVersion)) {
      throw new DivineError("DIVINE_CORPUS_INCOMPATIBLE", "Corpus spec is outside the tested compatibility set.", {
        actual: release.specVersion, supported: this.supportedSpecVersions,
      });
    }
    this.release = Object.freeze({ ...release });
    return this.release;
  }

  get connectedRelease(): CorpusRelease | undefined {
    return this.release;
  }

  async read<T extends CorpusCanonicalRecord = CorpusCanonicalRecord>(
    kind: CorpusRecordKind,
    id: CorpusCanonicalId,
  ): Promise<CorpusReadResult<T>> {
    assertConnected(this.release);
    assertCorpusCanonicalId(id);
    const result = await this.reader.readRecord<T>(kind, id);
    if (result.status === "available" && (result.record.id !== id || result.record.record_type !== kind)) {
      throw new DivineError("DIVINE_CORPUS_RELEASE_INVALID", "Corpus returned a record with mismatched canonical identity.", {
        requestedId: id, requestedKind: kind, returnedId: result.record.id, returnedKind: result.record.record_type,
      });
    }
    if (result.status !== "available" && "canonicalId" in result) assertCorpusCanonicalId(result.canonicalId);
    return result;
  }

  async resolveIdentity(lookup: CorpusIdentityLookup): Promise<CorpusIdentityResolution> {
    assertConnected(this.release);
    if (!this.identityResolver) {
      throw new DivineError("DIVINE_CORPUS_IDENTITY_UNAVAILABLE", "No Corpus identity resolver was configured; Divine will not mint or guess canonical IDs.");
    }
    if (lookup.type === "canonical") assertCorpusCanonicalId(lookup.id);
    if (lookup.type === "source-local") validateSourceLocalIdentifier(lookup.identifier);
    if (lookup.type === "external") validateExternalIdentifier(lookup.identifier);
    if (lookup.type === "alias" && lookup.contextRef) assertCorpusCanonicalId(lookup.contextRef);
    if (lookup.type === "alias" && (!lookup.value || /[\u0000-\u001f\u007f]/.test(lookup.value))) {
      throw new DivineError("DIVINE_CORPUS_IDENTITY_INVALID", "Alias lookup requires an exact non-empty label.");
    }
    const result = await this.identityResolver.resolve(lookup);
    if (result.status === "resolved") validateCorpusIdentityRecord(result.identity);
    if (result.status === "ambiguous") result.candidates.forEach(validateCorpusIdentityRecord);
    if (result.status === "restricted" && result.canonicalId) assertCorpusCanonicalId(result.canonicalId);
    return result;
  }

  async listProfiles(): Promise<readonly CorpusProfileDescriptor[]> {
    assertConnected(this.release);
    if (!this.profileProvider) {
      throw new DivineError("DIVINE_CORPUS_PROFILE_UNAVAILABLE", "No Corpus profile provider was configured.");
    }
    const profiles = await this.profileProvider.listProfiles();
    profiles.forEach((profile) => { assertProfileDescriptor(profile); if (!this.supportedSpecVersions.includes(profile.specVersion)) throw new DivineError("DIVINE_CORPUS_INCOMPATIBLE", "Corpus profile spec is outside the tested compatibility set.", { profileId: profile.id, specVersion: profile.specVersion, supported: this.supportedSpecVersions }); });
    return Object.freeze([...profiles].sort((a, b) => a.id.localeCompare(b.id) || a.version.localeCompare(b.version)));
  }

  async readProfile(profileId: string, version: string, canonicalId: CorpusCanonicalId): Promise<CorpusProfileReadResult> {
    assertConnected(this.release);
    assertCorpusCanonicalId(canonicalId);
    if (!this.profileProvider) {
      throw new DivineError("DIVINE_CORPUS_PROFILE_UNAVAILABLE", "No Corpus profile provider was configured.");
    }
    const result = await this.profileProvider.readProfile(profileId, version, canonicalId);
    if (result.profileId !== profileId || result.version !== version || result.canonicalId !== canonicalId) {
      throw new DivineError("DIVINE_CORPUS_RELEASE_INVALID", "Corpus profile provider returned a mismatched profile identity.", {
        requested: { profileId, version, canonicalId },
        returned: { profileId: result.profileId, version: result.version, canonicalId: result.canonicalId },
      });
    }
    return result;
  }

  async project<T extends CorpusCanonicalRecord = CorpusCanonicalRecord>(
    kind: CorpusRecordKind,
    id: CorpusCanonicalId,
  ): Promise<CorpusProjection<T> | Exclude<CorpusReadResult<T>, { status: "available" }>> {
    const result = await this.read<T>(kind, id);
    if (result.status !== "available") return result;
    const release = this.release!;
    return Object.freeze({
      projectionKey: stableKey([release.releaseId, release.specVersion, release.datasetVersion, release.contentHash, kind, id].join("\u001f")),
      source: Object.freeze({
        repository: "moonwitness-corpus" as const,
        releaseId: release.releaseId,
        specVersion: release.specVersion,
        datasetVersion: release.datasetVersion,
        contentHash: release.contentHash,
        canonicalId: result.record.id,
        recordType: result.record.record_type,
      }),
      record: result.record,
      ...(result.rights ? { rights: result.rights } : {}),
    });
  }
}

export function isCorpusProjectionFresh(projection: CorpusProjection, current: CorpusRelease): boolean {
  return projection.source.releaseId === current.releaseId &&
    projection.source.specVersion === current.specVersion &&
    projection.source.datasetVersion === current.datasetVersion &&
    projection.source.contentHash === current.contentHash;
}
export function assertCorpusProjectionFresh(projection: CorpusProjection, current: CorpusRelease): void {
  if (!isCorpusProjectionFresh(projection, current)) {
    throw new DivineError("DIVINE_CORPUS_STALE_PROJECTION", "Corpus projection was derived from a different release or content hash.", {
      projection: projection.source,
      current: { releaseId: current.releaseId, specVersion: current.specVersion, contentHash: current.contentHash },
    });
  }
}
