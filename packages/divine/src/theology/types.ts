import type {OntologyScope} from "../ontology/types.ts";
export type RevelationClaimKind="theological-attribution"|"canonical-recognition"|"textual-attestation"|"historical-critical"|"editorial-status";
export type PositionStance="affirms"|"denies"|"contests"|"undetermined";
export type ComparisonOutcome="comparable"|"non-equivalent"|"incomparable";
export interface RevelationResearchProfile {readonly id:string;readonly version:string;readonly scope:OntologyScope;readonly traditionRef?:string;readonly communityRef?:string;readonly description:string}
export interface RevelationClaim {readonly id:string;readonly kind:RevelationClaimKind;readonly corpusAssertionId:string;readonly scope:OntologyScope;readonly sourceRefs:readonly string[];readonly evidenceRefs:readonly string[];readonly provenanceRef:string;readonly method:string;readonly periodRef?:string;readonly note:string}
export interface TheologyPosition {readonly id:string;readonly profileId:string;readonly subjectRef:string;readonly stance:PositionStance;readonly claimRefs:readonly string[];readonly scope:OntologyScope;readonly periodRef?:string;readonly method:string;readonly sourceRefs:readonly string[]}
export interface ComparisonFrame {readonly id:string;readonly dimensions:readonly ("theological-attribution"|"canonical-recognition"|"textual-attestation"|"historical-transmission"|"editorial-status")[];readonly method:string;readonly scope:OntologyScope;readonly mappingRefs?:readonly string[]}
export interface TheologyComparison {readonly frameId:string;readonly outcome:ComparisonOutcome;readonly comparedPositionIds:readonly string[];readonly rationale:string;readonly limitations:readonly string[]}
export type DomainReviewDecision="accept-within-scope"|"request-revision"|"reject-within-scope";
export interface DomainReview {readonly id:string;readonly reviewerRef:string;readonly reviewerRole:string;readonly authorityScope:OntologyScope;readonly targetRef:string;readonly decision:DomainReviewDecision;readonly rationale:string;readonly reviewedAt:string}
export interface TheologyValidation {readonly valid:boolean;readonly diagnostics:readonly string[]}