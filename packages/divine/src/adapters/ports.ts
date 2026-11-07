import { DivineError } from "../errors.ts";
import type { DivineAddon } from "../types.ts";
import type {
  CorpusCanonicalId, CorpusIdentityLookup, CorpusIdentityResolution, CorpusProfileDescriptor,
  CorpusProfileReadResult, CorpusRecordKind, CorpusReadResult, CorpusCanonicalRecord,
} from "../corpus/types.ts";

export type DivineAdapterCapability =
  | "corpus.read" | "corpus.identity.resolve" | "corpus.profile.read"
  | "orm.read" | "arsy.addon.lifecycle" | "zill.authorize" | "mizan.assessment.read";
export interface AdapterPortDescriptor {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly DivineAdapterCapability[];
}
export interface DescribedAdapterPort { readonly descriptor: AdapterPortDescriptor }
export function assertAdapterCapabilities(port: DescribedAdapterPort, required: readonly DivineAdapterCapability[]): void {
  const missing = required.filter((capability) => !port.descriptor.capabilities.includes(capability));
  if (missing.length) {
    throw new DivineError("DIVINE_ADAPTER_CAPABILITY_MISSING", "Adapter does not provide all required capabilities.", {
      adapterId: port.descriptor.id, required, missing,
    });
  }
}
export interface CorpusReadPort extends DescribedAdapterPort {
  read<T extends CorpusCanonicalRecord = CorpusCanonicalRecord>(kind: CorpusRecordKind, id: CorpusCanonicalId): Promise<CorpusReadResult<T>>;
}
export interface CorpusIdentityPort extends DescribedAdapterPort {
  resolveIdentity(lookup: CorpusIdentityLookup): Promise<CorpusIdentityResolution>;
}
export interface CorpusProfilePort extends DescribedAdapterPort {
  listProfiles(): Promise<readonly CorpusProfileDescriptor[]>;
  readProfile(profileId: string, version: string, canonicalId: CorpusCanonicalId): Promise<CorpusProfileReadResult>;
}
/** Minimal read/invoke bridge; Divine does not prescribe model schemas or own ORM persistence. */
export interface OrmAdapterPort extends DescribedAdapterPort {
  read(modelName: string, canonicalId: CorpusCanonicalId): Promise<unknown | undefined>;
  invoke(modelName: string, methodName: string, args: readonly unknown[]): Promise<unknown>;
}
/** ARSY owns addon hosting and lifecycle; Divine only offers a registration contract. */
export interface ArsyAddonHostPort extends DescribedAdapterPort {
  register(addon: DivineAddon): Promise<void>;
  unregister(addonId: string): Promise<void>;
}
/** ZILL remains the authority for access decisions; Divine must ask rather than duplicate policy. */
export interface ZillAuthorizationPort extends DescribedAdapterPort {
  authorize(input: { readonly subjectRef: CorpusCanonicalId; readonly action: string; readonly resourceRef: CorpusCanonicalId }): Promise<{
    readonly decision: "allow" | "deny" | "indeterminate";
    readonly policyRefs: readonly CorpusCanonicalId[];
    readonly reason?: string;
  }>;
}
/** MIZAN remains the assessment authority; Divine consumes its method-bound result. */
export interface MizanAssessmentPort extends DescribedAdapterPort {
  readAssessment(assessmentRef: CorpusCanonicalId): Promise<{
    readonly assessmentRef: CorpusCanonicalId;
    readonly methodRef: CorpusCanonicalId;
    readonly outcome: "sufficient" | "insufficient" | "inconclusive";
    readonly evidenceRefs: readonly CorpusCanonicalId[];
    readonly scope: Readonly<Record<string, CorpusCanonicalId>>;
  } | undefined>;
}
