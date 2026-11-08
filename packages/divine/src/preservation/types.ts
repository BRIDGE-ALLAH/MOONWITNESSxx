export type RightsAction="ingest"|"query"|"display"|"export"|"ai-process";
export type RightsDecision="allow"|"metadata-only"|"deny";
export interface RightsPolicy {readonly resourceRef:string;readonly decisions:Readonly<Partial<Record<RightsAction,RightsDecision>>>;readonly basisRef:string;readonly reviewedAt?:string}
export interface PreservationInput {readonly artifactRef:string;readonly corpusRelease:string;readonly contentDigest:string;readonly digestAlgorithm:"sha-256";readonly derivationMethod:string;readonly methodVersion:string;readonly sourceRefs:readonly string[];readonly rightsPolicyRefs:readonly string[];readonly createdAt:string}
export interface PreservationManifest extends PreservationInput {readonly manifestVersion:"1";readonly manifestDigest:string}
export interface ResearchDecision {readonly id:string;readonly kind:"promote"|"reject"|"correct"|"supersede";readonly targetRef:string;readonly actorRef:string;readonly role:string;readonly method:string;readonly rationale:string;readonly occurredAt:string;readonly supersedes?:string}
export interface DecisionLedgerEntry {readonly decision:ResearchDecision;readonly previousDigest:string|null;readonly entryDigest:string}
export interface IntegrityReport {readonly valid:boolean;readonly checkedEntries:number;readonly firstInvalidIndex?:number;readonly reason?:string}
export interface ReviewAttribution {readonly reviewerRef:string;readonly role:string;readonly method:string;readonly reviewedAt:string;readonly decision:"approved"|"rejected"|"needs-changes"}
